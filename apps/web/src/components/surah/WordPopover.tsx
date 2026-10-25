"use client";

import { useTranslations } from "next-intl";
import { useId, type PointerEventHandler, type RefObject } from "react";
import { CloseIcon } from "@/components/icons";
import { ArabicText } from "@/components/text/ArabicText";
import { Link } from "@/i18n/navigation";
import type { WordDetail } from "@/lib/services/reading/surah-view";
import { LocalizedText } from "./LocalizedText";
import { SourceLink } from "./SourceLink";
import { useReader } from "./SurahReader";

type WordPopoverProps = {
  id: string;
  word: WordDetail;
  closeButton: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onPointerEnter: PointerEventHandler;
  onPointerLeave: PointerEventHandler;
  onFocus: () => void;
};

/**
 * What a word means in this verse, what its root means elsewhere, and the sources. A non-modal
 * dialog shown below the section's verses; Escape or the close button closes it.
 */
export function WordPopover({
  id,
  word,
  closeButton,
  onClose,
  onPointerEnter,
  onPointerLeave,
  onFocus,
}: WordPopoverProps) {
  const t = useTranslations("surah");
  const { locale } = useReader();
  const titleId = useId();
  const { ref, root } = word;

  return (
    <div
      id={id}
      role="dialog"
      aria-labelledby={titleId}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onFocus={onFocus}
      className="mt-4 rounded-xl border border-line bg-white p-5 shadow-lg sm:ml-auto sm:max-w-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div id={titleId}>
            <ArabicText size="lg" className="text-brand">
              {word.textAr}
            </ArabicText>
          </div>
          <p className="text-xs text-ink-muted">
            {ref.surah}:{ref.ayah}
            {root ? (
              <>
                {" · "}
                {t("word.root")}{" "}
                <ArabicText as="span" size="sm">
                  {root}
                </ArabicText>
              </>
            ) : null}
          </p>
        </div>
        <button
          ref={closeButton}
          type="button"
          aria-label={t("word.close")}
          onClick={onClose}
          className="rounded-md bg-page p-2 text-ink hover:bg-line"
        >
          <CloseIcon className="size-4" />
        </button>
      </div>

      <h3 className="mt-4 text-xs font-semibold">{t("word.inThisVerse")}</h3>
      <LocalizedText text={word.meaning} locale={locale} />

      {word.elsewhere.length > 0 ? (
        <div className="mt-4 rounded-lg bg-page p-4">
          <h3 className="text-xs font-semibold text-ink-muted">{t("word.elsewhere")}</h3>
          <ul className="flex flex-col gap-3">
            {word.elsewhere.map((other, i) => (
              <li key={i}>
                <LocalizedText
                  text={other.text}
                  locale={locale}
                  lead={
                    other.verse ? (
                      <>
                        {other.verse.available ? (
                          <Link
                            href={`/surah/${other.verse.surah}#${other.verse.anchor}`}
                            className="font-semibold text-brand underline underline-offset-2"
                          >
                            {other.verse.label}
                          </Link>
                        ) : (
                          <span className="font-semibold">{other.verse.label}</span>
                        )}
                        :{" "}
                      </>
                    ) : null
                  }
                />
                {other.verseAr ? (
                  <ArabicText size="md" className="text-right">
                    {other.verseAr}
                  </ArabicText>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {word.sources.length > 0 ? (
        <>
          <h3 className="mt-4 text-xs font-semibold">{t("sources")}</h3>
          <ul>
            {word.sources.map((source, i) => (
              <li key={`${source.passage.id}-${i}`}>
                <SourceLink source={source} />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
