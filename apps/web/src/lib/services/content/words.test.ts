import { describe, expect, it } from "vitest";
import { isAnnotationOnly, splitWords, wordsMatchVerse } from "./words";

// Al-Baqarah 2:2, copied verbatim from Tanzil Quran Text (Uthmani, Version 1.1), tanzil.net.
// It has the pause mark ۛ twice, each written as its own space-separated token.
const AL_BAQARAH_2_2 = "ذَٰلِكَ ٱلْكِتَـٰبُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًى لِّلْمُتَّقِينَ";

describe("splitWords", () => {
  const words = splitWords(AL_BAQARAH_2_2);
  const tokens = AL_BAQARAH_2_2.split(" ");

  it("leaves the pause marks out of the words", () => {
    expect(tokens.filter(isAnnotationOnly)).toEqual(["ۛ", "ۛ"]);
    expect(words).toHaveLength(tokens.length - 2);
    expect(words.some((word) => word.includes("ۛ"))).toBe(false);
  });

  it("keeps the other words, in order", () => {
    expect(words).toEqual(tokens.filter((token) => token !== "ۛ"));
  });
});

describe("wordsMatchVerse", () => {
  it("accepts the words of a verse with pause marks", () => {
    expect(wordsMatchVerse(AL_BAQARAH_2_2, splitWords(AL_BAQARAH_2_2))).toBe(true);
  });

  it("rejects a word list that counts a pause mark as a word", () => {
    expect(wordsMatchVerse(AL_BAQARAH_2_2, AL_BAQARAH_2_2.split(" "))).toBe(false);
  });

  it("rejects a missing or reordered word", () => {
    const words = splitWords(AL_BAQARAH_2_2);
    expect(wordsMatchVerse(AL_BAQARAH_2_2, words.slice(1))).toBe(false);
    expect(wordsMatchVerse(AL_BAQARAH_2_2, [words[1], words[0], ...words.slice(2)])).toBe(false);
  });
});

describe("isAnnotationOnly", () => {
  it("treats tokens of pause marks and similar signs as non-words", () => {
    for (const sign of ["ۖ", "ۗ", "ۘ", "ۙ", "ۚ", "ۛ", "ۜ", "۞", "۩"]) {
      expect(isAnnotationOnly(sign)).toBe(true);
    }
  });

  it("keeps a word that carries a sign on one of its letters", () => {
    const [word] = splitWords(AL_BAQARAH_2_2);
    expect(isAnnotationOnly(`${word}ۜ`)).toBe(false);
  });
});
