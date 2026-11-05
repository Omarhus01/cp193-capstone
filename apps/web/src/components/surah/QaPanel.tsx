"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import type { Locale } from "@/i18n/locale";
import type { Localized } from "@/lib/domain/content";
import { questionsForSection, type QuestionsBySection, type QuestionView } from "@/lib/services/qa";
import { LocalizedText } from "./LocalizedText";
import { SourceChips } from "./SourceLink";
import { useReader } from "./SurahReader";

type QaPanelProps =
  /** The right column on wide screens, following the section in view. */
  | { variant: "panel"; sectionLabels: Record<number, string>; questions: QuestionsBySection }
  /** Under a section, on phones. */
  | { variant: "inline"; questions: QuestionView[] };

/**
 * Questions and answers: the fixed questions of the section (ADR 0018), each opening its answer
 * with the sources behind it. Asking your own question is shown, disabled, as coming soon.
 */
export function QaPanel(props: QaPanelProps) {
  const t = useTranslations("qa");
  const { currentSection, locale } = useReader();
  const headingId = useId();
  const inputId = useId();
  const panel = props.variant === "panel";
  const range = panel ? props.sectionLabels[currentSection] : undefined;
  const questions = panel ? questionsForSection(props.questions, currentSection) : props.questions;

  return (
    <section
      aria-labelledby={headingId}
      className={panel ? "rounded-xl border border-line bg-white p-5" : "border-t border-line pt-5"}
    >
      <h2 id={headingId} className="font-semibold">
        {t("title")}
      </h2>
      {range ? <p className="mt-0.5 text-xs text-ink-muted">{t("readingNow", { range })}</p> : null}
      {/* A new section starts with every answer closed. */}
      <QuestionList key={panel ? currentSection : "inline"} questions={questions} locale={locale} />
      <label htmlFor={inputId} className="mt-5 mb-1 block text-xs font-semibold">
        {t("askLabel")}
      </label>
      <input
        id={inputId}
        type="text"
        disabled
        placeholder={t("askPlaceholder")}
        className="w-full cursor-not-allowed rounded-md border border-line bg-page px-3 py-2 text-sm"
      />
      <p className="mt-2 text-xs text-ink-muted">{t("declineNote")}</p>
    </section>
  );
}

/** The section's questions. One answer is open at a time. */
function QuestionList({ questions, locale }: { questions: QuestionView[]; locale: Locale }) {
  const t = useTranslations("qa");
  const [openId, setOpenId] = useState<string | null>(null);
  if (questions.length === 0) {
    return <p className="mt-4 text-sm text-ink-muted">{t("noQuestions")}</p>;
  }
  return (
    <ul aria-label={t("questionsLabel")} className="mt-4 flex flex-col gap-2">
      {questions.map((question) => (
        <Question
          key={question.id}
          question={question}
          locale={locale}
          open={openId === question.id}
          onToggle={() => setOpenId(openId === question.id ? null : question.id)}
        />
      ))}
    </ul>
  );
}

type QuestionProps = {
  question: QuestionView;
  locale: Locale;
  open: boolean;
  onToggle: () => void;
};

/** A question that opens its answer, which ends with its source chips. */
function Question({ question, locale, open, onToggle }: QuestionProps) {
  const answerId = useId();
  return (
    <li className="rounded-lg border border-line">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={answerId}
        onClick={onToggle}
        className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-page"
      >
        <QuestionText text={question.question} locale={locale} />
      </button>
      <div id={answerId} hidden={!open} className="border-t border-line px-3 py-2 text-sm">
        <LocalizedText
          text={question.answer}
          locale={locale}
          trailing={<SourceChips sources={question.sources} />}
        />
      </div>
    </li>
  );
}

/**
 * The question in the page's language. On Korean pages the English follows when the reader shows
 * English. Plain text, since it sits inside a button.
 */
function QuestionText({ text, locale }: { text: Localized; locale: Locale }) {
  const english = locale === "ko" ? text.en : null;
  return (
    <>
      <span>{text[locale] ?? text.en}</span>
      {english && text.ko ? (
        <span
          lang="en"
          className="font-normal text-ink-muted group-data-[show-english=false]/reader:hidden"
        >
          {english}
        </span>
      ) : null}
    </>
  );
}
