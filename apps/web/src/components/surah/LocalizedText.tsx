import type { ReactNode } from "react";
import { RichText } from "@/components/text/RichText";
import type { Locale } from "@/i18n/locale";
import type { Localized } from "@/lib/domain/content";
import { pickText } from "@/lib/services/reading/localized";

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
 * reader turns on "show English explanation too" (a data attribute set by SurahReader). A draft
 * that a tester sees without its Korean yet shows the English in its place.
 */
export function LocalizedText({
  text,
  locale,
  lead,
  trailing,
  className = "",
}: LocalizedTextProps) {
  const { primary, primaryLang, english } = pickText(text, locale);
  return (
    <>
      {primary ? (
        <RichText
          text={primary}
          lang={primaryLang === locale ? undefined : primaryLang}
          lead={lead}
          trailing={trailing}
          className={className}
        />
      ) : null}
      {english ? (
        <div className="mt-1 text-ink-muted group-data-[show-english=false]/reader:hidden">
          <RichText text={english} lang="en" className={className} />
        </div>
      ) : null}
    </>
  );
}
