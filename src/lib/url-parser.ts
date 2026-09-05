export interface UrlParam {
  key: string;
  value: string;
}

export interface ParsedUrlParts {
  protocol: string;
  hostname: string;
  port: string;
  pathname: string;
  hash: string;
  username: string;
  password: string;
  params: UrlParam[];
  host: string;
  origin: string;
  href: string;
}

export interface UrlBuilderNeutralStateInput {
  hostname: string;
  port: string;
  pathname: string;
  hash: string;
  username: string;
  password: string;
  params: UrlParam[];
}

function normalizeProtocol(protocol: string): string {
  const trimmed = protocol.trim();
  if (!trimmed) {
    throw new Error("Protocol is required");
  }
  const withColon = trimmed.endsWith(":") ? trimmed : `${trimmed}:`;
  if (!/^[A-Za-z][A-Za-z0-9+.-]*:$/.test(withColon)) {
    throw new Error("Invalid URL protocol");
  }
  return withColon.toLowerCase();
}

export function parseUrlParts(input: string): ParsedUrlParts {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("URL input is required");
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Invalid URL. Include protocol (for example https://)");
  }

  const params: UrlParam[] = [];
  for (const [key, value] of url.searchParams.entries()) {
    params.push({ key, value });
  }

  return {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port,
    pathname: url.pathname || "/",
    hash: url.hash.replace(/^#/, ""),
    username: url.username,
    password: url.password,
    params,
    host: url.host,
    origin: url.origin,
    href: url.href,
  };
}

// Assemble a URL string from individual components using the URL API
// to ensure consistent encoding of special characters.
export function buildUrlFromParts(parts: {
  protocol: string;
  hostname: string;
  port?: string;
  pathname?: string;
  hash?: string;
  username?: string;
  password?: string;
  params?: UrlParam[];
}): string {
  const protocol = normalizeProtocol(parts.protocol);
  const hostname = parts.hostname.trim();
  if (!hostname) {
    throw new Error("Hostname is required");
  }

  const port = parts.port?.trim() ?? "";
  if (port && !/^\d+$/.test(port)) {
    throw new Error("Port must be numeric");
  }

  const base = `${protocol}//${hostname}${port ? `:${port}` : ""}`;
  const url = new URL(base);

  const pathname = (parts.pathname ?? "/").trim();
  url.pathname = pathname.startsWith("/") ? pathname : `/${pathname}`;

  if (parts.username) {
    url.username = parts.username;
  }
  if (parts.password) {
    url.password = parts.password;
  }

  const searchParams = new URLSearchParams();
  for (const param of parts.params ?? []) {
    if (!param.key && !param.value) continue;
    searchParams.append(param.key, param.value);
  }
  url.search = searchParams.toString();

  const hash = (parts.hash ?? "").trim();
  url.hash = hash ? `#${hash}` : "";

  return url.toString();
}

/**
 * Whether the builder sub-form is still untouched.
 *
 * Deliberately says nothing about the Input URL field: that is a separate
 * sub-form, and letting it un-neutralise the builder is what made typing a
 * valid URL report "Hostname is required" against a builder the user had not
 * touched yet.
 */
export function isNeutralUrlBuilderState(
  state: UrlBuilderNeutralStateInput,
): boolean {
  return (
    !state.hostname &&
    !state.port &&
    (state.pathname === "/" || !state.pathname) &&
    !state.hash &&
    !state.username &&
    !state.password &&
    state.params.length === 1 &&
    !state.params[0]?.key &&
    !state.params[0]?.value
  );
}
