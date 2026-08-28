const MAX_IP_LENGTH = 64;

function firstForwardedAddress(value: string | null): string | null {
  const candidate = value?.split(",")[0]?.trim();
  if (!candidate || candidate.length > MAX_IP_LENGTH) return null;
  return candidate;
}

/**
 * Resolve a client address only from headers supplied by the trusted runtime.
 * Vercel overwrites x-forwarded-for and provides x-vercel-forwarded-for.
 * Development keeps a narrow fallback for local tests and reverse proxies.
 */
export function getTrustedClientIp(req: Request): string {
  if (process.env.VERCEL === "1") {
    return (
      firstForwardedAddress(req.headers.get("x-vercel-forwarded-for")) ||
      firstForwardedAddress(req.headers.get("x-forwarded-for")) ||
      "unknown"
    );
  }

  if (process.env.NODE_ENV !== "production") {
    return (
      firstForwardedAddress(req.headers.get("x-vercel-forwarded-for")) ||
      firstForwardedAddress(req.headers.get("x-forwarded-for")) ||
      firstForwardedAddress(req.headers.get("x-real-ip")) ||
      "local"
    );
  }

  return "unknown";
}
