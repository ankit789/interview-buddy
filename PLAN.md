# Mock Interviewer — Development Plan

> Created: 2026-06-17
> Stack: Next.js 14 App Router · Supabase · Tailwind CSS · shadcn/ui · Groq + Claude · Vercel · Excalidraw

---

## What We Are Building

An AI-powered mock interview web app for FAANG/top-tier prep. Primary focus is **System Design** interviews with a split chat + whiteboard UI. LLD and Behavioral are also supported as chat-only modes.

**Target users:** Senior engineers preparing for FAANG/top-tier interviews.

**Not in v1 scope:** Voice mode, company-specific modes, human interviewer pairing.

**Responsive strategy:** Desktop-first. Auth, dashboard, and results pages work on mobile. Interview page is desktop-only — show a "best experienced on desktop" notice on screens < 768px.

---

## Interview Types

| Type | Chat | Whiteboard | Notes |
|---|---|---|---|
| **System Design** | ✅ | ✅ Excalidraw | Primary focus — split panel layout |
| **LLD** | ✅ | ❌ | Text-only; class/OOP design in prose |
| **Behavioral** | ✅ | ❌ | STAR format, Amazon LP questions |

---

## AI Model Strategy

| Stage | Model | Cost |
|---|---|---|
| Practice Q&A (all types) | Groq DeepSeek R1 | Free |
| Diagram feedback (SD only) | Claude Sonnet 4.6 | Per request |
| Final evaluation | Claude Sonnet 4.6 | ~$0.003/session |

User brings their own Groq + Anthropic API keys via a Settings panel.

---

## Scoring — RESHADED Framework (adapted from sd-coach)

Final evaluation scores 7 dimensions (0–2 each, max 14):

| Dimension | What's evaluated |
|---|---|
| **R** — Requirements | Did the user clarify scope, users, scale before diving in? |
| **E** — Estimation | Capacity math: QPS, storage, bandwidth |
| **S** — Storage | Data model, DB choice, sharding strategy |
| **H** — High-Level Design | Component diagram, data flow, key services |
| **A** — API Design | Endpoints, contracts, pagination, auth |
| **D** — Deep Dive | At least one component explored thoroughly |
| **E** — Extensibility | Failure modes, tradeoffs, scaling knobs |

Claude returns: score per dimension + evidence + gaps + overall verdict (Not Ready / Borderline / Strong Hire).

For LLD: adapted rubric (Requirements, Class Design, OOP principles, API/interface, Extensibility).
For Behavioral: STAR completeness, specificity, impact quantification.

---

## Supabase Schema

```sql
-- interview_sessions
id, user_id, topic, difficulty, interview_type (system_design|lld|behavioral),
problem_id, status (active|completed), canvas_state (jsonb), created_at, completed_at

-- interview_messages
id, session_id, role (user|assistant), content, message_type (chat|hint|diagram_feedback),
created_at

-- interview_evaluations
id, session_id, scores (jsonb), feedback (text), verdict (text), created_at

-- user_settings
id, user_id, groq_api_key (text), anthropic_api_key (text), updated_at
```

RLS enabled on all tables. Indexes on `session_id` and `user_id`.

---

## System Design Interview — Layout & Flow

```
┌──────────────────────────────────────────────────────┐
│  Phase: [Clarification] [Estimation] [HLD] [Deep Dive] [Tradeoffs]  │  Timer  │
├─────────────────────────┬────────────────────────────┤
│                         │                            │
│   Excalidraw Canvas     │   Chat Panel               │
│   (draw architecture)   │   AI: "Walk me through     │
│                         │   your data model..."      │
│                         │                            │
│                         │   [You]: ...               │
│                         │                            │
│                         │   [Hint] [Get Diagram      │
│                         │    Feedback] [End Session] │
└─────────────────────────┴────────────────────────────┘
```

### Interview Phases (System Design)
1. Problem clarification — AI checks if user asks right scoping questions
2. Capacity estimation — back-of-envelope math
3. High-level design — components, data flow
4. Deep dive — one component explored thoroughly
5. Tradeoffs + failure modes
6. Final evaluation — RESHADED scoring via Claude

### "Get Diagram Feedback" button
- Sends current Excalidraw canvas (simplified element list) + chat transcript to Claude
- Claude returns: what's good, what's missing, numbered annotations on diagram
- Does NOT end the session — mid-session coaching moment

---

## Build Phases

### Phase 1 — Project Bootstrap
- [ ] `npx create-next-app@latest interview-buddy` (TypeScript + Tailwind + App Router)
- [ ] Install `@supabase/ssr @supabase/supabase-js`
- [ ] Install `@excalidraw/excalidraw`
- [ ] Port auth setup from StudyStick: `middleware.ts`, `lib/supabase/client.ts`, `lib/supabase/server.ts`
- [ ] Login page + protected route wrapper
- [ ] `.env.local` with Supabase URL + anon key

### Phase 2 — Database Schema
- [ ] Create 4 tables in Supabase (sessions, messages, evaluations, user_settings)
- [ ] Enable RLS on all tables
- [ ] Add indexes on `session_id` and `user_id`

### Phase 3 — Interview Selection UI (`/`)
- [ ] Primary CTA: System Design (featured, prominent)
- [ ] Secondary: LLD / Behavioral
- [ ] Problem selector: 48 problems seeded from sd-coach's problems.json (adapted)
- [ ] Difficulty + company filters
- [ ] "Start Interview" → creates session row → `/interview/[sessionId]`

