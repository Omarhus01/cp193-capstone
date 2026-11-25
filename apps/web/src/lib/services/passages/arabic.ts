// Arabic text prepared for comparing. Only for comparing: the text the finder copies is never
// changed.

/** Arabic-Indic digits (٣٤) as ASCII digits (34). */
export function westernDigits(text: string): string {
  return text.replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
}

// Diacritics (with the small superscript alef), honorific and Quranic annotation signs, tatweel,
// and invisible joiners and direction marks.
const MARKS =
  /[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640\u08d3-\u08ff\u200b-\u200f\u202a-\u202e\ufeff]/g;

/**
 * Plain letters and single spaces: no diacritics, tatweel or Quran marks, one form each of alef,
 * ya and ta marbuta, and nothing that isn't an Arabic letter.
 */
export function normalizeArabic(text: string): string {
  return text
    .replace(MARKS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ىیئ]/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ة/g, "ه")
    .replace(/[^\u0621-\u064a]+/g, " ")
    .trim();
}

/**
 * The letters that Uthmani and plain spelling share. Uthmani spelling writes many long vowels as
 * small marks and some with another letter (قوّٰمون / قوامون, الصلوٰة / الصلاة), and joins some
 * words (يٰأيها / يا أيها), so the normalized texts alone still differ. This also drops alef, waw,
 * ya, hamza and spaces, and reads a doubled lam as one (الّيل / الليل).
 */
export function consonantSkeleton(text: string): string {
  return normalizeArabic(text)
    .replace(/[اويء ]/g, "")
    .replace(/ل{2,}/g, "ل");
}
