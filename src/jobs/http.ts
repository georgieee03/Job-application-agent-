const DEFAULT_TIMEOUT_MS = 20000;
const SENSITIVE_QUERY_PARAMS = new Set([
  "access_token",
  "api_key",
  "apikey",
  "app_id",
  "app_key",
  "authorization",
  "client_secret",
  "key",
  "password",
  "secret",
  "token"
]);

export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...init.headers
      }
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status} for ${redactUrl(url)}${body ? `: ${body.slice(0, 200)}` : ""}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchText(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status} for ${redactUrl(url)}${body ? `: ${body.slice(0, 200)}` : ""}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

export function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (SENSITIVE_QUERY_PARAMS.has(key.toLowerCase())) {
        url.searchParams.set(key, "[REDACTED]");
      }
    }

    if (url.hostname === "jooble.org" && url.pathname.startsWith("/api/")) {
      url.pathname = "/api/[REDACTED]";
    }

    return url.toString();
  } catch {
    return value.replace(/(jooble\.org\/api\/)[^/?#]+/i, "$1[REDACTED]");
  }
}
