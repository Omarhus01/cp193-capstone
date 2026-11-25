// The text of a page, out of the export's HTML. Tags go; the text itself stays as it is.

const PAGE_START = '<div class="PageText">';
const PAGE_HEAD = /<div class="PageHead">[\s\S]*?<\/div>/;
const FOOTNOTES = /<hr[^>]*>\s*<div class="footnote">([\s\S]*?)<\/div>/g;
// Only the tags the export uses, so a "<" in the text is kept.
const TAGS = /<\/?(?:div|span|font|sup|p|hr)(?:\s[^<>]*)?\/?>/g;
// Shamela marks the start of a heading with invisible joiners around the heading's tag.
const HEADING_JOINERS = /\u200c*(<span data-type="title"[^>]*>)\u200c*/g;

/** The page's own HTML. A damaged record also holds the pages after it; those are left out. */
export function ownHtml(displayElem: string): string {
  const start = displayElem.indexOf(PAGE_START);
  if (start === -1) return displayElem;
  const next = displayElem.indexOf(PAGE_START, start + PAGE_START.length);
  return displayElem.slice(start, next === -1 ? undefined : next);
}

function plainText(html: string): string {
  return html
    .replace(HEADING_JOINERS, "$1")
    .replace(/<p>\s*<\/p>|<hr[^>]*>/g, "\n")
    .replace(TAGS, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .join("\n")
    .trim();
}

/** A page's text and its footnotes, one paragraph per line. */
export function pageText(displayElem: string): { text: string; footnotes: string } {
  const body = ownHtml(displayElem).replace(PAGE_HEAD, "");
  const footnotes = [...body.matchAll(FOOTNOTES)].map((match) => match[1]);
  return {
    text: plainText(body.replace(FOOTNOTES, "")),
    footnotes: plainText(footnotes.join("<p></p>")),
  };
}

/** The book's title and the printed page number at the top of the page. */
export function pageHead(displayElem: string): { partName: string; pageNumber: string } {
  const html = ownHtml(displayElem);
  return {
    partName: plainText(/<span class="PartName">([^<]*)/.exec(html)?.[1] ?? ""),
    pageNumber: /<span class="PageNumber">[^<]*?([\d٠-٩]+)/.exec(html)?.[1] ?? "",
  };
}

const VOLUME = /\s+-\s+(?:جـ\s*)?([^-]+)$/;

/** "أيسر التفاسير للجزائري - جـ ١" without its volume. */
export function bookTitle(partName: string, partTitle: string): string {
  const volume = VOLUME.exec(partName);
  return volume && volume[1].trim() === partTitle.trim()
    ? partName.slice(0, volume.index).trim()
    : partName.trim();
}

/** The volume of a page, or null in a book of one volume (there it holds the title). */
export function volumeOf(partName: string, partTitle: string): string | null {
  return VOLUME.exec(partName)?.[1].trim() === partTitle.trim() ? partTitle.trim() : null;
}

/**
 * Whether the page has text before a heading's mark: the end of the section before it. Also true
 * when the page doesn't mark the heading, since then the heading could be anywhere on it.
 */
export function hasTextBeforeHeading(displayElem: string, tocId: number): boolean {
  const body = ownHtml(displayElem).replace(PAGE_HEAD, "");
  const mark = body.indexOf(`id="toc-${tocId}"`);
  if (mark === -1) return true;
  const before = body.slice(0, body.lastIndexOf("<", mark));
  return plainText(before).replace(/\u200c/g, "") !== "";
}
