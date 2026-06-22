-- ============================================================
-- interview-buddy schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ──────────────────────────────────────────
-- 1. user_settings
-- ──────────────────────────────────────────
create table if not exists public.user_settings (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  groq_api_key     text,
  cerebras_api_key text,
  mistral_api_key  text,
  gemini_api_key   text,
  anthropic_api_key text,
  google_tts_api_key text,
  updated_at       timestamptz not null default now(),
  unique (user_id)
);

-- Additive migration for existing installs (safe to re-run)
alter table public.user_settings add column if not exists cerebras_api_key text;
alter table public.user_settings add column if not exists mistral_api_key text;
alter table public.user_settings add column if not exists gemini_api_key text;
alter table public.user_settings add column if not exists google_tts_api_key text;

alter table public.user_settings enable row level security;

create policy "Users manage own settings"
  on public.user_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ──────────────────────────────────────────
-- 2. interview_sessions
-- ──────────────────────────────────────────
create table if not exists public.interview_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  problem_id      text not null,
  interview_type  text not null check (interview_type in ('system_design', 'lld', 'behavioral')),
  difficulty      text not null check (difficulty in ('Easy', 'Medium', 'Hard')),
  target_level    text not null default 'senior' check (target_level in ('mid', 'senior', 'staff')),
  status          text not null default 'active' check (status in ('active', 'completed')),
  canvas_state    jsonb,                    -- Excalidraw elements, SD only
  code_state      jsonb,                    -- { code, language }, LLD only
  created_at      timestamptz not null default now(),
  completed_at    timestamptz
);

-- Additive migration for existing installs (safe to re-run)
alter table public.interview_sessions add column if not exists target_level text not null default 'senior';
alter table public.interview_sessions add column if not exists code_state jsonb;

create index idx_sessions_user_id     on public.interview_sessions(user_id);
create index idx_sessions_status      on public.interview_sessions(user_id, status);
create index idx_sessions_created_at  on public.interview_sessions(user_id, created_at desc);

alter table public.interview_sessions enable row level security;

create policy "Users manage own sessions"
  on public.interview_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ──────────────────────────────────────────
-- 3. interview_messages
-- ──────────────────────────────────────────
create table if not exists public.interview_messages (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.interview_sessions(id) on delete cascade,
  role         text not null check (role in ('user', 'assistant')),
  content      text not null,
  message_type text not null default 'chat' check (message_type in ('chat', 'hint', 'diagram_feedback')),
  created_at   timestamptz not null default now()
);

create index idx_messages_session_id  on public.interview_messages(session_id);
create index idx_messages_created_at  on public.interview_messages(session_id, created_at asc);

alter table public.interview_messages enable row level security;

-- Messages are readable/writable by the session owner only
create policy "Users access own session messages"
  on public.interview_messages
  for all
  using (
    exists (
      select 1 from public.interview_sessions s
      where s.id = session_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.interview_sessions s
      where s.id = session_id
        and s.user_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────
-- 4. interview_evaluations
-- ──────────────────────────────────────────
create table if not exists public.interview_evaluations (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.interview_sessions(id) on delete cascade unique,
  scores     jsonb not null,   -- ReshadeScore[]
  total      integer not null,
  verdict    text not null check (verdict in ('Not Ready', 'Borderline', 'Strong Hire')),
  covered    jsonb not null default '[]',   -- string[]
  missed     jsonb not null default '[]',   -- string[]
  stalled    jsonb not null default '[]',   -- string[] — moments the candidate got stuck
  study_next jsonb not null default '[]',   -- string[]
  feedback   text not null default '',
  signals    jsonb,                         -- InterviewSignalsRecord — behavioral interaction metrics
  created_at timestamptz not null default now()
);

-- Additive migration for existing installs (safe to re-run)
alter table public.interview_evaluations add column if not exists stalled jsonb not null default '[]';
alter table public.interview_evaluations add column if not exists signals jsonb;

create index idx_evaluations_session_id on public.interview_evaluations(session_id);

alter table public.interview_evaluations enable row level security;

create policy "Users access own evaluations"
  on public.interview_evaluations
  for all
  using (
    exists (
      select 1 from public.interview_sessions s
      where s.id = session_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.interview_sessions s
      where s.id = session_id
        and s.user_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────
-- 5. Auto-update updated_at on user_settings
-- ──────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_user_settings_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();
