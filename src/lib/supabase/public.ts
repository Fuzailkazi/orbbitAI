import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cookie-less anon Supabase client for PUBLIC, shared reads inside "use cache" scopes
 * (src/lib/data). It carries no session, so every query runs as the `anon` role and RLS still
 * applies (all catalog tables have a public SELECT policy). It never reads cookies or headers,
 * which is what lets the result be cached and shared between viewers.
 *
 * Never use it for per-user data or writes: use createServerClient() / createRouteHandlerClient()
 * for those. Never swap in the service-role key here (CLAUDE.md rule 4).
 */
let client: SupabaseClient | null = null;

export function createPublicClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase configuration is missing (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)."
    );
  }

  client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
