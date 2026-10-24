import { NextResponse, type NextRequest } from "next/server";
import { readConfirmParams } from "@/lib/services/auth/confirm";
import { createClient } from "@/lib/supabase/server";

/**
 * Target of the link in the signup confirmation email. Handles both link shapes:
 * - `?code=`: Supabase's default email link, which redirects here with a PKCE code
 * - `?token_hash=&type=`: a custom email template that links here directly (see README)
 * On success the user is logged in and sent to the `next` path.
 */
export async function GET(request: NextRequest) {
  const { locale, next, credential } = readConfirmParams(request.nextUrl.searchParams);

  if (credential) {
    const supabase = await createClient();
    const { error } =
      credential.kind === "code"
        ? await supabase.auth.exchangeCodeForSession(credential.code)
        : await supabase.auth.verifyOtp({
            type: credential.type,
            token_hash: credential.tokenHash,
          });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL(`/${locale}/login?error=confirmFailed`, request.url));
}
