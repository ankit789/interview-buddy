"use client";

import { useRef, useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, RefreshCw } from "lucide-react";
import type { ExcalidrawElement, AppState } from "@/lib/excalidraw-types";
import { useAppTheme } from "@/hooks/useAppTheme";

// Canvas palette per theme. On dark we use Excalidraw's own dark canvas and a
// light default stroke so freshly drawn shapes are visible (a black default
// stroke vanishes on a dark canvas).
const CANVAS_BG = { dark: "#121212", light: "#ffffff" } as const;
const STROKE = { dark: "#e8e8e8", light: "#1e1e1e" } as const;

const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading canvas…
      </div>
    ),
  }
);

interface ExcalidrawPanelProps {
  sessionId: string;
  initialCanvasState: Record<string, unknown> | null;
  onRequestDiagramFeedback: (elements: ExcalidrawElement[]) => void;
  diagramFeedbackLoading: boolean;
}

export function ExcalidrawPanel({
  sessionId,
  initialCanvasState,
  onRequestDiagramFeedback,
  diagramFeedbackLoading,
}: ExcalidrawPanelProps) {
  const excalidrawRef = useRef<{ getSceneElements: () => readonly ExcalidrawElement[] } | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saved, setSaved] = useState(true);
  const theme = useAppTheme();

  const saveCanvas = useCallback(
    async (elements: readonly ExcalidrawElement[], _appState: AppState) => {
      setSaved(false);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await fetch("/api/interview/canvas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId,
              canvasState: {
                elements,
                appState: { viewBackgroundColor: CANVAS_BG[theme] },
              },
            }),
          });
          setSaved(true);
        } catch {
          // best-effort
        }
      }, 2000);
    },
    [sessionId, theme]
  );

  function handleGetFeedback() {
    const elements = excalidrawRef.current?.getSceneElements();
    if (elements) onRequestDiagramFeedback(elements as ExcalidrawElement[]);
  }

  const initialData = {
    elements: (initialCanvasState?.elements as ExcalidrawElement[]) ?? [],
    appState: {
      viewBackgroundColor: CANVAS_BG[theme],
      currentStrokeColor: STROKE[theme],
      currentBackgroundColor: "transparent",
      // Default to rectangle tool
      activeTool: {
        type: "rectangle",
        locked: false,
        customType: null,
        lastActiveTool: null,
      },
    },
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-1 relative min-h-0">
        <div style={{ position: "absolute", inset: 0 }}>
          <Excalidraw
            excalidrawAPI={(api: any) => {
              excalidrawRef.current = api as unknown as {
                getSceneElements: () => readonly ExcalidrawElement[];
              };
              // Expose the API for end-to-end automation (read/scene access).
              // Dev/test only — never attach in production, where it would
              // hand any page script full read/write access to the canvas.
              if (
                process.env.NODE_ENV !== "production" &&
                typeof window !== "undefined"
              ) {
                (window as unknown as { __excalidrawAPI?: unknown }).__excalidrawAPI = api;
              }
            }}
            initialData={initialData as any}
            theme={theme}
            onChange={saveCanvas as any}
            UIOptions={{
              canvasActions: {
                saveAsImage: false,
                loadScene: false,
                export: false,
                toggleTheme: false,
              },
            }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-border px-3 py-2 flex items-center justify-between bg-background">
        <span className="font-mono text-[10px] text-muted-foreground/50">
          {saved ? "canvas saved" : "saving…"}
        </span>
        <button
          onClick={handleGetFeedback}
          disabled={diagramFeedbackLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 bg-primary/5 hover:bg-primary/10 rounded-md transition-colors disabled:opacity-50"
        >
          {diagramFeedbackLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Diagram Feedback
        </button>
      </div>
    </div>
  );
}
