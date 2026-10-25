import { useTranslations } from "next-intl";

/** At the top of the surah page for testers: the page includes content still in review (ADR 0016). */
export function TesterBanner() {
  const t = useTranslations("tester");
  return (
    <div
      role="note"
      className="mb-6 rounded-xl border border-cite/30 bg-cite-soft px-5 py-4 text-cite"
    >
      <p className="font-semibold">{t("bannerTitle")}</p>
      <p className="mt-1 text-sm">{t("bannerBody")}</p>
    </div>
  );
}
