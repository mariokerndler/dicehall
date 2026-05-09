export type SocketOriginCheck = {
  origin?: string;
  host?: string | string[];
  forwardedHost?: string | string[];
  allowedOrigins?: string[];
};

function firstHeaderValue(value?: string | string[]): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.split(",")[0]?.trim().toLowerCase() ?? "";
}

function normalizeOrigin(origin: string): string | null {
  try {
    const parsed = new URL(origin);
    return `${parsed.protocol}//${parsed.host}`.toLowerCase();
  } catch {
    return null;
  }
}

export function parseAllowedOrigins(value = process.env.DICEHALL_ALLOWED_ORIGINS ?? ""): string[] {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map(normalizeOrigin)
    .filter((origin): origin is string => Boolean(origin));
}

export function isAllowedSocketOrigin({
  origin,
  host,
  forwardedHost,
  allowedOrigins = parseAllowedOrigins()
}: SocketOriginCheck): boolean {
  if (!origin) {
    return true;
  }

  const normalizedOrigin = normalizeOrigin(origin);

  if (!normalizedOrigin) {
    return false;
  }

  const originHost = new URL(normalizedOrigin).host.toLowerCase();
  const requestHost = firstHeaderValue(forwardedHost) || firstHeaderValue(host);

  if (requestHost && originHost === requestHost) {
    return true;
  }

  return allowedOrigins.includes(normalizedOrigin);
}
