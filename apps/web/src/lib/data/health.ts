import { getSupabaseEnv } from "@/lib/supabase/env";
import { isLocalUrl, type HealthReport } from "@/lib/supabase/local-guard";

/**
 * Whether this server runs and which kind of Supabase it talks to: local (127.0.0.1, localhost)
 * or hosted. Never the URL itself. Test tooling checks it before writing data through the app.
 */
export function getHealth(): HealthReport {
  return { ok: true, supabase: isLocalUrl(getSupabaseEnv().url) ? "local" : "remote" };
}
