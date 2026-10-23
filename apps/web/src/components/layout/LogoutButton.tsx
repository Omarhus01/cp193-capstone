"use client";

import { useLocale, useTranslations } from "next-intl";
// next/navigation's usePathname keeps the locale prefix, which logoutRedirectPath requires.
import { usePathname, useSearchParams } from "next/navigation";
import { logOut } from "@/app/[locale]/auth-actions";

/** Log out button. Sends the current page so the server can decide where to go next. */
export function LogoutButton() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const pathname = usePathname();
  const search = useSearchParams().toString();

  return (
    <form action={logOut}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={search ? `${pathname}?${search}` : pathname} />
      <button type="submit" className="text-sm font-medium text-zinc-700 hover:text-emerald-800">
        {t("logout")}
      </button>
    </form>
  );
}
