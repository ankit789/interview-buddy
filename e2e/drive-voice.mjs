import { chromium } from "playwright";

const BASE = process.argv[2] || "http://127.0.0.1:4500";
const PROBLEM = process.argv[3] || "leadership-conflict";
const EMAIL = process.env.IB_EMAIL || "***REDACTED***";
const PASSWORD = process.env.IB_PASSWORD || "***REDACTED***";
const log = (...a) => console.log("[voice]", ...a);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const speakCalls = [];
page.on("response", (r) => {
  if (r.url().includes("/api/interview/speak")) speakCalls.push(r.status());
});

try {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /^Sign in$/ }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });
  log("logged in");

  await page.goto(`${BASE}/interview/new?problem=${PROBLEM}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Start Interview/ }).click();
  await page.waitForURL(/\/interview\/[0-9a-f-]{8,}$/i, { timeout: 25000 });
  const sid = page.url().split("/").pop();
  log("session", sid);
  await page.waitForTimeout(1200);

  // Toggle to voice mode
  await page.getByRole("button", { name: /^Voice$/ }).click();
  await page.waitForTimeout(600);
  const voiceHeaderVisible = await page.getByText("● Voice").count();
  const micButton = await page.locator('button[aria-label="Start speaking"]').count();
  // Web Speech API is unavailable in headless chromium → unsupported notice shows.
  const unsupportedNotice = await page.getByText(/Speech recognition isn.t supported/).count();
  log("voice UI:", JSON.stringify({ voiceHeaderVisible, micButton, unsupportedNotice }));
  await page.screenshot({ path: "e2e/voice-mode.png" });

  // Use the text fallback to drive a real turn through the voice panel
  await page.getByRole("button", { name: /Type/ }).click();
  await page.waitForTimeout(300);
  const input = page.locator('input[placeholder*="Type your answer"]');
  await input.fill(
    "I'll use STAR. Situation: two senior engineers on my team deadlocked on whether to adopt gRPC. Task: as tech lead I had to unblock the decision without losing either person."
  );
  await input.press("Enter");

  // Wait for the streamed interviewer reply to land (assistant text appears)
  await page.waitForFunction(
    () => {
      const t = document.body.innerText;
      return /interviewer/i.test(t) && t.length > 400;
    },
    { timeout: 60000 }
  ).catch(() => {});
  await page.waitForTimeout(2500); // allow speak() fetch to fire

  const replyText = await page.evaluate(() => {
    // the large centered interviewer line
    const ps = [...document.querySelectorAll("p")].map((p) => p.innerText.trim());
    return ps.sort((a, b) => b.length - a.length)[0]?.slice(0, 120) ?? "";
  });

  await page.screenshot({ path: "e2e/voice-reply.png" });
  console.log(
    JSON.stringify(
      {
        sid,
        voiceHeaderVisible,
        micButton,
        unsupportedNotice,
        speakCalls,
        replyPreview: replyText,
        errors,
      },
      null,
      2
    )
  );
} catch (e) {
  console.log("FAILED:", String(e));
  await page.screenshot({ path: "e2e/voice-fail.png" }).catch(() => {});
} finally {
  await browser.close();
}
