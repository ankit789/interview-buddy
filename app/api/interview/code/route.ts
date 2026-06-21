import { createClient } from "@/lib/supabase/server";

const MAX_CODE_LEN = 50_000;
const ALLOWED_LANGUAGES = ["typescript", "java", "python", "cpp"];

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { sessionId, code, language } = await req.json();

  if (typeof sessionId !== "string" || typeof code !== "string") {
    return new Response("Bad request", { status: 400 });
  }
  if (code.length > MAX_CODE_LEN) {
    return new Response("Code too large", { status: 413 });
  }
  const lang = ALLOWED_LANGUAGES.includes(language) ? language : "typescript";

  const { error } = await supabase
    .from("interview_sessions")
    .update({ code_state: { code, language: lang } })
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (error) return new Response("Failed to save", { status: 500 });

  return new Response("OK");
}
