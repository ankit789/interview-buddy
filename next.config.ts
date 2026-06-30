import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// Pin the workspace root to this project. A stray lockfile in a parent
// directory (~/package-lock.json) otherwise makes Turbopack infer the wrong
// root, which breaks client asset resolution and hydration.
const projectRoot = dirname(fileURLToPath(import.meta.url));

const isProd = process.env.NODE_ENV === "production";

// Supabase is reached directly from the browser (auth, postgrest, realtime),
// so it must be allowlisted in connect-src. Everything else (LLM/TTS providers)
// is called server-side and doesn't need a browser origin.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseConnect = supabaseUrl
  ? `${supabaseUrl} ${supabaseUrl.replace(/^https/, "wss")}`
  : "";

// Production CSP. We use 'unsafe-inline' for scripts because the pre-paint theme
// bootstrap + the framework's inline runtime are inline and there's no nonce
// pipeline yet (a nonce would force every page to render dynamically). Tightening
// to a nonce-based policy is a tracked follow-up.
const csp = [
  `default-src 'self'`,
  `base-uri 'self'`,
  `object-src 'none'`,
  `frame-ancestors 'none'`,
  `form-action 'self'`,
  `img-src 'self' data: blob: https:`,
  `font-src 'self'`,
  `style-src 'self' 'unsafe-inline'`,
  `script-src 'self' 'unsafe-inline'`,
  `connect-src 'self' ${supabaseConnect}`.trim(),
  `media-src 'self' blob: data:`,
  `worker-src 'self' blob:`,
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Voice mode uses the Web Speech API, so microphone is allowed for same-origin.
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  // CSP only in production — the dev server needs inline eval + ws for HMR.
  ...(isProd ? [{ key: "Content-Security-Policy", value: csp }] : []),
];

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  // Allow the dev server's HMR/dev-resource requests from these origins.
  // Without this, Next 16 blocks /_next/* dev requests from non-localhost
  // origins (e.g. 127.0.0.1 or the LAN IP), which starves the client runtime
  // and prevents hydration in `next dev`.
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.0.5"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
