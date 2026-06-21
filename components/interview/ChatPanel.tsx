"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Send, Lightbulb, StopCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import type { InterviewMessage } from "@/lib/types";
import ReactMarkdown from "react-markdown";

type Msg = Pick<InterviewMessage, "role" | "content" | "message_type">;

interface ChatPanelProps {
  sessionId: string;
  messages: Msg[];
  onMessages: (updater: (prev: Msg[]) => Msg[]) => void;
  onPhaseChange: (phase: number) => void;
  problem: { title: string; description: string };
}

// Strip <think>...</think> blocks DeepSeek R1 emits
function stripThink(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trimStart();
}

export function ChatPanel({
  sessionId,
  messages,
  onMessages,
  onPhaseChange,
  problem,
}: ChatPanelProps) {
  const [problemOpen, setProblemOpen] = useState(true);
  const router = useRouter();
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [input]);

  const sendMessage = useCallback(
    async (content: string, isHint = false) => {
      if (!content.trim() || streaming) return;
      setError(null);

      // Add user message immediately
      onMessages((prev) => [
        ...prev,
        { role: "user", content, message_type: isHint ? "hint" : "chat" } as Msg,
      ]);
      setInput("");
      setStreaming(true);

      // Add empty assistant placeholder
      onMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", message_type: "chat" } as Msg,
      ]);

      try {
        const res = await fetch("/api/interview/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, content, isHint }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to get response");
        }

        const phase = res.headers.get("X-Interview-Phase");
        if (phase !== null) onPhaseChange(parseInt(phase, 10));

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let raw = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          raw += decoder.decode(value, { stream: true });
          const visible = stripThink(raw);
          onMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: visible,
              message_type: "chat",
            };
            return updated;
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
        // Remove the empty placeholder on error
        onMessages((prev) => prev.slice(0, -1));
      } finally {
        setStreaming(false);
      }
    },
    [sessionId, streaming, onMessages, onPhaseChange]
  );

  async function endSession() {
    if (ending) return;
    setEnding(true);
    try {
      const res = await fetch("/api/interview/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      router.push(`/interview/${sessionId}/result`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate evaluation");
      setEnding(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const userMessageCount = messages.filter((m) => m.role === "user").length;
  const canEnd = !streaming && !ending;
  const [confirmEnd, setConfirmEnd] = useState(false);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Problem statement panel */}
      <div className="shrink-0 border-b border-border bg-card/50">
        <button
          onClick={() => setProblemOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-card/80 transition-colors"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest shrink-0">
              Problem
            </span>
            <span className="text-xs font-medium text-foreground truncate">
              {problem.title}
            </span>
          </div>
          {problemOpen ? (
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          )}
        </button>
        {problemOpen && (
          <div className="px-4 pb-3 pt-0.5">
            <p className="text-xs text-foreground/75 leading-relaxed">
              {problem.description}
            </p>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 min-h-0">
        {messages.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Send a message to start the interview.
          </div>
        )}
        {messages.map((msg, i) => (
          <Message key={i} message={msg} />
        ))}
        {streaming && messages[messages.length - 1]?.content === "" && (
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-mono">
            <Loader2 className="w-3 h-3 animate-spin" />
            thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 px-3 py-2 text-xs text-destructive bg-destructive/10 rounded border border-destructive/20">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 border-t border-border p-3 space-y-2 bg-background">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={streaming || ending}
            placeholder="Type your answer… (⌘+Enter to send)"
            rows={1}
            className={cn(
              "flex-1 resize-none bg-input border border-border rounded-md px-3 py-2 text-sm",
              "placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors",
              "disabled:opacity-50 min-h-[38px] max-h-[120px]"
            )}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || streaming || ending}
            className={cn(
              "w-9 h-9 flex items-center justify-center rounded-md border transition-colors shrink-0",
              input.trim() && !streaming
                ? "bg-primary text-primary-foreground border-primary hover:bg-primary/80"
                : "border-border text-muted-foreground opacity-40 cursor-not-allowed"
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => sendMessage("Can I get a hint?", true)}
            disabled={streaming || ending}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border hover:border-border/60 rounded-md transition-colors disabled:opacity-40"
          >
            <Lightbulb className="w-3.5 h-3.5" />
            Hint
          </button>

          {confirmEnd ? (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-muted-foreground">End interview?</span>
              <button
                onClick={() => { setConfirmEnd(false); endSession(); }}
                className="px-2.5 py-1.5 text-xs font-medium text-destructive border border-destructive/40 bg-destructive/5 hover:bg-destructive/10 rounded-md transition-colors"
              >
                Yes, end
              </button>
              <button
                onClick={() => setConfirmEnd(false)}
                className="px-2.5 py-1.5 text-xs text-muted-foreground border border-border hover:text-foreground rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => userMessageCount < 3 ? setConfirmEnd(true) : endSession()}
              disabled={!canEnd}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-destructive border border-border hover:border-destructive/40 rounded-md transition-colors disabled:opacity-40 ml-auto"
            >
              {ending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <StopCircle className="w-3.5 h-3.5" />
              )}
              {ending ? "Evaluating…" : "End & Evaluate"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Message({ message }: { message: Msg }) {
  const isUser = message.role === "user";
  const isDiagramFeedback = message.message_type === "diagram_feedback";

  return (
    <div className={cn("space-y-1", isUser && "pl-2")}>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
          {isUser ? "you" : isDiagramFeedback ? "diagram feedback" : "interviewer"}
        </span>
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
        {message.content ? (
          isUser ? (
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
                  <pre className="font-mono text-xs bg-muted rounded p-3 mb-2 overflow-x-auto">{children}</pre>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          )
        ) : (
          <span className="text-muted-foreground/40 italic">…</span>
        )}
      </div>
    </div>
  );
}
