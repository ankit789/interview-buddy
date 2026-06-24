import { createClient } from "@/lib/supabase/server";
import { getProblemById } from "@/lib/problems";
import { buildEvaluationPrompt } from "@/lib/prompts";
import {
  computeSignals,
  applyVerdictGuardrails,
  type SignalMessage,
} from "@/lib/interview-signals";
import { complete, keysFromSettings, NoProviderError } from "@/lib/llm";
import { summarizeCanvas, extractCode } from "@/lib/artifact-summary";
import { decryptSettings } from "@/lib/crypto";
import type { Verdict } from "@/lib/types";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { sessionId } = await req.json();

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
    .select("mistral_api_key, cerebras_api_key, groq_api_key, gemini_api_key")
    .eq("user_id", user.id)
    .single();

  const keys = keysFromSettings(decryptSettings(settings));

  const { data: messages } = await supabase
    .from("interview_messages")
    .select("role, content, message_type")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  const msgs = (messages ?? []) as SignalMessage[];

  const transcriptBody = msgs
    .map((m) => `${m.role === "user" ? "Candidate" : "Interviewer"}: ${m.content}`)
    .join("\n\n");

  // Include a textual summary of the candidate's whiteboard so the evaluator judges the
  // actual diagram (components + connections), not just the chat transcript.
  const canvasSummary = summarizeCanvas(session.canvas_state);
  const codeArtifact = extractCode(session.code_state);
  let transcript = transcriptBody;
  if (canvasSummary) {
    transcript += `\n\n[CANDIDATE'S WHITEBOARD DIAGRAM]\nThe candidate drew an architecture diagram: ${canvasSummary} Judge whether the right components are present, connected, and the data flow is coherent.`;
  }
  if (codeArtifact) {
    transcript += `\n\n[CANDIDATE'S CODE — ${codeArtifact.language}]\n\`\`\`${codeArtifact.language}\n${codeArtifact.code}\n\`\`\``;
  }

  // Compute behavioral interaction signals from the session
  const signals = computeSignals(session.interview_type, msgs);

  const evalPrompt = buildEvaluationPrompt(
    problem,
    session.interview_type,
    transcript,
    !!session.canvas_state,
    signals,
    session.target_level ?? "senior"
  );

  // Self-consistency: a single LLM eval can land ~1-1.5 points off the consensus, which can
  // flip a borderline verdict. Run the eval a few times and take the median-total result.
  const EVAL_SAMPLES = 3;
  const candidates: Record<string, unknown>[] = [];
  let lastError = "";
  for (let i = 0; i < EVAL_SAMPLES; i++) {
    try {
      const { text } = await complete(keys, [{ role: "user", content: evalPrompt }], {
        maxTokens: 4000,
        temperature: 0.3,
        json: true,
      });
      const stripped = text.replace(/^```json?\n?/m, "").replace(/\n?```$/m, "");
      const match = stripped.match(/\{[\s\S]*\}/);
      candidates.push(JSON.parse(match ? match[0] : stripped));
    } catch (e) {
      if (e instanceof NoProviderError) {
        return Response.json({ error: e.message }, { status: 400 });
      }
      lastError = e instanceof Error ? e.message : "eval error";
    }
  }

  if (candidates.length === 0) {
    console.error("All evaluation samples failed:", lastError);
    return Response.json({ error: "Failed to evaluate: " + lastError }, { status: 502 });
  }

  // Pick the sample whose total is the median — a representative, internally-coherent result.
  candidates.sort((a, b) => (Number(a.total) || 0) - (Number(b.total) || 0));
  const evaluation = candidates[Math.floor(candidates.length / 2)];

  // Apply deterministic guardrails — a serious behavioral flag caps the verdict.
  const rawVerdict = (evaluation.verdict as Verdict) ?? "Not Ready";
  const { verdict, capReason } = applyVerdictGuardrails(rawVerdict, signals);

  const signalsRecord = { ...signals, capReason };

  // The evaluator JSON omits per-dimension max; every dimension is scored 0-3.
  // Stamping max explicitly keeps each record self-describing, so legacy 0-2 sessions
  // and new 0-3 sessions both normalize correctly in analytics.
  const scores = ((evaluation.scores as { max?: number }[] | undefined) ?? []).map((s) => ({
    ...s,
    max: typeof s.max === "number" ? s.max : 3,
  }));

  // Save evaluation
  const { data: saved, error: saveError } = await supabase
    .from("interview_evaluations")
    .insert({
      session_id: sessionId,
      scores,
      total: evaluation.total,
      verdict,
      covered: evaluation.covered ?? [],
      missed: evaluation.missed ?? [],
      stalled: evaluation.stalled ?? [],
      study_next: evaluation.study_next ?? [],
      feedback: evaluation.feedback ?? "",
      signals: signalsRecord,
    })
    .select("id")
    .single();

  if (saveError) {
    console.error("Failed to save evaluation:", saveError);
    return Response.json({ error: "Failed to save evaluation: " + saveError.message }, { status: 500 });
  }

  // Mark session completed
  await supabase
    .from("interview_sessions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", sessionId);

  return Response.json({
    evaluationId: saved?.id,
    ...evaluation,
    verdict,
    signals: signalsRecord,
  });
}
