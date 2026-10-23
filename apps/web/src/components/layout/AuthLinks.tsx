"use client";

import { useLocale, useTranslations } from "next-intl";
// next/navigation's usePathname keeps the locale prefix, which safeNextPath requires.
import { usePathname, useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { authLinkNextPath } from "@/lib/auth/paths";

/** Log in / Sign up links that bring the user back to the current page. Reads the URL. */
export function AuthLinks() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const next = authLinkNextPath(usePathname(), new URLSearchParams(useSearchParams()), locale);

  return (
    <div className="flex items-center gap-3">
      <Link
        href={{ pathname: "/login", query: { next } }}
        className="text-sm font-medium text-zinc-700 hover:text-emerald-800"
      >
        {t("login")}
      </Link>
      <Link
        href={{ pathname: "/signup", query: { next } }}
        className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800"
      >
        {t("signup")}
      </Link>
    </div>
  );
}