### Phase 4 — System Design Interview Page (`/interview/[sessionId]`)
- [ ] Split layout: Excalidraw left, chat right
- [ ] Phase progress bar at top (5 phases + read-only, not clickable)
- [ ] Interview timer (countdown, color-coded at 25%/10%)
- [ ] Chat panel: AI messages left, user right, auto-scroll
- [ ] "Request Hint" button
- [ ] "Get Diagram Feedback" button
- [ ] "End Session" button
- [ ] Auto-save canvas state to Supabase every 30s + on diagram feedback click
- [ ] Restore canvas from `canvas_state` on page load (150ms, show skeleton)

### Phase 5 — LLD + Behavioral Interview Page
- [ ] Full-width chat layout (no canvas)
- [ ] Same phase bar and timer
- [ ] Same hint + end session controls

### Phase 6 — Groq API Route (conversational interviewer)
- [ ] `POST /api/interview/message`
- [ ] Streams Groq DeepSeek R1
- [ ] System prompt: senior interviewer persona, phase-aware, pushes back on vague answers
- [ ] On hint flag: nudges without giving the answer
- [ ] Saves user + AI messages to `interview_messages`

### Phase 7 — Claude Diagram Feedback Route (SD only)
- [ ] `POST /api/interview/diagram-feedback`
- [ ] Input: simplified Excalidraw elements + chat history
- [ ] Claude returns: feedback text + diagram annotations (numbered)
- [ ] Renders annotations as overlay on canvas

### Phase 8 — Claude Evaluation Route
- [ ] `POST /api/interview/evaluate`
- [ ] Input: full transcript + final canvas state (SD only)
- [ ] RESHADED scoring for SD; adapted rubric for LLD/Behavioral
- [ ] Returns structured JSON: scores, evidence, gaps, verdict, study_next
- [ ] Saves to `interview_evaluations`, marks session `completed`
- [ ] Redirects to `/interview/[sessionId]/result`

### Phase 9 — Results Page (`/interview/[sessionId]/result`)
- [ ] RESHADED score visualization (score/2 per dimension)
- [ ] What you covered well
- [ ] Specific gaps with transcript references
- [ ] Overall verdict: Not Ready / Borderline / Strong Hire
- [ ] Study recommendations
- [ ] "Practice Again" button

### Phase 10 — Settings Panel (`/settings`)
- [ ] Groq API key input + validate button
- [ ] Anthropic API key input + validate button
- [ ] Keys saved to `user_settings` table

### Phase 11 — Dashboard (`/dashboard`)
- [ ] List of past sessions: topic, type, date, verdict
- [ ] Click → replay transcript + results
- [ ] Delete session

---

## Problem Bank

Seed from sd-coach's `problems.json` (48 System Design problems). Augment with:
- 10 LLD problems (parking lot, elevator, chess, vending machine, etc.)
- 10 Behavioral question sets (leadership, conflict, delivery under pressure, etc.)

---

## Key Decisions Made

| Decision | Choice | Reason |
|---|---|---|
| Supabase project | New, separate from StudyStick | Cleaner isolation |
| System Design UI | Split panel (Excalidraw + chat) | Primary use case, diagram is real part of SD interviews |
| LLD/Behavioral UI | Chat-only | No diagram needed for these types |
| Scoring framework | RESHADED (adapted from sd-coach) | Battle-tested, structured, covers the right dimensions |
| Phase progress bar | Read-only | Prevents users gaming the flow |
| Short/low-quality answers | AI calls it out in system prompt | No special UI needed |

---

## UI Design System

**Style direction:** Dark luxury / terminal-meets-editorial. References: Linear, Vercel dashboard, Raycast.

**Palette (CSS custom properties):**
```css
--color-bg:      oklch(10% 0 0);       /* near-black */
--color-surface: oklch(14% 0 0);       /* card/panel bg */
--color-border:  oklch(22% 0 0);       /* subtle borders */
--color-text:    oklch(92% 0 0);       /* primary text */
--color-muted:   oklch(55% 0 0);       /* labels, metadata */
--color-accent:  oklch(68% 0.18 250);  /* blue — CTAs, active */
--color-success: oklch(68% 0.18 145);  /* green — Strong Hire */
--color-warn:    oklch(75% 0.18 80);   /* amber — Borderline */
--color-danger:  oklch(65% 0.2 25);    /* red — Not Ready */
```

**Typography:** Inter (UI) + JetBrains Mono (labels, scores, phase chips)

**Component library:** shadcn/ui (Radix primitives + Tailwind) — Dialog, Sheet, Dropdown, Tooltip, Progress. Nothing else.

**Motion:** Minimal. Page fade 150ms. Chat messages slide-up 200ms. RESHADED bars animate 0→score on results page 400ms ease-out. Timer color transition 300ms.

**Chat message style:** No bubbles. Label ("interviewer" / "you") in muted monospace above each message block. Clean transcript aesthetic.

**Phase bar:** Pill chips (not a progress bar). Active = accent blue, done = muted + checkmark, upcoming = dim. Read-only.

**Timer:** Monospace top-right. Amber at 25% remaining, red at 10%. Color-only change, no animation.
- SD: 45 min default
- LLD: 30 min default
- Behavioral: 20 min default

**Excalidraw:** Dark theme, toolbar stripped to drawing tools only. Draggable divider with chat panel (60/40 default split).

---

## Open Questions

None — all major decisions resolved.

---

## Environment

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Reference: sd-coach repo at `/Users/ankit/workplace/sd-coach` for Excalidraw integration patterns and problems.json.
