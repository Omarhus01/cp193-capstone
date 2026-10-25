import { useTranslations } from "next-intl";

/**
 * Marks content a tester sees before it is published (ADR 0016). Other readers never get drafts,
 * so they never see this badge.
 */
export function DraftBadge() {
  const t = useTranslations("tester");
  return (
    <span
      title={t("draftLabel")}
      className="inline-block rounded bg-cite-soft px-1.5 py-0.5 align-middle text-xs font-semibold text-cite not-italic"
    >
      <span aria-hidden="true">{t("draft")}</span>
      <span className="sr-only">{t("draftLabel")}</span>
    </span>
  );
}
