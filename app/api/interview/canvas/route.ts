import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { sessionId, canvasState } = await req.json();

  const { error } = await supabase
    .from("interview_sessions")
    .update({ canvas_state: canvasState })
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (error) return new Response("Failed to save", { status: 500 });

  return new Response("OK");
}
