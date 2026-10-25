"use client";

import { useTranslations } from "next-intl";
import { Fragment } from "react";
import { ArabicText } from "@/components/text/ArabicText";
import { toArabicDigits, type VerseView } from "@/lib/services/reading/surah-view";
import { useReader } from "./SurahReader";

type SectionVersesProps = { verses: VerseView[] };

/** A section's verses in Arabic, each followed by its number, then their pronunciation. */
export function SectionVerses({ verses }: SectionVersesProps) {
  const t = useTranslations("surah");
  const { locale } = useReader();
  const pronounced = verses.filter((verse) => verse.transliteration[locale]);

  return (
    <div className="mt-4">
      <ArabicText size="lg">
        {verses.map((verse) => (
          <span key={verse.ayah} id={verse.anchor} className="scroll-mt-24">
            {verse.tokens.map((token, i) => (
              <Fragment key={i}>
                {i > 0 ? " " : null}
                {token.textAr}
              </Fragment>
            ))}{" "}
            <VerseNumber ayah={verse.ayah} label={t("verseNumber", { number: verse.ayah })} />{" "}
          </span>
        ))}
      </ArabicText>

      {pronounced.length > 0 ? (
        <p
          aria-label={t("pronunciation")}
          className={`mt-3 leading-7 text-ink-muted group-data-[show-pronunciation=false]/reader:hidden ${
            locale === "en" ? "italic" : ""
          }`}
        >
          {pronounced.map((verse) => (
            <Fragment key={verse.ayah}>
              {verse.transliteration[locale]}{" "}
              <span className="text-xs text-brand not-italic">({verse.ayah})</span>{" "}
            </Fragment>
          ))}
        </p>
      ) : null}
    </div>
  );
}

/** "﴿٤﴾" after a verse. Page decoration, not part of the Tanzil text. */
function VerseNumber({ ayah, label }: { ayah: number; label: string }) {
  return (
    <span className="whitespace-nowrap text-brand">
      <span aria-hidden="true">{`﴿${toArabicDigits(ayah)}﴾`}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
