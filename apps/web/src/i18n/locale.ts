import { routing } from "./routing";

export type Locale = (typeof routing.locales)[number];

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (routing.locales as readonly string[]).includes(value);
}

/** Splits "/ko/surah/2" into { locale: "ko", path: "/surah/2" }. Locale is null when the path has none. */
export function stripLocale(pathname: string): { locale: Locale | null; path: string } {
  const [, first, ...rest] = pathname.split("/");
  if (!isLocale(first)) {
    return { locale: null, path: pathname || "/" };
  }
  return { locale: first, path: `/${rest.join("/")}` };
}
