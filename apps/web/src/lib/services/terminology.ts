/**
 * Terms that must never appear (CLAUDE.md, Content rules; docs/decisions/0008):
 * - 하나님 is the Christian term and is banned everywhere.
 * - "God" capitalized is used as a name, and the name is Allah (الله). Lowercase "god"
 *   translates إله (a god, a deity) and is correct: "there is no god but Allah".
 */
const BANNED_TERMS: { term: string; pattern: RegExp }[] = [
  { term: "하나님", pattern: /하나님/ },
  { term: "God", pattern: /\bGod\b/ },
];

/** Returns the banned terms that occur in `text`, or an empty list. */
export function findBannedTerms(text: string): string[] {
  return BANNED_TERMS.filter(({ pattern }) => pattern.test(text)).map(({ term }) => term);
}
