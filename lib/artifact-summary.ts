// Summarizers for the candidate's whiteboard and code, shared by the live interviewer
// (so it can SEE and probe the artifacts mid-interview) and the evaluator (so they count
// toward the score). Keeping one implementation avoids the two routes drifting apart.

// Turn the stored Excalidraw canvas into a short text description: component labels +
// how many boxes/connections. Returns null when there's nothing meaningful drawn.
export function summarizeCanvas(
  canvasState: Record<string, unknown> | null
): string | null {
  const elements = canvasState?.elements as
    | { type?: string; text?: string; isDeleted?: boolean }[]
    | undefined;
  if (!Array.isArray(elements) || elements.length === 0) return null;

  const labels: string[] = [];
  let shapes = 0;
  let arrows = 0;
  for (const el of elements) {
    if (!el || el.isDeleted) continue;
    const t = el.text?.trim();
    if (el.type === "text") {
      if (t) labels.push(t);
    } else if (el.type === "arrow" || el.type === "line") {
      arrows++;
    } else if (el.type === "rectangle" || el.type === "ellipse" || el.type === "diamond") {
      shapes++;
      if (t) labels.push(t);
    }
  }
  const cleanLabels = [...new Set(labels.filter(Boolean))];
  if (shapes === 0 && arrows === 0 && cleanLabels.length === 0) return null;
  return `${shapes} component box(es) and ${arrows} connection(s)/arrow(s). Labeled components: ${
    cleanLabels.length ? cleanLabels.join(", ") : "(none labeled)"
  }.`;
}

export interface CodeArtifact {
  language: string;
  code: string;
}

// Pull the candidate's code out of code_state, ignoring an untouched starter (just the seed
// comment, no real declarations). Returns null when there's no meaningful code.
export function extractCode(
  codeState: Record<string, unknown> | null
): CodeArtifact | null {
  const code = (codeState?.code as string | undefined)?.trim();
  if (!code) return null;
  const meaningful = code
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("//") && !l.trim().startsWith("#"));
  if (meaningful.length === 0) return null;
  const language = (codeState?.language as string | undefined) ?? "code";
  return { language, code };
}
