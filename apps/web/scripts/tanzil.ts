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

/** Where a page of the Madani mushaf starts, as Tanzil's metadata marks it. */
export type PageStart = { page: number; surah: number; ayah: number };

/**
 * The first verse of each of the mushaf's 604 pages, from the `<pages>` part of quran-data.xml,
 * checked to be numbered 1 to 604 in text order, starting at 1:1, each at a verse that exists.
 */
export function readPageStarts(metadataXml: string): PageStart[] {
  const verseCounts = new Map(readSurahMetadata(metadataXml).map((s) => [s.number, s.verseCount]));
  const block = /<pages>([\s\S]*?)<\/pages>/.exec(metadataXml)?.[1] ?? "";
  const pages = [...block.matchAll(/<page [^>]*\/>/g)].map((match) => {
    const page = attributes(match[0]);
    return { page: Number(page.index), surah: Number(page.sura), ayah: Number(page.aya) };
  });
  pages.forEach((start, i) => {
    const before = pages[i - 1];
    const verseCount = verseCounts.get(start.surah) ?? 0;
    if (start.page !== i + 1 || !(start.ayah >= 1 && start.ayah <= verseCount)) {
      throw new Error(`Tanzil metadata: page ${i + 1} is missing or starts at no verse.`);
    }
    if (
      before &&
      (start.surah < before.surah || (start.surah === before.surah && start.ayah <= before.ayah))
    ) {
      throw new Error(`Tanzil metadata: page ${start.page} starts before page ${before.page}.`);
    }
  });
  if (pages.length !== 604) {
    throw new Error(`Tanzil metadata lists ${pages.length} pages, not 604.`);
  }
  if (pages[0].surah !== 1 || pages[0].ayah !== 1) {
    throw new Error("Tanzil metadata: page 1 doesn't start at 1:1.");
  }
  return pages;
}

/**
 * The surah.json the importer creates for a surah that has none: the English name is Tanzil's
 * transliteration (`tname`, such as "Al-Baqara"), and the Korean name is left for the owner.
 */
export function newSurahFile(transliteratedName: string | undefined) {
  return {
    $schema: "../../schema/surah.schema.json",
    names: { en: transliteratedName?.trim() || null, ko: null },
  };
}
