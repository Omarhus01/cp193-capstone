import type { Locale } from "@/i18n/locale";
import type { Localized } from "@/lib/domain/content";

type LocalizedTextProps = {
  text: Localized;
  locale: Locale;
  className?: string;
};

/**
 * Owner content in the page's language. On Korean pages the English follows, shown when the
 * reader turns on "show English explanation too" (a data attribute set by SurahReader).
 */
export function LocalizedText({ text, locale, className = "" }: LocalizedTextProps) {
  const primary = text[locale];
  const english = locale === "ko" ? text.en : null;
  return (
    <>
      {primary ? <p className={`leading-7 ${className}`}>{primary}</p> : null}
      {english ? (
        <p
          lang="en"
          className={`mt-1 leading-7 text-ink-muted group-data-[show-english=false]/reader:hidden ${className}`}
        >
          {english}
        </p>
      ) : null}
    </>
  );
}
