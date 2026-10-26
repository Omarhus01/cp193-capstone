import { useTranslations } from "next-intl";
import { passageLabel, type SourceView } from "@/lib/services/reading/surah-view";

/**
 * The full citation of a source: "Ibn Kathīr, Tafsīr al-Qurʾān al-ʿAẓīm (Dār al-Kutub
 * al-ʿIlmiyya, …), vol. 1, pp. 18–30", led by who it quotes when it does ("Muslim, via Ibn Kathīr,
 * …").
 */
export function useSourceLabel() {
  const t = useTranslations("surah.passage");
  return ({ passage, quoting }: Pick<SourceView, "passage" | "quoting">) => {
    const { key, values, edition } = passageLabel(passage);
    const title = edition ? t("titleEdition", { title: values.title, edition }) : values.title;
    const label = t(key, { ...values, title });
    return quoting ? t("via", { quoting, label }) : label;
  };
}

const CHIP =
  "rounded bg-cite-soft px-1.5 py-0.5 align-middle text-xs whitespace-nowrap text-cite not-italic";

/**
 * A small "Source 1" chip whose tooltip is the full citation. It opens the cited pages in a new tab
 * when the passage has a link (Shamela), and links nowhere when it doesn't.
 */
export function SourceChip({ source }: { source: SourceView }) {
  const t = useTranslations("surah");
  const label = useSourceLabel()(source);
  const name = t("sourceLabel", { number: source.number, label });
  const text = t("sourceNumber", { number: source.number });
  const { url } = source.passage;
  if (!url) {
    return (
      <span title={label} className={CHIP}>
        <span aria-hidden="true">{text}</span>
        <span className="sr-only">{name}</span>
      </span>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      aria-label={`${name} ${t("feedback.newTab")}`}
      className={`${CHIP} hover:underline`}
    >
      {text}
    </a>
  );
}

/** The source chips of one point, shown at its end. */
export function SourceChips({ sources }: { sources: SourceView[] }) {
  if (sources.length === 0) {
    return null;
  }
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {sources.map((source, i) => (
        <SourceChip key={`${source.passage.id}-${i}`} source={source} />
      ))}
    </span>
  );
}

/**
 * A source cited in full, as in the word popover: a link to the cited pages in a new tab, or plain
 * text when the passage has no link.
 */
export function SourceLink({ source }: { source: SourceView }) {
  const t = useTranslations("surah.feedback");
  const label = useSourceLabel()(source);
  const { url } = source.passage;
  if (!url) {
    return <span className="text-sm text-cite">{label}</span>;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm text-cite underline underline-offset-2 hover:no-underline"
    >
      {label}
      <span className="sr-only"> {t("newTab")}</span>
    </a>
  );
}
