export function encodeUrl(input: string, mode: UrlEncodeMode): string {
  if (mode === "component") {
    return encodeURIComponent(input);
  }
  return encodeURI(input);
}

export function decodeUrl(input: string, mode: UrlEncodeMode): string {
  try {
    if (mode === "component") {
      return decodeURIComponent(input);
    }
    return decodeURI(input);
  } catch (e) {
    if (e instanceof URIError) {
      throw new Error("Malformed percent-encoded sequence");
    }
    throw e;
  }
}

export type UrlEncodeMode = "component" | "full";

export const urlEncodeModes = [
  {
    value: "component" as const,
    label: "Component",
    description: "encodeURIComponent — encodes all special characters",
  },
  {
    value: "full" as const,
    label: "Full URI",
    description: "encodeURI — preserves :, /, ?, #, etc.",
  },
];
