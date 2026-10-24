import type { NextConfig } from "next";

/** Security headers applied to every response. */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" }, // no embedding in other sites (clickjacking)
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The ingest/validation scripts and research data are not part of the app build.
  outputFileTracingExcludes: { "*": ["./scripts/**", "../gos/**"] },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Authenticated pages and API responses must never be cached by a CDN.
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
