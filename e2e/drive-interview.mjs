// End-to-end interview automation: logs in, runs a system-design interview at a
// given level, DRAWS an architecture diagram on the Excalidraw whiteboard (so the
// canvas feeds the evaluation), then ends & evaluates.
//
// Usage:  node e2e/drive-interview.mjs <senior|staff> [problemId] [base]
//   e.g.  node e2e/drive-interview.mjs staff rate-limiter http://127.0.0.1:4500
//
// Requires env EMAIL / PASSWORD (or edit defaults below).
import { chromium } from "playwright";
import fs from "node:fs";

const LEVEL = (process.argv[2] || "senior").toLowerCase();
const PROBLEM = process.argv[3] || "rate-limiter";
const BASE = process.argv[4] || "http://127.0.0.1:4500";
const EMAIL = process.env.IB_EMAIL;
const PASSWORD = process.env.IB_PASSWORD;
if (!EMAIL || !PASSWORD) { console.error("Set IB_EMAIL and IB_PASSWORD env vars to run this script."); process.exit(1); }
const SHOTS = `/tmp/ib-shots`;
fs.mkdirSync(SHOTS, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ── Design content per level ──────────────────────────────────────────────
// Each design: component boxes (laid out in a grid) + directed connections.
const DESIGNS = {
  senior: {
    components: [
      "Clients", "Load Balancer", "API Gateway\n(RL middleware)", "Redis\n(token buckets)",
      "Config Service", "Upstream Service", "Metrics",
    ],
    links: [[0, 1], [1, 2], [2, 3], [2, 5], [4, 2], [2, 6]],
    turns: [
      `Clarifying first: distributed (shared across app servers) or per-instance? Peak QPS and number of API keys? Limit per API-key/route, per user, or per IP? Strict accuracy or is small boundary overshoot OK? On limiter failure — fail open or fail closed?`,
      `Assuming distributed, ~50k rps, per-API-key per-route limits, small overshoot OK, fail-open. I'll sketch the architecture on the whiteboard and walk you through the end-to-end flow.`,
      `Algorithm is token bucket per {apiKey,route}: a Lua script on Redis refills by elapsed time and decrements atomically, returning allow/deny — no read-modify-write race. Idle keys get a TTL. Rate/burst per route comes from the Config Service, cached at the gateway.`,
      `Failure handling: if Redis is unreachable the gateway fails open behind a local circuit breaker and emits a degraded-enforcement metric. For a hot key I shard it into N sub-buckets each at rate/N and sum allowances.`,
    ],
  },
  staff: {
    components: [
      "Clients", "Global LB\n(anycast)", "API Gateway\n(RL middleware)", "Local Circuit\nBreaker",
      "Redis Cluster\n(token buckets)", "Config Service\n(per-tier rules)", "Upstream Service",
      "Metrics +\nDashboards", "Async Reconciler\n(global cap)", "Alerting",
    ],
    links: [[0, 1], [1, 2], [2, 3], [3, 4], [5, 2], [2, 6], [2, 7], [4, 8], [7, 9]],
    turns: [
      `Before designing, I want to pin scope and SLOs: is enforcement per-region or a strict global cap? Target QPS, key cardinality, and tail-latency budget the limiter can add (e.g. <1ms p99)? Multi-tenant tiers with different limits? Blast radius if the limiter is wrong — do we fail open or closed, and is that per-route configurable?`,
      `I'll assume multi-region with per-region enforcement and an async-reconciled global cap, 50k rps/region, p99 budget <1ms, multi-tenant tiers, fail-open default but fail-closed configurable for sensitive routes. Let me put the full architecture on the whiteboard.`,
      `Token bucket per {apiKey,route} via an atomic Lua script on the Redis cluster (refill+consume in one round trip). Per-tier rate/burst rules come from the Config Service and are cached at the gateway with a short TTL and a push-invalidation channel so limit changes propagate in seconds.`,
      `Operational maturity: each region enforces rate/regions locally to keep the hot path single-region; an async reconciler aggregates counters for a true global cap with bounded eventual consistency. The gateway fails open behind a circuit breaker, emits per-key allow/deny + 429 + bucket-saturation metrics to dashboards, and alerting fires on enforcement-degraded or saturation. Rollout of new limits is staged per-tier and reversible.`,
      `On hot keys and fairness: a single super-hot key is sharded into N sub-buckets (key:0..N-1) at rate/N to spread load across slots, trading a little boundary accuracy. For abuse I'd layer a coarse IP/edge limit before the per-key limit so one tenant can't exhaust shared capacity.`,
    ],
  },
};

// ── Uber / ride-sharing (geospatial matching) ──
const UBER = {
  staff: {
    components: [
      "Rider App", "Driver App", "API Gateway", "Location Ingestion\n(driver pings)",
      "Kafka\n(loc stream)", "Driver Location\nCache (Redis GEO)", "Geo Index\n(S2 cells, sharded)",
      "Matching Service", "Trip Service", "Surge / Pricing", "Trips DB\n(sharded by city)", "Dispatch /\nNotifications",
    ],
    links: [[0, 2], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [2, 7], [7, 6], [7, 8], [8, 10], [8, 11], [7, 9], [4, 9]],
    turns: [
      `Before I design, let me pin scope and SLOs: scale — concurrent riders/drivers and the location-update rate (drivers ping every few seconds)? Match latency SLO, e.g. p99 < 2s? Global multi-city or single region? Consistency — strong for trip state but eventual for driver location? Blast radius if matching is slow/wrong — do we degrade gracefully? Are surge pricing and ETA in v1 scope?`,
      `I'll assume 10M daily riders, ~1M concurrently-active drivers pinging every 4s (~250k location updates/sec), match p99 < 2s, multi-city global, strong consistency for trip state and eventual for location, surge in scope. Let me lay the full architecture on the whiteboard and walk the flow.`,
      `Geospatial core: driver pings flow through a high-throughput ingestion tier onto Kafka, decoupled from matching so a ping spike never stalls matches. A consumer updates a Redis GEO driver-location cache and an in-memory geo index built on S2 cells, sharded by city/region. Matching queries the index for candidate drivers within a radius of the rider's pickup and ranks them by ETA, not raw distance.`,
      `Matching correctness: a match is a read on the geo index plus a write to claim a driver. I serialize the claim with a per-driver compare-and-set on driver state in the cache, so two concurrent riders can't grab the same driver. Trip state lives in a strongly-consistent store sharded by city; driver location stays eventual and TTL'd, since a few seconds of staleness is fine.`,
      `Scale and ops: sharding by city keeps geo queries local and bounds fan-out; cross-city trips route to the pickup region. Surge is computed per S2 cell from supply/demand on the Kafka stream. On degradation, matching widens the search radius or serves a slightly stale cache rather than failing the ride. I'd add dashboards for match latency, match success rate, and driver utilization, with alerting on SLO breach, and stage any matching-algorithm changes behind a per-city flag so rollouts are reversible.`,
    ],
  },
  senior: {
    components: [
      "Rider App", "Driver App", "API Gateway", "Location Service",
      "Redis GEO\n(driver cache)", "Matching Service", "Trip Service", "Trips DB",
    ],
    links: [[0, 2], [1, 2], [2, 3], [3, 4], [2, 5], [5, 4], [5, 6], [6, 7]],
    turns: [
      `Clarifying: scale and driver location-update rate? Match latency target? Single city or global? Strong consistency for trips, eventual for location? Surge in scope?`,
      `Assume large scale, drivers ping every ~4s, match p99 < 2s, multi-city, eventual location / consistent trips. Let me sketch the architecture on the whiteboard.`,
      `Drivers send location to a Location Service that updates a Redis GEO cache keyed by city. Matching does a geo radius query for nearby drivers, ranks by ETA, and claims a driver via an atomic state update so no double-booking. Trip state goes to a consistent Trips DB sharded by city.`,
      `On failure or load, matching widens the radius or uses a slightly stale cache instead of failing; location is TTL'd so dead drivers age out. Sharding by city keeps geo queries local.`,
    ],
  },
};

const BY_PROBLEM = { "rate-limiter": DESIGNS, "uber-lyft": UBER };
const designSet = BY_PROBLEM[PROBLEM] || DESIGNS;
const design = designSet[LEVEL] || designSet.senior || designSet.staff;

// ── Excalidraw element factory (full required fields so updateScene renders) ──
const rnd = () => Math.floor(Math.random() * 2 ** 31);
const base = (over) => ({
  angle: 0, strokeColor: "#1e1e1e", backgroundColor: "transparent", fillStyle: "solid",
  strokeWidth: 2, strokeStyle: "solid", roughness: 1, opacity: 100, groupIds: [],
  frameId: null, roundness: null, seed: rnd(), versionNonce: rnd(), version: 1,
  isDeleted: false, boundElements: null, updated: 1, link: null, locked: false, ...over,
});
function buildScene(components, links) {
  // Larger boxes, readable font, 3-column layout with generous spacing.
  const COLS = 3, BW = 230, BH = 96, GX = 130, GY = 120, X0 = 80, Y0 = 80;
  const pos = components.map((_, i) => ({
    x: X0 + (i % COLS) * (BW + GX),
    y: Y0 + Math.floor(i / COLS) * (BH + GY),
  }));
  const els = [];
  components.forEach((label, i) => {
    const boxId = `box-${i}`, txtId = `txt-${i}`;
    // Bind the label to the box so it stays centered (container/boundElements).
    els.push(base({
      id: boxId, type: "rectangle", x: pos[i].x, y: pos[i].y, width: BW, height: BH,
      backgroundColor: "#f1f3f5", fillStyle: "solid", roundness: { type: 3 },
      boundElements: [{ id: txtId, type: "text" }],
    }));
    els.push(base({
      id: txtId, type: "text", x: pos[i].x + 12, y: pos[i].y + BH / 2 - 18,
      width: BW - 24, height: 36, text: label, fontSize: 18, fontFamily: 2,
      textAlign: "center", verticalAlign: "middle", containerId: boxId,
      originalText: label, lineHeight: 1.25,
    }));
  });
  // Edge-to-edge arrows (exit bottom/side of source, enter top/side of target)
  // bound to the boxes so they stay attached and read cleanly.
  links.forEach(([a, b], i) => {
    const sameRow = Math.floor(a / COLS) === Math.floor(b / COLS);
    const ax = pos[a].x + BW / 2, bx = pos[b].x + BW / 2;
    const startX = sameRow ? (bx > ax ? pos[a].x + BW : pos[a].x) : ax;
    const startY = sameRow ? pos[a].y + BH / 2 : pos[a].y + BH;
    const endX = sameRow ? (bx > ax ? pos[b].x : pos[b].x + BW) : bx;
    const endY = sameRow ? pos[b].y + BH / 2 : pos[b].y;
    els.push(base({
      id: `arr-${i}`, type: "arrow", x: startX, y: startY,
      width: endX - startX, height: endY - startY,
      points: [[0, 0], [endX - startX, endY - startY]], lastCommittedPoint: null,
      startBinding: { elementId: `box-${a}`, focus: 0, gap: 4 },
      endBinding: { elementId: `box-${b}`, focus: 0, gap: 4 },
      startArrowhead: null, endArrowhead: "arrow",
    }));
  });
  return els;
}

const browser = await chromium.launch({ headless: false, slowMo: 50 });
const page = await browser.newPage({ viewport: { width: 1500, height: 920 } });
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("hmr")) log("PAGEERR:", m.text().slice(0, 120)); });

