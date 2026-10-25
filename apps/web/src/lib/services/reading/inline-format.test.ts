import { describe, expect, it } from "vitest";
import { parseInline, parseParagraphs } from "./inline-format";

const plain = (text: string) => ({ text, bold: false, italic: false });
const bold = (text: string) => ({ text, bold: true, italic: false });
const italic = (text: string) => ({ text, bold: false, italic: true });

describe("parseInline", () => {
  it("finds bold and italic runs", () => {
    expect(parseInline("**al-Ḥamd** is not *madḥ* (commendation)")).toEqual([
      bold("al-Ḥamd"),
      plain(" is not "),
      italic("madḥ"),
      plain(" (commendation)"),
    ]);
  });

  it("handles Korean and Arabic inside the marks", () => {
    expect(parseInline("**알라**는 *الله*")).toEqual([bold("알라"), plain("는 "), italic("الله")]);
  });

  it("keeps punctuation inside a bold run", () => {
    expect(parseInline("**1:4:** *Yawm al-Dīn*")).toEqual([
      bold("1:4:"),
      plain(" "),
      italic("Yawm al-Dīn"),
    ]);
  });

  it("leaves a mark without its pair as text", () => {
    expect(parseInline("**not closed")).toEqual([plain("**not closed")]);
    expect(parseInline("one * star")).toEqual([plain("one * star")]);
    expect(parseInline("a * b * c")).toEqual([plain("a * b * c")]);
  });

  it("never produces markup: angle brackets stay text", () => {
    expect(parseInline("**<b>x</b>**")).toEqual([bold("<b>x</b>")]);
  });
});

describe("parseParagraphs", () => {
  it("splits on blank lines and drops empty paragraphs", () => {
    expect(parseParagraphs("first\n\n**second**\n\n\n")).toEqual([
      [plain("first")],
      [bold("second")],
    ]);
  });

  it("keeps a single line break inside a paragraph", () => {
    expect(parseParagraphs("one\ntwo")).toEqual([[plain("one\ntwo")]]);
  });
});
