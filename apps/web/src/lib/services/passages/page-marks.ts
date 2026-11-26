// Finding a verse inside a surah's pages, for books whose table of contents lists surahs only.
// Such books often print the verse's number in the text itself.
import { westernDigits } from "./arabic";
import { longestRun } from "./longest-run";
import { pageText } from "./page-text";
import type { SurahNames } from "./surah-names";
import type { ExportPage, VerseRef } from "./types";

/** A printed verse number. Marks that belong to one quote, or to quotes in a row, share a group. */
type Mark = { ayah: number; pageId: number; group: number };

type PageTexts = readonly { pageId: number; text: string }[];

// Quotes with only a few signs between them are one group of verses, discussed together.
const MAX_GAP_IN_GROUP = 5;

/** Ibn Kathir: "{… (34)}", the number inside the quote. */
function marksInQuotes(pages: PageTexts, verseCount: number): Mark[] {
  const marks: Mark[] = [];
  let group = 0;
  for (const { pageId, text } of pages) {
    let lastEnd = -Infinity;
    for (const quote of text.matchAll(/[{﴿]([^{}﴿﴾]*)[}﴾]/g)) {
      if (quote.index - lastEnd > MAX_GAP_IN_GROUP) group++;
      lastEnd = quote.index + quote[0].length;
      for (const number of quote[1].matchAll(/\((\d+)\)/g)) {
        marks.push({ ayah: Number(number[1]), pageId, group });
      }
    }
  }
  return inVerseOrder(marks, verseCount);
}

/** al-Siraj: a line that starts "(34)". */
function marksAtLineStart(pages: PageTexts, verseCount: number): Mark[] {
  const marks = pages.flatMap(({ pageId, text }) =>
    [...text.matchAll(/^\((\d+)\)/gm)].map((m) => ({ ayah: Number(m[1]), pageId, group: 0 })),
  );
  return inVerseOrder(marks, verseCount).map((mark) => ({ ...mark, group: mark.ayah }));
}

/** Mujahid, Abd al-Razzaq: "{…} [النساء: 34]". Thawri: "(الآية 34)". */
function marksAfterQuotes(pages: PageTexts, surah: number, names: SurahNames): Mark[] {
  let group = 0;
  return pages.flatMap(({ pageId, text }) =>
    [...text.matchAll(/\[([^\][\d:]{1,25}):\s*(\d+)(?:\s*-\s*(\d+))?\]|\(الآية:?\s*(\d+)\)/g)]
      .filter((match) => match[4] !== undefined || names.byExactName(match[1]) === surah)
      .flatMap((match) => {
        group++;
        const from = Number(match[4] ?? match[2]);
        const to = Math.max(from, Number(match[3] ?? from));
        return Array.from({ length: to - from + 1 }, (_, i) => ({
          ayah: from + i,
          pageId,
          group,
        }));
      }),
  );
}

/** Muqatil: "… - 34- …", the number at the end of what is said about the verse. */
function marksAtVerseEnd(pages: PageTexts, verseCount: number): Mark[] {
  const marks = pages.flatMap(({ pageId, text }) =>
    [...text.matchAll(/(?<![\d-])-\s?(\d{1,3})\s?-(?!\s?\d)/g)].map((match) => ({
      ayah: Number(match[1]),
      pageId,
      group: 0,
    })),
  );
  return inVerseOrder(marks, verseCount);
}

/**
 * The verse numbers among the marks. Footnote numbers look the same; verses come in order, so the
 * footnote numbers drop out.
 */
function inVerseOrder(marks: readonly Mark[], verseCount: number): Mark[] {
  return longestRun(
    marks.filter(({ ayah }) => ayah >= 1 && ayah <= verseCount),
    (a, b) => a.ayah < b.ayah || (a.ayah === b.ayah && a.group === b.group),
  );
}

/**
 * The page ids that discuss the verse, in runs, or an empty list. Looks for each way books print
 * verse numbers and uses the one this book prints most.
 */
export function searchPages(
  pages: readonly ExportPage[],
  verse: VerseRef,
  verseCount: number,
  names: SurahNames,
): PageRange[] {
  const texts = pages.map((page) => ({
    pageId: page.page_id,
    text: westernDigits(pageText(page.display_elem).text),
  }));
  const lastPage = texts.at(-1)?.pageId ?? 0;
  const inQuotes = marksInQuotes(texts, verseCount);
  const atLineStart = marksAtLineStart(texts, verseCount);
  const afterQuotes = marksAfterQuotes(texts, verse.surah, names);
  const atVerseEnd = marksAtVerseEnd(texts, verseCount);
  const most = Math.max(
    ...[inQuotes, atLineStart, afterQuotes, atVerseEnd].map((marks) => marks.length),
  );

  if (most === atVerseEnd.length) {
    return runsOf(atVerseEnd, verse.ayah, (i, mark) => ({
      from: atVerseEnd[i - 1]?.pageId ?? texts[0].pageId,
      to: mark.pageId,
    }));
  }
  // A reference at the end of a narration: the next page with a reference is another narration. A
  // quote at the top of a discussion: its text may reach the page of the next quote.
  const marks =
    most === afterQuotes.length ? afterQuotes : most === inQuotes.length ? inQuotes : atLineStart;
  const beforeNext = marks === afterQuotes ? 1 : 0;
  return runsOf(marks, verse.ayah, (i, mark) => {
    const next = marks.slice(i + 1).find((other) => other.group !== mark.group);
    return {
      from: mark.pageId,
      to: next ? Math.max(mark.pageId, next.pageId - beforeNext) : lastPage,
    };
  });
}

type PageRange = { from: number; to: number };

/** The page ranges of a verse's marks, with ranges that touch joined. */
function runsOf(
  marks: readonly Mark[],
  ayah: number,
  rangeOf: (index: number, mark: Mark) => PageRange,
): PageRange[] {
  const runs: PageRange[] = [];
  marks.forEach((mark, i) => {
    if (mark.ayah !== ayah) return;
    const range = rangeOf(i, mark);
    const last = runs.at(-1);
    if (last && range.from <= last.to + 1) last.to = Math.max(last.to, range.to);
    else runs.push(range);
  });
  return runs;
}
