import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { getSupabaseEnv } from "./env";

/**
 * Refreshes the Supabase session cookies on `response` and returns whether a user is logged in.
 * Called from src/proxy.ts on every page request.
 */
export async function updateSession(
  request: NextRequest,
  response: NextResponse,
): Promise<{ isLoggedIn: boolean }> {
  const { url, anonKey } = getSupabaseEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Do not run code between creating the client and this call: it refreshes an expired session.
  const { data } = await supabase.auth.getClaims();
  return { isLoggedIn: Boolean(data?.claims) };
}
