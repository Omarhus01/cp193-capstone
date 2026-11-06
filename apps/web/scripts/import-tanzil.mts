// Imports surahs, or some of their verses, from Tanzil's Uthmani text into content/surahs/NNN/
// (content/README.md, "Quran text").
//
//   npm run content:import-tanzil -- <quran-uthmani.xml> <quran-data.xml> <surah or verses> […]
//
// "4" imports all of surah 4; "4:34" only verse 34; "4:34-36" verses 34 to 36 (ADR 0022). The
// arguments decide exactly which verses the folder holds, so verses it held before that aren't
// listed are dropped (and printed).
// text.json gets the verses exactly as Tanzil has them; Tanzil's license forbids changing the text.
// words.json gets each verse's words (pause marks are not words) and keeps roots already filled in
// for words whose text didn't change. surah.json is created with empty names if it doesn't exist.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { CONTENT_DIR } from "@/lib/services/content/load";
import { textFileSchema, wordsFileSchema } from "@/lib/services/content/schema";
import { parseVerseSelection } from "@/lib/services/content/verse-selection";
import { splitWords } from "@/lib/services/content/words";
import { writeJsonFile } from "./json-file";
import { attributes } from "./tanzil";

const [textXmlPath, metadataXmlPath, ...surahArgs] = process.argv.slice(2);
if (!textXmlPath || !metadataXmlPath || surahArgs.length === 0) {
  console.error(
    "Usage: npm run content:import-tanzil -- <quran-uthmani.xml> <quran-data.xml> <surah or verses> […]\n" +
      'For example "1" (all of Al-Fatiha), "4:34" (one verse) or "4:34-36" (verses 34 to 36).',
  );
  process.exit(1);
}
const selections = parseVerseSelection(surahArgs);

const textXml = readFileSync(textXmlPath, "utf8").replace(/\r\n/g, "\n");
const metadataXml = readFileSync(metadataXmlPath, "utf8");

// Tanzil's notice, which its terms require in every file derived from the text.
const notice = /# PLEASE DO NOT REMOVE[\s\S]*?#={20,}[\s\S]*?#={20,}/.exec(textXml)?.[0];
if (!notice?.includes("Tanzil Quran Text (Uthmani")) {
  throw new Error(`${textXmlPath} doesn't carry Tanzil's Uthmani copyright notice.`);
}
if (textXml.includes("&")) {
  throw new Error(`${textXmlPath} has XML entities; this importer expects plain attribute text.`);
}

for (const { surah: number, ayahs: selected } of selections) {
  const suraBlock = new RegExp(`<sura index="${number}" [^>]*>([\\s\\S]*?)</sura>`).exec(textXml);
  const metaTag = new RegExp(`<sura index="${number}" [^>]*/>`).exec(metadataXml);
  if (!suraBlock || !metaTag) {
    throw new Error(`Surah ${number} isn't in the Tanzil files.`);
  }
  const meta = attributes(metaTag[0]);
  const ayas = [...suraBlock[1].matchAll(/<aya [^>]*\/>/g)].map((m) => attributes(m[0]));
  if (ayas.length !== Number(meta.ayas)) {
    throw new Error(
      `Surah ${number}: ${ayas.length} verses in the text, ${meta.ayas} in the metadata.`,
    );
  }
  ayas.forEach((aya, i) => {
    if (Number(aya.index) !== i + 1) {
      throw new Error(`Surah ${number}: verse ${i + 1} is numbered ${aya.index}.`);
    }
  });

  // The whole sura was checked against the metadata above; now keep only the selected verses.
  for (const ayah of selected === "all" ? [] : selected) {
    if (ayah > ayas.length) {
      throw new Error(`Surah ${number} has ${ayas.length} verses, so there is no verse ${ayah}.`);
    }
  }
  const imported =
    selected === "all" ? ayas : ayas.filter((aya) => selected.includes(Number(aya.index)));

  const dir = path.join(CONTENT_DIR, "surahs", String(number).padStart(3, "0"));
  const textPath = path.join(dir, "text.json");
  if (existsSync(textPath)) {
    const before = textFileSchema.parse(JSON.parse(readFileSync(textPath, "utf8")));
    const dropped = before.verses
      .map((verse) => verse.ayah)
      .filter((ayah) => !imported.some((aya) => Number(aya.index) === ayah));
    if (dropped.length > 0) {
      console.warn(
        `Surah ${number}: verses ${dropped.join(", ")} were in the folder and aren't listed, so ` +
          "they are left out now. List them too to keep them.",
      );
    }
  }
  await writeJsonFile(textPath, {
    $schema: "../../schema/text.schema.json",
    attribution: notice,
    surah: {
      number,
      nameAr: meta.name,
      revelationPlace: meta.type.toLowerCase(),
      verseCount: ayas.length,
      basmala: ayas[0].bismillah ?? null,
    },
    verses: imported.map((aya) => ({ ayah: Number(aya.index), text: aya.text })),
  });

  // Keep the roots the owner has filled in, for words whose text is unchanged.
  const wordsPath = path.join(dir, "words.json");
  const roots = new Map<string, string | null>();
  if (existsSync(wordsPath)) {
    const existing = wordsFileSchema.parse(JSON.parse(readFileSync(wordsPath, "utf8")));
    for (const verse of existing.verses) {
      for (const word of verse.words) {
        roots.set(`${verse.ayah}:${word.position}:${word.text}`, word.root);
      }
    }
  }
  await writeJsonFile(wordsPath, {
    $schema: "../../schema/words.schema.json",
    attribution: notice,
    verses: imported.map((aya) => ({
      ayah: Number(aya.index),
      words: splitWords(aya.text).map((text, i) => ({
        position: i + 1,
        text,
        root: roots.get(`${aya.index}:${i + 1}:${text}`) ?? null,
      })),
    })),
  });

  const surahPath = path.join(dir, "surah.json");
  if (!existsSync(surahPath)) {
    await writeJsonFile(surahPath, {
      $schema: "../../schema/surah.schema.json",
      names: { en: null, ko: null },
    });
  }
  const which =
    imported.length === ayas.length
      ? `all ${ayas.length} verses`
      : `${imported.length} of ${ayas.length} verses (${imported.map((aya) => aya.index).join(", ")})`;
  console.log(`Surah ${number}: ${which} written to ${path.relative(process.cwd(), dir)}`);
}
