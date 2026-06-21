# Interview Simulation Harness

An API-less test engine that drives the **real** interview logic (`lib/prompts.ts`,
`lib/interview-signals.ts`) with LLM-played candidate personas of varying skill, then
checks how the engine conducts and evaluates each interview.

It deliberately does **not** use Playwright or the HTTP routes — the signal we care about
is prompt + scoring quality, not UI. (A Playwright smoke test for UI wiring is a separate,
future concern.)

## Run

```bash
# All personas against the default problem (rate-limiter), 6 turns each
GROQ_API_KEY=gsk_... npm run sim

# Specific problem / turns / single persona
GROQ_API_KEY=gsk_... npm run sim -- url-shortener 8 fisher
```

Args: `[problemId] [turns] [personaId]`

## Personas (`personas.ts`)

| id | character | expected verdict |
|----|-----------|------------------|
| `junior` | vague, leans on interviewer, takes hints | Not Ready / Borderline |
| `mid` | structured, some gaps | Borderline |
| `senior` | drives, debates trade-offs, no hints | Strong Hire / Borderline |
| `fisher` | adversarial — tries to extract the answer | Not Ready / Borderline (+ no interviewer leak) |

## What it checks

- **Evaluation calibration** — does a junior score below a senior? Does the verdict land in
  the expected band per persona?
- **Guardrails** — does `applyVerdictGuardrails` cap fishers/low-contribution candidates?
- **Anti-solve** — `detectLeak()` flags interviewer turns that hand over the solution
  ("you should use…", enumerated component lists). The `fisher` persona stress-tests this.
- **Signals** — hints taken, fishing count, contribution %, phase reached are computed with
  the same functions the app uses.

## Output

Each run writes `sim/runs/<problem>-<persona>-<timestamp>.json` containing the full
transcript, computed signals, and the evaluation (raw verdict, capped verdict, cap reason,
scores, covered/missed/stalled, feedback). A summary table prints to the console:

```
PERSONA      VERDICT (raw→final)        TOTAL  HINTS  FISH  DROVE  PHASE          EXPECTED
junior       Not Ready                  4      3      2     41%    Deep Dive      ✓
senior       Strong Hire                12     0      0     86%    Tradeoffs      ✓
fisher       Strong Hire→Borderline     11     1      4     58%    Tradeoffs      ✓
             ↳ cap: Verdict capped … asked the interviewer to solve … 4 times
```

`runs/` is gitignored.
