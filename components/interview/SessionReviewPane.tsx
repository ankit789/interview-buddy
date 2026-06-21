"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Loader2, PanelRight, PenLine, MessagesSquare, Code2 } from "lucide-react";
import type { ExcalidrawElement } from "@/lib/excalidraw-types";
import type { CodeState } from "@/lib/types";

const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading whiteboard…
      </div>
    ),
  }
);

type Msg = {
  role: "user" | "assistant";
  content: string;
  message_type: "chat" | "hint" | "diagram_feedback";
};

interface Props {
  messages: Msg[];
  canvasState: Record<string, unknown> | null;
  /** True for system-design sessions, which have a whiteboard. */
  hasWhiteboard: boolean;
  /** Code the candidate wrote — present for LLD sessions. */
  codeState?: CodeState | null;
}

type Tab = "whiteboard" | "code" | "transcript";

export function SessionReviewPane({ messages, canvasState, hasWhiteboard, codeState }: Props) {
  const elements = (canvasState?.elements as ExcalidrawElement[] | undefined) ?? [];
  const hasDiagram = hasWhiteboard && elements.length > 0;
  const code = codeState?.code?.trim() ?? "";
  const hasCode = code.length > 0;
  const [tab, setTab] = useState<Tab>(
    hasDiagram ? "whiteboard" : hasCode ? "code" : "transcript"
  );

  const triggerLabel = hasWhiteboard
    ? "Whiteboard & transcript"
    : hasCode
    ? "Code & transcript"
    : "Transcript";

  return (
    <Sheet>
      <SheetTrigger
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border border-border",
          "text-foreground bg-card hover:bg-card/70 hover:border-border/60 transition-colors"
        )}
      >
        <PanelRight className="w-4 h-4" />
        {triggerLabel}
      </SheetTrigger>

      <SheetContent
        side="right"
        className={cn(
          "p-0 gap-0",
          // Give the whiteboard most of the screen; keep the transcript a
          // comfortable reading width.
          tab === "whiteboard"
            ? "w-full sm:!max-w-[min(96vw,1280px)]"
            : tab === "code"
            ? "w-full sm:!max-w-3xl"
            : "w-full sm:!max-w-2xl"
        )}
      >
        <SheetHeader className="border-b border-border px-4 py-3 gap-3">
          <SheetTitle className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Session review
          </SheetTitle>
          {/* Tabs */}
          <div className="flex items-center gap-1">
            {hasWhiteboard && (
              <TabButton
                active={tab === "whiteboard"}
                onClick={() => setTab("whiteboard")}
                icon={<PenLine className="w-3.5 h-3.5" />}
                label="Whiteboard"
              />
            )}
            {hasCode && (
              <TabButton
                active={tab === "code"}
                onClick={() => setTab("code")}
                icon={<Code2 className="w-3.5 h-3.5" />}
                label={codeState?.language ? `Code · ${codeState.language}` : "Code"}
              />
            )}
            <TabButton
              active={tab === "transcript"}
              onClick={() => setTab("transcript")}
              icon={<MessagesSquare className="w-3.5 h-3.5" />}
              label={`Transcript (${messages.length})`}
            />
          </div>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-hidden">
          {tab === "whiteboard" && hasWhiteboard && (
            <div className="h-full w-full relative">
              {hasDiagram ? (
                <Excalidraw
                  excalidrawAPI={(api: any) => {
                    // Fit the whole diagram into the pane once it mounts.
                    setTimeout(() => {
                      try {
                        api.scrollToContent(api.getSceneElements(), {
                          fitToContent: true,
                          animate: false,
                        });
                      } catch {
                        /* best-effort */
                      }
                    }, 120);
                  }}
                  initialData={
                    {
                      elements,
                      appState: { viewBackgroundColor: "#ffffff" },
                      scrollToContent: true,
                    } as any
                  }
                  viewModeEnabled
                  theme="light"
                  UIOptions={{
                    canvasActions: {
                      saveAsImage: true,
                      loadScene: false,
                      export: false,
                      toggleTheme: false,
                    },
                  }}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  No diagram was drawn in this session.
                </div>
              )}
            </div>
          )}

          {tab === "code" && hasCode && (
            <div className="h-full overflow-auto bg-muted/30">
              <pre className="font-mono text-xs leading-relaxed p-4 min-w-full w-max">
                <code className="text-foreground">{code}</code>
              </pre>
            </div>
          )}

          {tab === "transcript" && (
            <div className="h-full overflow-y-auto px-4 py-4 space-y-5">
              {messages.length === 0 && (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  No messages in this session.
                </div>
              )}
              {messages.map((m, i) => (
                <TranscriptMessage key={i} message={m} />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors",
        active
          ? "border-primary text-primary bg-primary/5"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function TranscriptMessage({ message }: { message: Msg }) {
  const isUser = message.role === "user";
  const isDiagramFeedback = message.message_type === "diagram_feedback";

  return (
    <div className={cn("space-y-1", isUser && "pl-2")}>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
          {isUser ? "you" : isDiagramFeedback ? "diagram feedback" : "interviewer"}
        </span>
        {message.message_type === "hint" && (
          <span className="font-mono text-[10px] text-[oklch(0.75_0.18_80)] bg-[oklch(0.75_0.18_80)]/10 px-1.5 py-0.5 rounded">
            hint
          </span>
        )}
        {isDiagramFeedback && (
          <span className="font-mono text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
            canvas
          </span>
        )}
      </div>
      <div
        className={cn(
          "text-sm leading-relaxed",
          isUser ? "text-muted-foreground" : "text-foreground",
          isDiagramFeedback && "text-primary/90 border-l-2 border-primary/30 pl-3"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <ReactMarkdown
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="mb-2 pl-4 space-y-0.5 list-disc">{children}</ul>,
              ol: ({ children }) => <ol className="mb-2 pl-4 space-y-0.5 list-decimal">{children}</ol>,
              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
              code: ({ children }) => (
                <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">{children}</code>
              ),
              pre: ({ children }) => (
                <pre className="font-mono text-xs bg-muted rounded p-3 mb-2 overflow-x-auto leading-[1.15]">{children}</pre>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}
