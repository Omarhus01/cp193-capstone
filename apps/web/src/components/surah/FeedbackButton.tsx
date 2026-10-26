import { useTranslations } from "next-intl";

type FeedbackButtonProps = {
  /** The feedback form, or null while there is none (feedbackFormUrl). */
  url: string | null;
};

/** Opens the user-testing feedback form in a new tab, or says it is coming soon. */
export function FeedbackButton({ url }: FeedbackButtonProps) {
  const t = useTranslations("surah.feedback");
  if (!url) {
    return (
      <p className="rounded-xl border border-dashed border-line bg-page px-4 py-3 text-center text-sm text-ink-muted">
        {t("comingSoon")}
      </p>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl bg-brand px-4 py-3 text-center font-semibold text-white hover:bg-brand/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {t("button")}
      <span className="sr-only"> {t("newTab")}</span>
    </a>
  );
}
