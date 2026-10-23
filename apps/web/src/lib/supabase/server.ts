import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { getSupabaseEnv } from "./env";

/** Supabase client for Server Components, Server Actions and Route Handlers. Create one per request. */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components can't set cookies. The proxy refreshes the session on every request,
          // so it is safe to skip the write here.
        }
      },
    },
  });
}

/**
 * Returns the logged-in user's id, or null. The JWT is verified, not just decoded.
 * For Server Components only; Server Actions and Route Handlers use createClient directly.
 */
export async function getCurrentUserId(): Promise<string | null> {
  // getClaims checks the token's expiry against Date.now(). With Cache Components a prerender
  // can resolve cookies() and still reach that call, so wait for the real request first.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub ?? null;
}
