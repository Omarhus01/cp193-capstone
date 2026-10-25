import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { passageLabel, type SourceView } from "@/lib/services/reading/surah-view";

/**
 * The full name of a source: "Ibn Kathīr, Tafsīr al-Qurʾān al-ʿAẓīm, vol. 1, pp. 101–111", led by
 * who it quotes when it does ("Muslim, via Ibn Kathīr, …").
 */
export function useSourceLabel() {
  const t = useTranslations("surah.passage");
  return ({ passage, quoting }: Pick<SourceView, "passage" | "quoting">) => {
    const { key, values } = passageLabel(passage);
    const label = t(key, values);
    return quoting ? t("via", { quoting, label }) : label;
  };
}

/** A small "Source 1" link to the cited passage's page (/[locale]/sources/[id], #4). */
export function SourceChip({ source }: { source: SourceView }) {
  const t = useTranslations("surah");
  const label = useSourceLabel()(source);
  return (
    <Link
      href={`/sources/${source.passage.id}`}
      aria-label={t("sourceLabel", { number: source.number, label })}
      title={label}
      className="rounded bg-cite-soft px-1.5 py-0.5 align-middle text-xs whitespace-nowrap text-cite not-italic hover:underline"
    >
      {t("sourceNumber", { number: source.number })}
    </Link>
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

/** A source named in full, as in the word popover. */
export function SourceLink({ source }: { source: SourceView }) {
  const label = useSourceLabel()(source);
  return (
    <Link
      href={`/sources/${source.passage.id}`}
      className="text-sm text-cite underline underline-offset-2 hover:no-underline"
    >
      {label}
    </Link>
  );
}
