// End-to-end SDET framework-design interview: senior-level conversation across the
// five framework phases + writes a real POM framework skeleton in the code editor,
// then ends & evaluates. Confirms the FRAMED rubric scores live on the 0-3 scale.
import { chromium } from "playwright";
const LEVEL = (process.argv[2] || "senior").toLowerCase();
const PROBLEM = process.argv[3] || "design-ui-test-framework";
const BASE = process.argv[4] || "http://127.0.0.1:4500";
const EMAIL = process.env.IB_EMAIL || "***REDACTED***";
const PASSWORD = process.env.IB_PASSWORD || "***REDACTED***";
const log = (...a) => console.log("[sdet-fw]", ...a);
const errors = [];

const CODE = `import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.WebDriverWait;
import java.time.Duration;

// Thread-safe driver management for parallel execution (Singleton-per-thread).
final class DriverManager {
    private static final ThreadLocal<WebDriver> TL = new ThreadLocal<>();
    static WebDriver get() { return TL.get(); }
    static void set(WebDriver d) { TL.set(d); }
    static void quit() { if (TL.get() != null) { TL.get().quit(); TL.remove(); } }
}

// Factory abstracts the browser/platform choice (open-closed: add a browser, not edit callers).
interface DriverFactory { WebDriver create(); }
class ChromeDriverFactory implements DriverFactory { public WebDriver create() { /* configure ChromeOptions */ return null; } }

// Base page: shared waits + element helpers so page objects stay thin and deterministic.
abstract class BasePage {
    protected final WebDriver driver = DriverManager.get();
    protected final WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));
    protected void click(org.openqa.selenium.By locator) {
        wait.until(d -> d.findElement(locator).isDisplayed());
        driver.findElement(locator).click();   // explicit wait, no Thread.sleep
    }
}

// A concrete page object — only locators + intent-revealing methods, no assertions.
class LoginPage extends BasePage {
    private static final org.openqa.selenium.By USER = org.openqa.selenium.By.id("user");
    private static final org.openqa.selenium.By PASS = org.openqa.selenium.By.id("pass");
    public HomePage loginAs(String u, String p) { type(USER, u); type(PASS, p); click(org.openqa.selenium.By.id("submit")); return new HomePage(); }
    private void type(org.openqa.selenium.By b, String v) { wait.until(d -> d.findElement(b)); driver.findElement(b).sendKeys(v); }
}
class HomePage extends BasePage {}

// Test data via Builder so tests read intentionally and defaults stay DRY.
class User { String name, pass; }
class UserBuilder { private final User u = new User(); UserBuilder name(String n){u.name=n;return this;} UserBuilder pass(String p){u.pass=p;return this;} User build(){return u;} }

// Base test: per-method driver lifecycle (parallel-safe) + reporting hook.
abstract class BaseTest {
    void setup(DriverFactory f) { DriverManager.set(f.create()); }
    void teardown() { DriverManager.quit(); }
}
`;

const TURNS = [
  `Let me scope it. Which stack — Selenium or Playwright, and which language? Single browser or cross-browser? Do we need parallel execution and a CI/device target? Roughly how many tests will this scale to? I'll assume Selenium + Java, cross-browser, parallel execution in CI, scaling to a few hundred UI tests, with Allure reporting.`,
  `Architecture is layered: a driver layer (thread-safe DriverManager + a DriverFactory per browser), a page layer (BasePage with shared waits/helpers, one page object per screen exposing intent-revealing methods and returning the next page), a test layer (BaseTest owning per-method driver lifecycle), and test data via builders. Tests never touch WebDriver directly. I'll write the core classes in the editor.`,
  `Patterns: Factory for driver creation so adding a browser is a new class, not edited callers (open-closed); a thread-local Singleton for the driver so parallel tests don't share state; Builder for test data; and page objects encapsulating locators so a UI change touches one file. I avoid a base-class god-object by keeping BasePage to waits + low-level helpers only.`,
  `Reliability: no Thread.sleep anywhere — only explicit WebDriverWait conditions, and stable locators (ids/data-testids over XPath). Each test gets its own driver via ThreadLocal so they're isolated and parallel-safe; setup/teardown per method with a guaranteed quit() to avoid leaks. Flaky tests get a bounded retry listener, but I treat a retry as a bug to investigate, not a fix.`,
  `Extensibility & CI: a new screen is a new page object, a new browser is a new factory — no framework edits. Config (env URL, browser) is externalized so the same suite runs locally and in CI. In CI it runs in parallel on a Selenium Grid, gates the PR on failure, and publishes an Allure report with screenshots-on-failure; I'd track flake rate and pass rate over time.`,
];

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1500, height: 920 } });
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("hmr")) errors.push(m.text().slice(0,120)); });
const codeSaves = [];
page.on("response", (r) => { if (r.url().includes("/api/interview/code")) codeSaves.push(r.status()); });

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
  // confirm the code editor mounted (framework-design modality = code)
  const hasEditor = await page.waitForSelector(".cm-content", { timeout: 20000 }).then(() => true).catch(() => false);
  log("code editor present:", hasEditor);
  await page.waitForSelector("textarea", { timeout: 20000 });
  await page.waitForTimeout(800);

  await send(TURNS[0], 1);
  await send(TURNS[1], 2);

  log("writing framework code into editor");
  await page.locator(".cm-content").click();
  await page.locator(".cm-content").fill(CODE).catch(async () => {
    await page.keyboard.insertText(CODE);
  });
  await page.waitForFunction(() => document.body.innerText.includes("code saved"), { timeout: 10000 }).catch(() => {});
  log("code POST statuses:", JSON.stringify(codeSaves));

  for (let i = 2; i < TURNS.length; i++) await send(TURNS[i], i + 1);

  log("End & Evaluate");
  await page.getByRole("button", { name: /End & Evaluate/ }).click();
  await page.getByRole("button", { name: /Yes, end/ }).click({ timeout: 3000 }).catch(() => {});
  await page.waitForURL(/\/result$/, { timeout: 180000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  const body = await page.evaluate(() => document.body.innerText);
  const verdict = (body.match(/Not Ready|Borderline|Strong Hire/) || ["?"])[0];
  const score = (body.match(/(\d{1,2})\s*\/\s*(\d{1,2})/) || ["?"])[0];
  const codeTab = await page.getByRole("button", { name: /Code/ }).count().then(c => c > 0).catch(() => false);
  await page.screenshot({ path: "e2e/sdet-fw-result.png", fullPage: false });
  console.log(JSON.stringify({ sid, hasEditor, codeSaves, verdict, score, codeTab, errors }, null, 2));
} catch (e) {
  log("ERROR:", e.message.split("\n")[0]);
  await page.screenshot({ path: "e2e/sdet-fw-error.png" }).catch(() => {});
  process.exitCode = 1;
} finally {
  await b.close();
}
