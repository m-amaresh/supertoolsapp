import type { NextConfig } from "next";
import {
  GA_CONNECT_HOSTS,
  GA_IMG_HOSTS,
  GA_SCRIPT_HOSTS,
  isAnalyticsConfigured,
} from "./src/lib/analytics";

const isDev = process.env.NODE_ENV !== "production";

// Google Analytics is the only thing the site loads from another origin, and
// gtag.js cannot be self-hosted. The relaxation is therefore conditional: a
// build with no measurement ID — local development, or anyone running their
// own copy — keeps script-src naming nothing but 'self'.
//
// The consent banner does not appear here on purpose. It is vendored into
// public/consent/ precisely so that adding a cookie banner did not also mean
// trusting a CDN with script execution on every page.
const withAnalytics = isAnalyticsConfigured();
const gaScript = withAnalytics ? ` ${GA_SCRIPT_HOSTS.join(" ")}` : "";
const gaConnect = withAnalytics ? ` ${GA_CONNECT_HOSTS.join(" ")}` : "";
const gaImg = withAnalytics ? ` ${GA_IMG_HOSTS.join(" ")}` : "";

// Vercel Analytics + Speed Insights load debug scripts from these hosts only
// in dev. Production uses same-origin `/_vercel/insights/*` paths rewritten
// by Vercel's edge, so CSP stays strict in prod.
const vercelInsightsScript = "https://va.vercel-scripts.com";
const vercelInsightsEvents = "https://vitals.vercel-insights.com";

// The PDF unlock tool decrypts files with a WebAssembly build of qpdf, and
// instantiating WebAssembly requires 'wasm-unsafe-eval' in script-src.
//
// A dedicated worker takes its CSP from the response headers of its own script
// URL rather than from the page that spawned it, so the relaxation belongs on
// the worker's path — not on any page. The worker is served from `/pdf/`, which
// confines 'wasm-unsafe-eval' to that single directory: every page in the app,
// including the PDF tool itself, keeps the strict policy, and no other worker
// gains the capability.
//
// The engine is served same-origin from `public/pdf/`, so `connect-src 'self'`
// is unchanged and no cross-origin request is involved.
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
      // The `/pdf/` rule must come first, and the general rule must exclude
      // that path: when two matching rules both set Content-Security-Policy the
      // browser receives two headers and enforces their intersection, which
      // would strip 'wasm-unsafe-eval' straight back out.
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
