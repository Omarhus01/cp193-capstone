// The reader's choices on the surah page, kept in cookies so they survive reloads, navigation and
// the language switch, and so the server renders the page in the chosen state (ADR 0014).

export type ReadingPreferences = {
  /** Korean pages: show the English explanation under the Korean. */
  showEnglish: boolean;
  /** Show the transliteration line under the Arabic, when the content has one. */
  showPronunciation: boolean;
};

export const DEFAULT_PREFERENCES: ReadingPreferences = {
  showEnglish: false,
  showPronunciation: true,
};

export const PREFERENCE_COOKIES = {
  showEnglish: "qe-show-english",
  showPronunciation: "qe-show-pronunciation",
} as const satisfies Record<keyof ReadingPreferences, string>;

const ONE_YEAR = 60 * 60 * 24 * 365;

/** Reads the preferences from cookie values ("1" or "0"); anything else keeps the default. */
export function parsePreferences(cookie: (name: string) => string | undefined): ReadingPreferences {
  const read = (key: keyof ReadingPreferences) => {
    const value = cookie(PREFERENCE_COOKIES[key]);
    return value === "1" ? true : value === "0" ? false : DEFAULT_PREFERENCES[key];
  };
  return { showEnglish: read("showEnglish"), showPronunciation: read("showPronunciation") };
}

/** The document.cookie string that stores one preference for a year. */
export function preferenceCookie(key: keyof ReadingPreferences, value: boolean): string {
  return `${PREFERENCE_COOKIES[key]}=${value ? 1 : 0}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax`;
}
