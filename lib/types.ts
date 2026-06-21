export type InterviewType = "system_design" | "lld" | "behavioral";
export type InterviewLevel = "mid" | "senior" | "staff";
export type Difficulty = "Easy" | "Medium" | "Hard";
export type SessionStatus = "active" | "completed";

export interface Problem {
  id: string;
  title: string;
  description: string;
  statement: string;
  category: string;
  difficulty: Difficulty;
  companies: string[];
  type: InterviewType;
  timeMinutes: number;
}

export interface InterviewSession {
  id: string;
  user_id: string;
  problem_id: string;
  interview_type: InterviewType;
  difficulty: Difficulty;
  target_level: InterviewLevel;
  status: SessionStatus;
  canvas_state: Record<string, unknown> | null;
  code_state: CodeState | null;
  created_at: string;
  completed_at: string | null;
}

export interface CodeState {
  code: string;
  language: string;
}

export interface InterviewMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  message_type: "chat" | "hint" | "diagram_feedback";
  created_at: string;
}

export type Verdict = "Not Ready" | "Borderline" | "Strong Hire";

export interface ReshadeScore {
  label: string;
  letter: string;
  score: number;
  max: number;
  evidence: string;
  gap: string;
}

export interface InterviewSignalsRecord {
  hintsTaken: number;
  fishingCount: number;
  contributionRatio: number;
  questionRatio: number;
  candidateMessages: number;
  maxPhaseReached: number;
  maxPhaseLabel: string;
  leakCount: number;
  capReason?: string | null;
}

export interface InterviewEvaluation {
  id: string;
  session_id: string;
  scores: ReshadeScore[];
  total: number;
  verdict: Verdict;
  covered: string[];
  missed: string[];
  stalled: string[];
  study_next: string[];
  feedback: string;
  signals: InterviewSignalsRecord | null;
  created_at: string;
}
