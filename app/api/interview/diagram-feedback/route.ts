import { createClient } from "@/lib/supabase/server";
import { getProblemById } from "@/lib/problems";
import { buildDiagramFeedbackPrompt } from "@/lib/prompts";
import { decryptSettings } from "@/lib/crypto";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { sessionId, elements } = await req.json();

  const { data: session } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (!session) return new Response("Not found", { status: 404 });

  const problem = getProblemById(session.problem_id);
  if (!problem) return new Response("Problem not found", { status: 404 });

  const { data: settings } = await supabase
    .from("user_settings")
    .select("anthropic_api_key")
    .eq("user_id", user.id)
    .single();

  const apiKey = decryptSettings(settings)?.anthropic_api_key;
  if (!apiKey) {
    return Response.json(
      { error: "Anthropic API key not configured. Go to Settings to add it." },
      { status: 400 }
    );
  }

  // Get recent transcript for context
  const { data: messages } = await supabase
    .from("interview_messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(10);

  const transcript = (messages ?? [])
    .reverse()
    .map((m) => `${m.role === "user" ? "Candidate" : "Interviewer"}: ${m.content}`)
    .join("\n\n");

  const anthropic = new Anthropic({ apiKey });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: buildDiagramFeedbackPrompt(problem, elements, transcript),
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  let result: { feedback: string; annotations: { note: string; elementId: string | null }[] };
  try {
    result = JSON.parse(text);
  } catch {
    result = { feedback: text, annotations: [] };
  }

  // Save as a message
  await supabase.from("interview_messages").insert({
    session_id: sessionId,
    role: "assistant",
    content: result.feedback,
    message_type: "diagram_feedback",
  });

  return Response.json(result);
}
