import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionChunk,
} from "openai/resources/chat/completions";
import type { Stream } from "openai/streaming";

export type ProviderId = "cerebras" | "groq" | "mistral" | "gemini";

export interface ProviderKeys {
  cerebras?: string | null;
  groq?: string | null;
  mistral?: string | null;
  gemini?: string | null;
}

interface ProviderConfig {
  id: ProviderId;
  baseURL: string;
  model: string;
}

// Preferred fallback order: most generous free budget first.
// All four expose OpenAI-compatible /chat/completions endpoints.
const PROVIDERS: ProviderConfig[] = [
  { id: "cerebras", baseURL: "https://api.cerebras.ai/v1", model: "gpt-oss-120b" },
  { id: "groq", baseURL: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
  { id: "mistral", baseURL: "https://api.mistral.ai/v1", model: "mistral-small-latest" },
  {
    id: "gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    model: "gemini-3-flash-preview",
  },
];

export class NoProviderError extends Error {
  constructor() {
    super("No LLM provider key configured. Add a Cerebras, Groq, Mistral, or Gemini key in Settings.");
    this.name = "NoProviderError";
  }
}

export class AllProvidersFailedError extends Error {
  constructor(public readonly attempts: { provider: ProviderId; message: string }[]) {
    super(
      "All configured LLM providers failed: " +
        attempts.map((a) => `${a.provider} (${a.message})`).join("; ")
    );
    this.name = "AllProvidersFailedError";
  }
}

// Ordered list of providers that have a usable key.
function activeProviders(keys: ProviderKeys): { config: ProviderConfig; key: string }[] {
  return PROVIDERS.map((config) => {
    const key = keys[config.id];
    return key ? { config, key } : null;
  }).filter((x): x is { config: ProviderConfig; key: string } => x !== null);
}

// A 429 (quota/rate limit) or 401/403 (bad/missing key) means "try the next provider".
function shouldFallover(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  return status === 429 || status === 401 || status === 403;
}

function errMessage(err: unknown): string {
  const status = (err as { status?: number })?.status;
  const message = err instanceof Error ? err.message : String(err);
  return status ? `${status}: ${message}` : message;
}

interface CompleteOpts {
  maxTokens?: number;
  temperature?: number;
  json?: boolean;
  /** Override the provider's default model. Single-provider use (e.g. the sim) only —
   *  model ids are provider-specific, so don't combine with multi-provider fallback. */
  model?: string;
}

// Non-streaming completion with provider fallback. Returns text + which provider answered.
export async function complete(
  keys: ProviderKeys,
  messages: ChatCompletionMessageParam[],
  opts: CompleteOpts = {}
): Promise<{ text: string; provider: ProviderId }> {
  const providers = activeProviders(keys);
  if (providers.length === 0) throw new NoProviderError();

  const attempts: { provider: ProviderId; message: string }[] = [];
  for (const { config, key } of providers) {
    try {
      const client = new OpenAI({ apiKey: key, baseURL: config.baseURL });
      const res = await client.chat.completions.create({
        model: opts.model ?? config.model,
        messages,
        max_tokens: opts.maxTokens ?? 512,
        temperature: opts.temperature ?? 0.7,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      });
      return { text: res.choices[0]?.message?.content ?? "", provider: config.id };
    } catch (err) {
      attempts.push({ provider: config.id, message: errMessage(err) });
      if (shouldFallover(err)) continue;
      // Non-retriable error (e.g. 400/500) — still try the next provider as a best effort.
      continue;
    }
  }
  throw new AllProvidersFailedError(attempts);
}

interface StreamOpts {
  maxTokens?: number;
  temperature?: number;
}

// Streaming completion with fallback at creation time. Once a stream starts, no further fallover.
export async function streamChat(
  keys: ProviderKeys,
  messages: ChatCompletionMessageParam[],
  opts: StreamOpts = {}
): Promise<{ stream: Stream<ChatCompletionChunk>; provider: ProviderId }> {
  const providers = activeProviders(keys);
  if (providers.length === 0) throw new NoProviderError();

  const attempts: { provider: ProviderId; message: string }[] = [];
  for (const { config, key } of providers) {
    try {
      const client = new OpenAI({ apiKey: key, baseURL: config.baseURL });
      const stream = await client.chat.completions.create({
        model: config.model,
        messages,
        stream: true,
        max_tokens: opts.maxTokens ?? 512,
        temperature: opts.temperature ?? 0.7,
      });
      return { stream, provider: config.id };
    } catch (err) {
      attempts.push({ provider: config.id, message: errMessage(err) });
      continue;
    }
  }
  throw new AllProvidersFailedError(attempts);
}

// Pull provider keys from a user_settings row (or any object with *_api_key fields).
export function keysFromSettings(
  settings: {
    cerebras_api_key?: string | null;
    groq_api_key?: string | null;
    mistral_api_key?: string | null;
    gemini_api_key?: string | null;
  } | null
): ProviderKeys {
  return {
    cerebras: settings?.cerebras_api_key ?? null,
    groq: settings?.groq_api_key ?? null,
    mistral: settings?.mistral_api_key ?? null,
    gemini: settings?.gemini_api_key ?? null,
  };
}
