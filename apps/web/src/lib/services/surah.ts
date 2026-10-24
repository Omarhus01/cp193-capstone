export const SURAH_COUNT = 114;

/** Parses a surah number from the URL. Returns null unless it is a whole number from 1 to 114. */
export function parseSurahNumber(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }
  const number = Number(value);
  return number >= 1 && number <= SURAH_COUNT ? number : null;
}
