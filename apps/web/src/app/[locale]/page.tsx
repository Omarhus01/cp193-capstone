import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/locale";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  return <HomeContent />;
}

function HomeContent() {
  const t = useTranslations("home");
  return (
    <section className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-lg leading-8 text-zinc-700">{t("intro")}</p>
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/surah/1"
          className="rounded-md bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-800"
        >
          {t("start")}
        </Link>
        <p className="text-sm text-zinc-500">{t("accountHint")}</p>
      </div>
    </section>
  );
}
