import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // argon2 (src/lib/auth/password.ts) ships native bindings — keep it out of
  // the server bundle rather than letting the bundler try to inline it.
  serverExternalPackages: ["argon2"],

  async headers() {
    return [
      {
        // /reset carries a single-use account-recovery token in its query
        // string. Without this, any outbound request the page makes would
        // put that token in a Referer header. The app serves no third-party
        // assets today, so this costs nothing and stops the leak becoming
        // possible the first time one is added.
        source: "/reset",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          // A reset link must not be cached or indexed if it ends up
          // pasted somewhere it shouldn't be.
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
