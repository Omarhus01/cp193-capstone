// What one heading of a table of contents says about which verses it covers.
import { westernDigits } from "./arabic";

/**
 * - `surah-range`: "[سورة النساء (٤) : الآيات ١ إلى ٣]", names its surah
 * - `range`: "الآية (٣٤)", "الآيتان (٨، ٩)", "٢ - الآية الثانية: …"; covers just these verses
 * - `number`: "٣٤", "الآية: ٣٤"; in most books such a section runs on to the next number
 * - `quote`: "قوله تعالى: ﴿…﴾", with the verse's number only if the book prints it
 */
export type VerseHeading =
  | { style: "surah-range"; surah: number; from: number; to: number }
  | { style: "range" | "number"; from: number; to: number }
  | { style: "quote"; quote: string; from: number | null; to: number | null };

const TO = String.raw`\s*\)?\s*(?:-|–|،|,|و|إلى|الى)\s*\(?\s*`;
const SURAH_RANGE = new RegExp(
  String.raw`\(\s*(\d+)\s*\)\s*:\s*(?:آية|الآية|الآيتان|الآيات)\s*(\d+)(?:${TO}(\d+))?`,
);
const RANGE = new RegExp(
  String.raw`^[\[(]?\s*(?:الآية|الآيتان|الآيات)\s*:?\s*[\[(]?\s*(\d+)(?:${TO}(\d+))?`,
);
const ORDINAL = /^(\d+)\s*-\s*الآية\s/;
const AYAH_NUMBER = /^الآية:\s*(\d+)$/;
const NUMBER = /^(\d+)(?:\s*-\s*(\d+))?$/;
const QUOTE =
  /^(?:تفسير\s)?و?(?:قوله|قول الله|قال الله|قول(?=\s*:))(?:\s*(?:تعالى|عز وجل|جل وعز|جل ذكره|جل ثناؤه|﷿))*\s*:?\s*(.+)$/;
// A heading that is only a quote in brackets: "(… (٥) …)".
const BARE_QUOTE = /^([(﴿][^)﴾]{8,}.*)$/;

/** The verses in a heading's quote, by the numbers printed in it: "… (٢٩) … (٣٠)". */
function numbersInQuote(quote: string): { from: number | null; to: number | null } {
  const numbers = [...quote.matchAll(/\((\d+)\)/g)];
  if (numbers.length === 0) return { from: null, to: null };
  const from = Number(numbers[0][1]);
  const last = numbers[numbers.length - 1];
  // A number ends its verse, so letters after the last number begin the next verse.
  const rest = quote
    .slice(last.index + last[0].length)
    .replace(/[^\u0621-\u064a]/g, "")
    .replace(/الآية$/, "");
  const to = Number(last[1]) + (rest === "" ? 0 : 1);
  return { from, to: Math.max(from, to) };
}

/** Reads a heading, or null if it isn't about particular verses. */
export function parseVerseHeading(rawTitle: string): VerseHeading | null {
  const title = westernDigits(rawTitle).trim();
  let match = SURAH_RANGE.exec(title);
  if (match) {
    const from = Number(match[2]);
    return { style: "surah-range", surah: Number(match[1]), from, to: Number(match[3] ?? from) };
  }
  match = AYAH_NUMBER.exec(title) ?? NUMBER.exec(title);
  if (match) return { style: "number", from: Number(match[1]), to: Number(match[2] ?? match[1]) };
  match = RANGE.exec(title) ?? ORDINAL.exec(title);
  if (match) return { style: "range", from: Number(match[1]), to: Number(match[2] ?? match[1]) };
  match = QUOTE.exec(title) ?? BARE_QUOTE.exec(title);
  if (match) return { style: "quote", quote: match[1], ...numbersInQuote(match[1]) };
  return null;
}
