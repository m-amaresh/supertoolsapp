export interface PasswordOptions {
  length: number;
  includeUppercase: boolean;
  includeLowercase: boolean;
  includeNumbers: boolean;
  includeSymbols: boolean;
  excludeSimilar: boolean;
  excludeChars: string;
}

const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const NUMBERS = "0123456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{};:,.?/|~";
const SIMILAR_CHARS = "Il1O0o";

function uniqueChars(input: string): string {
  return [...new Set(input)].join("");
}

function filterExcluded(input: string, excluded: Set<string>): string {
  return [...input].filter((char) => !excluded.has(char)).join("");
}

// Pre-filled CSPRNG buffer to amortize the cost of crypto.getRandomValues calls.
const randomPool = { buf: new Uint32Array(256), idx: 256 };

function getRandomUint32(): number {
  if (randomPool.idx >= randomPool.buf.length) {
    crypto.getRandomValues(randomPool.buf);
    randomPool.idx = 0;
  }
  const idx = randomPool.idx++;
  const value = randomPool.buf[idx];
  randomPool.buf[idx] = 0;
  return value;
}

// Rejection sampling avoids modulo bias for cryptographic-quality indexing.
function getRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) {
    throw new Error("maxExclusive must be greater than 0");
  }
  const UINT32_MAX_PLUS_ONE = 0x100000000;
  const limit = Math.floor(UINT32_MAX_PLUS_ONE / maxExclusive) * maxExclusive;

  let value = getRandomUint32();
  while (value >= limit) {
    value = getRandomUint32();
  }

  return value % maxExclusive;
}

function pickChar(chars: string): string {
  return chars[getRandomInt(chars.length)];
}

function shuffleInPlace<T>(items: T[]): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = getRandomInt(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
}

function buildCharSets(options: PasswordOptions): string[] {
  const excluded = new Set(options.excludeChars.split(""));
  if (options.excludeSimilar) {
    for (const char of SIMILAR_CHARS) {
      excluded.add(char);
    }
  }

  const sets: string[] = [];
  if (options.includeUppercase) {
    sets.push(filterExcluded(UPPERCASE, excluded));
  }
  if (options.includeLowercase) {
    sets.push(filterExcluded(LOWERCASE, excluded));
  }
  if (options.includeNumbers) {
    sets.push(filterExcluded(NUMBERS, excluded));
  }
  if (options.includeSymbols) {
    sets.push(filterExcluded(SYMBOLS, excluded));
  }

  return sets.filter((set) => set.length > 0);
}

// Generate a cryptographically random password. Guarantees at least one
// character from each selected set, fills the rest from the combined pool,
// then Fisher-Yates shuffles the result to eliminate positional bias.
export function generatePassword(options: PasswordOptions): string {
  const sets = buildCharSets(options);
  if (sets.length === 0) {
    throw new Error("No character sets available with the current options");
  }
  if (options.length < sets.length) {
    throw new Error(
      `Length must be at least ${sets.length} to include all selected character groups`,
    );
  }
  if (options.length > 512) {
    throw new Error("Length must be 512 or less");
  }

  const pool = uniqueChars(sets.join(""));
  const passwordChars: string[] = [];

  // Guarantee at least one character from each selected set.
  for (const set of sets) {
    passwordChars.push(pickChar(set));
  }

  for (let i = passwordChars.length; i < options.length; i++) {
    passwordChars.push(pickChar(pool));
  }

  shuffleInPlace(passwordChars);
  return passwordChars.join("");
}

export function generatePasswords(
  options: PasswordOptions,
  count: number,
): string[] {
  if (!Number.isInteger(count) || count < 1 || count > 200) {
    throw new Error("Count must be an integer between 1 and 200");
  }
  return Array.from({ length: count }, () => generatePassword(options));
}

export function estimateEntropyBits(options: PasswordOptions): number {
  const sets = buildCharSets(options);
  if (sets.length === 0) return 0;
  const poolSize = uniqueChars(sets.join("")).length;
  if (poolSize <= 1) return 0;

  // The generator guarantees one char from each set, then fills the rest from
  // the full pool. Account for the constrained picks honestly rather than
  // assuming every position is uniformly random from the full pool.
  let bits = 0;
  for (const set of sets) {
    bits += Math.log2(set.length);
  }
  bits += (options.length - sets.length) * Math.log2(poolSize);

  return bits;
}
