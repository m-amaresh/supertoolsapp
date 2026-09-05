"use client";

import { useEffect, useState } from "react";

// Last-resort error boundary — renders outside ThemeProvider and layout,
// so it uses pure inline styles with matchMedia-based dark mode detection.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    console.error("[GlobalError]", error);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [error]);

  const bg = isDark ? "#0a0a0a" : "#fff";
  const fg = isDark ? "#eee" : "#111";
  const cardBg = isDark ? "#1a1a1a" : "#fff";
  const cardBorder = isDark ? "#333" : "#e5e5e5";
  const subColor = isDark ? "#999" : "#666";

  return (
    <html lang="en">
      <body style={{ backgroundColor: bg, color: fg, margin: 0 }}>
        <div style={{ minHeight: "100vh", padding: "1.5rem" }}>
          <div
            style={{
              maxWidth: "42rem",
              borderRadius: "0.5rem",
              border: `1px solid ${cardBorder}`,
              background: cardBg,
              padding: "1.25rem",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            }}
          >
            <h2
              style={{
                fontSize: "18px",
                fontWeight: 600,
                letterSpacing: "-0.01em",
                margin: 0,
              }}
            >
              Application error
            </h2>
            <p
              style={{
                marginTop: "0.5rem",
                fontSize: "14px",
                color: subColor,
                marginBottom: 0,
              }}
            >
              An unrecoverable error occurred in the app shell.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: "1rem",
                display: "inline-flex",
                height: "2rem",
                alignItems: "center",
                gap: "0.375rem",
                borderRadius: "0.375rem",
                background: "#2563eb",
                padding: "0 0.875rem",
                fontSize: "13px",
                fontWeight: 500,
                color: "#fff",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              }}
            >
              Reload app
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
