import { z } from "zod";
import { REVIEW_STEPS } from "@/lib/services/review";
import { REF_PATTERN } from "./spans";

// The shape of each file in content/ (content/README.md). `npm run content:schema` writes these
// as JSON Schema to content/schema/, which editors use through each file's "$schema".
// Checks that need more than one file (do refs exist, do sections cover the surah) are in
// validate.ts.

const $schema = z.string().optional();
const text = z.string().min(1);
const id = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase letters, digits and single hyphens")
  .meta({
    description: 'A stable id, such as "001-reading-1". Never reuse one for something else.',
  });

const verseRef = z.string().regex(/^[1-9]\d{0,2}:[1-9]\d{0,2}$/, 'a verse, such as "2:60"');
const wordRef = z
  .string()
  .regex(/^[1-9]\d{0,2}:[1-9]\d{0,2}:[1-9]\d{0,2}$/, 'a word, such as "2:60:3"');
const ref = z.string().regex(new RegExp(REF_PATTERN), 'a verse ("2:60") or a word ("2:60:3")');

const span = z.strictObject({ from: ref, to: ref }).meta({
  description:
    'From and to, inclusive. "1:2" is the whole verse; "1:2:3" is its third word. ' +
    'A phrase: { "from": "1:2:1", "to": "1:2:3" }. Several verses: { "from": "1:2", "to": "1:4" }.',
});

const localized = z
  .strictObject({ en: text.nullable(), ko: text.nullable() })
  .meta({ description: "English and Korean. null until written." });

const reviewEntry = z
  .strictObject({
    status: z.enum(REVIEW_STEPS),
    reviewer: text,
    date: z.iso.date(),
    notes: text.optional(),
  })
  .meta({ description: "One review step. Sending an item back to an earlier step needs notes." });

const reviewed = {
  status: z
    .enum(REVIEW_STEPS)
    .meta({ description: "Must be where the review history ends (draft when it's empty)." }),
  review: z.array(reviewEntry),
};

const citations = z
  .array(id)
  .meta({ description: "Ids of passages in content/sources/, in the order they are shown." });

const attribution = text.meta({
  description: "Tanzil's copyright notice, verbatim. Its terms require it in every derived file.",
});

const revelationPlace = z.enum(["meccan", "medinan"]);

/**
 * quran-metadata.json: every surah's name, revelation place and verse count, from Tanzil's
 * metadata. Verse references are checked against it. Generated; never edited by hand.
 */
export const quranMetadataFileSchema = z.strictObject({
  $schema,
  attribution: text.meta({
    description: "Tanzil's copyright and license for the metadata, kept as its license asks.",
  }),
  surahs: z
    .array(
      z.strictObject({
        number: z.int().min(1).max(114),
        nameAr: text,
        revelationPlace,
        verseCount: z.int().min(1),
      }),
    )
    .length(114),
});

/** text.json: the surah's Quran text, imported from Tanzil. Never edited by hand. */
export const textFileSchema = z.strictObject({
  $schema,
  attribution,
  surah: z.strictObject({
    number: z.int().min(1).max(114),
    nameAr: text,
    revelationPlace,
    verseCount: z.int().min(1),
    basmala: text
      .nullable()
      .meta({ description: "Shown before verse 1. null for Al-Fatiha (where it is 1:1) and 9." }),
  }),
  verses: z.array(z.strictObject({ ayah: z.int().min(1), text })),
});

/** words.json: the words of each verse, generated from text.json. Roots are added by the owner. */
export const wordsFileSchema = z.strictObject({
  $schema,
  attribution,
  verses: z.array(
    z.strictObject({
      ayah: z.int().min(1),
      words: z.array(z.strictObject({ position: z.int().min(1), text, root: text.nullable() })),
    }),
  ),
});

/** surah.json: the surah's names and brief, written by the owner. */
export const surahFileSchema = z.strictObject({
  $schema,
  names: localized,
  brief: z.strictObject({ en: text.nullable(), ko: text.nullable(), ...reviewed }).optional(),
});

const explanationKind = z.enum(["phrase_note", "verse_explanation", "reading_section"]).meta({
  description:
    "phrase_note: part of one verse (word refs). verse_explanation: one or more whole verses. " +
    "reading_section: a section of the surah, listed in reading.json.",
});

