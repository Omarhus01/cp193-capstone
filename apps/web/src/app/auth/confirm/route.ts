import { NextResponse, type NextRequest } from "next/server";
import { confirmEmailLink } from "@/lib/services/auth/accounts";
import { readConfirmParams } from "@/lib/services/auth/confirm";

/**
 * Target of the link in the signup confirmation email. Handles both link shapes:
 * - `?code=`: Supabase's default email link, which redirects here with a PKCE code
 * - `?token_hash=&type=`: a custom email template that links here directly (see README)
 * On success the user is logged in and sent to the `next` path.
 */
export async function GET(request: NextRequest) {
  const { locale, next, credential } = readConfirmParams(request.nextUrl.searchParams);

  if (credential && (await confirmEmailLink(credential))) {
    return NextResponse.redirect(new URL(next, request.url));
  }

  return NextResponse.redirect(new URL(`/${locale}/login?error=confirmFailed`, request.url));
}
