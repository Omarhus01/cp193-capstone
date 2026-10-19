import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import type { Locale } from "@/i18n/locale";
import { requireUserId } from "@/lib/auth/require-user";
import { parseSurahNumber } from "@/lib/surah";

type SurahPageProps = PageProps<"/[locale]/surah/[n]">;

/** Protected placeholder. Verse content arrives in step 2. */
export default function SurahPage({ params }: SurahPageProps) {
  // The surah number and the session are only known at request time, so render behind Suspense.
  return (
    <Suspense>
      <SurahContent params={params} />
    </Suspense>
  );
}

async function SurahContent({ params }: Pick<SurahPageProps, "params">) {
  const { locale: localeParam, n } = await params;
  const locale = localeParam as Locale;
  setRequestLocale(locale);

  const surahNumber = parseSurahNumber(n);
  if (!surahNumber) {
    notFound();
  }
  await requireUserId(locale, `/${locale}/surah/${n}`);

  const t = await getTranslations("surah");
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("title", { number: surahNumber })}</h1>
      <p className="text-zinc-600">{t("placeholder")}</p>
    </section>
  );
}
