export type EscapeMode = "html" | "json" | "url" | "regex";

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const HTML_UNESCAPE_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;

// Escape special characters for a given context so they render as literals.
export function escapeString(input: string, mode: EscapeMode): string {
  if (!input) return "";

  switch (mode) {
    case "html":
      return input.replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch] || ch);

    case "json":
      return JSON.stringify(input).slice(1, -1);

    case "url":
      return encodeURIComponent(input);

    case "regex":
      return input.replace(REGEX_SPECIAL, "\\$&");
  }
}

// Reverse escape sequences back to their original characters.
export function unescapeString(input: string, mode: EscapeMode): string {
  if (!input) return "";

  switch (mode) {
    case "html":
      return input.replace(
        /&(?:amp|lt|gt|quot|#39);/g,
        (entity) => HTML_UNESCAPE_MAP[entity] || entity,
      );

    // Handle all JSON escape sequences defined in RFC 8259 §7.
    case "json":
      return input.replace(/\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4})/g, (seq) => {
        switch (seq[1]) {
          case '"':
            return '"';
          case "\\":
            return "\\";
          case "/":
            return "/";
          case "b":
            return "\b";
          case "f":
            return "\f";
          case "n":
            return "\n";
          case "r":
            return "\r";
          case "t":
            return "\t";
          default:
            return String.fromCharCode(parseInt(seq.slice(2), 16));
        }
      });

    case "url":
      try {
        return decodeURIComponent(input);
      } catch {
        return input;
      }

    case "regex":
      return input.replace(/\\([.*+?^${}()|[\]\\])/g, "$1");
  }
}

export const ESCAPE_MODE_LABELS: Record<EscapeMode, string> = {
  html: "HTML Entities",
  json: "JSON",
  url: "URL (Percent)",
  regex: "Regex",
};
