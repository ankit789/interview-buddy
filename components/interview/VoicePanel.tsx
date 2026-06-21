"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Mic, Square, Volume2, VolumeX, Loader2, Lightbulb, StopCircle, Keyboard, Send } from "lucide-react";
import type { InterviewMessage } from "@/lib/types";
import { streamInterviewReply, endInterview } from "@/lib/interview-client";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

type Msg = Pick<InterviewMessage, "role" | "content" | "message_type">;

interface VoicePanelProps {
  sessionId: string;
  messages: Msg[];
  onMessages: (updater: (prev: Msg[]) => Msg[]) => void;
  onPhaseChange: (phase: number) => void;
  problem: { title: string; description: string };
}

function plainSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " code omitted ")
    .replace(/[*_`#>]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1");
}

export function VoicePanel({
  sessionId,
  messages,
  onMessages,
  onPhaseChange,
  problem,
}: VoicePanelProps) {
  const router = useRouter();
  const { supported, listening, finalText, interim, error: sttError, start, stop, reset } =
    useSpeechRecognition();

  const [streaming, setStreaming] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showText, setShowText] = useState(false);
  const [textInput, setTextInput] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingSendRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const stopSpeaking = useCallback(() => {
    try {
      audioRef.current?.pause();
    } catch {
      /* noop */
    }
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  const browserSpeak = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(plainSpeech(text));
    u.rate = 1.02;
    u.onend = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }, []);

  const speak = useCallback(
    async (text: string) => {
      setSpeaking(true);
      try {
        const res = await fetch("/api/interview/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const type = res.headers.get("Content-Type") ?? "";
        if (res.ok && type.includes("audio")) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = audioRef.current ?? new Audio();
          audioRef.current = audio;
          audio.src = url;
          audio.onended = () => {
            setSpeaking(false);
            URL.revokeObjectURL(url);
          };
          audio.onerror = () => {
            URL.revokeObjectURL(url);
            browserSpeak(text);
          };
          await audio.play();
          return;
        }
        // 503 (no provider) / 502 (provider error) → browser voice.
        browserSpeak(text);
      } catch {
        browserSpeak(text);
      }
    },
    [browserSpeak]
  );

  const handleSend = useCallback(
    async (content: string, isHint = false) => {
      if (!content.trim() || streaming) return;
      stopSpeaking();
      setError(null);
      setTextInput("");

      onMessages((prev) => [
        ...prev,
        { role: "user", content, message_type: isHint ? "hint" : "chat" } as Msg,
        { role: "assistant", content: "", message_type: "chat" } as Msg,
      ]);
      setStreaming(true);

      try {
        const finalReply = await streamInterviewReply(sessionId, content, isHint, {
          onPhase: onPhaseChange,
          onDelta: (visible) =>
            onMessages((prev) => {
              const u = [...prev];
              u[u.length - 1] = { role: "assistant", content: visible, message_type: "chat" };
              return u;
            }),
        });
        if (finalReply) speak(finalReply);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
        onMessages((prev) => prev.slice(0, -1));
      } finally {
        setStreaming(false);
      }
    },
    [sessionId, streaming, onMessages, onPhaseChange, speak, stopSpeaking]
  );

  // When the mic stops after a send-intent, dispatch the captured transcript.
  useEffect(() => {
    if (!listening && pendingSendRef.current) {
      pendingSendRef.current = false;
      const text = `${finalText} ${interim}`.trim();
      reset();
      if (text) handleSend(text);
    }
  }, [listening, finalText, interim, reset, handleSend]);

  function toggleMic() {
    if (streaming) return;
    if (listening) {
      pendingSendRef.current = true;
      stop();
    } else {
      stopSpeaking();
      start();
    }
  }

  async function handleEnd() {
    if (ending) return;
    stopSpeaking();
    stop();
    setEnding(true);
    try {
      await endInterview(sessionId);
      router.push(`/interview/${sessionId}/result`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate evaluation");
      setEnding(false);
    }
  }

  const lastInterviewer = [...messages].reverse().find((m) => m.role === "assistant" && m.content);
  const liveTranscript = `${finalText} ${interim}`.trim();
  const userTurns = messages.filter((m) => m.role === "user").length;

  return (
    <div className="flex flex-col h-full min-h-0 bg-gradient-to-b from-background to-card/30">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[10px] text-primary uppercase tracking-widest shrink-0">
            ● Voice
          </span>
          <span className="text-xs text-muted-foreground truncate">{problem.title}</span>
        </div>
        <button
          onClick={() => setShowText((v) => !v)}
          className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground border border-border rounded-md transition-colors"
        >
          <Keyboard className="w-3.5 h-3.5" />
          {showText ? "Hide" : "Type"}
        </button>
      </div>

      {/* Conversation focus */}
      <div className="flex-1 overflow-y-auto px-6 py-6 min-h-0 flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          {messages.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center max-w-sm">
              Tap the mic and introduce how you&apos;d like to approach{" "}
              <span className="text-foreground">{problem.title}</span>.
            </p>
          ) : (
            <div className="max-w-xl w-full space-y-3 text-center">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                {speaking ? (
                  <Volume2 className="w-4 h-4 text-primary animate-pulse" />
                ) : (
                  <span className="font-mono text-[10px] uppercase tracking-widest">interviewer</span>
                )}
              </div>
              <p className="text-lg leading-relaxed text-foreground">
                {streaming && !lastInterviewer?.content ? (
                  <span className="inline-flex items-center gap-2 text-muted-foreground text-base">
                    <Loader2 className="w-4 h-4 animate-spin" /> thinking…
                  </span>
                ) : (
                  lastInterviewer?.content ?? ""
                )}
              </p>
            </div>
          )}
        </div>
        <div ref={bottomRef} />
      </div>

      {/* Live transcript */}
      {(listening || liveTranscript) && (
        <div className="shrink-0 px-6 pb-2 text-center">
          <p className="text-sm text-muted-foreground italic min-h-[1.25rem]">
            {liveTranscript || (listening ? "listening…" : "")}
          </p>
        </div>
      )}

      {/* Errors / capability notes */}
      {!supported && (
        <div className="mx-6 mb-2 px-3 py-2 text-xs text-muted-foreground bg-muted rounded border border-border text-center">
          Speech recognition isn&apos;t supported in this browser — use “Type”, or try Chrome.
        </div>
      )}
      {(error || sttError) && (
        <div className="mx-6 mb-2 px-3 py-2 text-xs text-destructive bg-destructive/10 rounded border border-destructive/20 text-center">
          {error ?? `Mic error: ${sttError}`}
        </div>
      )}

      {/* Text fallback */}
      {showText && (
        <div className="shrink-0 px-6 pb-2 flex gap-2">
          <input
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend(textInput);
            }}
            disabled={streaming || ending}
            placeholder="Type your answer and press Enter"
            className="flex-1 bg-input border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary/60 transition-colors disabled:opacity-50"
          />
          <button
            onClick={() => handleSend(textInput)}
            disabled={!textInput.trim() || streaming || ending}
            className="w-9 h-9 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Mic + controls */}
      <div className="shrink-0 border-t border-border px-6 py-4 flex items-center justify-between">
        <button
          onClick={() => handleSend("Can I get a hint?", true)}
          disabled={streaming || ending}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md transition-colors disabled:opacity-40"
        >
          <Lightbulb className="w-3.5 h-3.5" />
          Hint
        </button>

        {/* Big mic */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={toggleMic}
            disabled={!supported || streaming || ending}
            className={cn(
              "relative w-16 h-16 rounded-full flex items-center justify-center transition-all disabled:opacity-40",
              listening
                ? "bg-destructive text-white shadow-lg shadow-destructive/30"
                : "bg-primary text-primary-foreground hover:scale-105 shadow-lg shadow-primary/20"
            )}
            aria-label={listening ? "Stop and send" : "Start speaking"}
          >
            {listening && (
              <span className="absolute inset-0 rounded-full bg-destructive/40 animate-ping" />
            )}
            {streaming ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : listening ? (
              <Square className="w-5 h-5 fill-current" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </button>
          <span className="font-mono text-[10px] text-muted-foreground">
            {streaming ? "answering…" : listening ? "tap to send" : "tap to speak"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {speaking && (
            <button
              onClick={stopSpeaking}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md transition-colors"
              aria-label="Stop audio"
            >
              <VolumeX className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={handleEnd}
            disabled={ending || streaming}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-destructive border border-border hover:border-destructive/40 rounded-md transition-colors disabled:opacity-40"
          >
            {ending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <StopCircle className="w-3.5 h-3.5" />}
            {ending ? "Evaluating…" : userTurns < 3 ? "End" : "End & Evaluate"}
          </button>
        </div>
      </div>
    </div>
  );
}
