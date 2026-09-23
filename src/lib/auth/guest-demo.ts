import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Guest demo session — lets reviewers explore the dashboard without creating an account.
 * Shared by proxy.ts (routing guard), the (dashboard) layout, /api/auth/demo (toggle) and
 * API auth checks (requireApiSession).
 *
 * SERVER ONLY. The cookie holds an HMAC-SHA256 signed token with an expiry, so it can't be
 * forged by setting `orbbit_guest_demo=true` by hand. Anything that fails verification —
 * including the legacy unsigned "true" value — is treated as logged out.
 *
 * Token format: `v1.<expiresAtEpochSeconds>.<nonce>.<base64url signature>`
 * Secret: GUEST_DEMO_SECRET (≥ 16 chars). When unset, a key is derived from
 * SUPABASE_SERVICE_ROLE_KEY so local dev works without new env. With neither, guest
 * sessions are disabled (fail closed).
 */
export const GUEST_DEMO_COOKIE = "orbbit_guest_demo";
export const GUEST_EMAIL_COOKIE = "orbbit_guest_email";
export const GUEST_DEMO_EMAIL = "guest.reviewer@orbbit.ai";

const TOKEN_VERSION = "v1";
const SEVEN_DAYS_SECONDS = 60 * 60 * 24 * 7;
export const GUEST_SESSION_TTL_SECONDS = SEVEN_DAYS_SECONDS;
const MIN_SECRET_LENGTH = 16;
const DERIVATION_LABEL = "orbbit:guest-demo-cookie:v1";

export interface GuestCookieOptions {
  path: string;
  maxAge: number;
  sameSite: "lax";
  httpOnly: boolean;
  secure: boolean;
}

/** Server-only cookies: proxy, layouts and route handlers read them; no client script needs them. */
export function guestCookieOptions(): GuestCookieOptions {
  return {
    path: "/",
    maxAge: GUEST_SESSION_TTL_SECONDS,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };
}

export class GuestDemoConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuestDemoConfigError";
  }
}

/** Environment lookup (process.env by default; a plain object in tests). */
export type GuestDemoEnv = Readonly<Record<string, string | undefined>>;

/**
 * Resolves the signing key. Never exposed to the client: it is derived (HMAC) from the
 * service-role key rather than using that key directly, so a leaked cookie signature says
 * nothing about the service-role key.
 */
export function resolveGuestDemoSecret(env: GuestDemoEnv = process.env): Buffer | null {
  const explicit = env.GUEST_DEMO_SECRET?.trim();
  if (explicit && explicit.length >= MIN_SECRET_LENGTH) return Buffer.from(explicit, "utf8");

  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (serviceKey) return createHmac("sha256", serviceKey).update(DERIVATION_LABEL).digest();

  return null;
}

function sign(payload: string, secret: Buffer): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export interface GuestTokenOptions {
  /** Signing key; defaults to resolveGuestDemoSecret(). */
  secret?: Buffer | null;
  /** Current time in ms (injectable for tests). */
  now?: number;
  ttlSeconds?: number;
}

/** Creates a signed guest token. Throws GuestDemoConfigError when no signing key is configured. */
export function createGuestDemoToken(options: GuestTokenOptions = {}): string {
  const secret = options.secret === undefined ? resolveGuestDemoSecret() : options.secret;
  if (!secret) {
    throw new GuestDemoConfigError(
      "Guest demo is not configured: set GUEST_DEMO_SECRET (or SUPABASE_SERVICE_ROLE_KEY)."
    );
  }
  const now = options.now ?? Date.now();
  const ttl = options.ttlSeconds ?? GUEST_SESSION_TTL_SECONDS;
  const expiresAt = Math.floor(now / 1000) + ttl;
  const nonce = randomBytes(12).toString("base64url");
  const payload = `${TOKEN_VERSION}.${expiresAt}.${nonce}`;
  return `${payload}.${sign(payload, secret)}`;
}

const TOKEN_RE = /^v1\.(\d{1,12})\.([A-Za-z0-9_-]{8,64})\.([A-Za-z0-9_-]{43})$/;

/** Verifies signature and expiry in constant time. Any malformed, forged or expired value → false. */
export function verifyGuestDemoToken(
  value: string | undefined | null,
  options: Omit<GuestTokenOptions, "ttlSeconds"> = {}
): boolean {
  if (!value) return false;
  const match = TOKEN_RE.exec(value);
  if (!match) return false;

  const secret = options.secret === undefined ? resolveGuestDemoSecret() : options.secret;
  if (!secret) return false;

  const [, expiresRaw, nonce, signature] = match;
  const expected = Buffer.from(sign(`${TOKEN_VERSION}.${expiresRaw}.${nonce}`, secret), "utf8");
  const actual = Buffer.from(signature, "utf8");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;

  const now = options.now ?? Date.now();
  return Number(expiresRaw) * 1000 > now;
}

/**
 * True when the guest demo cookie value is a valid, unexpired signed token.
 * (Name kept for existing callers; the legacy unsigned "true" value no longer passes.)
 */
export function isGuestDemoValue(value: string | undefined): boolean {
  return verifyGuestDemoToken(value);
}
