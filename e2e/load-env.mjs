// Side-effect import: loads .env.local into process.env for standalone e2e scripts.
// These run via plain `node`/`tsx`, which does NOT auto-read .env.local — so without this
// the scripts would have no IB_EMAIL / IB_PASSWORD. Existing real env vars win (not overwritten).
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
try {
  const raw = fs.readFileSync(join(root, ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (!(k in process.env)) process.env[k] = v;
  }
} catch {
  // No .env.local — fall back to whatever is already in the real environment.
}
