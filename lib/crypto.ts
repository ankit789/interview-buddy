import crypto from "node:crypto";

// Server-only. Encrypts user-supplied secrets (LLM/TTS API keys) at rest so a database
// leak yields ciphertext, not usable keys. We ENCRYPT (reversible) rather than hash —
// the server must recover the real key to call the provider, so hashing is not an option.
//
// Master key lives only in env (SETTINGS_ENC_KEY), never in the DB. Exposing keys would
// require breaching BOTH the database and the server environment.

const ALGO = "aes-256-gcm";
const PREFIX = "v1"; // payload format marker, so we can evolve the scheme later

export type KeyField =
  | "mistral_api_key"
  | "cerebras_api_key"
  | "groq_api_key"
  | "gemini_api_key"
  | "anthropic_api_key"
  | "google_tts_api_key";

export const KEY_FIELDS: KeyField[] = [
  "mistral_api_key",
  "cerebras_api_key",
  "groq_api_key",
  "gemini_api_key",
  "anthropic_api_key",
  "google_tts_api_key",
];

function getKey(): Buffer {
  const raw = process.env.SETTINGS_ENC_KEY;
  if (!raw) {
    throw new Error(
      "SETTINGS_ENC_KEY is not set — required to encrypt/decrypt stored API keys."
    );
  }
  // Accept a 32-byte key supplied as base64 or hex; otherwise derive 32 bytes from the
  // passphrase via SHA-256 (forgiving, still high-entropy if the env value is a real secret).
  for (const enc of ["base64", "hex"] as const) {
    try {
      const b = Buffer.from(raw, enc);
      if (b.length === 32) return b;
    } catch {
      /* try next encoding */
    }
  }
  return crypto.createHash("sha256").update(raw, "utf8").digest();
}

// Returns "v1:<iv>:<tag>:<ciphertext>" (each part base64).
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

// Decrypts a "v1:" payload. Anything else (e.g. a legacy plaintext key written before this
// scheme existed) is returned as-is, so existing rows keep working until they're re-saved.
export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== PREFIX) return payload;
  const [, ivB, tagB, ctB] = parts;
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivB, "base64"));
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

// Decrypts every known key field on a settings row (no-op for null/empty/legacy values).
export function decryptSettings<T extends Record<string, unknown> | null | undefined>(
  row: T
): T {
  if (!row) return row;
  const out = { ...(row as Record<string, unknown>) };
  for (const f of KEY_FIELDS) {
    const v = out[f];
    if (typeof v === "string" && v) out[f] = decryptSecret(v);
  }
  return out as T;
}
