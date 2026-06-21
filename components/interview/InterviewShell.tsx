"use client";

import { useState, useCallback, useRef } from "react";
import { PhaseBar } from "./PhaseBar";
import { Timer } from "./Timer";
import { ChatPanel } from "./ChatPanel";
import { ExcalidrawPanel } from "./ExcalidrawPanel";
import { CodeEditorPanel } from "./CodeEditorPanel";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { getPhases } from "@/lib/prompts";
import type { InterviewSession, InterviewMessage, Problem } from "@/lib/types";
import type { ExcalidrawElement } from "@/lib/excalidraw-types";
import Link from "next/link";

interface InterviewShellProps {
  session: InterviewSession;
  problem: Problem;
  initialMessages: Pick<InterviewMessage, "role" | "content" | "message_type">[];
}

const MIN_CANVAS_PCT = 30;
const MAX_CANVAS_PCT = 75;
const DEFAULT_CANVAS_PCT = 60;

export function InterviewShell({
  session,
  problem,
  initialMessages,
}: InterviewShellProps) {
  const [currentPhase, setCurrentPhase] = useState(0);
  const [diagramFeedbackLoading, setDiagramFeedbackLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState(() =>
    initialMessages.map((m) =>
      m.role === "assistant"
        ? { ...m, content: m.content.replace(/<think>[\s\S]*?<\/think>/g, "").trimStart() }
        : m
    )
  );
  const [canvasPct, setCanvasPct] = useState(DEFAULT_CANVAS_PCT);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const phases = getPhases(session.interview_type);
  const isSystemDesign = session.interview_type === "system_design";
  const isLld = session.interview_type === "lld";
  // Both SD and LLD use a resizable side panel; only the left-hand tool differs.
  const hasSidePanel = isSystemDesign || isLld;

  const handleDiagramFeedback = useCallback(
    async (elements: ExcalidrawElement[]) => {
      if (diagramFeedbackLoading) return;
      setDiagramFeedbackLoading(true);
      try {
        const res = await fetch("/api/interview/diagram-feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: session.id,
            elements: elements.map((el) => ({
              id: el.id,
              type: el.type,
              x: el.x,
              y: el.y,
              label: (el as unknown as { label?: { text?: string } }).label?.text ?? "",
            })),
          }),
        });
        const data = await res.json();
        if (data.feedback) {
          setChatMessages((m) => [
            ...m,
            {
              role: "assistant" as const,
              content: data.feedback,
              message_type: "diagram_feedback" as const,
            },
          ]);
        }
      } finally {
        setDiagramFeedbackLoading(false);
      }
    },
    [session.id, diagramFeedbackLoading]
  );

  function onDividerMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function onMouseMove(e: MouseEvent) {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setCanvasPct(Math.min(MAX_CANVAS_PCT, Math.max(MIN_CANVAS_PCT, pct)));
    }

    function onMouseUp() {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="shrink-0 border-b border-border bg-background/95 backdrop-blur-sm px-4 h-12 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            ← back
          </Link>
          <span className="text-muted-foreground/40">|</span>
          <span className="text-sm font-medium truncate">{problem.title}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <PhaseBar phases={phases} currentPhase={currentPhase} />
          <Timer totalMinutes={problem.timeMinutes} />
          <ThemeToggle />
        </div>
      </header>

      {/* Mobile notice */}
      <div className="md:hidden flex-1 flex items-center justify-center p-8 text-center">
        <div className="space-y-3">
          <p className="text-2xl">💻</p>
          <p className="font-medium">Best on desktop</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            The interview experience requires a larger screen.
          </p>
        </div>
      </div>

      {/* Main content — desktop only */}
      <div ref={containerRef} className="hidden md:flex flex-1 overflow-hidden">
        {hasSidePanel ? (
          <>
            {/* Tool panel — whiteboard for SD, code editor for LLD */}
            <div
              className="flex flex-col overflow-hidden"
              style={{ width: `${canvasPct}%` }}
            >
              {isSystemDesign ? (
                <ExcalidrawPanel
                  sessionId={session.id}
                  initialCanvasState={session.canvas_state}
                  onRequestDiagramFeedback={handleDiagramFeedback}
                  diagramFeedbackLoading={diagramFeedbackLoading}
                />
              ) : (
                <CodeEditorPanel
                  sessionId={session.id}
                  initialCodeState={session.code_state}
                />
              )}
            </div>

            {/* Drag handle */}
            <div
              onMouseDown={onDividerMouseDown}
              className="w-1 shrink-0 bg-border hover:bg-primary/50 cursor-col-resize transition-colors relative group"
              title="Drag to resize"
            >
              {/* Visual grip dots */}
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-0.5 h-0.5 rounded-full bg-primary/80" />
                ))}
              </div>
            </div>

            {/* Chat panel */}
            <div
              className="flex flex-col overflow-hidden"
              style={{ width: `${100 - canvasPct}%` }}
            >
              <ChatPanel
                sessionId={session.id}
                messages={chatMessages}
                onMessages={setChatMessages}
                onPhaseChange={setCurrentPhase}
                problem={problem}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 max-w-3xl mx-auto flex flex-col overflow-hidden">
            <ChatPanel
              sessionId={session.id}
              messages={chatMessages}
              onMessages={setChatMessages}
              onPhaseChange={setCurrentPhase}
              problem={problem}
            />
          </div>
        )}
      </div>
    </div>
  );
}
