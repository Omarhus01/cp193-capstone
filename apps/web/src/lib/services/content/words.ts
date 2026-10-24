// Quranic annotation signs (U+06D6–U+06ED): the pause marks ۖ ۗ ۘ ۙ ۚ ۛ ۜ and signs such as ۞ and
// ۩. Tanzil writes a pause mark as its own space-separated token. Such a token is not a word.
// Signs attached to a letter inside a word stay part of that word.
const ANNOTATION_ONLY = /^[ۖ-ۭ]+$/u;

/** Whether a space-separated token of a verse is only annotation signs, not a word. */
export function isAnnotationOnly(token: string): boolean {
  return ANNOTATION_ONLY.test(token);
}

/**
 * The words of a verse, in order. The verse text itself keeps every mark exactly as Tanzil has it
 * (its license forbids changing it); only the word list leaves the pause marks out.
 */
export function splitWords(verseText: string): string[] {
  return verseText.split(/\s+/u).filter((token) => token !== "" && !isAnnotationOnly(token));
}

/** Whether `words`, in order, are exactly the words of the verse. */
export function wordsMatchVerse(verseText: string, words: readonly string[]): boolean {
  const expected = splitWords(verseText);
  return expected.length === words.length && expected.every((word, i) => word === words[i]);
}
