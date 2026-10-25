import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Passage } from "@/lib/domain/content";
import { passageLabel } from "@/lib/services/reading/surah-view";

/** The name of a cited passage: "Title, vol. 1, p. 70". */
export function usePassageLabel() {
  const t = useTranslations("surah.passage");
  return (passage: Passage) => {
    const { key, values } = passageLabel(passage);
    return t(key, values);
  };
}

/** A small "Source 1" link to the cited passage's page (/[locale]/sources/[id], #4). */
export function SourceChip({ number, passage }: { number: number; passage: Passage }) {
  const t = useTranslations("surah");
  const label = usePassageLabel()(passage);
  return (
    <Link
      href={`/sources/${passage.id}`}
      aria-label={t("sourceLabel", { number, label })}
      title={label}
      className="rounded bg-cite-soft px-1.5 py-0.5 text-xs whitespace-nowrap text-cite hover:underline"
    >
      {t("sourceNumber", { number })}
    </Link>
  );
}

/** A source named in full, as in the word popover. */
export function SourceLink({ passage }: { passage: Passage }) {
  const label = usePassageLabel()(passage);
  return (
    <Link
      href={`/sources/${passage.id}`}
      className="text-sm text-cite underline underline-offset-2 hover:no-underline"
    >
      {label}
    </Link>
  );
}
