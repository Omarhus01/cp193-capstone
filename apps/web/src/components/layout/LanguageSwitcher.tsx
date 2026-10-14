"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

/**
 * EN/KO links that keep the user on the same page, query string included, in the other language.
 * Reads the URL, so render it inside <Suspense>.
 */
export function LanguageSwitcher() {
  const t = useTranslations("header");
  const currentLocale = useLocale();
  const pathname = usePathname();
  const query = Object.fromEntries(useSearchParams());

  return (
    <nav aria-label={t("languageLabel")}>
      <ul className="flex gap-1 text-sm">
        {routing.locales.map((locale) => {
          const isCurrent = locale === currentLocale;
          return (
            <li key={locale}>
              <Link
                href={{ pathname, query }}
                locale={locale}
                hrefLang={locale}
                lang={locale}
                aria-label={t(`languages.${locale}`)}
                aria-current={isCurrent ? "page" : undefined}
                className={`rounded px-2 py-1 font-medium ${
                  isCurrent ? "bg-emerald-700 text-white" : "text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {t(`languageShort.${locale}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
