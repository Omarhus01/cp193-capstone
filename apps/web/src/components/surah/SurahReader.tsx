"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { Locale } from "@/i18n/locale";
import { preferenceCookie, type ReadingPreferences } from "@/lib/services/reading/preferences";

/** The word whose popover is open. `pinned` once clicked, tapped or focused (not just hovered). */
export type OpenWord = { key: string; pinned: boolean; focus: boolean };

type Reader = {
  locale: Locale;
  preferences: ReadingPreferences;
  setPreference: (key: keyof ReadingPreferences, value: boolean) => void;
  /** The position of the reading section the reader is at. */
  currentSection: number;
  setCurrentSection: (position: number) => void;
  /** One word popover is open at a time, across the page. */
  openWord: OpenWord | null;
  setOpenWord: Dispatch<SetStateAction<OpenWord | null>>;
};

const ReaderContext = createContext<Reader | null>(null);

export function useReader(): Reader {
  const reader = useContext(ReaderContext);
  if (!reader) {
    throw new Error("useReader must be used inside <SurahReader>");
  }
  return reader;
}

type SurahReaderProps = {
  locale: Locale;
  initialPreferences: ReadingPreferences;
  firstSection: number;
  children: ReactNode;
};

/**
 * Holds the surah page's state for its columns: the reader's preferences, the section in view,
 * and the open word popover. The preferences are data attributes on the wrapper, so the English
 * and pronunciation lines are shown or hidden with CSS, and the server renders the stored choice
 * from the cookie without a flash.
 */
export function SurahReader({
  locale,
  initialPreferences,
  firstSection,
  children,
}: SurahReaderProps) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [currentSection, setCurrentSection] = useState(firstSection);
  const [openWord, setOpenWord] = useState<OpenWord | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);

  const setPreference = useCallback((key: keyof ReadingPreferences, value: boolean) => {
    setPreferences((current) => ({ ...current, [key]: value }));
    document.cookie = preferenceCookie(key, value);
  }, []);

  // The current section is the last one whose top has passed a line a quarter down the window,
  // or the last section once the page is scrolled to the bottom.
  useEffect(() => {
    const sections = [...(wrapper.current?.querySelectorAll<HTMLElement>("[data-section]") ?? [])];
    if (sections.length === 0) {
      return;
    }
    let frame = 0;
    function update() {
      frame = 0;
      const line = window.innerHeight / 4;
      const atBottom =
        window.scrollY > 0 &&
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      const passed = sections.filter((section) => section.getBoundingClientRect().top <= line);
      const current = atBottom ? sections.at(-1) : (passed.at(-1) ?? sections[0]);
      setCurrentSection(Number(current?.dataset.section));
    }
    function schedule() {
      frame ||= requestAnimationFrame(update);
    }
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  const reader = useMemo(
    () => ({
      locale,
      preferences,
      setPreference,
      currentSection,
      setCurrentSection,
      openWord,
      setOpenWord,
    }),
    [locale, preferences, setPreference, currentSection, openWord],
  );

  return (
    <ReaderContext.Provider value={reader}>
      <div
        ref={wrapper}
        className="group/reader"
        data-show-english={preferences.showEnglish}
        data-show-pronunciation={preferences.showPronunciation}
      >
        {children}
      </div>
    </ReaderContext.Provider>
  );
}
