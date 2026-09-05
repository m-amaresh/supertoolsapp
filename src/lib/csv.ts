export type DelimitedFormat = "csv" | "tsv";

export interface DelimitedToJsonOptions {
  format: DelimitedFormat;
  hasHeader: boolean;
  indent: number | string;
}

export interface JsonToDelimitedOptions {
  format: DelimitedFormat;
  includeHeader: boolean;
}

const delimiterByFormat: Record<DelimitedFormat, string> = {
  csv: ",",
  tsv: "\t",
};

function delimiterFor(format: DelimitedFormat): string {
  return delimiterByFormat[format];
}

function normalizeHeaderCell(value: string, index: number): string {
  const trimmed = value.trim();
  if (!trimmed) return `column_${index + 1}`;
  return trimmed;
}

function stringifyCell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function encodeField(field: string, delimiter: string): string {
  const needsQuote =
    field.includes('"') ||
    field.includes("\n") ||
    field.includes("\r") ||
    field.includes(delimiter);
  if (!needsQuote) return field;
  return `"${field.replace(/"/g, '""')}"`;
}

// RFC 4180-style parser: handles quoted fields, escaped quotes (""), and
// mixed line endings (LF, CRLF). Strips the trailing empty row that a
// final newline produces.
function parseDelimitedRows(input: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentFieldChars: string[] = [];
  let inQuotes = false;
  let justClosedQuote = false;

  const pushField = () => {
    currentRow.push(currentFieldChars.join(""));
    currentFieldChars = [];
    justClosedQuote = false;
  };

  const pushRow = () => {
    pushField();
    rows.push(currentRow);
    currentRow = [];
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          currentFieldChars.push('"');
          i++;
        } else {
          inQuotes = false;
          justClosedQuote = true;
        }
      } else {
        currentFieldChars.push(ch);
      }
      continue;
    }

    if (justClosedQuote) {
      if (ch === delimiter) {
        pushField();
        continue;
      }
      if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && input[i + 1] === "\n") {
          i++;
        }
        pushRow();
        continue;
      }
      throw new Error("Unexpected character after closing quote in field");
    }

    if (ch === '"') {
      if (currentFieldChars.length === 0) {
        inQuotes = true;
        continue;
      }
      throw new Error("Unexpected quote in unquoted field");
    }

    if (ch === delimiter) {
      pushField();
      continue;
    }

    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") {
        i++;
      }
      pushRow();
      continue;
    }

    currentFieldChars.push(ch);
  }

  if (inQuotes) {
    throw new Error("Unclosed quoted field in delimited input");
  }

  pushField();
  rows.push(currentRow);

  const last = rows.at(-1);
  if (
    last &&
    last.length === 1 &&
    last[0] === "" &&
    (input.endsWith("\n") || input.endsWith("\r"))
  ) {
    rows.pop();
  }

  return rows;
}

// Convert parsed rows to JSON. With a header row, produces an array of objects
// keyed by header names. Duplicate headers get a _N suffix. Without a header,
// produces an array of arrays.
function rowsToObjectRecords(rows: string[][], hasHeader: boolean): unknown[] {
  if (rows.length === 0) return [];

  if (!hasHeader) {
    return rows.map((row) => [...row]);
  }

  const headers = rows[0].map((cell, index) =>
    normalizeHeaderCell(cell, index),
  );
  const collisions = new Map<string, number>();
  const stableHeaders = headers.map((header) => {
    const count = collisions.get(header) ?? 0;
    collisions.set(header, count + 1);
    if (count === 0) return header;
    return `${header}_${count + 1}`;
  });

  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    for (let i = 0; i < stableHeaders.length; i++) {
      record[stableHeaders[i]] = row[i] ?? "";
    }
    return record;
  });
}

function objectRecordsToRows(
  value: unknown,
  includeHeader: boolean,
): string[][] {
  if (!Array.isArray(value)) {
    throw new Error("JSON input must be an array of objects or arrays");
  }

  if (value.length === 0) return [];

  if (value.every(Array.isArray)) {
    return value.map((row) =>
      (row as unknown[]).map((cell) => stringifyCell(cell)),
    );
  }

  if (
    !value.every(
      (row) => row !== null && typeof row === "object" && !Array.isArray(row),
    )
  ) {
    throw new Error("JSON array must contain only objects or only arrays");
  }

  const keySet = new Set<string>();
  for (const row of value as Array<Record<string, unknown>>) {
    for (const key of Object.keys(row)) {
      keySet.add(key);
    }
  }
  const keys = [...keySet];

  const rows: string[][] = [];
  if (includeHeader) {
    rows.push(keys);
  }
  for (const row of value as Array<Record<string, unknown>>) {
    rows.push(keys.map((key) => stringifyCell(row[key])));
  }

  return rows;
}

function stringifyRows(rows: string[][], delimiter: string): string {
  return rows
    .map((row) =>
      row.map((field) => encodeField(field, delimiter)).join(delimiter),
    )
    .join("\n");
}

export function convertDelimitedToJson(
  input: string,
  options: DelimitedToJsonOptions,
): string {
  if (!input.trim()) return "";

  const delimiter = delimiterFor(options.format);
  const rows = parseDelimitedRows(input, delimiter);
  const value = rowsToObjectRecords(rows, options.hasHeader);
  return JSON.stringify(value, null, options.indent);
}

export function convertJsonToDelimited(
  input: string,
  options: JsonToDelimitedOptions,
): string {
  if (!input.trim()) return "";

  const parsed = JSON.parse(input) as unknown;
  const rows = objectRecordsToRows(parsed, options.includeHeader);
  const delimiter = delimiterFor(options.format);
  return stringifyRows(rows, delimiter);
}
