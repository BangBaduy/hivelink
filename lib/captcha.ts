const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_ACTION = "shorten";

interface TurnstileResponse {
  success?: boolean;
  action?: string;
  hostname?: string;
}

export function getTurnstileSiteKey(): string | null {
  const key = process.env.TURNSTILE_SITE_KEY?.trim();
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  return key && secret ? key : null;
}

export async function verifyTurnstileToken(
  token: unknown,
  clientIp: string,
  requestHostname: string
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (
    !secret ||
    typeof token !== "string" ||
    token.length < 1 ||
    token.length > 2048
  ) {
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (clientIp !== "unknown" && clientIp !== "local") {
      body.set("remoteip", clientIp);
    }

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return false;

    const result = (await response.json()) as TurnstileResponse;
    const hostname = requestHostname.trim().toLowerCase();
    return (
      result.success === true &&
      result.action === TURNSTILE_ACTION &&
      hostname.length > 0 &&
      result.hostname?.toLowerCase() === hostname
    );
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