/** explanations.json: the surah's explanations, written by the owner. */
export const explanationsFileSchema = z.strictObject({
  $schema,
  explanations: z.array(
    z.strictObject({
      id,
      kind: explanationKind,
      span,
      parts: z.strictObject({
        wordMeanings: localized,
        background: localized,
        context: localized,
        connectedVerses: localized,
      }),
      citations,
      contextLinks: z.array(z.strictObject({ span, reason: localized })).meta({
        description: "Other parts of the text a reader needs for this explanation, and why.",
      }),
      ...reviewed,
    }),
  ),
});

/** reading.json: the surah's reading sections, in reading order. */
export const readingFileSchema = z.strictObject({
  $schema,
  sections: z.array(id).meta({
    description:
      "Ids of reading_section explanations. Together they cover the surah from its first verse " +
      "to its last, with no gaps or overlaps.",
  }),
});

/** word-meanings.json: what words mean in their verse, written by the owner. */
export const wordMeaningsFileSchema = z.strictObject({
  $schema,
  wordMeanings: z.array(
    z.strictObject({ word: wordRef, meaning: localized, citations, ...reviewed }),
  ),
});

/** transliterations.json: how each verse is pronounced, written and reviewed per language. */
export const transliterationsFileSchema = z.strictObject({
  $schema,
  transliterations: z.array(
    z.strictObject({
      verse: verseRef,
      language: z.enum(["en", "ko"]).meta({
        description:
          "en: Latin letters, shown on English pages, steps draft → en_approved → published. " +
          "ko: Hangul, shown on Korean pages, steps draft → ko_approved → published.",
      }),
      text: text.nullable().meta({ description: "The whole verse. null until written." }),
      ...reviewed,
    }),
  ),
});

/** sources/<id>.json: a source and the passages cited from it. */
export const sourceFileSchema = z.strictObject({
  $schema,
  source: z.strictObject({
    id,
    titleAr: text.nullable(),
    titleEn: text.nullable(),
    author: text,
    edition: text.nullable(),
    type: z.enum(["tafsir", "asbab_al_nuzul", "word_dictionary", "hadith"]),
  }),
  passages: z.array(
    z.strictObject({
      id,
      volume: text.nullable(),
      page: text.nullable(),
      verse: verseRef
        .nullable()
        .meta({ description: "For sources arranged by verse, when there is no page to cite." }),
      textAr: text.nullable(),
      summary: localized,
    }),
  ),
});

export type QuranMetadataFile = z.infer<typeof quranMetadataFileSchema>;
export type SurahMetadata = QuranMetadataFile["surahs"][number];
export type TextFile = z.infer<typeof textFileSchema>;
export type WordsFile = z.infer<typeof wordsFileSchema>;
export type SurahFile = z.infer<typeof surahFileSchema>;
export type ExplanationsFile = z.infer<typeof explanationsFileSchema>;
export type ExplanationEntry = ExplanationsFile["explanations"][number];
export type ReadingFile = z.infer<typeof readingFileSchema>;
export type WordMeaningsFile = z.infer<typeof wordMeaningsFileSchema>;
export type WordMeaningEntry = WordMeaningsFile["wordMeanings"][number];
export type TransliterationsFile = z.infer<typeof transliterationsFileSchema>;
export type TransliterationEntry = TransliterationsFile["transliterations"][number];
export type SourceFile = z.infer<typeof sourceFileSchema>;

/** Each schema and the name of its file in content/schema/. */
export const CONTENT_SCHEMAS = {
  "quran-metadata.schema.json": quranMetadataFileSchema,
  "text.schema.json": textFileSchema,
  "words.schema.json": wordsFileSchema,
  "surah.schema.json": surahFileSchema,
  "explanations.schema.json": explanationsFileSchema,
  "reading.schema.json": readingFileSchema,
  "word-meanings.schema.json": wordMeaningsFileSchema,
  "transliterations.schema.json": transliterationsFileSchema,
  "source.schema.json": sourceFileSchema,
} as const;

/** The JSON Schema written to content/schema/<name>. */
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, { target: "draft-2020-12", io: "input" });
}
