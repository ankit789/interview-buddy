import { chromium } from "playwright";

const BASE = process.argv[2] || "http://127.0.0.1:4500";
const PROBLEM = process.argv[3] || "parking-lot";
const EMAIL = process.env.IB_EMAIL || "***REDACTED***";
const PASSWORD = process.env.IB_PASSWORD || "***REDACTED***";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const failedReqs = [];
page.on("response", (r) => {
  if (r.url().includes("/api/interview/code") && !r.ok())
    failedReqs.push(`code POST ${r.status()}`);
});

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.locator('input[type="email"]').fill(EMAIL);
await page.locator('input[type="password"]').fill(PASSWORD);
await page.getByRole("button", { name: /^Sign in$/ }).click();
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });

await page.goto(`${BASE}/interview/new?problem=${PROBLEM}`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Start Interview/ }).click();
await page.waitForURL(/\/interview\/[0-9a-f-]+$/, { timeout: 25000 });
await page.waitForTimeout(2500); // editor dynamic import

// The CodeMirror editor mounts into a .cm-editor element
const editorVisible = await page.locator(".cm-editor").count();

// Type some code into the editor
await page.locator(".cm-content").click();
await page.keyboard.type("class ParkingLot {\n  private List<Level> levels;\n  public boolean park(Vehicle v) {\n    return true;\n  }\n}");
await page.waitForTimeout(300);

// Switch language to Java via the select
await page.locator("select").selectOption("java").catch(() => {});
await page.waitForTimeout(300);

// Wait out the autosave debounce (2s) + network
await page.waitForTimeout(3000);

const saveLabel = await page.locator("text=/code saved|saving…/").innerText().catch(() => "?");
await page.screenshot({ path: "e2e/lld.png" });

console.log(
  JSON.stringify(
    { editorVisible, saveLabel, codeApiFailures: failedReqs, errors },
    null,
    2
  )
);
await browser.close();
