export interface DiffLine {
  type: "equal" | "added" | "removed";
  text: string;
  leftNum?: number;
  rightNum?: number;
}

export interface DiffOptions {
  ignoreWhitespace: boolean;
  ignoreCase: boolean;
  trimLines: boolean;
}

function normalize(line: string, options: DiffOptions): string {
  let result = line;
  if (options.trimLines) {
    result = result.trim();
  }
  if (options.ignoreWhitespace) {
    result = result.replace(/\s+/g, " ").trim();
  }
  if (options.ignoreCase) {
    result = result.toLowerCase();
  }
  return result;
}

const MAX_DIFF_LINES = 5000;
const MAX_LINE_PRODUCT = 10_000_000;

// Build the LCS (longest common subsequence) DP table over pre-normalized
// lines, as one flat (m+1)x(n+1) array read with `i * (n + 1) + j`. Lengths
// never exceed MAX_DIFF_LINES, so 16 bits per cell is enough, and a typed array
// keeps the 10M-cell worst case at ~20 MB instead of nested JS arrays.
function lcs(normA: string[], normB: string[]): Uint16Array {
  const m = normA.length;
  const n = normB.length;
  const width = n + 1;
  const dp = new Uint16Array((m + 1) * width);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cell = i * width + j;
      dp[cell] =
        normA[i - 1] === normB[j - 1]
          ? dp[cell - width - 1] + 1
          : Math.max(dp[cell - width], dp[cell - 1]);
    }
  }

  return dp;
}

// Compute a line-level diff using the LCS algorithm. Normalization (trim,
// collapse whitespace, case fold) is applied only for comparison — the output
// preserves the original text. Guards against O(n*m) blowup on large inputs.
export function computeDiff(
  left: string,
  right: string,
  options: DiffOptions,
): DiffLine[] {
  // Any line ending counts, so a CRLF file and its LF copy compare equal.
  const leftLines = left.split(/\r\n|\r|\n/);
  const rightLines = right.split(/\r\n|\r|\n/);

  if (
    leftLines.length > MAX_DIFF_LINES ||
    rightLines.length > MAX_DIFF_LINES ||
    leftLines.length * rightLines.length > MAX_LINE_PRODUCT
  ) {
    throw new Error(
      `Input too large for diff (${leftLines.length} × ${rightLines.length} lines). Limit each side to ${MAX_DIFF_LINES} lines.`,
    );
  }

  // Pre-normalize once to avoid redundant work in LCS + traceback
  const normLeft = leftLines.map((l) => normalize(l, options));
  const normRight = rightLines.map((l) => normalize(l, options));

  const dp = lcs(normLeft, normRight);
  const width = rightLines.length + 1;

  const result: DiffLine[] = [];
  let i = leftLines.length;
  let j = rightLines.length;

  const stack: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && normLeft[i - 1] === normRight[j - 1]) {
      stack.push({
        type: "equal",
        text: leftLines[i - 1],
        leftNum: i,
        rightNum: j,
      });
      i--;
      j--;
    } else if (
      j > 0 &&
      (i === 0 || dp[i * width + j - 1] >= dp[(i - 1) * width + j])
    ) {
      stack.push({ type: "added", text: rightLines[j - 1], rightNum: j });
      j--;
    } else {
      stack.push({ type: "removed", text: leftLines[i - 1], leftNum: i });
      i--;
    }
  }

  // Reverse since we built it backwards
  for (let k = stack.length - 1; k >= 0; k--) {
    result.push(stack[k]);
  }

  return result;
}

export interface DiffStats {
  added: number;
  removed: number;
  unchanged: number;
}

export function getDiffStats(lines: DiffLine[]): DiffStats {
  let added = 0;
  let removed = 0;
  let unchanged = 0;

  for (const line of lines) {
    if (line.type === "added") added++;
    else if (line.type === "removed") removed++;
    else unchanged++;
  }

  return { added, removed, unchanged };
}
