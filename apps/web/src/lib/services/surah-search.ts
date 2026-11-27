import type { SurahLink } from "./surah-list";

// Pure helpers for the surah switcher. They live apart from surah-list.ts, which reads the
// database, so the switcher (a client component) can import them.

// Arabic short vowels, shadda, sukun, the dagger alif and the Quranic annotation marks, and the
// tatweel (the stretching line), none of which a reader types.
const ARABIC_MARKS = /[ً-ٰٟۖ-ۭـ]/g;
// Alif with hamza, madda or wasla, which readers type as a plain alif.
const ALIF_FORMS = /[آأإٱ]/g;
const ARABIC_INDIC_DIGITS = /[٠-٩]/g;
// Spaces, hyphens, apostrophes and the ʿ and ʾ of transliterations.
const SEPARATORS = /[\s\-'’‘`ʿʾʼ]/g;

/**
 * A name or query as a search compares it: lowercase, without accents, Arabic vowel marks,
 * spaces, hyphens or apostrophes, with every alif form as a plain alif, Arabic-Indic digits as
 * 0–9, and doubled Latin letters as one ("Aal-i-Imraan" → "alimran"), since English spellings
 * of the names vary.
 */
export function normalizeForSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .normalize("NFC")
    .toLowerCase()
    .replace(ARABIC_MARKS, "")
    .replace(ALIF_FORMS, "ا")
    .replace(ARABIC_INDIC_DIGITS, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(SEPARATORS, "")
    .replace(/([a-z])\1+/g, "$1");
}

/**
 * The surahs a query finds, in surah order. Digits find the surahs whose number starts with them,
 * the exact number first ("1" → 1, 10–19, 100–114). Anything else finds the surahs whose
 * Arabic, English or Korean name contains it. An empty query finds every surah.
 */
export function filterSurahs(links: readonly SurahLink[], query: string): SurahLink[] {
  const wanted = normalizeForSearch(query);
  if (wanted === "") {
    return [...links];
  }
  if (/^\d+$/.test(wanted)) {
    const exact = links.filter((link) => String(link.number) === wanted);
    const starting = links.filter(
      (link) => String(link.number).startsWith(wanted) && String(link.number) !== wanted,
    );
    return [...exact, ...starting];
  }
  return links.filter((link) =>
    [link.nameAr, link.nameEn, link.nameKo].some(
      (name) => name !== null && normalizeForSearch(name).includes(wanted),
    ),
  );
}

/**
 * The surahs before and after this one in the list. The list holds the surahs in the database, so
 * these never point at a surah the site doesn't have.
 */
export function adjacentSurahs(
  links: readonly SurahLink[],
  number: number,
): { previous: SurahLink | null; next: SurahLink | null } {
  const index = links.findIndex((link) => link.number === number);
  if (index === -1) {
    return { previous: null, next: null };
  }
  return { previous: links[index - 1] ?? null, next: links[index + 1] ?? null };
}
