import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { z } from "zod";
import {
  explanationsFileSchema,
  readingFileSchema,
  sourceFileSchema,
  surahFileSchema,
  textFileSchema,
  transliterationsFileSchema,
  wordMeaningsFileSchema,
  wordsFileSchema,
  type ExplanationEntry,
  type SourceFile,
  type SurahFile,
  type TextFile,
  type TransliterationEntry,
  type WordMeaningEntry,
  type WordsFile,
} from "./schema";

/** The repository's content/ folder. */
export const CONTENT_DIR = fileURLToPath(new URL("../../../../../../content/", import.meta.url));

/** A problem in a content file. `file` is relative to content/, `path` points inside the JSON. */
export type ContentError = { file: string; path: string; message: string };

/** The files of one surah folder, content/surahs/NNN/. Optional files that don't exist are empty. */
export type SurahFiles = {
  number: number;
  /** "surahs/001" */
  dir: string;
  text: TextFile;
  words: WordsFile;
  surah: SurahFile;
  explanations: ExplanationEntry[];
  readingSections: string[];
  wordMeanings: WordMeaningEntry[];
  transliterations: TransliterationEntry[];
};

export type SourceFiles = SourceFile & { file: string };

export type ContentBundle = { surahs: SurahFiles[]; sources: SourceFiles[] };

const REQUIRED_FILES = ["text.json", "words.json", "surah.json"];
const OPTIONAL_FILES = [
  "explanations.json",
  "reading.json",
  "word-meanings.json",
  "transliterations.json",
];

/** "explanations[0].span.from" */
export function formatPath(segments: readonly PropertyKey[]): string {
  return segments
    .map((segment, i) =>
      typeof segment === "number" ? `[${segment}]` : `${i === 0 ? "" : "."}${String(segment)}`,
    )
    .join("");
}

function listDir(dir: string): string[] {
  return existsSync(dir) ? readdirSync(dir).sort() : [];
}

/**
 * Reads every file in content/ and checks each against its schema. Files that fail are left out of
 * the bundle, and so is a surah whose files don't all pass. The bundle still needs validateContent
 * for the checks across files.
 */
export function loadContent(dir: string = CONTENT_DIR): {
  bundle: ContentBundle;
  errors: ContentError[];
} {
  const errors: ContentError[] = [];

  function read<T>(file: string, schema: z.ZodType<T>): T | null {
    let json: unknown;
    try {
      json = JSON.parse(readFileSync(path.join(dir, file), "utf8"));
    } catch (error) {
      errors.push({
        file,
        path: "",
        message: `can't be read as JSON: ${(error as Error).message}`,
      });
      return null;
    }
    const result = schema.safeParse(json);
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({ file, path: formatPath(issue.path), message: issue.message });
      }
      return null;
    }
    return result.data;
  }

  function readOptional<T>(file: string, schema: z.ZodType<T>): T | null | undefined {
    return existsSync(path.join(dir, file)) ? read(file, schema) : undefined;
  }

  const surahs: SurahFiles[] = [];
  for (const name of listDir(path.join(dir, "surahs"))) {
    const surahDir = `surahs/${name}`;
    if (!/^\d{3}$/.test(name)) {
      errors.push({ file: surahDir, path: "", message: 'surah folders are named "001" to "114"' });
      continue;
    }
    for (const file of listDir(path.join(dir, surahDir))) {
      if (![...REQUIRED_FILES, ...OPTIONAL_FILES].includes(file)) {
        errors.push({
          file: `${surahDir}/${file}`,
          path: "",
          message: `unknown file; a surah folder holds ${[...REQUIRED_FILES, ...OPTIONAL_FILES].join(", ")}`,
        });
      }
    }
    for (const file of REQUIRED_FILES) {
      if (!existsSync(path.join(dir, surahDir, file))) {
        errors.push({ file: `${surahDir}/${file}`, path: "", message: "is missing" });
      }
    }

    const text = readOptional(`${surahDir}/text.json`, textFileSchema);
    const words = readOptional(`${surahDir}/words.json`, wordsFileSchema);
    const surah = readOptional(`${surahDir}/surah.json`, surahFileSchema);
    const explanations = readOptional(`${surahDir}/explanations.json`, explanationsFileSchema);
    const reading = readOptional(`${surahDir}/reading.json`, readingFileSchema);
    const wordMeanings = readOptional(`${surahDir}/word-meanings.json`, wordMeaningsFileSchema);
    const transliterations = readOptional(
      `${surahDir}/transliterations.json`,
      transliterationsFileSchema,
    );
    const optional = [explanations, reading, wordMeanings, transliterations];
    if (!text || !words || !surah || optional.includes(null)) {
      continue;
    }
    surahs.push({
      number: Number(name),
      dir: surahDir,
      text,
      words,
      surah,
      explanations: explanations?.explanations ?? [],
      readingSections: reading?.sections ?? [],
      wordMeanings: wordMeanings?.wordMeanings ?? [],
      transliterations: transliterations?.transliterations ?? [],
    });
  }

  const sources: SourceFiles[] = [];
  for (const name of listDir(path.join(dir, "sources"))) {
    const file = `sources/${name}`;
    if (!name.endsWith(".json")) {
      errors.push({ file, path: "", message: "sources/ holds only <source id>.json files" });
      continue;
    }
    const source = read(file, sourceFileSchema);
    if (source) {
      sources.push({ ...source, file });
    }
  }

  return { bundle: { surahs, sources }, errors };
}
