"use client";

import { useTranslations } from "next-intl";
import { Fragment, useCallback, useEffect, useId, useRef, type PointerEvent } from "react";
import { ArabicText } from "@/components/text/ArabicText";
import { useDismiss } from "@/components/use-dismiss";
import {
  toArabicDigits,
  wordKey,
  type VerseView,
  type WordDetail,
} from "@/lib/services/reading/surah-view";
import { DraftBadge } from "./DraftBadge";
import { useReader } from "./SurahReader";
import { WordPopover } from "./WordPopover";

type SectionVersesProps = {
  verses: VerseView[];
  /** The section's words that have a published meaning, keyed "surah:ayah:word". */
  words: Record<string, WordDetail>;
};

// Hovering opens a word's popover after a short pause, so moving the mouse across the verse
// doesn't flash every popover; leaving closes it after a pause, so the pointer can reach it.
const HOVER_OPEN_MS = 150;
const HOVER_CLOSE_MS = 250;

/**
 * A section's verses in Arabic, each followed by its number, then their pronunciation. A word
 * with a meaning is a button with a dotted underline that opens its popover below the verses:
 * on hover with a mouse, or by click, tap, Enter or Space, which also moves focus into it.
 */
export function SectionVerses({ verses, words }: SectionVersesProps) {
  const t = useTranslations("surah");
  const { locale, openWord, setOpenWord } = useReader();
  const container = useRef<HTMLDivElement>(null);
  const wordButtons = useRef(new Map<string, HTMLButtonElement>());
  const closeButton = useRef<HTMLButtonElement>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  const popoverId = useId();

  const open = openWord && words[openWord.key] ? openWord : null;
  const pronounced = verses.filter((verse) => verse.transliteration[locale]);
  const pronunciationDraft = pronounced.some((verse) => verse.transliterationDraft[locale]);

  const close = useCallback(
    (returnFocus: boolean) => {
      window.clearTimeout(hoverTimer.current);
      const key = open?.key;
      setOpenWord((current) => (current?.key === key ? null : current));
      if (returnFocus && key) {
        wordButtons.current.get(key)?.focus();
      }
    },
    [open?.key, setOpenWord],
  );
  const dismiss = useCallback(
    (reason: "escape" | "outside") => close(reason === "escape"),
    [close],
  );
  useDismiss(open !== null, dismiss, container);

  // Opened by click, tap or keyboard: move focus into the popover.
  useEffect(() => {
    if (open?.focus) {
      closeButton.current?.focus();
    }
  }, [open?.key, open?.focus]);

  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  function onWordClick(key: string) {
    window.clearTimeout(hoverTimer.current);
    setOpenWord((current) =>
      current?.key === key && current.pinned ? null : { key, pinned: true, focus: true },
    );
  }

  function onWordEnter(event: PointerEvent, key: string) {
    if (event.pointerType !== "mouse") {
      return;
    }
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => {
      setOpenWord((current) => (current?.pinned ? current : { key, pinned: false, focus: false }));
    }, HOVER_OPEN_MS);
  }

  function onHoverLeave(event: PointerEvent) {
    if (event.pointerType !== "mouse") {
      return;
    }
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => {
      setOpenWord((current) => (current && !current.pinned ? null : current));
    }, HOVER_CLOSE_MS);
  }

  function onPopoverEnter() {
    window.clearTimeout(hoverTimer.current);
  }

  return (
    <div ref={container} className="mt-4">
      <ArabicText size="lg">
        {verses.map((verse) => (
          <span key={verse.ayah} id={verse.anchor} className="scroll-mt-24">
            {verse.tokens.map((token, i) => {
              const key =
                token.kind === "word"
                  ? wordKey({ surah: verse.surah, ayah: verse.ayah, word: token.position })
                  : null;
              const isOpen = key !== null && open?.key === key;
              return (
                <Fragment key={i}>
                  {i > 0 ? " " : null}
                  {key && words[key] ? (
                    <button
                      ref={(element) => {
                        if (element) {
                          wordButtons.current.set(key, element);
                        } else {
                          wordButtons.current.delete(key);
                        }
                      }}
                      type="button"
                      aria-haspopup="dialog"
                      aria-expanded={isOpen}
                      aria-controls={isOpen ? popoverId : undefined}
                      onClick={() => onWordClick(key)}
                      onPointerEnter={(event) => onWordEnter(event, key)}
                      onPointerLeave={onHoverLeave}
                      className={`cursor-pointer rounded underline decoration-brand decoration-dotted decoration-2 underline-offset-[0.6em] hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-brand ${
                        isOpen ? "bg-brand-soft" : ""
                      }`}
                    >
                      {token.textAr}
                    </button>
                  ) : (
                    token.textAr
                  )}
                </Fragment>
              );
            })}{" "}
            <VerseNumber ayah={verse.ayah} label={t("verseNumber", { number: verse.ayah })} />{" "}
          </span>
        ))}
      </ArabicText>

      {pronounced.length > 0 ? (
        <p
          className={`mt-3 leading-7 text-ink-muted group-data-[show-pronunciation=false]/reader:hidden ${
            locale === "en" ? "italic" : ""
          }`}
        >
          {pronunciationDraft ? (
            <>
              <DraftBadge />{" "}
            </>
          ) : null}
          <span className="sr-only">{t("pronunciation")}: </span>
          {pronounced.map((verse) => (
            <Fragment key={verse.ayah}>
              {verse.transliteration[locale]}{" "}
              <span className="text-xs text-brand not-italic">({verse.ayah})</span>{" "}
            </Fragment>
          ))}
        </p>
      ) : null}

      {open ? (
        <WordPopover
          id={popoverId}
          word={words[open.key]}
          closeButton={closeButton}
          onClose={() => close(true)}
          onPointerEnter={onPopoverEnter}
          onPointerLeave={onHoverLeave}
          onFocus={() =>
            setOpenWord((current) =>
              current && !current.pinned ? { ...current, pinned: true } : current,
            )
          }
        />
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
