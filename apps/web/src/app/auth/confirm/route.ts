import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isLocale } from "@/i18n/locale";
import { routing } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";

/**
 * Target of the link in the signup confirmation email. The "Confirm signup" email template in
 * Supabase must point here (see README). On success the user is logged in and sent home.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const localeParam = searchParams.get("locale");
  const locale = isLocale(localeParam) ? localeParam : routing.defaultLocale;

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(`/${locale}`, request.url));
    }
  }

  return NextResponse.redirect(new URL(`/${locale}/login?error=confirmFailed`, request.url));
}
