interface RegexMatch {
  fullMatch: string;
  index: number;
  length: number;
  groups: string[];
  namedGroups: Record<string, string>;
}

interface RegexResult {
  matches: RegexMatch[];
  error: string | null;
  truncated: boolean;
}

interface WorkerPayload {
  pattern: string;
  flags: string;
  testString: string;
}

function isWorkerPayload(value: unknown): value is WorkerPayload {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.pattern === "string" &&
    typeof record.flags === "string" &&
    typeof record.testString === "string"
  );
}

self.onmessage = (event: MessageEvent<WorkerPayload>) => {
  const MATCH_LIMIT = 10000;

  // Dedicated workers receive messages only from their creator, so `event.origin`
  // is the empty string for same-origin messages. Reject anything else as
  // defense-in-depth against cross-origin postMessage scenarios.
  if (event.origin !== "" && event.origin !== self.location.origin) {
    return;
  }

  if (!isWorkerPayload(event.data)) {
    self.postMessage({
      matches: [],
      error: "Invalid request payload",
      truncated: false,
    } satisfies RegexResult);
    return;
  }

  const { pattern, flags, testString } = event.data;

  if (!pattern) {
    self.postMessage({
      matches: [],
      error: null,
      truncated: false,
    } satisfies RegexResult);
    return;
  }

  try {
    const regex = new RegExp(pattern, flags);
    const matches: RegexMatch[] = [];
    let truncated = false;

    if (flags.includes("g")) {
      let match = regex.exec(testString);
      while (match !== null) {
        if (matches.length >= MATCH_LIMIT) {
          truncated = true;
          break;
        }
        matches.push({
          fullMatch: match[0],
          index: match.index,
          length: match[0].length,
          groups: match.slice(1).map((group) => (group == null ? "" : group)),
          namedGroups: match.groups ? { ...match.groups } : {},
        });

        if (match[0].length === 0) {
          regex.lastIndex++;
        }
        match = regex.exec(testString);
      }
    } else {
      const match = regex.exec(testString);
      if (match) {
        matches.push({
          fullMatch: match[0],
          index: match.index,
          length: match[0].length,
          groups: match.slice(1).map((group) => (group == null ? "" : group)),
          namedGroups: match.groups ? { ...match.groups } : {},
        });
      }
    }

    self.postMessage({ matches, error: null, truncated } satisfies RegexResult);
  } catch (error) {
    self.postMessage({
      matches: [],
      error:
        error instanceof Error ? error.message : "Invalid regular expression",
      truncated: false,
    } satisfies RegexResult);
  }
};
