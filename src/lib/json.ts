export interface JsonValidationResult {
  valid: boolean;
  error?: {
    message: string;
    line?: number;
    column?: number;
  };
  parsed?: unknown;
}

// Parse JSON and extract error position as line/column.
// V8 (Chrome/Edge/Node): "at position N" — derive line/col from char offset.
// Firefox: "at line N column M" — read directly.
// Safari: no position info — raw message only.
export function validateJson(input: string): JsonValidationResult {
  if (!input.trim()) {
    return { valid: true };
  }

  try {
    const parsed = JSON.parse(input);
    return { valid: true, parsed };
  } catch (e) {
    const error = e as SyntaxError;

    let line: number | undefined;
    let column: number | undefined;

    // V8: "Unexpected token x at position 12"
    const v8Match = error.message.match(/at position (\d+)/);
    if (v8Match) {
      const position = parseInt(v8Match[1], 10);
      const lines = input.substring(0, position).split("\n");
      line = lines.length;
      column = lines[lines.length - 1].length + 1;
    } else {
      // Firefox: "JSON.parse: unexpected character at line 3 column 5 of the JSON data"
      const ffMatch = error.message.match(/at line (\d+) column (\d+)/);
      if (ffMatch) {
        line = parseInt(ffMatch[1], 10);
        column = parseInt(ffMatch[2], 10);
      }
    }

    return {
      valid: false,
      error: {
        message: error.message,
        line,
        column,
      },
    };
  }
}

export function shouldShowValidJsonStatus(args: {
  input: string;
  hasError: boolean;
  oversized: boolean;
}): boolean {
  return args.input.trim().length > 0 && !args.hasError && !args.oversized;
}

// Recursively sort object keys alphabetically. Arrays are traversed but
// their element order is preserved (only object keys within are sorted).
export function sortJsonKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(sortJsonKeys);
  }
  if (obj !== null && typeof obj === "object") {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    for (const key of keys) {
      sorted[key] = sortJsonKeys((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return obj;
}
