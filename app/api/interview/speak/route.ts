import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";

// Groq's PlayAI TTS is OpenAI-compatible (POST /audio/speech), so it reuses the
// same SDK and the user's existing Groq key. If no Groq key is configured the
// route returns 503 and the client falls back to the browser's SpeechSynthesis.
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const TTS_MODEL = "playai-tts";
const TTS_VOICE = "Fritz-PlayAI";
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
    .select("groq_api_key")
    .eq("user_id", user.id)
    .single();

  const key = settings?.groq_api_key ?? process.env.GROQ_API_KEY;
  if (!key) {
    // Signal the client to fall back to browser TTS.
    return Response.json({ error: "no-tts-provider" }, { status: 503 });
  }

  const input = forSpeech(text);
  if (!input) return new Response("Bad request", { status: 400 });

  try {
    const client = new OpenAI({ apiKey: key, baseURL: GROQ_BASE_URL });
    const speech = await client.audio.speech.create({
      model: TTS_MODEL,
      voice: TTS_VOICE,
      input,
      response_format: "wav",
    });
    const buf = Buffer.from(await speech.arrayBuffer());
    return new Response(buf, {
      headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "TTS provider error";
    return Response.json({ error: msg }, { status: 502 });
  }
}
