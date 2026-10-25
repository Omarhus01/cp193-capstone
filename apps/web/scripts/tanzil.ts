// Reading Tanzil's XML downloads (tanzil.net/download and tanzil.net/res/text/metadata). The
// files use plain attributes, so a regular expression reads them without an XML parser.

/** The attributes of one XML tag, such as `<sura index="1" ayas="7" … />`. */
export function attributes(tag: string): Record<string, string> {
  return Object.fromEntries([...tag.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
}

export type SurahMetadata = {
  number: number;
  nameAr: string;
  revelationPlace: "meccan" | "medinan";
  verseCount: number;
};

/** The surahs in Tanzil's quran-data.xml, checked to be 1 to 114 in order. */
export function readSurahMetadata(metadataXml: string): SurahMetadata[] {
  const surahs = [...metadataXml.matchAll(/<sura [^>]*\/>/g)].map((match) => {
    const sura = attributes(match[0]);
    return {
      number: Number(sura.index),
      nameAr: sura.name,
      revelationPlace: sura.type.toLowerCase() as SurahMetadata["revelationPlace"],
      verseCount: Number(sura.ayas),
    };
  });
  surahs.forEach((surah, i) => {
    if (surah.number !== i + 1 || !(surah.verseCount > 0) || !surah.nameAr) {
      throw new Error(`Tanzil metadata: surah ${i + 1} is missing or incomplete.`);
    }
    if (!["meccan", "medinan"].includes(surah.revelationPlace)) {
      throw new Error(`Tanzil metadata: surah ${i + 1} has type "${surah.revelationPlace}".`);
    }
  });
  if (surahs.length !== 114) {
    throw new Error(`Tanzil metadata lists ${surahs.length} surahs, not 114.`);
  }
  return surahs;
}

/** The copyright and license on Tanzil's metadata file, which its license asks to keep. */
export function metadataAttribution(metadataXml: string): string {
  const quran = attributes(/<quran [^>]*>/.exec(metadataXml)?.[0] ?? "");
  if (!quran.copyright || !quran.license) {
    throw new Error("Tanzil metadata has no copyright or license attribute.");
  }
  return `Quran metadata ${quran.copyright}, license ${quran.license}, from https://tanzil.net/res/text/metadata/quran-data.xml`;
}
