import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { ArabicText } from "@/components/text/ArabicText";
import { Link } from "@/i18n/navigation";
import { loadSurahLinks } from "@/lib/services/surah-list";

/**
 * Every surah in the database, explained or not, each linking to its page: its number, its name in
 * the page's language (else English) and its Arabic name, with the verses it holds when that is
 * only some. Render inside <Suspense>.
 */
export async function SurahList() {
  // Read the list when a page is requested, not while building, so the build never needs the
  // database and a new seed shows up without a deploy.
  await connection();
  const [locale, t] = await Promise.all([getLocale(), getTranslations("home")]);
  const surahs = await loadSurahLinks(locale);
  if (surahs.length === 0) {
    return null;
  }
  return (
    <section aria-labelledby="surah-list-title" className="flex flex-col gap-3">
      <h2 id="surah-list-title" className="text-lg font-semibold">
        {t("surahsTitle")}
      </h2>
      <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {surahs.map((surah) => (
          <li key={surah.number}>
            <Link
              href={`/surah/${surah.number}`}
              className="flex items-baseline justify-between gap-3 rounded-md px-2 py-1 hover:bg-white"
            >
              <span className="font-medium text-emerald-800 underline underline-offset-2 hover:text-emerald-900">
                {surah.number}. {surah.name}
                {surah.verses ? <span className="text-zinc-600"> {surah.verses}</span> : null}
              </span>
              <ArabicText as="span" size="sm" className="text-zinc-600">
                {surah.nameAr}
              </ArabicText>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
