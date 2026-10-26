import { useTranslations } from "next-intl";

/**
 * At the top of the surah page, for every reader during user testing: how far the review is, and
 * where to find the feedback form.
 */
export function ReviewNote() {
  const t = useTranslations("surah.reviewNote");
  return (
    <div
      role="note"
      className="mb-6 rounded-xl border border-cite/30 bg-cite-soft px-5 py-4 text-cite"
    >
      <p className="font-semibold">{t("status")}</p>
      <p className="mt-1 text-sm">{t("feedback")}</p>
    </div>
  );
}
