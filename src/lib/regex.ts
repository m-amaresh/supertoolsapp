export interface RegexMatch {
  fullMatch: string;
  index: number;
  length: number;
  groups: string[];
  namedGroups: Record<string, string>;
}

export interface RegexResult {
  matches: RegexMatch[];
  error: string | null;
}

export interface RegexPreset {
  name: string;
  pattern: string;
  flags: string;
  description: string;
}

export interface RegexFlagState {
  g: boolean;
  i: boolean;
  m: boolean;
  s: boolean;
  u: boolean;
}

export function regexFlagStateFromFlags(flags: string): RegexFlagState {
  return {
    g: flags.includes("g"),
    i: flags.includes("i"),
    m: flags.includes("m"),
    s: flags.includes("s"),
    u: flags.includes("u"),
  };
}

export function regexFlagsToString(flagState: RegexFlagState): string {
  let flags = "";
  if (flagState.g) flags += "g";
  if (flagState.i) flags += "i";
  if (flagState.m) flags += "m";
  if (flagState.s) flags += "s";
  if (flagState.u) flags += "u";
  return flags;
}

export const regexPresets: RegexPreset[] = [
  {
    name: "Email",
    pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
    flags: "g",
    description: "Match email addresses",
  },
  {
    name: "URL",
    pattern: "https?://[\\w\\-._~:/?#\\[\\]@!$&'()*+,;=%]+",
    flags: "g",
    description: "Match HTTP/HTTPS URLs",
  },
  {
    name: "IPv4",
    pattern: "\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b",
    flags: "g",
    description: "Match IPv4 addresses",
  },
  {
    name: "Hex Color",
    pattern: "#(?:[0-9a-fA-F]{3}){1,2}\\b",
    flags: "g",
    description: "Match hex color codes",
  },
  {
    name: "Phone (US)",
    pattern: "(?:\\+?1[-.\\s]?)?\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}",
    flags: "g",
    description: "Match US phone numbers",
  },
  {
    name: "Date (YYYY-MM-DD)",
    pattern: "\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])",
    flags: "g",
    description: "Match ISO date format",
  },
  {
    name: "Date (DD/MM/YYYY)",
    pattern: "(?:0[1-9]|[12]\\d|3[01])/(?:0[1-9]|1[0-2])/\\d{4}",
    flags: "g",
    description: "Match slash date format",
  },
  {
    name: "Datetime (ISO 8601)",
    pattern:
      "\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])T(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d)?(?:\\.\\d{1,3})?(?:Z|[+-](?:[01]\\d|2[0-3]):?[0-5]\\d)?",
    flags: "g",
    description: "Match ISO 8601 timestamps",
  },
  {
    name: "Time (24h)",
    pattern: "\\b(?:[01]\\d|2[0-3]):[0-5]\\d(?:[:][0-5]\\d)?\\b",
    flags: "g",
    description: "Match 24-hour time",
  },
  {
    name: "UUID v4",
    pattern:
      "\\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\\b",
    flags: "g",
    description: "Match UUID version 4",
  },
  {
    name: "MAC Address",
    pattern: "\\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\\b",
    flags: "g",
    description: "Match MAC addresses",
  },
  {
    name: "Credit Card (basic)",
    pattern: "\\b(?:\\d[ -]*?){13,19}\\b",
    flags: "g",
    description: "Match card-number-like strings",
  },
  {
    name: "Hashtag",
    pattern: "(?<!\\w)#[\\p{L}\\p{N}_]+",
    flags: "gu",
    description: "Match hashtags (Unicode-aware)",
  },
  {
    name: "Mention",
    pattern: "(?<!\\w)@[A-Za-z0-9_]{1,30}",
    flags: "g",
    description: "Match @mentions",
  },
  {
    name: "HTML Tag",
    pattern: "<\\/?[A-Za-z][^>]*>",
    flags: "g",
    description: "Match HTML-like tags",
  },
];
