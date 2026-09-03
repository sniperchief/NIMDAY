import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @nimiq/core ships a large WASM bundle and is only ever imported in server code
  // (auth signature verification). Keep it external so Next doesn't try to bundle it.
  serverExternalPackages: ["@nimiq/core"],
  experimental: {
    // allow importing the WASM-backed package from server components / route handlers
  },
};

export default nextConfig;
