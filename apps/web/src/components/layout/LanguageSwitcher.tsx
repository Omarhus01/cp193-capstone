"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

/**
 * English/한국어 links that keep the user on the same page, query string included, in that language.
 * Reads the URL, so render it inside <Suspense>.
 */
export function LanguageSwitcher() {
  const t = useTranslations("header");
  const currentLocale = useLocale();
  const pathname = usePathname();
  const query = Object.fromEntries(useSearchParams());

  return (
    <nav aria-label={t("languageLabel")}>
      <ul className="inline-flex gap-0.5 rounded-lg bg-page p-0.5 text-sm">
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
                className={`block rounded-md px-3 py-1 ${
                  isCurrent
                    ? "bg-white font-semibold text-ink shadow-sm"
                    : "text-ink-muted hover:text-ink"
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
