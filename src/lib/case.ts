export type CaseType =
  | "camel"
  | "snake"
  | "pascal"
  | "kebab"
  | "upper"
  | "lower"
  | "title"
  | "constant";

export interface CaseOption {
  value: CaseType;
  label: string;
  example: string;
}

export const caseOptions: CaseOption[] = [
  { value: "camel", label: "camelCase", example: "myVariableName" },
  { value: "pascal", label: "PascalCase", example: "MyVariableName" },
  { value: "snake", label: "snake_case", example: "my_variable_name" },
  { value: "kebab", label: "kebab-case", example: "my-variable-name" },
  { value: "constant", label: "CONSTANT_CASE", example: "MY_VARIABLE_NAME" },
  { value: "upper", label: "UPPERCASE", example: "MY VARIABLE NAME" },
  { value: "lower", label: "lowercase", example: "my variable name" },
  { value: "title", label: "Title Case", example: "My Variable Name" },
];

// Split input into words by detecting boundaries in any naming convention.
// 1. Insert a split before uppercase after lowercase/digit (camelCase → camel Case)
// 2. Insert a split inside runs of capitals (XMLParser → XML Parser)
// 3. Treat common separators (_-./\) as word boundaries
function splitIntoWords(input: string): string[] {
  return input
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[_\-./\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 0);
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function convertCase(input: string, targetCase: CaseType): string {
  // For simple upper/lower, apply directly to the full text
  if (targetCase === "upper") return input.toUpperCase();
  if (targetCase === "lower") return input.toLowerCase();

  // For title case, capitalize each word preserving original separators
  if (targetCase === "title") {
    return input.replace(/\S+/g, (word) => capitalize(word));
  }

  // For identifier-style cases, split into words first
  const words = splitIntoWords(input);
  if (words.length === 0) return input;

  switch (targetCase) {
    case "camel":
      return words
        .map((w, i) => (i === 0 ? w.toLowerCase() : capitalize(w)))
        .join("");
    case "pascal":
      return words.map((w) => capitalize(w)).join("");
    case "snake":
      return words.map((w) => w.toLowerCase()).join("_");
    case "kebab":
      return words.map((w) => w.toLowerCase()).join("-");
    case "constant":
      return words.map((w) => w.toUpperCase()).join("_");
    default:
      return input;
  }
}

// Convert each line independently for multi-line input
export function convertCaseMultiline(
  input: string,
  targetCase: CaseType,
): string {
  return input
    .split("\n")
    .map((line) => (line.trim() ? convertCase(line, targetCase) : line))
    .join("\n");
}
