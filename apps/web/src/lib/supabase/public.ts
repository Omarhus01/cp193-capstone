import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

/**
 * Supabase client for public content, for code in src/lib/data. It reads as the anon role, with
 * no cookies and no session, so the result is the same for every reader and can be cached.
 */
export function createPublicClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
