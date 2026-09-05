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

// Build the LCS (longest common subsequence) DP table over pre-normalized lines.
// Returns the full (m+1)x(n+1) table for traceback.
function lcs(normA: string[], normB: string[]): number[][] {
  const m = normA.length;
  const n = normB.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (normA[i - 1] === normB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
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
  const leftLines = left.split("\n");
  const rightLines = right.split("\n");

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
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
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
