// Collects what the books of the Athars export say about one verse into one markdown file
// (content/README.md, "Finding passages for a new verse").
//
//   npm run content:find-passages -- <export folder> <surah:verse> [<quran-uthmani.xml>]
//
// Writes <export folder>/found/<surah>-<verse>.md. It copies source text only: it writes no
// explanations or translations, and never touches content/. The export and the result stay outside
// the repository. With Tanzil's text, it also finds headings that quote the verse without its number.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CONTENT_DIR } from "@/lib/services/content/load";
import { quranMetadataFileSchema } from "@/lib/services/content/schema";
import { parseVerseSelection } from "@/lib/services/content/verse-selection";
import { passagesMarkdown } from "@/lib/services/passages/markdown";
import { collectPassages } from "./collect-passages";
import { assertOutside } from "./export";

const [exportDir, verseArg, tanzilPath] = process.argv.slice(2);
if (!exportDir || !verseArg) {
  console.error(
    "Usage: npm run content:find-passages -- <export folder> <surah:verse> [<quran-uthmani.xml>]",
  );
  process.exit(1);
}
const [{ surah, ayahs }] = parseVerseSelection([verseArg]);
if (ayahs === "all" || ayahs.length !== 1) {
  throw new Error(`"${verseArg}": give one verse, for example 4:34.`);
}
const verse = { surah, ayah: ayahs[0] };
const file = path.join(path.resolve(exportDir), "found", `${verse.surah}-${verse.ayah}.md`);
assertOutside(path.join(CONTENT_DIR, ".."), file);

const metadata = quranMetadataFileSchema.parse(
  JSON.parse(readFileSync(path.join(CONTENT_DIR, "quran-metadata.json"), "utf8")),
);
const tanzilXml = tanzilPath ? readFileSync(tanzilPath, "utf8") : null;
const results = await collectPassages(exportDir, verse, metadata.surahs, tanzilXml);

mkdirSync(path.dirname(file), { recursive: true });
writeFileSync(file, passagesMarkdown(verse, results));
const found = results.filter((result) => result.kind === "found").length;
console.log(`${verseArg}: found in ${found} of ${results.length} books. Written to ${file}`);
