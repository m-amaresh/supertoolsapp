/** Maximum input size (in characters) before showing a performance warning */
export const MAX_INPUT_SIZE = 1_000_000;

/** Common text encoding options for encoding/decoding tools */
export const TEXT_ENCODING_OPTIONS = [
  { value: "utf8", label: "UTF-8" },
  { value: "latin1", label: "Latin-1" },
  { value: "hex", label: "Hex" },
] as const;
