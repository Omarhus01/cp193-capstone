import type { ReactNode } from "react";
import { RichText } from "@/components/text/RichText";
import type { Locale } from "@/i18n/locale";
import type { Localized } from "@/lib/domain/content";

type LocalizedTextProps = {
  text: Localized;
  locale: Locale;
  /** Shown before the text in the page's language, such as a related verse's reference. */
  lead?: ReactNode;
  /** Shown after the text in the page's language, such as the point's source links. */
  trailing?: ReactNode;
  className?: string;
};

/**
 * Owner content in the page's language. On Korean pages the English follows, shown when the
 * reader turns on "show English explanation too" (a data attribute set by SurahReader).
 */
export function LocalizedText({
  text,
  locale,
  lead,
  trailing,
  className = "",
}: LocalizedTextProps) {
  const primary = text[locale];
  const english = locale === "ko" ? text.en : null;
  return (
    <>
      {primary ? (
        <RichText text={primary} lead={lead} trailing={trailing} className={className} />
      ) : null}
      {english ? (
        <div className="mt-1 text-ink-muted group-data-[show-english=false]/reader:hidden">
          <RichText text={english} lang="en" className={className} />
        </div>
      ) : null}
    </>
  );
}
