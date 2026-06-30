import "./load-env.mjs";
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:3000";
const EMAIL = process.env.IB_EMAIL;
const PASSWORD = process.env.IB_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error("Set IB_EMAIL and IB_PASSWORD (in .env.local) to run this script.");
  process.exit(1);
}

const OUT = "docs/screenshots";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1024 }, deviceScaleFactor: 2 });
const log = {};

// ── login ──
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.locator('input[type="email"]').fill(EMAIL);
await page.locator('input[type="password"]').fill(PASSWORD);
await page.getByRole("button", { name: /^Sign in$/ }).click();
try {
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });
  log.login = "ok";
} catch {
  log.login = "FAILED — IB_PASSWORD in .env.local likely stale after rotation";
  console.log(JSON.stringify(log, null, 2));
  await browser.close();
  process.exit(2);
}

// ── catalog (home) ──
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/catalog.png` });
log.catalog = "ok";

// discover session links from the dashboard
await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
await page.waitForTimeout(900);
const dots = page.locator("svg circle");
const n = await dots.count();
if (n > 0) await dots.nth(n - 1).hover().catch(() => {});
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/dashboard.png` });
log.dashboard = "ok";

const resultHrefs = await page.locator('a[href*="/result"]').evaluateAll((els) => els.map((e) => e.getAttribute("href")));
const activeHrefs = await page
  .locator('a[href*="/interview/"]:not([href*="/result"])')
  .evaluateAll((els) => els.map((e) => e.getAttribute("href")));
log.found = { results: resultHrefs.slice(0, 3), active: activeHrefs.slice(0, 3) };

// ── result page ──
if (resultHrefs[0]) {
  await page.goto(`${BASE}${resultHrefs[0]}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/result.png` });
  log.result = "ok";
}

// ── interview shell (prefer an active SD session; else open the first active) ──
const shellHref = activeHrefs[0];
if (shellHref) {
  await page.goto(`${BASE}${shellHref}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500); // let Excalidraw / editor mount
  await page.screenshot({ path: `${OUT}/interview.png` });
  log.interview = "ok";
} else {
  log.interview = "no active session found — start one to capture the shell";
}

console.log(JSON.stringify(log, null, 2));
await browser.close();
