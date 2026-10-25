import { connection, NextResponse } from "next/server";
import { healthReport } from "@/lib/services/health";

/**
 * GET /health: `{ ok: true, supabase: "local" | "remote" }`. Test tooling refuses to sign up or
 * write test data through a server whose Supabase isn't local (e2e/local-supabase.ts). It never
 * reveals the Supabase URL. Outside the locale prefix, like /auth/confirm.
 */
export async function GET() {
  // Answer per request, from the running server's settings, not from a build-time prerender.
  await connection();
  return NextResponse.json(healthReport(), { headers: { "Cache-Control": "no-store" } });
}
