// Guards for tooling that writes data (test sign-ups, test users, fixture seeds): it must
// only ever touch a local Supabase. A hosted project URL, or an app server that talks to one, is
// refused before anything is written. Used by e2e/local-supabase.ts; the app's /health route
// reports which kind of Supabase it uses, without revealing the URL.

/** Whether a URL points to this machine (127.0.0.1 or localhost), where test data may go. */
export function isLocalUrl(url: string | undefined): boolean {
  if (!url) {
    return false;
  }
  try {
    const { protocol, hostname } = new URL(url);
    return (
      (protocol === "http:" || protocol === "https:") &&
      (hostname === "127.0.0.1" || hostname === "localhost")
    );
  } catch {
    return false;
  }
}

/** Throws unless the Supabase URL a test helper is about to write to is local. */
export function assertLocalSupabaseUrl(url: string | undefined, action: string): void {
  if (!isLocalUrl(url)) {
    throw new Error(
      `Refusing to ${action}: the Supabase URL isn't local (127.0.0.1 or localhost). ` +
        "Test data may only be written to a local Supabase (npx supabase start).",
    );
  }
}

/** What the app's /health route answers. */
export type HealthReport = { ok: boolean; supabase: "local" | "remote" };

/**
 * Throws unless the app server at `baseURL` runs on this machine and itself talks to a local
 * Supabase. Call it before signing up or logging in through the app in a test, so a server that
 * happens to use a hosted project (an old dev server on the same port) is never written to.
 */
export async function assertLocalServer(
  baseURL: string | undefined,
  action: string,
  fetchHealth: (url: string) => Promise<Response> = fetch,
): Promise<void> {
  if (!isLocalUrl(baseURL)) {
    throw new Error(`Refusing to ${action}: the app server ${baseURL ?? "(none)"} isn't local.`);
  }
  let report: HealthReport;
  try {
    const response = await fetchHealth(new URL("/health", baseURL).toString());
    report = (await response.json()) as HealthReport;
  } catch (error) {
    throw new Error(
      `Refusing to ${action}: couldn't ask ${baseURL}/health which Supabase it uses ` +
        `(${(error as Error).message}). Is the right server running on that port?`,
    );
  }
  if (report?.supabase !== "local") {
    throw new Error(
      `Refusing to ${action}: the app server at ${baseURL} talks to a hosted Supabase, not a local ` +
        "one. Stop it, or start the test server on another port with the local URL and keys.",
    );
  }
}
