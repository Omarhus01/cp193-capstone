import type { Locale } from "@/i18n/locale";
import type { Localized } from "@/lib/domain/content";

/**
 * Which text to show, and in which language. A Korean page shows the Korean, with the English
 * under it when the reader asks for it. Published content always has its Korean; a draft a tester
 * sees may not have it yet (status en_approved), so the English takes its place.
 */
export function pickText(
  text: Localized,
  locale: Locale,
): { primary: string | null; primaryLang: Locale; english: string | null } {
  if (locale === "en") {
    return { primary: text.en, primaryLang: "en", english: null };
  }
  if (!text.ko) {
    return { primary: text.en, primaryLang: "en", english: null };
  }
  return { primary: text.ko, primaryLang: "ko", english: text.en };
}
