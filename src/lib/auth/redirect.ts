const DEFAULT_REDIRECT = "/dashboard";
const PROBE_ORIGIN = "http://orbbit.invalid";

/**
 * Only allow same-origin relative redirects. Blocks protocol-relative ("//evil.com"),
 * backslash ("/\\evil.com") and control-character tricks ("/\t/evil.com" — the URL parser
 * strips tabs/newlines, turning it into "//evil.com") by resolving against a probe origin.
 * Pure — safe to import from client components, route handlers and proxy.ts.
 */
export function safeRedirectPath(next: string | null | undefined, fallback = DEFAULT_REDIRECT): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  // Reject ASCII control characters outright (tab, CR, LF, NUL…).
  for (let i = 0; i < next.length; i++) {
    if (next.charCodeAt(i) < 0x20 || next.charCodeAt(i) === 0x7f) return fallback;
  }
  try {
    const resolved = new URL(next, PROBE_ORIGIN);
    if (resolved.origin !== PROBE_ORIGIN) return fallback;
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return fallback;
  }
}
