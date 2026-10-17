"use server";

import { redirect } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/locale";
import { routing } from "@/i18n/routing";
import { safeNextPath } from "@/lib/auth/paths";
import { readCredentials, validateCredentials, type AuthErrorKey } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = {
  error: AuthErrorKey | null;
  notice: "checkEmail" | null;
};

function readLocale(formData: FormData): Locale {
  const locale = formData.get("locale");
  return isLocale(locale) ? locale : routing.defaultLocale;
}

export async function logIn(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const locale = readLocale(formData);
  const credentials = readCredentials(formData);
  const invalid = validateCredentials(credentials);
  if (invalid) {
    return { error: invalid, notice: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);
  if (error) {
    const key = error.code === "email_not_confirmed" ? "emailNotConfirmed" : "invalidCredentials";
    return { error: key, notice: null };
  }

  redirect(safeNextPath(formData.get("next"), locale));
}

export async function signUp(_previous: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const locale = readLocale(formData);
  const credentials = readCredentials(formData);
  const invalid = validateCredentials(credentials);
  if (invalid) {
    return { error: invalid, notice: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...credentials,
    // Read by the database trigger that creates the user's profiles row.
    options: { data: { language_pref: locale } },
  });
  if (error) {
    return { error: "signupFailed", notice: null };
  }

  // With email confirmation turned off, Supabase logs the user in right away.
  if (data.session) {
    redirect(`/${locale}`);
  }
  return { error: null, notice: "checkEmail" };
}

export async function logOut(formData: FormData): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${readLocale(formData)}`);
}
