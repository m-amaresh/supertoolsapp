export type NumberBase = "bin" | "oct" | "dec" | "hex";

export interface BaseConversionResult {
  bin: string;
  oct: string;
  dec: string;
  hex: string;
  error: string | null;
}

const BASE_MAP: Record<NumberBase, number> = {
  bin: 2,
  oct: 8,
  dec: 10,
  hex: 16,
};

const VALIDATION_PATTERNS: Record<NumberBase, RegExp> = {
  bin: /^-?[01]+$/,
  oct: /^-?[0-7]+$/,
  dec: /^-?[0-9]+$/,
  hex: /^-?[0-9a-fA-F]+$/,
};

const BASE_LABELS: Record<NumberBase, string> = {
  bin: "Binary",
  oct: "Octal",
  dec: "Decimal",
  hex: "Hexadecimal",
};

export { BASE_LABELS };

export function convertBase(
  input: string,
  fromBase: NumberBase,
): BaseConversionResult {
  const empty: BaseConversionResult = {
    bin: "",
    oct: "",
    dec: "",
    hex: "",
    error: null,
  };

  const trimmed = input.trim();
  if (!trimmed) return empty;

  // Strip common prefixes
  let cleaned = trimmed;
  if (fromBase === "hex") {
    cleaned = cleaned.replace(/^(-?)0x/i, "$1");
  } else if (fromBase === "bin") {
    cleaned = cleaned.replace(/^(-?)0b/i, "$1");
  } else if (fromBase === "oct") {
    cleaned = cleaned.replace(/^(-?)0o/i, "$1");
  }

  if (!cleaned) return empty;

  if (!VALIDATION_PATTERNS[fromBase].test(cleaned)) {
    return {
      ...empty,
      error: `Invalid ${BASE_LABELS[fromBase].toLowerCase()} number`,
    };
  }

  try {
    const isNegative = cleaned.startsWith("-");
    const absolute = isNegative ? cleaned.slice(1) : cleaned;
    // Parse digit-by-digit with BigInt so we handle arbitrarily large
    // numbers without losing precision (Number can't represent >2^53).
    let parsed = BigInt(0);
    const base = BigInt(BASE_MAP[fromBase]);
    for (const ch of absolute) {
      const digit = Number.parseInt(ch, BASE_MAP[fromBase]);
      parsed = parsed * base + BigInt(digit);
    }

    const sign = isNegative ? "-" : "";
    const absParsed = parsed;

    return {
      bin: sign + absParsed.toString(2),
      oct: sign + absParsed.toString(8),
      dec: sign + absParsed.toString(10),
      hex: sign + absParsed.toString(16).toUpperCase(),
      error: null,
    };
  } catch {
    return { ...empty, error: "Number too large or invalid" };
  }
}
