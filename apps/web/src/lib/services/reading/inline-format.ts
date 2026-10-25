// The small part of Markdown that content text may use: **bold**, *italic*, and paragraphs
// separated by a blank line. The page turns the tokens into React elements, never into HTML, so
// nothing in the content can inject markup (ADR 0015).

export type InlineToken = { text: string; bold: boolean; italic: boolean };

// **bold** (no "*" inside), or *italic* (no "*" inside, and not opening or closing on a space, so
// "a * b * c" stays literal). A mark without its pair stays as text.
const MARKS = /\*\*([^*]+)\*\*|\*([^*\s](?:[^*]*[^*\s])?)\*/g;

/** One paragraph as runs of plain, bold and italic text. */
export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let last = 0;
  for (const match of text.matchAll(MARKS)) {
    if (match.index > last) {
      tokens.push({ text: text.slice(last, match.index), bold: false, italic: false });
    }
    tokens.push(
      match[1] !== undefined
        ? { text: match[1], bold: true, italic: false }
        : { text: match[2], bold: false, italic: true },
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    tokens.push({ text: text.slice(last), bold: false, italic: false });
  }
  return tokens;
}

/** The paragraphs of a text (split on blank lines), each as inline tokens. */
export function parseParagraphs(text: string): InlineToken[][] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== "")
    .map(parseInline);
}
