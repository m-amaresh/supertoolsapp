import type { NextConfig } from "next";
import {
  GA_CONNECT_HOSTS,
  GA_IMG_HOSTS,
  GA_SCRIPT_HOSTS,
  isAnalyticsConfigured,
} from "./src/lib/analytics";

const isDev = process.env.NODE_ENV !== "production";

// Only configured GA builds allow third-party hosts; the consent banner is self-hosted.
const withAnalytics = isAnalyticsConfigured();
const gaScript = withAnalytics ? ` ${GA_SCRIPT_HOSTS.join(" ")}` : "";
const gaConnect = withAnalytics ? ` ${GA_CONNECT_HOSTS.join(" ")}` : "";
const gaImg = withAnalytics ? ` ${GA_IMG_HOSTS.join(" ")}` : "";

// Vercel Analytics + Speed Insights load debug scripts from these hosts only
// in dev. Production uses same-origin `/_vercel/insights/*` paths rewritten
// by Vercel's edge, so CSP stays strict in prod.
const vercelInsightsScript = "https://va.vercel-scripts.com";
const vercelInsightsEvents = "https://vitals.vercel-insights.com";

// Workers use the CSP of their own script response. Scope qpdf's required
// 'wasm-unsafe-eval' to /pdf/ so pages and other workers keep the strict policy.
function buildCsp({ allowWasm }: { allowWasm: boolean }): string {
  const scriptSrc = [
    "script-src 'self' 'unsafe-inline'",
    isDev ? " 'unsafe-eval'" : "",
    allowWasm ? " 'wasm-unsafe-eval'" : "",
  ].join("");

  return [
    "default-src 'self'",
    scriptSrc,
    `script-src-elem 'self' 'unsafe-inline'${isDev ? ` ${vercelInsightsScript}` : ""}${gaScript}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${gaImg}`,
    "font-src 'self' data:",
    `connect-src 'self'${isDev ? ` ${vercelInsightsScript} ${vercelInsightsEvents}` : ""}${gaConnect}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

const contentSecurityPolicy = buildCsp({ allowWasm: false });
const wasmWorkerContentSecurityPolicy = buildCsp({ allowWasm: true });

const baseSecurityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const securityHeaders = [
  ...baseSecurityHeaders,
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
];

const wasmWorkerSecurityHeaders = [
  ...baseSecurityHeaders,
  {
    key: "Content-Security-Policy",
    value: wasmWorkerContentSecurityPolicy,
  },
];

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  async headers() {
    return [
      // Avoid overlapping CSP headers: browsers enforce their intersection,
      // which would remove the /pdf/ worker's 'wasm-unsafe-eval' permission.
      {
        source: "/pdf/:path*",
        headers: wasmWorkerSecurityHeaders,
      },
      {
        source: "/:path((?!pdf/).*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
