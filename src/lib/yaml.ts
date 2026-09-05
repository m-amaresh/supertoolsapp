import { sortJsonKeys } from "./json";

export interface YamlError {
  message: string;
  line?: number;
  column?: number;
}

export interface YamlValidationResult {
  valid: boolean;
  error?: YamlError;
  parsed?: unknown;
}

function toYamlError(error: unknown): YamlError {
  if (!(error instanceof Error)) {
    return { message: "Failed to process YAML" };
  }

  const yamlError = error as Error & {
    linePos?: Array<{ line: number; col: number }>;
  };
  const position = yamlError.linePos?.[0];

  return {
    message: yamlError.message,
    line: position?.line,
    column: position?.col,
  };
}

// Lazy-load the yaml package so it's only fetched when a YAML tool is used.
let yamlModulePromise: Promise<typeof import("yaml")> | null = null;

async function getYamlModule() {
  if (!yamlModulePromise) {
    yamlModulePromise = import("yaml").catch((err) => {
      yamlModulePromise = null;
      throw err;
    });
  }
  return yamlModulePromise;
}

export async function validateYaml(
  input: string,
): Promise<YamlValidationResult> {
  if (!input.trim()) {
    return { valid: true };
  }

  try {
    const { parse } = await getYamlModule();
    const parsed = parse(input);
    return { valid: true, parsed };
  } catch (error) {
    return { valid: false, error: toYamlError(error) };
  }
}

export async function convertJsonToYaml(
  input: string,
  sortKeys: boolean,
): Promise<{ output?: string; error?: YamlError }> {
  if (!input.trim()) {
    return {};
  }

  try {
    const { stringify } = await getYamlModule();
    const parsed = JSON.parse(input);
    const value = sortKeys ? sortJsonKeys(parsed) : parsed;
    return { output: stringify(value) };
  } catch (error) {
    if (error instanceof Error) {
      return { error: { message: error.message } };
    }
    return { error: { message: "Failed to parse JSON input" } };
  }
}

export async function convertYamlToJson(
  input: string,
  indent: number | string,
  sortKeys: boolean,
): Promise<{ output?: string; error?: YamlError }> {
  if (!input.trim()) {
    return {};
  }

  try {
    const { parse } = await getYamlModule();
    const parsed = parse(input);
    const value = sortKeys ? sortJsonKeys(parsed) : parsed;
    return { output: JSON.stringify(value, null, indent) };
  } catch (error) {
    return { error: toYamlError(error) };
  }
}
