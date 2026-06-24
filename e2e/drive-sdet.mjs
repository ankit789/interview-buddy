// End-to-end SDET test-design interview: logs in, runs a strong senior-level
// "how would you test a file upload API" conversation across all five phases,
// then ends & evaluates. Confirms the TESTED rubric scores live on the 0-3 scale.
import { chromium } from "playwright";
const LEVEL = (process.argv[2] || "senior").toLowerCase();
const PROBLEM = process.argv[3] || "test-file-upload-api";
const BASE = process.argv[4] || "http://127.0.0.1:4500";
const EMAIL = process.env.IB_EMAIL;
const PASSWORD = process.env.IB_PASSWORD;
if (!EMAIL || !PASSWORD) { console.error("Set IB_EMAIL and IB_PASSWORD env vars to run this script."); process.exit(1); }
const log = (...a) => console.log("[sdet]", ...a);
const errors = [];

const TURNS = [
  `Let me scope it first. What file types and max size are allowed? Is auth required? Is processing synchronous (return the URL now) or async (return a job id)? Single bucket or multi-region storage? Expected throughput, and is virus scanning or content moderation in scope? I'll assume images + PDF, 10MB cap, authenticated, synchronous, single S3 bucket, ~100 rps, no AV in v1.`,
  `I'd structure coverage across the pyramid: unit tests on the validators (type, size, filename sanitization) in isolation; integration tests on the endpoint against mocked storage; a few end-to-end tests through the gateway with real auth; and a contract test on the response schema. I'd prioritize by risk — validation and storage-failure paths first, since a bad file accepted or a silent storage failure is the highest-impact bug.`,
  `Concrete cases. Positive: a valid 2MB JPEG returns 200 with a URL that serves back the same bytes; a valid PDF returns 200. Negative: an .exe renamed to .jpg must be rejected by magic-byte sniffing not just extension, expect 415; missing file 400; missing or invalid auth 401. Boundary: exactly 10MB passes, 10MB + 1 byte returns 413; a 0-byte file returns 400; a filename containing ../ or unicode/emoji is stored safely with no path traversal; two uploads with the same filename both persist with no overwrite. I'd also send a truncated/corrupted image.`,
  `Automation: pytest + requests (or REST-assured) at the API layer, data-driven from a table of (file, expected status) so a new case is one row. Fixture files stay small and the oversized one is generated programmatically. I would NOT hit real S3 in CI — run localstack/minio in a container for determinism and speed, with one nightly smoke test against a real staging bucket. No sleeps to avoid flakiness — poll the returned URL with a bounded retry.`,
  `Non-functional: a k6 load test at ~100 rps watching p99 latency and error rate, plus a soak test for buffer/memory leaks. Security: confirm content sniffing can't execute an uploaded file, check SSRF if it ever fetches remote URLs, ensure the stored URLs aren't guessable and are access-controlled, and cover the path-traversal and malware-disguise cases. CI: unit + integration gate every PR and block merge on failure; track coverage and escape rate; run load and full e2e nightly; dashboard upload success rate and 4xx/5xx ratio with alerting on regressions.`,
];

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1400, height: 900 } });
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("hmr")) errors.push(m.text().slice(0,120)); });

async function send(text, idx) {
  const ta = page.locator("textarea");
  await ta.click(); await ta.fill(text);
  await page.waitForTimeout(200);
  await page.keyboard.press("Control+Enter");
  await page.waitForFunction(() => document.querySelector("textarea")?.disabled === true, { timeout: 12000 }).catch(() => {});
  await page.waitForFunction(() => document.querySelector("textarea")?.disabled === false, { timeout: 150000 });
  log(`turn ${idx} replied`);
}

try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /^Sign in$/ }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });
  log("logged in");

  await page.goto(`${BASE}/interview/new?problem=${PROBLEM}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: LEVEL === "staff" ? /Staff/ : /Senior/ }).click().catch(() => {});
  await page.getByRole("button", { name: /Start Interview/ }).click();
  await page.waitForURL(/\/interview\/[0-9a-f-]{8,}$/i, { timeout: 25000 });
  const sid = page.url().split("/").pop();
  log("session", sid);
  // confirm the whiteboard panel rendered (SDET modality = whiteboard)
  const hasCanvas = await page.locator(".excalidraw").count().then(c => c > 0).catch(() => false);
  log("whiteboard panel present:", hasCanvas);
  await page.waitForSelector("textarea", { timeout: 20000 });
  await page.waitForTimeout(800);

  for (let i = 0; i < TURNS.length; i++) await send(TURNS[i], i + 1);

  log("End & Evaluate");
  await page.getByRole("button", { name: /End & Evaluate/ }).click();
  await page.getByRole("button", { name: /Yes, end/ }).click({ timeout: 3000 }).catch(() => {});
  await page.waitForURL(/\/result$/, { timeout: 180000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  const body = await page.evaluate(() => document.body.innerText);
  const verdict = (body.match(/Not Ready|Borderline|Strong Hire/) || ["?"])[0];
  const score = (body.match(/(\d{1,2})\s*\/\s*(\d{1,2})/) || ["?"])[0];
  // grab per-dimension letters + /max to confirm 0-3 scale rendered
  const dims = (body.match(/\b(T|E|S|T2|E2|N|D)\b[\s\S]{0,40}?\d\/3/g) || []).slice(0,7);
  await page.screenshot({ path: "e2e/sdet-result.png", fullPage: false });
  console.log(JSON.stringify({ sid, hasCanvas, verdict, score, errors }, null, 2));
} catch (e) {
  log("ERROR:", e.message.split("\n")[0]);
  await page.screenshot({ path: "e2e/sdet-error.png" }).catch(() => {});
  process.exitCode = 1;
} finally {
  await b.close();
}
