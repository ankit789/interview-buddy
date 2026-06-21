import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProblemById } from "@/lib/problems";
import { InterviewShell } from "@/components/interview/InterviewShell";
import type { InterviewSession, InterviewMessage } from "@/lib/types";

interface Props {
  params: Promise<{ sessionId: string }>;
}

export default async function InterviewPage({ params }: Props) {
  const { sessionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (!session) notFound();

  if (session.status === "completed") {
    redirect(`/interview/${sessionId}/result`);
  }

  const problem = getProblemById(session.problem_id);
  if (!problem) notFound();

  const { data: messages } = await supabase
    .from("interview_messages")
    .select("role, content, message_type")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  return (
    <InterviewShell
      session={session as InterviewSession}
      problem={problem}
      initialMessages={
        (messages ?? []) as Pick<
          InterviewMessage,
          "role" | "content" | "message_type"
        >[]
      }
    />
  );
}
