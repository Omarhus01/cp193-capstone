// Writes content/quran-metadata.json from Tanzil's quran-data.xml: every surah's Arabic name,
// revelation place and verse count, and the first verse of each page of the Madani mushaf.
// Validation checks verse references against it, including references to surahs whose text isn't
// imported (content/README.md, "Verse references"). The seed gives each verse its page, and the
// surah page groups verses that have no explanation yet by page.
//
//   npm run content:import-tanzil-metadata -- <quran-data.xml>
import { readFileSync } from "node:fs";
import path from "node:path";
import { CONTENT_DIR } from "@/lib/services/content/load";
import { writeJsonFile } from "./json-file";
import { metadataAttribution, readPageStarts, readSurahMetadata } from "./tanzil";

const [metadataXmlPath] = process.argv.slice(2);
if (!metadataXmlPath) {
  console.error("Usage: npm run content:import-tanzil-metadata -- <quran-data.xml>");
  process.exit(1);
}

const metadataXml = readFileSync(metadataXmlPath, "utf8");
const surahs = readSurahMetadata(metadataXml);
const pages = readPageStarts(metadataXml);
await writeJsonFile(path.join(CONTENT_DIR, "quran-metadata.json"), {
  $schema: "./schema/quran-metadata.schema.json",
  attribution: metadataAttribution(metadataXml),
  surahs,
  pages,
});
console.log(
  `${surahs.length} surahs and ${pages.length} page starts written to content/quran-metadata.json`,
);
