// Shared client-side helpers for driving an interview turn, used by both the
// text ChatPanel and the voice-first VoicePanel so the streaming/phase/eval
// logic lives in exactly one place.

/** Strip <think>...</think> blocks some models emit. */
export function stripThink(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trimStart();
}

export interface StreamCallbacks {
  /** Called once with the detected phase index, if the server reported one. */
  onPhase?: (phase: number) => void;
  /** Called repeatedly with the cumulative, think-stripped visible text. */
  onDelta?: (visibleText: string) => void;
}

/**
 * Send one candidate turn and stream the interviewer's reply.
 * Resolves with the final visible text. Throws on a non-OK response.
 */
export async function streamInterviewReply(
  sessionId: string,
  content: string,
  isHint: boolean,
  cb: StreamCallbacks = {}
): Promise<string> {
  const res = await fetch("/api/interview/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, content, isHint }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? "Failed to get response");
  }

  const phase = res.headers.get("X-Interview-Phase");
  if (phase !== null) cb.onPhase?.(parseInt(phase, 10));

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let raw = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    raw += decoder.decode(value, { stream: true });
    cb.onDelta?.(stripThink(raw));
  }
  return stripThink(raw);
}

/** Trigger evaluation for a session. Throws on error; otherwise resolves. */
export async function endInterview(sessionId: string): Promise<void> {
  const res = await fetch("/api/interview/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data as { error?: string }).error) {
    throw new Error((data as { error?: string }).error ?? "Failed to generate evaluation");
  }
}
