import type { NextRequest } from "next/server";

export function proxy(_request: NextRequest) {
  // Auth guard skeleton — will be implemented in Phase 3.
  // Protected routes (/dashboard/*) will redirect unauthenticated users to /login.
  return undefined;
}
