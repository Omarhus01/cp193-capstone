import { useTranslations } from "next-intl";
import { ArrowLeftIcon, ArrowRightIcon } from "@/components/icons";
import { ArabicText } from "@/components/text/ArabicText";
import { Link } from "@/i18n/navigation";
import type { SurahLink } from "@/lib/services/surah-list";

type SurahPagerProps = {
  previous: SurahLink | null;
  next: SurahLink | null;
  /** Names the links as a group. Each pager on a page needs its own. */
  label: string;
  className?: string;
};

/**
 * Links to the surahs before and after this one: "Previous surah" and "Next surah", with the
 * surah's number and names. The first surah has no previous link and the last no next one.
 */
export function SurahPager({ previous, next, label, className = "" }: SurahPagerProps) {
  const t = useTranslations("surah.pager");
  if (!previous && !next) {
    return null;
  }
  return (
    <nav aria-label={label} className={`grid grid-cols-2 gap-3 text-sm ${className}`}>
      {previous ? (
        <PagerLink surah={previous} direction="previous" heading={t("previous")} />
      ) : null}
      {next ? <PagerLink surah={next} direction="next" heading={t("next")} /> : null}
    </nav>
  );
}

type PagerLinkProps = { surah: SurahLink; direction: "previous" | "next"; heading: string };

/**
 * One link, in its own half of the row (the next surah always on the right). On phones it fills
 * its half and the names wrap rather than being cut off; on wider screens it is as wide as its
 * text.
 */
function PagerLink({ surah, direction, heading }: PagerLinkProps) {
  const isNext = direction === "next";
  const Arrow = isNext ? ArrowRightIcon : ArrowLeftIcon;
  return (
    <Link
      href={`/surah/${surah.number}`}
      rel={isNext ? "next" : "prev"}
      className={`flex min-w-0 items-center gap-2 rounded-lg border border-line px-3 py-2 hover:bg-page focus-visible:outline-2 focus-visible:outline-brand ${
        isNext
          ? "col-start-2 flex-row-reverse text-right sm:justify-self-end"
          : "sm:justify-self-start"
      }`}
    >
      <Arrow className="size-4 shrink-0 text-brand" />
      <span className={`flex min-w-0 flex-col break-words ${isNext ? "items-end" : "items-start"}`}>
        <span className="text-xs text-ink-muted">{heading}</span>
        <span className="font-medium">
          {surah.number}. {surah.name}
        </span>
        <ArabicText as="span" size="sm" className="text-ink-muted">
          {surah.nameAr}
        </ArabicText>
      </span>
    </Link>
  );
}
