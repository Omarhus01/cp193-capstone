import type { Localized, ReviewStatus, Span } from "@/lib/domain/content";
import {
  REVIEW_STEPS,
  REVIEW_TRACKS,
  replayReview,
  type ReviewEntry,
  type ReviewTrack,
} from "@/lib/services/review";
import { findBannedTerms } from "@/lib/services/terminology";
import type { ContentBundle, ContentError } from "./load";
import { formatRef, isReversed, parseRef, parseSpan, type SpanRefs } from "./spans";
import { wordsMatchVerse } from "./words";

/**
 * Checks across files that a schema can't express: every ref points to text that exists, reading
 * sections cover their surah, review histories follow the steps, and no banned term appears.
 * Returns every problem found, or an empty list.
 */
export function validateContent(bundle: ContentBundle): ContentError[] {
  const errors: ContentError[] = [];
  const report = (file: string, path: string, message: string) =>
    errors.push({ file, path, message });

  // Every surah's verse count from Tanzil's metadata, imported or not.
  const metadata = new Map(bundle.metadata.map((surah) => [surah.number, surah]));
  bundle.metadata.forEach((surah, i) => {
    if (surah.number !== i + 1) {
      report("quran-metadata.json", `surahs[${i}].number`, `is ${surah.number}; expected ${i + 1}`);
    }
  });

  // Word count of every verse, keyed "surah:ayah".
  const wordCounts = new Map<string, number>();
  const verseCounts = new Map<number, number>();

  for (const { number, dir, text, words } of bundle.surahs) {
    const textFile = `${dir}/text.json`;
    const wordsFile = `${dir}/words.json`;
    if (text.surah.number !== number) {
      report(textFile, "surah.number", `is ${text.surah.number}, but the folder is ${dir}`);
    }
    if (text.verses.length !== text.surah.verseCount) {
      report(
        textFile,
        "verses",
        `has ${text.verses.length} verses, but verseCount is ${text.surah.verseCount}`,
      );
    }
    verseCounts.set(number, text.surah.verseCount);
    const meta = metadata.get(number);
    if (
      meta &&
      (meta.verseCount !== text.surah.verseCount ||
        meta.nameAr !== text.surah.nameAr ||
        meta.revelationPlace !== text.surah.revelationPlace)
    ) {
      report(textFile, "surah", "doesn't match quran-metadata.json; import both from Tanzil again");
    }
    text.verses.forEach((verse, i) => {
      if (verse.ayah !== i + 1) {
        report(textFile, `verses[${i}].ayah`, `is ${verse.ayah}; verses are numbered 1, 2, 3, …`);
      }
    });

    if (words.verses.length !== text.verses.length) {
      report(
        wordsFile,
        "verses",
        `has ${words.verses.length} verses, text.json has ${text.verses.length}`,
      );
    }
    words.verses.forEach((verse, i) => {
      if (verse.ayah !== i + 1) {
        report(wordsFile, `verses[${i}].ayah`, `is ${verse.ayah}; verses are numbered 1, 2, 3, …`);
      }
      verse.words.forEach((word, j) => {
        if (word.position !== j + 1) {
          report(
            wordsFile,
            `verses[${i}].words[${j}].position`,
            `is ${word.position}; words are numbered 1, 2, 3, …`,
          );
        }
      });
      const verseText = text.verses[i]?.text;
      if (
        verseText !== undefined &&
        !wordsMatchVerse(
          verseText,
          verse.words.map((w) => w.text),
        )
      ) {
        report(
          wordsFile,
          `verses[${i}].words`,
          "joined with spaces, the words aren't the verse text without its pause marks",
        );
      }
      wordCounts.set(`${number}:${verse.ayah}`, verse.words.length);
    });
  }

  /** Why a ref doesn't point to existing text, or null when it does. */
  function missingText(ref: string): string | null {
    const parsed = parseRef(ref);
    if (!parsed) {
      return `"${ref}" isn't a verse ("2:60") or word ("2:60:3") ref`;
    }
    const count = wordCounts.get(`${parsed.surah}:${parsed.ayah}`);
    if (count === undefined) {
      return `verse ${parsed.surah}:${parsed.ayah} isn't in content/surahs/`;
    }
    if (parsed.word !== null && parsed.word > count) {
      return `${ref}: verse ${parsed.surah}:${parsed.ayah} has ${count} words`;
    }
    return null;
  }

  /** Checks a span and returns it parsed, or null when it is broken. */
  function checkSpan(file: string, path: string, refs: SpanRefs): Span | null {
    const problems = [missingText(refs.from), missingText(refs.to)].filter((p) => p !== null);
    for (const problem of problems) {
      report(file, path, problem);
    }
    const span = parseSpan(refs);
    if (problems.length > 0 || !span) {
      return null;
    }
    if (isReversed(span)) {
      report(file, path, `ends (${refs.to}) before it starts (${refs.from})`);
      return null;
    }
    return span;
  }

  function checkText(file: string, path: string, text: Localized) {
    for (const language of ["en", "ko"] as const) {
      const value = text[language];
      for (const term of value ? findBannedTerms(value) : []) {
        report(file, `${path}.${language}`, `uses "${term}" (see CLAUDE.md, Content rules)`);
      }
    }
  }

  function checkReview(
    file: string,
    path: string,
    item: { status: ReviewStatus; review: ReviewEntry[] },
    texts: Localized[],
    citationCount: number | null,
  ) {
    const replay = replayReview(item.review);
    if (!replay.ok) {
      report(file, `${path}.review[${replay.step}]`, replay.message);
    } else if (replay.status !== item.status) {
      report(
        file,
        `${path}.status`,
        `is ${item.status}, but the review history ends at ${replay.status}`,
      );
    }
    const step = REVIEW_STEPS.indexOf(item.status);
    if (texts.some((t) => t.ko && !t.en)) {
      report(file, path, "has Korean without the English it is drafted from");
    }
    if (step >= REVIEW_STEPS.indexOf("en_approved") && texts.every((t) => !t.en)) {
      report(file, path, `is ${item.status} but has no English text`);
    }
    if (step >= REVIEW_STEPS.indexOf("ko_drafted") && texts.some((t) => t.en && !t.ko)) {
      report(file, path, `is ${item.status}, so every English part needs its Korean`);
    }
    if (item.status === "published" && citationCount === 0) {
      report(file, path, "is published, so it needs at least one citation");
    }
  }

  // Sources and passages.
  const passageIds = new Set<string>();
  const sourceIds = new Set<string>();
  for (const { file, source, passages } of bundle.sources) {
    if (file !== `sources/${source.id}.json`) {
      report(
        file,
        "source.id",
        `is "${source.id}", so the file should be sources/${source.id}.json`,
      );
    }
    if (sourceIds.has(source.id)) {
      report(file, "source.id", `"${source.id}" is used by another source`);
    }
    sourceIds.add(source.id);
    if (!source.titleAr && !source.titleEn) {
      report(file, "source", "needs titleAr, titleEn or both");
    }
    passages.forEach((passage, i) => {
      const path = `passages[${i}]`;
      if (passageIds.has(passage.id)) {
        report(file, `${path}.id`, `"${passage.id}" is used by another passage`);
      }
      passageIds.add(passage.id);
      if (!passage.page && !passage.verse) {
        report(file, path, "needs a page, or a verse for sources arranged by verse");
      }
      const missing = passage.verse ? missingText(passage.verse) : null;
      if (missing) {
        report(file, `${path}.verse`, missing);
      }
      checkText(file, `${path}.summary`, passage.summary);
    });
  }

  function checkCitations(file: string, path: string, ids: string[]) {
    ids.forEach((citation, i) => {
      if (!passageIds.has(citation)) {
        report(file, `${path}[${i}]`, `no passage "${citation}" in content/sources/`);
      }
      if (ids.indexOf(citation) !== i) {
        report(file, `${path}[${i}]`, `"${citation}" is cited twice`);
      }
    });
  }

  // Explanations, reading sections, word meanings and briefs.
  const explanationIds = new Set<string>();
  for (const surah of bundle.surahs) {
    const { number, dir } = surah;
    const file = `${dir}/explanations.json`;
    const spans = new Map<string, Span>();

    surah.explanations.forEach((explanation, i) => {
      const path = `explanations[${i}]`;
      if (explanationIds.has(explanation.id)) {
        report(file, `${path}.id`, `"${explanation.id}" is used by another explanation`);
      }
      explanationIds.add(explanation.id);

      const span = checkSpan(file, `${path}.span`, explanation.span);
      if (span) {
        spans.set(explanation.id, span);
        if (span.start.surah !== number) {
          report(
            file,
            `${path}.span`,
            `starts in surah ${span.start.surah}, so it belongs in that surah's folder`,
          );
        }
        const wordRefs = span.start.word !== null && span.end.word !== null;
        const sameVerse = span.start.surah === span.end.surah && span.start.ayah === span.end.ayah;
        if (explanation.kind === "phrase_note" && !(wordRefs && sameVerse)) {
          report(file, `${path}.span`, "a phrase_note runs from word to word inside one verse");
        }
        if (
          explanation.kind !== "phrase_note" &&
          (span.start.word !== null || span.end.word !== null)
        ) {
          report(
            file,
            `${path}.span`,
            `a ${explanation.kind} covers whole verses ("1:2", not "1:2:3")`,
          );
        }
      }

      explanation.contextLinks.forEach((link, j) => {
        checkSpan(file, `${path}.contextLinks[${j}].span`, link.span);
        checkText(file, `${path}.contextLinks[${j}].reason`, link.reason);
      });
      checkCitations(file, `${path}.citations`, explanation.citations);

      const texts = Object.values(explanation.parts);
      for (const [part, text] of Object.entries(explanation.parts)) {
        checkText(file, `${path}.parts.${part}`, text);
      }
      checkReview(
        file,
        path,
        explanation,
        [...texts, ...explanation.contextLinks.map((link) => link.reason)],
        explanation.citations.length,
      );
    });

    // Reading sections run from the first verse to the last, in order, with no gaps or overlaps.
    const readingFile = `${dir}/reading.json`;
    let nextAyah = 1;
    surah.readingSections.forEach((id, i) => {
      const path = `sections[${i}]`;
      const explanation = surah.explanations.find((e) => e.id === id);
      if (!explanation) {
        report(readingFile, path, `no explanation "${id}" in ${dir}/explanations.json`);
        return;
      }
      if (explanation.kind !== "reading_section") {
        report(readingFile, path, `"${id}" is a ${explanation.kind}, not a reading_section`);
      }
      if (surah.readingSections.indexOf(id) !== i) {
        report(readingFile, path, `"${id}" is listed twice`);
      }
      const span = spans.get(id);
      if (!span) {
        return;
      }
      if (span.end.surah !== number) {
        report(readingFile, path, `"${id}" runs past the end of surah ${number}`);
        return;
      }
      if (span.start.ayah > nextAyah) {
        report(
          readingFile,
          path,
          `leaves a gap: verses ${formatRef({ surah: number, ayah: nextAyah, word: null })} to ` +
            `${formatRef({ surah: number, ayah: span.start.ayah - 1, word: null })} are in no section`,
        );
      } else if (span.start.ayah < nextAyah) {
        report(
          readingFile,
          path,
          `"${id}" starts at ${number}:${span.start.ayah}, inside the section before it`,
        );
      }
      nextAyah = Math.max(nextAyah, span.end.ayah + 1);
    });
    const verseCount = verseCounts.get(number) ?? 0;
    if (surah.readingSections.length > 0 && nextAyah <= verseCount) {
      report(
        readingFile,
        "sections",
        `end at verse ${nextAyah - 1}; the surah has ${verseCount} verses`,
      );
    }
    surah.explanations.forEach((explanation, i) => {
      if (
        explanation.kind === "reading_section" &&
        !surah.readingSections.includes(explanation.id)
      ) {
        report(
          file,
          `explanations[${i}]`,
          `reading_section "${explanation.id}" isn't listed in reading.json`,
        );
      }
    });

    const meaningsFile = `${dir}/word-meanings.json`;
    const meaningWords = new Set<string>();
    surah.wordMeanings.forEach((meaning, i) => {
      const path = `wordMeanings[${i}]`;
      const missing = missingText(meaning.word);
      if (missing) {
        report(meaningsFile, `${path}.word`, missing);
      } else if (parseRef(meaning.word)?.surah !== number) {
        report(meaningsFile, `${path}.word`, `${meaning.word} belongs in that surah's folder`);
      }
      if (meaningWords.has(meaning.word)) {
        report(meaningsFile, `${path}.word`, `${meaning.word} already has a meaning`);
      }
      meaningWords.add(meaning.word);
      checkCitations(meaningsFile, `${path}.citations`, meaning.citations);
      checkText(meaningsFile, `${path}.meaning`, meaning.meaning);
      checkReview(meaningsFile, path, meaning, [meaning.meaning], meaning.citations.length);
    });

    // Transliterations: one per verse and language, reviewed on that language's track.
    const transliterationsFile = `${dir}/transliterations.json`;
    const transliterated = new Set<string>();
    surah.transliterations.forEach((item, i) => {
      const path = `transliterations[${i}]`;
      const missing = missingText(item.verse);
      if (missing) {
        report(transliterationsFile, `${path}.verse`, missing);
      } else if (parseRef(item.verse)?.surah !== number) {
        report(
          transliterationsFile,
          `${path}.verse`,
          `${item.verse} belongs in that surah's folder`,
        );
      }
      const key = `${item.verse} ${item.language}`;
      if (transliterated.has(key)) {
        report(transliterationsFile, path, `${item.verse} already has a "${item.language}" one`);
      }
      transliterated.add(key);

      const track: ReviewTrack = item.language === "en" ? "latin" : "hangul";
      const steps: readonly ReviewStatus[] = REVIEW_TRACKS[track];
      if (!steps.includes(item.status)) {
        report(
          transliterationsFile,
          `${path}.status`,
          `"${item.language}" transliterations go ${steps.join(" → ")}`,
        );
      }
      const replay = replayReview(item.review, track);
      if (!replay.ok) {
        report(transliterationsFile, `${path}.review[${replay.step}]`, replay.message);
      } else if (replay.status !== item.status) {
        report(
          transliterationsFile,
          `${path}.status`,
          `is ${item.status}, but the review history ends at ${replay.status}`,
        );
      }
      if (item.status !== "draft" && !item.text) {
        report(transliterationsFile, path, `is ${item.status} but has no text`);
      }
      const text = { en: null, ko: null, [item.language]: item.text };
      checkText(transliterationsFile, `${path}.text`, text);
    });

    const surahFile = `${dir}/surah.json`;
    checkText(surahFile, "names", surah.surah.names);
    const brief = surah.surah.brief;
    if (brief) {
      const text = { en: brief.en, ko: brief.ko };
      checkText(surahFile, "brief", text);
      checkReview(surahFile, "brief", brief, [text], null);
    }
  }

  return errors;
}
