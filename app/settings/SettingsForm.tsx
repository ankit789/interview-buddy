"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, Check, Loader2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { getKeyStatus, saveKeys, type KeyStatus } from "./actions";

interface Keys {
  mistral_api_key: string;
  cerebras_api_key: string;
  groq_api_key: string;
  gemini_api_key: string;
  anthropic_api_key: string;
  google_tts_api_key: string;
}

const EMPTY: Keys = {
  mistral_api_key: "",
  cerebras_api_key: "",
  groq_api_key: "",
  gemini_api_key: "",
  anthropic_api_key: "",
  google_tts_api_key: "",
};

const EMPTY_STATUS: KeyStatus = {
  mistral_api_key: false,
  cerebras_api_key: false,
  groq_api_key: false,
  gemini_api_key: false,
  anthropic_api_key: false,
  google_tts_api_key: false,
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
    key: "mistral_api_key",
    label: "Mistral API Key",
    blurb: "Tried first — generous free tier and steady throughput for interviews.",
    link: "https://console.mistral.ai/api-keys",
    placeholder: "your Mistral key",
  },
  {
    key: "cerebras_api_key",
    label: "Cerebras API Key",
    blurb: "Fallback after Mistral — fast, 1M tokens/day free.",
    link: "https://cloud.cerebras.ai",
    placeholder: "csk-…",
  },
  {
    key: "groq_api_key",
    label: "Groq API Key",
    blurb: "Fallback if Mistral and Cerebras are rate-limited.",
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
  const [status, setStatus] = useState<KeyStatus>(EMPTY_STATUS);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState<Record<string, boolean>>({});

  useEffect(() => {
    getKeyStatus()
      .then(setStatus)
      .finally(() => setLoading(false));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    // Only send fields the user actually typed; empty fields leave the stored key untouched.
    const input: Partial<Keys> = {};
    (Object.keys(keys) as (keyof Keys)[]).forEach((k) => {
      const v = keys[k].trim();
      if (v) input[k] = v;
    });

    const { error } = await saveKeys(input);
    if (error) {
      setError(error);
    } else {
      setSaved(true);
      setKeys(EMPTY); // clear typed secrets from the form
      setStatus(await getKeyStatus());
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
        (<span className="font-medium text-foreground">Mistral → Cerebras → Groq → Gemini</span>) and
        automatically falls back to the next when one hits its quota. One key is enough to start.
        Keys are encrypted before storage and never shown back to you — enter a new value to replace one.
      </div>

      {PROVIDER_FIELDS.map((field) => (
        <fieldset key={field.key} className="space-y-3">
          <div className="space-y-1">
            <legend className="text-sm font-medium flex items-center gap-2">
              {field.label}
              {status[field.key] && <ConfiguredBadge />}
            </legend>
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
            configured={status[field.key]}
          />
        </fieldset>
      ))}

      <fieldset className="space-y-3 border-t border-border pt-6">
        <div className="space-y-1">
          <legend className="text-sm font-medium flex items-center gap-2">
            Anthropic API Key
            {status.anthropic_api_key && <ConfiguredBadge />}
          </legend>
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
          configured={status.anthropic_api_key}
        />
      </fieldset>

      <fieldset className="space-y-3 border-t border-border pt-6">
        <div className="space-y-1">
          <legend className="text-sm font-medium flex items-center gap-2">
            Google Cloud TTS Key
            {status.google_tts_api_key && <ConfiguredBadge />}
          </legend>
          <p className="text-xs text-muted-foreground">
            The interviewer&apos;s voice in voice mode (Google Neural2). Optional — without it,
            voice mode falls back to Groq, then your browser&apos;s built-in voice. Needs the
            Text-to-Speech API enabled on a billing-enabled project.{" "}
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-0.5"
            >
              Get a key <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>
        <KeyInput
          value={keys.google_tts_api_key}
          onChange={(v) => setKeys((k) => ({ ...k, google_tts_api_key: v }))}
          show={!!shown.google_tts_api_key}
          onToggle={() => toggle("google_tts_api_key")}
          placeholder="AIza…"
          configured={status.google_tts_api_key}
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

function ConfiguredBadge() {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-[oklch(0.68_0.18_145)] border border-[oklch(0.68_0.18_145)]/30 rounded px-1.5 py-0.5">
      <Check className="w-3 h-3" /> Configured
    </span>
  );
}

function KeyInput({
  value, onChange, show, onToggle, placeholder, configured,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  placeholder: string;
  configured?: boolean;
}) {
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={configured ? "•••••••••• — enter a new key to replace" : placeholder}
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
