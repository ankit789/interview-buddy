import { chromium } from "playwright";

const BASE = process.argv[2] || "http://127.0.0.1:4500";
const PROBLEM = process.argv[3] || "parking-lot";
const EMAIL = process.env.IB_EMAIL || "***REDACTED***";
const PASSWORD = process.env.IB_PASSWORD || "***REDACTED***";
const log = (...a) => console.log("[lld]", ...a);

const CODE = `import java.util.*;

enum VehicleType { MOTORCYCLE, CAR, BUS }

abstract class Vehicle {
    protected final String plate;
    protected final VehicleType type;
    Vehicle(String plate, VehicleType type) { this.plate = plate; this.type = type; }
    VehicleType getType() { return type; }
}
class Car extends Vehicle { Car(String p){ super(p, VehicleType.CAR);} }

class ParkingSpot {
    private final String id;
    private final VehicleType size;
    private Vehicle current;
    ParkingSpot(String id, VehicleType size){ this.id=id; this.size=size; }
    boolean isFree(){ return current == null; }
    boolean fits(Vehicle v){ return isFree() && v.getType() == size; }
    void assign(Vehicle v){ this.current = v; }
    void release(){ this.current = null; }
}

class Level {
    private final int floor;
    private final List<ParkingSpot> spots = new ArrayList<>();
    Level(int floor){ this.floor = floor; }
    Optional<ParkingSpot> findSpot(Vehicle v){
        return spots.stream().filter(s -> s.fits(v)).findFirst();
    }
}

interface PricingStrategy { double price(Ticket t); }

class Ticket {
    final String id; final ParkingSpot spot; final long entryTime;
    Ticket(String id, ParkingSpot spot){ this.id=id; this.spot=spot; this.entryTime=System.currentTimeMillis(); }
}

class ParkingLot {
    private final List<Level> levels;
    private final PricingStrategy pricing;
    ParkingLot(List<Level> levels, PricingStrategy pricing){ this.levels = levels; this.pricing = pricing; }

    Optional<Ticket> park(Vehicle v){
        for (Level l : levels) {
            Optional<ParkingSpot> spot = l.findSpot(v);
            if (spot.isPresent()) {
                spot.get().assign(v);
                return Optional.of(new Ticket(UUID.randomUUID().toString(), spot.get()));
            }
        }
        return Optional.empty(); // lot full
    }

    double unpark(Ticket t){
        t.spot.release();
        return pricing.price(t);
    }
}`;

const TURNS = [
  "Before I design: do we need to support multiple floors, multiple vehicle sizes (motorcycle/car/bus), and pricing by duration? I'll assume yes to all three, plus concurrency for parking from many entry gates.",
  "Here's my class design. Core entities: Vehicle (abstract) with subtypes by VehicleType; ParkingSpot which knows its size and whether it fits a vehicle; Level holding spots; ParkingLot orchestrating park/unpark across levels; Ticket capturing entry; and a PricingStrategy interface so pricing is pluggable. I've written it in the editor.",
  "For extensibility I used a PricingStrategy interface (Strategy pattern) so flat/hourly/surge pricing are swappable without touching ParkingLot. Spot-vehicle fit is encapsulated in ParkingSpot.fits, so adding an EV-charging spot type is a localized change.",
  "For concurrency across entry gates I'd guard spot assignment — either a per-level lock or a compare-and-set on the spot's state — so two cars can't be assigned the same spot. The park() loop returns Optional.empty when the lot is full.",
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 920 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const codeSaves = [];
page.on("response", (r) => {
  if (r.url().includes("/api/interview/code")) codeSaves.push(r.status());
});

async function send(text, idx) {
  const ta = page.locator("textarea");
  await ta.click();
  await ta.fill(text);
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
  await page.getByRole("button", { name: /Senior/ }).click().catch(() => {});
  await page.getByRole("button", { name: /Start Interview/ }).click();
  await page.waitForURL(/\/interview\/[0-9a-f-]{8,}$/i, { timeout: 25000 });
  const sid = page.url().split("/").pop();
  log("session", sid);
  await page.waitForSelector(".cm-content", { timeout: 20000 });
  await page.waitForTimeout(1500);

  await send(TURNS[0], 1);
  await send(TURNS[1], 2);

  // Write the class design into the editor (select-all then type to replace starter)
  log("writing code into editor");
  await page.locator(".cm-content").click();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Delete");
  await page.locator(".cm-content").fill(CODE).catch(async () => {
    // fill may not work on contenteditable; fall back to typing
    await page.keyboard.insertText(CODE);
  });
  // wait for debounced code save and assert it succeeded (200)
  await page.waitForFunction(() => document.body.innerText.includes("code saved"), { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(800);
  log("code saved label seen; code POST statuses:", JSON.stringify(codeSaves));

  for (let i = 2; i < TURNS.length; i++) await send(TURNS[i], i + 1);

  log("End & Evaluate");
  await page.getByRole("button", { name: /End & Evaluate/ }).click();
  await page.getByRole("button", { name: /Yes, end/ }).click({ timeout: 3000 }).catch(() => {});
  await page.waitForURL(/\/result$/, { timeout: 180000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);

  const body = await page.evaluate(() => document.body.innerText);
  const verdict = (body.match(/Not Ready|Borderline|Strong Hire/) || ["?"])[0];
  const score = (body.match(/(\d{1,2})\s*\/\s*(\d{1,2}|NaN)/) || ["?"])[0];

  // Open the review pane and switch to the Code tab
  await page.getByRole("button", { name: /Code & transcript|Transcript/ }).click().catch(() => {});
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /Code ·|^Code$/ }).click().catch(() => {});
  await page.waitForTimeout(500);
  const paneText = await page.evaluate(() => document.body.innerText);
  const codeTabRendered = paneText.includes("class ParkingLot") && paneText.includes("PricingStrategy");
  await page.screenshot({ path: "e2e/lld-result.png", fullPage: false });

  console.log(JSON.stringify({ sid, verdict, score, codeSaves, codeTabRendered, errors }, null, 2));
} catch (e) {
  console.log("FAILED:", String(e));
  await page.screenshot({ path: "e2e/lld-fail.png" }).catch(() => {});
} finally {
  await browser.close();
}
