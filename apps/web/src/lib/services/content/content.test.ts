import { describe, expect, it } from "vitest";
import type { ContentBundle, ContentError } from "./load";
import { explanation, testBundle } from "./test-bundle";
import { validateContent } from "./validate";

/** Validates a copy of the test bundle after `change`, and returns the messages. */
function errorsAfter(change: (bundle: ContentBundle) => void): ContentError[] {
  const bundle = testBundle();
  change(bundle);
  return validateContent(bundle);
}

function messages(errors: ContentError[]): string[] {
  return errors.map((e) => `${e.file} ${e.path}: ${e.message}`);
}

describe("validateContent", () => {
  it("accepts the test bundle", () => {
    expect(validateContent(testBundle())).toEqual([]);
  });

  describe("spans", () => {
    it("rejects a span that points to a verse that doesn't exist", () => {
      const errors = errorsAfter((b) => {
        b.surahs[0].explanations[2].span = { from: "1:9:1", to: "1:9:2" };
      });
      expect(messages(errors)).toContainEqual(expect.stringContaining("verse 1:9 isn't in"));
    });

    it("rejects a span that points to a word that doesn't exist", () => {
      const errors = errorsAfter((b) => {
        b.surahs[0].explanations[2].span = { from: "1:2:2", to: "1:2:7" };
      });
      expect(messages(errors)).toContainEqual(expect.stringContaining("has 4 words"));
    });

    it("rejects a context link into a surah that isn't in content/", () => {
      const errors = errorsAfter((b) => {
        b.surahs[0].explanations[2].contextLinks[0].span = { from: "3:1", to: "3:2" };
      });
      expect(messages(errors)).toContainEqual(expect.stringContaining("contextLinks[0].span"));
    });

    it("rejects a span that ends before it starts", () => {
      const errors = errorsAfter((b) => {
        b.surahs[0].explanations[2].span = { from: "1:2:3", to: "1:2:2" };
      });
      expect(messages(errors)).toContainEqual(expect.stringContaining("before it starts"));
    });

    it("keeps phrase notes inside one verse and other kinds to whole verses", () => {
      expect(
        messages(
          errorsAfter((b) => {
            b.surahs[0].explanations[2].span = { from: "1:2:2", to: "1:3:1" };
          }),
        ),
      ).toContainEqual(expect.stringContaining("inside one verse"));
      expect(
        messages(
          errorsAfter((b) => {
            b.surahs[0].explanations[3].span = { from: "1:3:1", to: "1:3:4" };
          }),
        ),
      ).toContainEqual(expect.stringContaining("covers whole verses"));
    });
  });

  describe("reading sections", () => {
    it("rejects a gap between sections", () => {
      const errors = errorsAfter((b) => {
        b.surahs[0].explanations[1].span = { from: "1:4", to: "1:4" };
      });
      expect(messages(errors)).toContainEqual(expect.stringContaining("leaves a gap"));
    });

    it("rejects overlapping sections", () => {
      const errors = errorsAfter((b) => {
        b.surahs[0].explanations[1].span = { from: "1:2", to: "1:4" };
      });
      expect(messages(errors)).toContainEqual(expect.stringContaining("inside the section before"));
    });

    it("rejects sections that stop before the last verse", () => {
      const errors = errorsAfter((b) => {
        b.surahs[0].explanations[1].span = { from: "1:3", to: "1:3" };
      });
      expect(messages(errors)).toContainEqual(expect.stringContaining("the surah has 4 verses"));
    });

    it("rejects sections that don't start at verse 1", () => {
      const errors = errorsAfter((b) => {
        b.surahs[0].explanations[0].span = { from: "1:2", to: "1:2" };
      });
      expect(messages(errors)).toContainEqual(expect.stringContaining("verses 1:1 to 1:1"));
    });

    it("rejects a section from another surah or of another kind", () => {
      expect(
        messages(
          errorsAfter((b) => {
            b.surahs[1].explanations = [explanation("s2-reading", "reading_section", "2:1", "2:3")];
            b.surahs[1].readingSections = ["s2-reading"];
            b.surahs[0].readingSections = ["s1-reading-1", "s2-reading"];
          }),
        ),
      ).toContainEqual(expect.stringContaining('no explanation "s2-reading" in surahs/001'));
      expect(
        messages(
          errorsAfter((b) => {
            b.surahs[0].readingSections = ["s1-reading-1", "s1-draft", "s1-reading-2"];
          }),
        ),
      ).toContainEqual(expect.stringContaining("not a reading_section"));
    });

    it("rejects a reading_section that isn't listed in reading.json", () => {
      const errors = errorsAfter((b) => {
        b.surahs[0].readingSections = ["s1-reading-1"];
      });
      expect(messages(errors)).toContainEqual(expect.stringContaining("isn't listed"));
    });
  });

  describe("review", () => {
    it("rejects a skipped step", () => {
      const errors = errorsAfter((b) => {
        b.surahs[0].explanations[0].review.splice(1, 1);
      });
      expect(messages(errors)).toContainEqual(expect.stringContaining("can't skip"));
    });

    it("rejects a status that the history doesn't reach", () => {
      const errors = errorsAfter((b) => {
        b.surahs[0].explanations[3].status = "published";
      });
      expect(messages(errors)).toContainEqual(
        expect.stringContaining("the review history ends at draft"),
      );
    });

    it("needs Korean for every English part once the Korean is drafted", () => {
      const errors = errorsAfter((b) => {
        b.surahs[0].explanations[0].parts.context.ko = null;
      });
      expect(messages(errors)).toContainEqual(expect.stringContaining("needs its Korean"));
    });

    it("needs a citation on a published item", () => {
      const errors = errorsAfter((b) => {
        b.surahs[0].wordMeanings[0].citations = [];
      });
      expect(messages(errors)).toContainEqual(expect.stringContaining("at least one citation"));
    });

    it("checks the surah brief's history too", () => {
      const errors = errorsAfter((b) => {
        b.surahs[0].surah.brief!.review = [];
      });
      expect(messages(errors)).toContainEqual(expect.stringContaining("surah.json brief.status"));
    });
  });

  describe("references and ids", () => {
    it("rejects a citation of a passage that doesn't exist", () => {
      const errors = errorsAfter((b) => {
        b.surahs[0].explanations[0].citations = ["passage-9"];
      });
      expect(messages(errors)).toContainEqual(expect.stringContaining('no passage "passage-9"'));
    });

    it("rejects a duplicate explanation id, across surahs too", () => {
      const errors = errorsAfter((b) => {
        b.surahs[1].explanations = [explanation("s1-note", "verse_explanation", "2:1", "2:1")];
      });
      expect(messages(errors)).toContainEqual(
        expect.stringContaining("used by another explanation"),
      );
    });

    it("rejects a word meaning for a word that doesn't exist", () => {
      const errors = errorsAfter((b) => {
        b.surahs[0].wordMeanings[0].word = "1:1:9";
      });
      expect(messages(errors)).toContainEqual(expect.stringContaining("has 4 words"));
    });

    it("rejects a passage with neither a page nor a verse", () => {
      const errors = errorsAfter((b) => {
        b.sources[0].passages[1].verse = null;
      });
      expect(messages(errors)).toContainEqual(expect.stringContaining("needs a page"));
    });
  });

  describe("text", () => {
    it("rejects words that don't match the verse text", () => {
      const errors = errorsAfter((b) => {
        b.surahs[0].words.verses[0].words.pop();
      });
      expect(messages(errors)).toContainEqual(expect.stringContaining("aren't the verse text"));
    });

    it("rejects a verse count that doesn't match the verses", () => {
      const errors = errorsAfter((b) => {
        b.surahs[0].text.surah.verseCount = 5;
      });
      expect(messages(errors)).toContainEqual(expect.stringContaining("verseCount is 5"));
    });

    it("rejects 하나님 in any text", () => {
      const errors = errorsAfter((b) => {
        b.surahs[0].explanations[0].parts.background.ko = "하나님";
      });
      expect(messages(errors)).toContainEqual(expect.stringContaining('uses "하나님"'));
    });
  });
});
