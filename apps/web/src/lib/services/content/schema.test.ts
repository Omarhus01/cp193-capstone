import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CONTENT_DIR } from "./load";
import { CONTENT_SCHEMAS, explanationsFileSchema, toJsonSchema } from "./schema";

describe("content/schema/", () => {
  it.each(Object.entries(CONTENT_SCHEMAS))(
    "%s is up to date (npm run content:schema)",
    (name, schema) => {
      const written = JSON.parse(readFileSync(path.join(CONTENT_DIR, "schema", name), "utf8"));
      expect(written).toEqual(toJsonSchema(schema));
    },
  );
});

describe("explanationsFileSchema", () => {
  const valid = {
    explanations: [
      {
        id: "001-reading-1",
        kind: "reading_section",
        span: { from: "1:1", to: "1:7" },
        parts: { wordMeanings: [], background: [], context: [], connectedVerses: [] },
        contextLinks: [],
        status: "draft",
        review: [],
      },
    ],
  };

  it("accepts a draft placeholder", () => {
    expect(explanationsFileSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ["a misspelled field", { kind: "reading_section", spam: true }],
    ["an unknown kind", { kind: "summary" }],
    ["a ref with a leading zero", { span: { from: "01:1", to: "1:7" } }],
    ["an unknown status", { status: "approved" }],
    ["an id with capitals", { id: "Reading-1" }],
    [
      "an empty string instead of null",
      {
        parts: {
          ...valid.explanations[0].parts,
          context: [{ en: "", ko: null, citations: [] }],
        },
      },
    ],
    [
      "a related verse that names a word",
      {
        parts: {
          ...valid.explanations[0].parts,
          connectedVerses: [{ verse: "2:1:3", en: "x", ko: null, citations: [] }],
        },
      },
    ],
    [
      "a quoting citation without a passage",
      {
        parts: {
          ...valid.explanations[0].parts,
          context: [{ en: "x", ko: null, citations: [{ quoting: "Muslim" }] }],
        },
      },
    ],
  ])("rejects %s", (_, change) => {
    const broken = { explanations: [{ ...valid.explanations[0], ...change }] };
    expect(explanationsFileSchema.safeParse(broken).success).toBe(false);
  });
});
