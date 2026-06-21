import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

// Pin the workspace root to this project. A stray lockfile in a parent
// directory (~/package-lock.json) otherwise makes Turbopack infer the wrong
// root, which breaks client asset resolution and hydration.
const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  // Allow the dev server's HMR/dev-resource requests from these origins.
  // Without this, Next 16 blocks /_next/* dev requests from non-localhost
  // origins (e.g. 127.0.0.1 or the LAN IP), which starves the client runtime
  // and prevents hydration in `next dev`.
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.0.5"],
};

export default nextConfig;
