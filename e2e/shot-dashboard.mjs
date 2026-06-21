import { chromium } from "playwright";

const BASE = process.argv[2] || "http://127.0.0.1:4600";
const EMAIL = process.env.IB_EMAIL || "***REDACTED***";
const PASSWORD = process.env.IB_PASSWORD || "***REDACTED***";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.locator('input[type="email"]').fill(EMAIL);
await page.locator('input[type="password"]').fill(PASSWORD);
await page.getByRole("button", { name: /^Sign in$/ }).click();
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });

await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

// Hover the last trend point to exercise the tooltip
const dots = page.locator("svg circle");
const n = await dots.count();
if (n > 0) await dots.nth(n - 1).hover().catch(() => {});
await page.waitForTimeout(300);

await page.screenshot({ path: "e2e/dashboard.png", fullPage: true });

const hasProgress = await page.getByText("Progress", { exact: true }).count();
const hasTrend = await page.getByText("Score trend").count();
const hasMastery = await page.getByText(/Dimension mastery/).count();
const hasGaps = await page.getByText("Recurring gaps").count();
const totalText = await page.locator("text=/\\d+\\/(10|14)/").allInnerTexts().catch(() => []);

console.log(JSON.stringify({ hasProgress, hasTrend, hasMastery, hasGaps, dots: n, totals: totalText.slice(0, 8), errors }, null, 2));

await browser.close();
