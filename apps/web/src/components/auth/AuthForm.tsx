"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { logIn, signUp, type AuthFormState } from "@/app/[locale]/auth-actions";
import { MIN_PASSWORD_LENGTH, type AuthErrorKey } from "@/lib/auth/validation";
import { FormError } from "./FormError";

type AuthFormProps = {
  mode: "login" | "signup";
  /** Where to go after logging in. Checked again on the server. */
  next?: string;
  initialError?: AuthErrorKey | null;
};

const inputClass =
  "w-full rounded-md border border-zinc-300 px-3 py-2 focus:border-emerald-700 focus:outline-none";

export function AuthForm({ mode, next, initialError = null }: AuthFormProps) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const initialState: AuthFormState = { error: initialError, notice: null };
  const [state, formAction, isPending] = useActionState(
    mode === "login" ? logIn : signUp,
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      {next && <input type="hidden" name="next" value={next} />}

      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("email")}
        <input name="email" type="email" autoComplete="email" required className={inputClass} />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("password")}
        <input
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={mode === "signup" ? MIN_PASSWORD_LENGTH : undefined}
          required
          className={inputClass}
        />
        {mode === "signup" && (
          <span className="font-normal text-zinc-500">{t("passwordHint")}</span>
        )}
      </label>

      <FormError errorKey={state.error} />
      {state.notice && (
        <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {t(state.notice)}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {isPending ? t("submitting") : t(mode)}
      </button>
    </form>
  );
}
