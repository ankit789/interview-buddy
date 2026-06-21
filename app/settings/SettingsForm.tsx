"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, Check, Loader2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface Keys {
  cerebras_api_key: string;
  groq_api_key: string;
  gemini_api_key: string;
  anthropic_api_key: string;
}

const EMPTY: Keys = {
  cerebras_api_key: "",
  groq_api_key: "",
  gemini_api_key: "",
  anthropic_api_key: "",
};

// Interview providers, in the order the app falls back through them.
const PROVIDER_FIELDS: {
  key: keyof Keys;
  label: string;
  blurb: string;
  link: string;
  placeholder: string;
}[] = [
  {
    key: "cerebras_api_key",
    label: "Cerebras API Key",
    blurb: "Tried first — most generous free tier (1M tokens/day) and fastest.",
    link: "https://cloud.cerebras.ai",
    placeholder: "csk-…",
  },
  {
    key: "groq_api_key",
    label: "Groq API Key",
    blurb: "Fallback if Cerebras is rate-limited.",
    link: "https://console.groq.com/keys",
    placeholder: "gsk_…",
  },
  {
    key: "gemini_api_key",
    label: "Gemini API Key",
    blurb: "Final fallback — huge context window (Gemini 2.5 Flash).",
    link: "https://aistudio.google.com/apikey",
    placeholder: "AIza…",
  },
];

export function SettingsForm() {
  const [keys, setKeys] = useState<Keys>(EMPTY);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from("user_settings")
        .select("cerebras_api_key, groq_api_key, gemini_api_key, anthropic_api_key")
        .eq("user_id", user.id)
        .single();
      if (data) {
        setKeys({
          cerebras_api_key: data.cerebras_api_key ?? "",
          groq_api_key: data.groq_api_key ?? "",
          gemini_api_key: data.gemini_api_key ?? "",
          anthropic_api_key: data.anthropic_api_key ?? "",
        });
      }
      setLoading(false);
    }
    load();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not authenticated"); setSaving(false); return; }

    const trimmed = (v: string) => v.trim() || null;
    const { error } = await supabase.from("user_settings").upsert({
      user_id: user.id,
      cerebras_api_key: trimmed(keys.cerebras_api_key),
      groq_api_key: trimmed(keys.groq_api_key),
      gemini_api_key: trimmed(keys.gemini_api_key),
      anthropic_api_key: trimmed(keys.anthropic_api_key),
    }, { onConflict: "user_id" });

    if (error) {
      setError(error.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>
    );
  }

  const toggle = (k: string) => setShown((s) => ({ ...s, [k]: !s[k] }));

  return (
    <form onSubmit={save} className="space-y-8">
      <div className="rounded-lg border border-border bg-card/50 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
        Add a key for any of the interview providers below. The app tries them in order
        (<span className="font-medium text-foreground">Cerebras → Groq → Gemini</span>) and
        automatically falls back to the next when one hits its quota. One key is enough to start.
      </div>

      {PROVIDER_FIELDS.map((field) => (
        <fieldset key={field.key} className="space-y-3">
          <div className="space-y-1">
            <legend className="text-sm font-medium">{field.label}</legend>
            <p className="text-xs text-muted-foreground">
              {field.blurb}{" "}
              <a
                href={field.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-0.5"
              >
                Get a key <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>
          <KeyInput
            value={keys[field.key]}
            onChange={(v) => setKeys((k) => ({ ...k, [field.key]: v }))}
            show={!!shown[field.key]}
            onToggle={() => toggle(field.key)}
            placeholder={field.placeholder}
          />
        </fieldset>
      ))}

      <fieldset className="space-y-3 border-t border-border pt-6">
        <div className="space-y-1">
          <legend className="text-sm font-medium">Anthropic API Key</legend>
          <p className="text-xs text-muted-foreground">
            Powers diagram feedback only (Claude Sonnet 4.6). Optional — chat and evaluation use the providers above.{" "}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-0.5"
            >
              Get a key <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>
        <KeyInput
          value={keys.anthropic_api_key}
          onChange={(v) => setKeys((k) => ({ ...k, anthropic_api_key: v }))}
          show={!!shown.anthropic_api_key}
          onToggle={() => toggle("anthropic_api_key")}
          placeholder="sk-ant-…"
        />
      </fieldset>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/80 transition-colors disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : saved ? (
          <Check className="w-4 h-4" />
        ) : null}
        {saving ? "Saving…" : saved ? "Saved!" : "Save keys"}
      </button>
    </form>
  );
}

function KeyInput({
  value, onChange, show, onToggle, placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className={cn(
          "w-full h-10 pl-3 pr-10 font-mono text-sm bg-input border border-border rounded-md",
          "placeholder:text-muted-foreground/50 outline-none focus:border-primary/60 transition-colors"
        )}
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}
