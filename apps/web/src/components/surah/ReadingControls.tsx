"use client";

import { useTranslations } from "next-intl";
import type { ReadingPreferences } from "@/lib/services/reading/preferences";
import { useReader } from "./SurahReader";

/** The reader's switches, and a hint about underlined words when the surah has word meanings. */
export function ReadingControls({ hasWordMeanings }: { hasWordMeanings: boolean }) {
  const t = useTranslations("surah");
  const { locale } = useReader();

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* English pages already show the English. */}
      {locale === "ko" ? <Toggle preference="showEnglish" label={t("showEnglish")} /> : null}
      <Toggle preference="showPronunciation" label={t("showPronunciation")} />
      {hasWordMeanings ? (
        <p className="text-sm text-ink-muted lg:ml-auto">{t("wordHint")}</p>
      ) : null}
    </div>
  );
}

function Toggle({ preference, label }: { preference: keyof ReadingPreferences; label: string }) {
  const { preferences, setPreference } = useReader();
  const on = preferences[preference];
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => setPreference(preference, !on)}
      className="flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-sm"
    >
      <span
        aria-hidden="true"
        className={`relative h-5 w-9 rounded-full transition-colors ${on ? "bg-brand" : "bg-line"}`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-[left] ${
            on ? "left-[1.125rem]" : "left-0.5"
          }`}
        />
      </span>
      {label}
    </button>
  );
}
