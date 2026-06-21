"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CodeState } from "@/lib/types";

const LANGUAGES = [
  { id: "java", label: "Java" },
  { id: "typescript", label: "TypeScript" },
  { id: "python", label: "Python" },
  { id: "cpp", label: "C++" },
];

const STARTERS: Record<string, string> = {
  java: "// Design your classes and interfaces here.\n\n",
  typescript: "// Design your classes and interfaces here.\n\n",
  python: "# Design your classes here.\n\n",
  cpp: "// Design your classes here.\n\n",
};

const SAVE_DEBOUNCE_MS = 2000;

interface CodeEditorPanelProps {
  sessionId: string;
  initialCodeState: CodeState | null;
}

export function CodeEditorPanel({ sessionId, initialCodeState }: CodeEditorPanelProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const langCompartmentRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const langFactoriesRef = useRef<Record<string, () => any>>({});
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [language, setLanguage] = useState(initialCodeState?.language ?? "java");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [ready, setReady] = useState(false);

  // Keep the latest language readable from the editor's update listener without
  // re-creating the editor.
  const languageRef = useRef(language);
  languageRef.current = language;

  const save = useCallback(
    (code: string, lang: string) => {
      setSaveStatus("saving");
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await fetch("/api/interview/code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, code, language: lang }),
          });
          // fetch only rejects on network failure, so an HTTP 4xx/5xx must be
          // checked explicitly — otherwise the UI would falsely report "saved".
          setSaveStatus(res.ok ? "saved" : "error");
        } catch {
          setSaveStatus("error");
        }
      }, SAVE_DEBOUNCE_MS);
    },
    [sessionId]
  );

  const langExtension = useCallback((lang: string) => {
    const make = langFactoriesRef.current[lang] ?? langFactoriesRef.current.typescript;
    return make();
  }, []);

  // Mount the CodeMirror editor once (dynamic import keeps it out of SSR).
  useEffect(() => {
    let destroyed = false;
    (async () => {
      const [{ EditorView }, { EditorState, Compartment }, basic, jsMod, javaMod, pyMod, cppMod, dark] =
        await Promise.all([
          import("@codemirror/view"),
          import("@codemirror/state"),
          import("codemirror"),
          import("@codemirror/lang-javascript"),
          import("@codemirror/lang-java"),
          import("@codemirror/lang-python"),
          import("@codemirror/lang-cpp"),
          import("@codemirror/theme-one-dark"),
        ]);
      if (destroyed || !hostRef.current) return;

      langFactoriesRef.current = {
        typescript: () => jsMod.javascript({ typescript: true }),
        java: () => javaMod.java(),
        python: () => pyMod.python(),
        cpp: () => cppMod.cpp(),
      };

      const compartment = new Compartment();
      langCompartmentRef.current = compartment;

      const isDark =
        document.documentElement.classList.contains("dark") ||
        window.matchMedia?.("(prefers-color-scheme: dark)").matches;

      const initialDoc = initialCodeState?.code ?? STARTERS[languageRef.current] ?? "";

      const extensions = [
        basic.basicSetup,
        compartment.of(langExtension(languageRef.current)),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) save(u.state.doc.toString(), languageRef.current);
        }),
        EditorView.theme({
          "&": { height: "100%", fontSize: "13px" },
          ".cm-scroller": { fontFamily: "var(--font-mono, ui-monospace, monospace)" },
          "&.cm-focused": { outline: "none" },
        }),
        EditorView.lineWrapping,
      ];
      if (isDark) extensions.push(dark.oneDark);

      viewRef.current = new EditorView({
        state: EditorState.create({ doc: initialDoc, extensions }),
        parent: hostRef.current,
      });
      setReady(true);
    })();

    return () => {
      destroyed = true;
      viewRef.current?.destroy();
      viewRef.current = null;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
    // Mount-once: deliberately not re-running on prop/callback identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onLanguageChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const lang = e.target.value;
    setLanguage(lang);
    languageRef.current = lang;
    const view = viewRef.current;
    const compartment = langCompartmentRef.current;
    if (view && compartment) {
      view.dispatch({ effects: compartment.reconfigure(langExtension(lang)) });
      save(view.state.doc.toString(), lang);
    }
  }

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-1 relative min-h-0">
        <div ref={hostRef} className="absolute inset-0 overflow-auto" />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading editor…
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border px-3 py-2 flex items-center justify-between bg-background">
        <span
          className={cn(
            "font-mono text-[10px]",
            saveStatus === "error" ? "text-red-400" : "text-muted-foreground/50"
          )}
        >
          {saveStatus === "saved" ? "code saved" : saveStatus === "saving" ? "saving…" : "save failed"}
        </span>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-mono text-[10px] uppercase tracking-wider">lang</span>
          <select
            value={language}
            onChange={onLanguageChange}
            className="text-xs bg-card border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:border-primary/50 transition-colors"
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
