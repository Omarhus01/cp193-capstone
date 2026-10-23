import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { AccountHint } from "@/components/home/AccountHint";
import { Link } from "@/i18n/navigation";

export default function HomePage() {
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
        {/* Reads the session cookie, so it streams in after the static shell. */}
        <Suspense fallback={null}>
          <AccountHint />
        </Suspense>
      </div>
    </section>
  );
}
