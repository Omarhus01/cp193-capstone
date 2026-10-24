import type { NextRequest, NextResponse } from "next/server";
import { createProxyClient } from "@/lib/supabase/proxy";

/**
 * Refreshes the Supabase session cookies on `response` and returns whether a user is logged in.
 * Called from src/proxy.ts on every page request.
 */
export async function refreshSession(
  request: NextRequest,
  response: NextResponse,
): Promise<{ isLoggedIn: boolean }> {
  const supabase = createProxyClient(request, response);
  // Do not run code between creating the client and this call: it refreshes an expired session.
  const { data } = await supabase.auth.getClaims();
  return { isLoggedIn: Boolean(data?.claims) };
}
