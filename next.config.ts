import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root. Without this, Turbopack walks up and finds the
  // stray package-lock.json in the home directory, then warns on every build.
  turbopack: { root: path.resolve(process.cwd()) },

  async headers() {
    return [
      {
        // The SW must not be cached, or a stale worker pins users to an old
        // build. The browser revalidates it on every load anyway; this makes
        // that explicit and survives CDN defaults.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
