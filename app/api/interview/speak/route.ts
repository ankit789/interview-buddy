import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";

// Voice synthesis with provider fallback:
//   1. Google Cloud TTS (Neural2) — most generous free tier, best quality
//   2. Groq PlayAI TTS — OpenAI-compatible, reuses the user's Groq key
//   3. (client) browser SpeechSynthesis — when the route returns 503
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const GROQ_TTS_MODEL = "playai-tts";
const GROQ_TTS_VOICE = "Fritz-PlayAI";
const GOOGLE_TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";
const GOOGLE_VOICE = "en-US-Neural2-D";
const GOOGLE_LANG = "en-US";
const MAX_TTS_LEN = 1200;

// Strip markdown so the voice doesn't read out asterisks, backticks, etc.
function forSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " (code omitted) ")
    .replace(/[*_`#>]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TTS_LEN);
}

async function googleTTS(key: string, input: string): Promise<Response> {
  const res = await fetch(`${GOOGLE_TTS_URL}?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text: input },
      voice: { languageCode: GOOGLE_LANG, name: GOOGLE_VOICE },
      audioConfig: { audioEncoding: "MP3" },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`google tts ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as { audioContent?: string };
  if (!data.audioContent) throw new Error("google tts: empty audioContent");
  const buf = Buffer.from(data.audioContent, "base64");
  return new Response(buf, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
}

async function groqTTS(key: string, input: string): Promise<Response> {
  const client = new OpenAI({ apiKey: key, baseURL: GROQ_BASE_URL });
  const speech = await client.audio.speech.create({
    model: GROQ_TTS_MODEL,
    voice: GROQ_TTS_VOICE,
    input,
    response_format: "wav",
  });
  const buf = Buffer.from(await speech.arrayBuffer());
  return new Response(buf, {
    headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { text } = await req.json();
  if (typeof text !== "string" || !text.trim()) {
    return new Response("Bad request", { status: 400 });
  }

  const { data: settings } = await supabase
    .from("user_settings")
    .select("google_tts_api_key, groq_api_key")
    .eq("user_id", user.id)
    .single();

  const googleKey = settings?.google_tts_api_key ?? process.env.GOOGLE_TTS_API_KEY;
  const groqKey = settings?.groq_api_key ?? process.env.GROQ_API_KEY;

  if (!googleKey && !groqKey) {
    // Signal the client to fall back to browser TTS.
    return Response.json({ error: "no-tts-provider" }, { status: 503 });
  }

  const input = forSpeech(text);
  if (!input) return new Response("Bad request", { status: 400 });

  const errors: string[] = [];

  if (googleKey) {
    try {
      return await googleTTS(googleKey, input);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "google tts error");
    }
  }

  if (groqKey) {
    try {
      return await groqTTS(groqKey, input);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "groq tts error");
    }
  }

  return Response.json({ error: errors.join("; ") || "TTS failed" }, { status: 502 });
}
