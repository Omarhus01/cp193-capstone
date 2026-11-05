import { describe, expect, it } from "vitest";
import { loadContent, type ContentBundle, type ContentError } from "./load";
import { explanation, question, testBundle, transliteration } from "./test-bundle";
import { validateContent } from "./validate";

describe("content/", () => {
  it("passes the schema and every check", () => {
    const { bundle, errors } = loadContent();
    expect([...errors, ...validateContent(bundle)]).toEqual([]);
    expect(bundle.surahs.map((s) => s.number)).toContain(1);
  });

  it("has Tanzil's metadata for all 114 surahs", () => {
    const { metadata } = loadContent().bundle;
    expect(metadata).toHaveLength(114);
    expect(metadata[1]).toMatchObject({ number: 2, verseCount: 286 });
    expect(metadata.reduce((total, surah) => total + surah.verseCount, 0)).toBe(6236);
  });

  it("keeps Al-Fatiha's Basmala as verse 1:1, as in Tanzil", () => {
    const fatiha = loadContent().bundle.surahs.find((s) => s.number === 1);
    expect(fatiha?.text.surah).toMatchObject({ verseCount: 7, basmala: null });
    expect(fatiha?.text.verses[0].ayah).toBe(1);
  });
});

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
        b.surahs[0].explanations[0].parts.context[0].ko = null;
      });
      expect(messages(errors)).toContainEqual(expect.stringContaining("needs its Korean"));
    });

    it("needs a citation on a published item", () => {
      const errors = errorsAfter((b) => {
        b.surahs[0].wordMeanings[0].citations = [];
      });
      expect(messages(errors)).toContainEqual(expect.stringContaining("at least one citation"));
    });

    it("needs a citation on every point of a published explanation or brief", () => {
      expect(
        messages(
          errorsAfter((b) => {
            b.surahs[0].explanations[0].parts.background[0].citations = [];
          }),
        ),
      ).toContainEqual(
        expect.stringContaining(
          "explanations[0].parts.background[0]: is published, so it needs at least one citation",
        ),
      );
      expect(
        messages(
          errorsAfter((b) => {
            b.surahs[0].surah.brief!.items[1].citations = [];
          }),
        ),
      ).toContainEqual(expect.stringContaining("brief.items[1]: is published"));
    });

    it("needs Korean for an elsewhere note once the Korean is drafted", () => {
      const errors = errorsAfter((b) => {
        b.surahs[0].wordMeanings[0].elsewhere[0].ko = null;
      });
      expect(messages(errors)).toContainEqual(
        expect.stringContaining(
          "wordMeanings[0]: is published, so every English part needs its Korean",
        ),
      );
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
        b.surahs[0].explanations[0].parts.context[0].citations = ["passage-9"];
      });
      expect(messages(errors)).toContainEqual(expect.stringContaining('no passage "passage-9"'));
    });

    it("rejects a quoting citation of a passage that doesn't exist", () => {
      const errors = errorsAfter((b) => {
        b.surahs[0].explanations[0].parts.context[0].citations = [
          { passage: "passage-9", quoting: "[narrator]" },
        ];
      });
      expect(messages(errors)).toContainEqual(expect.stringContaining('no passage "passage-9"'));
    });

    it("checks related verses and elsewhere notes against Tanzil's verse counts", () => {
      expect(
        messages(
          errorsAfter((b) => {
            b.surahs[0].explanations[0].parts.connectedVerses[0].verse = "3:11";
          }),
        ),
      ).toContainEqual(
        expect.stringContaining("parts.connectedVerses[0].verse: 3:11: surah 3 has 10 verses"),
      );
      expect(
        messages(
          errorsAfter((b) => {
            b.surahs[0].wordMeanings[0].elsewhere[0].verse = "115:1";
          }),
        ),
      ).toContainEqual(expect.stringContaining("elsewhere[0].verse: surah 115 doesn't exist"));
    });

    it("accepts a related verse in a surah that isn't imported", () => {
      expect(testBundle().surahs.map((s) => s.number)).not.toContain(3);
      expect(validateContent(testBundle())).toEqual([]);
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

  describe("transliterations", () => {
    it("rejects one for a verse that doesn't exist", () => {
      const errors = errorsAfter((b) => {
        b.surahs[0].transliterations[0].verse = "1:9";
      });
      expect(messages(errors)).toContainEqual(expect.stringContaining("verse 1:9 isn't in"));
    });

    it("rejects a second one for the same verse and language", () => {
      const errors = errorsAfter((b) => {
        b.surahs[0].transliterations.push(transliteration("1:1", "ko"));
      });
      expect(messages(errors)).toContainEqual(expect.stringContaining('already has a "ko" one'));
    });

    it("rejects a step from the other language's track", () => {
      const errors = errorsAfter((b) => {
        b.surahs[0].transliterations[0] = {
          ...transliteration("1:1", "en", "draft"),
          status: "ko_approved",
          review: [{ status: "ko_approved", reviewer: "Reviewer", date: "2026-10-01" }],
        };
      });
      expect(messages(errors)).toContainEqual(
        expect.stringContaining('"en" transliterations go draft → en_approved → published'),
      );
    });

    it("rejects publishing without the approval", () => {
      const errors = errorsAfter((b) => {
        b.surahs[0].transliterations[1].review = [
          { status: "published", reviewer: "Owner", date: "2026-10-02" },
        ];
      });
      expect(messages(errors)).toContainEqual(expect.stringContaining("review[0]: can't skip"));
    });

    it("rejects an approved one without text", () => {
      const errors = errorsAfter((b) => {
        b.surahs[0].transliterations[0].text = null;
      });
      expect(messages(errors)).toContainEqual(
        expect.stringContaining("is published but has no text"),
      );
    });

    it("rejects 하나님", () => {
      const errors = errorsAfter((b) => {
        b.surahs[0].transliterations[1].text = "하나님";
      });
      expect(messages(errors)).toContainEqual(
        expect.stringContaining("transliterations[1].text.ko"),
      );
    });
  });

  describe("fixed questions", () => {
    it("rejects an answer without a citation, even in a draft", () => {
      const errors = errorsAfter((b) => {
        b.surahs[0].qa[2].citations = [];
      });
      expect(messages(errors)).toContainEqual(
        "surahs/001/qa.json questions[2].citations: every answer needs at least one citation",
      );
    });

    it("rejects a citation of a passage that doesn't exist", () => {
      const errors = errorsAfter((b) => {
        b.surahs[0].qa[0].citations = ["passage-9"];
      });
      expect(messages(errors)).toContainEqual(
        'surahs/001/qa.json questions[0].citations[0]: no passage "passage-9" in content/sources/',
      );
    });

    it("attaches a question to whole verses of its own surah", () => {
      expect(
        messages(
          errorsAfter((b) => {
            b.surahs[0].qa[0].span = { from: "1:1:1", to: "1:1:2" };
          }),
        ),
      ).toContainEqual(expect.stringContaining("a question covers whole verses"));
      expect(
        messages(
          errorsAfter((b) => {
            b.surahs[0].qa[0].span = { from: "1:9", to: "1:9" };
          }),
        ),
      ).toContainEqual(expect.stringContaining("verse 1:9 isn't in"));
      expect(
        messages(
          errorsAfter((b) => {
            b.surahs[1].qa = [question("s2-qa", "1:1", "1:1")];
          }),
        ),
      ).toContainEqual(expect.stringContaining("belongs in that surah's folder"));
    });

    it("rejects a duplicate question id, across surahs too", () => {
      const errors = errorsAfter((b) => {
        b.surahs[1].qa = [question("s1-qa-1", "2:1", "2:1")];
      });
      expect(messages(errors)).toContainEqual(expect.stringContaining("used by another question"));
    });

    it("follows the explanations' review steps", () => {
      expect(
        messages(
          errorsAfter((b) => {
            b.surahs[0].qa[0].review.splice(2, 1);
          }),
        ),
      ).toContainEqual(expect.stringContaining("questions[0].review[2]: can't skip"));
      expect(
        messages(
          errorsAfter((b) => {
            b.surahs[0].qa[0].answer.ko = null;
          }),
        ),
      ).toContainEqual(expect.stringContaining("every English part needs its Korean"));
      expect(
        messages(
          errorsAfter((b) => {
            b.surahs[0].qa[0].answer.en = null;
          }),
        ),
      ).toContainEqual(expect.stringContaining("needs its English question and answer"));
    });

    it("rejects 하나님 in a question or answer", () => {
      const errors = errorsAfter((b) => {
        b.surahs[0].qa[1].question.ko = "하나님";
      });
      expect(messages(errors)).toContainEqual(
        expect.stringContaining('questions[1].question.ko: uses "하나님"'),
      );
    });
  });

  describe("text", () => {
    it("rejects words that don't match the verse text", () => {
      const errors = errorsAfter((b) => {
        b.surahs[0].words.verses[0].words.pop();
      });
      expect(messages(errors)).toContainEqual(expect.stringContaining("aren't the verse text"));
    });

    it("rejects a surah text that doesn't match Tanzil's metadata", () => {
      const errors = errorsAfter((b) => {
        b.metadata[1].verseCount = 5;
      });
      expect(messages(errors)).toContainEqual(
        expect.stringContaining("surahs/002/text.json surah: doesn't match quran-metadata.json"),
      );
    });

    it("rejects a verse count that doesn't match the verses", () => {
      const errors = errorsAfter((b) => {
        b.surahs[0].text.surah.verseCount = 5;
      });
      expect(messages(errors)).toContainEqual(expect.stringContaining("verseCount is 5"));
    });

    it("rejects 하나님 in any text", () => {
      const errors = errorsAfter((b) => {
        b.surahs[0].explanations[0].parts.background[0].ko = "하나님";
      });
      expect(messages(errors)).toContainEqual(expect.stringContaining('uses "하나님"'));
    });
  });
});
