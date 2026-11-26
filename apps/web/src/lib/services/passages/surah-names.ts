// Which surah a heading or a book title names.
import { normalizeArabic } from "./arabic";

export type SurahName = { number: number; nameAr: string };

// Names the books use besides the ones in content/quran-metadata.json: older names, and first
// words used as names. Headings are compared after normalizing, so spelling variants of the
// listed forms needn't be repeated.
const OTHER_NAMES: readonly (readonly [string, number])[] = [
  ["فاتحة الكتاب", 1],
  ["أم القرآن", 1],
  ["براءة", 9],
  ["بني إسرائيل", 17],
  ["سبحان", 17],
  ["اقترب", 21],
  ["قد أفلح", 23],
  ["المؤمنين", 23],
  ["طس النمل", 27],
  ["الم السجدة", 32],
  ["الم تنزيل السجدة", 32],
  ["الملائكة", 35],
  ["المؤمن", 40],
  ["حم المؤمن", 40],
  ["حم المؤمن غافر", 40],
  ["حم السجدة", 41],
  ["حم السجدة فصلت", 41],
  ["فصلت حم السجدة", 41],
  ["حم فصلت", 41],
  ["حم عسق", 42],
  ["عسق", 42],
  ["القتال", 47],
  ["والذاريات", 51],
  ["والطور", 52],
  ["والنجم", 53],
  ["اقتربت", 54],
  ["اقتربت الساعة", 54],
  ["الحواريين", 61],
  ["المنافقين", 63],
  ["المتحرم", 66],
  ["تبارك", 67],
  ["تبارك الذي بيده الملك", 67],
  ["ن", 68],
  ["نون", 68],
  ["ن والقلم", 68],
  ["سأل سائل", 70],
  ["سأل سائل المعارج", 70],
  ["إنا أرسلنا نوحا", 71],
  ["قل أوحي", 72],
  ["قل أوحي إلي", 72],
  ["لا أقسم بيوم القيامة", 75],
  ["القيمة", 75],
  ["الدهر", 76],
  ["هل أتى", 76],
  ["هل أتى على الإنسان", 76],
  ["والمرسلات", 77],
  ["عم", 78],
  ["عم يتساءلون", 78],
  ["والنازعات", 79],
  ["إذا الشمس كورت", 81],
  ["إذا السماء انفطرت", 82],
  ["ويل للمطففين", 83],
  ["التطفيف", 83],
  ["إذا السماء انشقت", 84],
  ["والسماء ذات البروج", 85],
  ["والسماء والطارق", 86],
  ["سبح", 87],
  ["سبح الأعلى", 87],
  ["سبح اسم ربك الأعلى", 87],
  ["لا أقسم بهذا البلد", 90],
  ["والشمس وضحاها", 91],
  ["والليل إذا يغشى", 92],
  ["والضحى", 93],
  ["ألم نشرح", 94],
  ["الشرح", 94],
  ["الانشراح", 94],
  ["والتين", 95],
  ["والتين والزيتون", 95],
  ["اقرأ", 96],
  ["اقرأ باسم ربك", 96],
  ["إنا أنزلناه", 97],
  ["لم يكن", 98],
  ["إذا زلزلت", 99],
  ["والعاديات", 100],
  ["ألهاكم", 102],
  ["ألهاكم التكاثر", 102],
  ["والعصر", 103],
  ["ويل لكل همزة", 104],
  ["ويل لكل همزة لمزة", 104],
  ["لإيلاف", 106],
  ["لإيلاف قريش", 106],
  ["أرأيت", 107],
  ["إنا أعطيناك الكوثر", 108],
  ["قل يا أيها الكافرون", 109],
  ["إذا جاء نصر الله", 110],
  ["إذا جاء نصر الله والفتح", 110],
  ["تبت", 111],
  ["المسد", 111],
  ["قل هو الله أحد", 112],
  ["الصمد", 112],
  ["قل أعوذ برب الفلق", 113],
  ["قل أعوذ برب الناس", 114],
];

// Both are matched against normalized text.
const PREFIX =
  /^(?:(?:(?:مختصر|تتمه) )?تفسير )?(?:ما جاء (?:في )?)?(?:و?من )?(?:السوره التي يذكر فيها|سوره) /;
const SUFFIX =
  / (?:عليه السلام|عليها السلام|صلي الله عليه وسلم|عز وجل|وهي مكيه|وهي مدنيه|مكيه|مدنيه|بسم الله الرحمن الرحيم.*)$/;
const LAST_TWO = /^(?:تفسير )?سورتي المعوذتين$/;

/** Finds surahs by the names books give them. */
export class SurahNames {
  private readonly byName = new Map<string, number>();

  constructor(surahs: readonly SurahName[]) {
    for (const [name, number] of OTHER_NAMES) this.byName.set(normalizeArabic(name), number);
    for (const { number, nameAr } of surahs) this.byName.set(normalizeArabic(nameAr), number);
  }

  /** The surah with exactly this name ("النساء", "بني إسرائيل"). */
  byExactName(name: string): number | null {
    return this.byName.get(normalizeArabic(name)) ?? null;
  }

  /**
   * The surahs a heading opens. A heading with the word "surah" counts at any level; a name alone
   * ("النساء") counts only at the top level, since a name such as "محمد" can also be a subheading.
   */
  ofHeading(title: string, topLevel: boolean): number[] {
    const text = normalizeArabic(title);
    if (LAST_TWO.test(text)) return [113, 114];
    const named = text.replace(PREFIX, "").replace(SUFFIX, "");
    const number = this.byName.get(named);
    return number !== undefined && (topLevel || PREFIX.test(text)) ? [number] : [];
  }

  /**
   * The one surah a book's title names ("تفسير العثيمين: لقمان", "تفسير سورة النصر"), or null if it
   * names none or several.
   */
  ofBookTitle(title: string): number | null {
    const named = /سورة\s+(.*)$/.exec(title)?.[1] ?? /:\s*(.*)$/.exec(title)?.[1];
    if (!named) return null;
    const words = normalizeArabic(named).split(" ");
    for (let length = words.length; length > 0; length--) {
      const number = this.byName.get(words.slice(0, length).join(" "));
      if (number === undefined) continue;
      const others = words.slice(length).map((word) => word.replace(/^و(?=ال)/, ""));
      return others.some((word) => this.byName.has(word)) ? null : number;
    }
    return null;
  }
}
