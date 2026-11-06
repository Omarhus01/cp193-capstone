// Which verses the Tanzil importer writes (scripts/import-tanzil.mts). A surah folder may hold
// the whole surah or only some of its verses (ADR 0022).

/** The verses to import from one surah: all of them, or the listed ones in ascending order. */
export type VerseSelection = { surah: number; ayahs: "all" | number[] };

const ARGUMENT = /^(\d{1,3})(?::(\d{1,3})(?:-(\d{1,3}))?)?$/;

/**
 * Reads the importer's arguments: "4" for the whole surah, "4:34" for one verse, "4:34-36" for
 * verses 34 to 36. Arguments for the same surah combine ("4:34 4:40"). Throws on a malformed
 * argument, a verse listed twice, or a whole surah listed together with some of its verses.
 * Whether each verse exists is checked against Tanzil's file by the importer.
 */
export function parseVerseSelection(args: readonly string[]): VerseSelection[] {
  const selections = new Map<number, VerseSelection>();
  for (const arg of args) {
    const match = ARGUMENT.exec(arg);
    const surah = Number(match?.[1]);
    if (!match || surah < 1 || surah > 114) {
      throw new Error(
        `"${arg}" isn't a surah (1 to 114) or verses: write "4", "4:34" or "4:34-36".`,
      );
    }
    const previous = selections.get(surah);
    if (match[2] === undefined) {
      if (previous) {
        throw new Error(`Surah ${surah} is listed more than once; list it whole or by verses.`);
      }
      selections.set(surah, { surah, ayahs: "all" });
      continue;
    }
    const from = Number(match[2]);
    const to = match[3] === undefined ? from : Number(match[3]);
    if (from < 1 || to < from) {
      throw new Error(`"${arg}": verses are numbered from 1, and a range goes up ("4:34-36").`);
    }
    if (previous?.ayahs === "all") {
      throw new Error(`Surah ${surah} is listed whole and by verses; list it one way.`);
    }
    const ayahs = previous?.ayahs ?? [];
    for (let ayah = from; ayah <= to; ayah++) {
      if (ayahs.includes(ayah)) {
        throw new Error(`Verse ${surah}:${ayah} is listed twice.`);
      }
      ayahs.push(ayah);
    }
    selections.set(surah, { surah, ayahs: ayahs.sort((a, b) => a - b) });
  }
  return [...selections.values()];
}
