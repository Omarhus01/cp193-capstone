// Writes content/quran-metadata.json from Tanzil's quran-data.xml: every surah's Arabic name,
// revelation place and verse count. Validation checks verse references against it, including
// references to surahs whose text isn't imported (content/README.md, "Verse references").
//
//   npm run content:import-tanzil-metadata -- <quran-data.xml>
import { readFileSync } from "node:fs";
import path from "node:path";
import { CONTENT_DIR } from "@/lib/services/content/load";
import { writeJsonFile } from "./json-file";
import { metadataAttribution, readSurahMetadata } from "./tanzil";

const [metadataXmlPath] = process.argv.slice(2);
if (!metadataXmlPath) {
  console.error("Usage: npm run content:import-tanzil-metadata -- <quran-data.xml>");
  process.exit(1);
}

const metadataXml = readFileSync(metadataXmlPath, "utf8");
const surahs = readSurahMetadata(metadataXml);
await writeJsonFile(path.join(CONTENT_DIR, "quran-metadata.json"), {
  $schema: "./schema/quran-metadata.schema.json",
  attribution: metadataAttribution(metadataXml),
  surahs,
});
console.log(`${surahs.length} surahs written to content/quran-metadata.json`);
