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

  // The current section is the first one crossing a band near the top of the window.
  useEffect(() => {
    const sections = wrapper.current?.querySelectorAll<HTMLElement>("[data-section]") ?? [];
    const visible = new Set<number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const position = Number((entry.target as HTMLElement).dataset.section);
          if (entry.isIntersecting) {
            visible.add(position);
          } else {
            visible.delete(position);
          }
        }
        if (visible.size > 0) {
          setCurrentSection(Math.min(...visible));
        }
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
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
