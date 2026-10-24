import type { EmailOtpType } from "@supabase/supabase-js";
import { isLocale, type Locale } from "@/i18n/locale";
import { routing } from "@/i18n/routing";
import { safeNextPath } from "./paths";

export const CONFIRM_PATH = "/auth/confirm";

const EMAIL_OTP_TYPES: readonly EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

/**
 * What the confirmation link carries. Supabase's default email link verifies the address, then
 * redirects with a PKCE `code`. A custom email template can link here directly with
 * `token_hash` and `type` instead.
 */
export type ConfirmCredential =
  { kind: "code"; code: string } | { kind: "otp"; tokenHash: string; type: EmailOtpType };

export type ConfirmParams = {
  locale: Locale;
  /** Where to send the user after confirming, already checked with safeNextPath. */
  next: string;
  credential: ConfirmCredential | null;
};

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return EMAIL_OTP_TYPES.includes(value as EmailOtpType);
}

export function readConfirmParams(searchParams: URLSearchParams): ConfirmParams {
  const localeParam = searchParams.get("locale");
  const locale = isLocale(localeParam) ? localeParam : routing.defaultLocale;
  const next = safeNextPath(searchParams.get("next"), locale);

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  let credential: ConfirmCredential | null = null;
  if (code) {
    credential = { kind: "code", code };
  } else if (tokenHash && isEmailOtpType(type)) {
    credential = { kind: "otp", tokenHash, type };
  }
  return { locale, next, credential };
}

/** The `emailRedirectTo` URL for signup: the confirm route, carrying the locale and next path. */
export function confirmRedirectUrl(origin: string, locale: Locale, next: string): string {
  const url = new URL(CONFIRM_PATH, origin);
  url.searchParams.set("locale", locale);
  url.searchParams.set("next", next);
  return url.toString();
}
