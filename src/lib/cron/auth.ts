import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Checks a scheduled-job request against CRON_SECRET. Vercel Cron sends
 * `Authorization: Bearer <CRON_SECRET>` automatically once the env var is set; the GitHub
 * Actions backup pinger sends the same header.
 *
 * Fails closed: with no secret configured, nothing is authorized. Both sides are hashed before
 * the constant-time compare so a length mismatch doesn't leak through an early return.
 */
export function isAuthorizedCronRequest(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || !authorization) return false;

  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  const received = createHash("sha256").update(authorization).digest();
  return timingSafeEqual(expected, received);
}
