"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProblemById } from "@/lib/problems";
import type { InterviewLevel } from "@/lib/types";

const VALID_LEVELS: InterviewLevel[] = ["mid", "senior", "staff"];

export async function createSession(problemId: string, level: InterviewLevel = "senior") {
  const problem = getProblemById(problemId);
  if (!problem) redirect("/");

  const targetLevel: InterviewLevel = VALID_LEVELS.includes(level) ? level : "senior";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session, error } = await supabase
    .from("interview_sessions")
    .insert({
      user_id: user.id,
      problem_id: problem.id,
      // Interview type is intrinsic to the problem — never a user choice.
      interview_type: problem.type,
      difficulty: problem.difficulty,
      target_level: targetLevel,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !session) redirect("/");

  redirect(`/interview/${session.id}`);
}
