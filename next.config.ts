import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // argon2 (src/lib/auth/password.ts) ships native bindings — keep it out of
  // the server bundle rather than letting the bundler try to inline it.
  serverExternalPackages: ["argon2"],
};

export default nextConfig;