async function send(text, idx) {
  const ta = page.locator("textarea");
  await ta.click(); await ta.fill(text);
  await page.waitForTimeout(250);
  await page.keyboard.press("Control+Enter");
  await page.waitForFunction(() => document.querySelector("textarea")?.disabled === true, { timeout: 12000 }).catch(() => {});
  await page.waitForFunction(() => document.querySelector("textarea")?.disabled === false, { timeout: 150000 });
  log(`✓ turn ${idx} replied`);
}

try {
  log(`level=${LEVEL} problem=${PROBLEM}`);
  // Login
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /^Sign in$/ }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25000 });
  log("✓ logged in");

  // Start at the chosen level
  await page.goto(`${BASE}/interview/new?problem=${PROBLEM}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const levelName = LEVEL === "staff" ? /Staff/ : LEVEL === "mid" ? /Mid/ : /Senior/;
  await page.getByRole("button", { name: levelName }).click().catch(() => {});
  await page.getByRole("button", { name: /Start Interview/ }).click();
  await page.waitForURL(/\/interview\/[0-9a-f-]{8,}$/i, { timeout: 25000 });
  const sid = page.url().split("/").pop();
  log("✓ session", sid);
  await page.waitForSelector("textarea", { timeout: 20000 });
  await page.waitForTimeout(1000);

  // Turns 1-2: clarify + announce design
  await send(design.turns[0], 1);
  await send(design.turns[1], 2);

  // DRAW the architecture on the whiteboard via the Excalidraw API
  log("→ drawing architecture on whiteboard");
  const scene = buildScene(design.components, design.links);
  const ok = await page.evaluate((els) => {
    const api = window.__excalidrawAPI;
    if (!api) return "no-api";
    api.updateScene({ elements: els });
    api.scrollToContent && api.scrollToContent(els, { fitToContent: true });
    return "ok";
  }, scene);
  log("  updateScene:", ok, `(${design.components.length} boxes, ${design.links.length} arrows)`);
  // wait for debounced canvas save (footer flips to "canvas saved")
  await page.waitForFunction(() => document.body.innerText.includes("canvas saved"), { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/diagram-${LEVEL}.png` });
  log("✓ diagram drawn & saved");

  // Remaining deep-dive turns
  for (let i = 2; i < design.turns.length; i++) await send(design.turns[i], i + 1);

  // End & evaluate
  log("→ End & Evaluate");
  await page.getByRole("button", { name: /End & Evaluate/ }).click();
  await page.getByRole("button", { name: /Yes, end/ }).click({ timeout: 3000 }).catch(() => {});
  await page.waitForURL(/\/result$/, { timeout: 180000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/result-${LEVEL}.png` });
  const body = await page.evaluate(() => document.body.innerText);
  const score = body.match(/(\d{1,2})\s*\/\s*(\d{1,2}|NaN)/);
  log("RESULT:", (body.match(/Not Ready|Borderline|Strong Hire/) || ["?"])[0], "|", score ? score[0] : "?");
  console.log("SID=" + sid);
} catch (e) {
  log("ERROR:", e.message.split("\n")[0]);
  await page.screenshot({ path: `${SHOTS}/error-${LEVEL}.png` }).catch(() => {});
  process.exitCode = 1;
} finally {
  await page.waitForTimeout(2000);
  await browser.close();
}
