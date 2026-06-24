import { createClient } from "@/lib/supabase/server";
import { getProblemById } from "@/lib/problems";
import { buildInterviewerSystemPrompt, detectPhaseFromMessages } from "@/lib/prompts";
import { isAskingForAnswer } from "@/lib/interview-signals";
import { summarizeCanvas, extractCode } from "@/lib/artifact-summary";
import { decryptSettings } from "@/lib/crypto";
import { streamChat, keysFromSettings, NoProviderError } from "@/lib/llm";

// The candidate's code can be long; cap what we feed into each live interviewer turn so the
// prompt stays bounded while still giving the interviewer the real structure to probe.
const LIVE_CODE_MAX = 6000;

// Build a "you can see this" snapshot of the candidate's whiteboard + code editor so the
// interviewer can reference the actual artifact instead of asking them to describe it.
function buildWorkspaceContext(
  canvasState: Record<string, unknown> | null,
  codeState: Record<string, unknown> | null
): string {
  const parts: string[] = [];
  const canvas = summarizeCanvas(canvasState);
  if (canvas) parts.push(`WHITEBOARD (the candidate's current diagram): ${canvas}`);
  const code = extractCode(codeState);
  if (code) {
    const shown =
      code.code.length > LIVE_CODE_MAX
        ? code.code.slice(0, LIVE_CODE_MAX) + "\n… (truncated — more below the cutoff)"
        : code.code;
    parts.push(
      `CODE EDITOR (${code.language}) — the candidate's current code:\n\`\`\`${code.language}\n${shown}\n\`\`\``
    );
  }
  if (parts.length === 0) return "";
  return `\n\nLIVE WORKSPACE — you can SEE the candidate's whiteboard and code editor right now. Reference what is actually there: probe specific components/classes they drew or wrote, point at gaps, and challenge their choices. Do NOT ask them to describe what you can already see.\n\n${parts.join(
    "\n\n"
  )}`;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { sessionId, content, isHint } = await req.json();

  // Fetch session
  const { data: session } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (!session) return new Response("Not found", { status: 404 });

  const problem = getProblemById(session.problem_id);
  if (!problem) return new Response("Problem not found", { status: 404 });

  // Fetch user API keys (any of Mistral / Cerebras / Groq / Gemini)
  const { data: settings } = await supabase
    .from("user_settings")
    .select("mistral_api_key, cerebras_api_key, groq_api_key, gemini_api_key")
    .eq("user_id", user.id)
    .single();

  const keys = keysFromSettings(decryptSettings(settings));

  // Fetch message history
  const { data: history } = await supabase
    .from("interview_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const messages = (history ?? []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const isAnswerFishing = !isHint && isAskingForAnswer(content);

  const userContent = isHint
    ? `[The candidate is requesting a hint] ${content}`
    : isAnswerFishing
    ? `[SYSTEM NOTE: The candidate is asking you a question they should be answering themselves. Do NOT answer it. Flip it back to them with a Socratic question.] ${content}`
    : content;

  // Save user message
  await supabase.from("interview_messages").insert({
    session_id: sessionId,
    role: "user",
    content,
    message_type: isHint ? "hint" : "chat",
  });

  const systemPrompt =
    buildInterviewerSystemPrompt(
      problem,
      session.interview_type,
      session.target_level ?? "senior"
    ) + buildWorkspaceContext(session.canvas_state, session.code_state);

  let stream;
  try {
    ({ stream } = await streamChat(
      keys,
      [
        { role: "system", content: systemPrompt },
        ...messages,
        { role: "user", content: userContent },
      ],
      { maxTokens: 900, temperature: 0.7 }
    ));
  } catch (e) {
    const status = e instanceof NoProviderError ? 400 : 502;
    const msg = e instanceof Error ? e.message : "LLM provider error";
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Detect current phase from conversation so far (includes the new user message)
  const allMessages = [
    ...messages,
    { role: "user", content: userContent },
  ];
  const detectedPhase = detectPhaseFromMessages(session.interview_type, allMessages);

  // Stream response back
  let fullText = "";

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) {
            fullText += delta;
            controller.enqueue(new TextEncoder().encode(delta));
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Stream error";
        controller.enqueue(new TextEncoder().encode(`\n\n[Error: ${msg}]`));
      } finally {
        controller.close();
        if (fullText) {
          const cleanText = fullText
            .replace(/<think>[\s\S]*?<\/think>/g, "")
            .trimStart();
          await supabase.from("interview_messages").insert({
            session_id: sessionId,
            role: "assistant",
            content: cleanText,
            message_type: "chat",
          });
        }
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
      "X-Interview-Phase": String(detectedPhase),
    },
  });
}
