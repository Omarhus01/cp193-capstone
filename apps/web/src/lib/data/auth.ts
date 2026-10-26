import type { EmailOtpType } from "@supabase/supabase-js";
import { connection } from "next/server";
import type { Credentials } from "@/lib/domain/auth";
import { createClient } from "@/lib/supabase/server";

export type { EmailOtpType };

/** What the signup confirmation link carries: a PKCE `code`, or a `token_hash` with its type. */
export type EmailConfirmation =
  { kind: "code"; code: string } | { kind: "otp"; tokenHash: string; type: EmailOtpType };

/**
 * Returns the logged-in user's id, or null. The JWT is verified, not just decoded.
 * For Server Components only; Server Actions and Route Handlers use the functions below.
 */
export async function getCurrentUserId(): Promise<string | null> {
  // getClaims checks the token's expiry against Date.now(). With Cache Components a prerender
  // can resolve cookies() and still reach that call, so wait for the real request first.
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub ?? null;
}

/** Logs in with email and password. On failure, returns Supabase's error code. */
export async function signInWithPassword(
  credentials: Credentials,
): Promise<{ ok: true } | { ok: false; code: string | undefined }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);
  return error ? { ok: false, code: error.code } : { ok: true };
}

/**
 * Creates an account. `loggedIn` is true when Supabase logs the user in right away, which
 * happens when email confirmation is turned off.
 */
export async function signUp({
  credentials,
  languagePref,
  emailRedirectTo,
}: {
  credentials: Credentials;
  languagePref: string;
  emailRedirectTo: string;
}): Promise<{ ok: true; loggedIn: boolean } | { ok: false }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...credentials,
    options: {
      // Read by the database trigger that creates the user's profiles row.
      data: { language_pref: languagePref },
      emailRedirectTo,
    },
  });
  return error ? { ok: false } : { ok: true, loggedIn: Boolean(data.session) };
}

/** Ends only this browser's session; the user stays logged in on their other devices. */
export async function signOutThisBrowser(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
}

/** Confirms the email address and logs the user in. Returns whether it worked. */
export async function confirmEmail(confirmation: EmailConfirmation): Promise<boolean> {
  const supabase = await createClient();
  const { error } =
    confirmation.kind === "code"
      ? await supabase.auth.exchangeCodeForSession(confirmation.code)
      : await supabase.auth.verifyOtp({
          type: confirmation.type,
          token_hash: confirmation.tokenHash,
        });
  return !error;
}
