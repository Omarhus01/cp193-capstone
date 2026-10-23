import { stripLocale, type Locale } from "@/i18n/locale";

/** Path prefixes (without the locale) that require a logged-in user. */
const PROTECTED_PREFIXES = ["/surah"];

/** The login and signup pages (without the locale). */
const AUTH_PATHS = ["/login", "/signup"];

export function isProtectedPath(pathname: string): boolean {
  const { path } = stripLocale(pathname);
  return PROTECTED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** The login page URL that sends the user back to `nextPath` after logging in. */
export function loginRedirectPath(locale: Locale, nextPath: string): string {
  return `/${locale}/login?next=${encodeURIComponent(nextPath)}`;
}

/**
 * Returns `next` when it is a path on this site under a known locale, and the locale's home page
 * otherwise. This stops a crafted `?next=` link from redirecting users to another site.
 */
export function safeNextPath(next: unknown, locale: Locale): string {
  const home = `/${locale}`;
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) {
    return home;
  }
  // Browsers treat "\" like "/" and drop control characters, so "/\evil.com" could leave the site.
  if (/[\\\u0000-\u001f]/.test(next)) {
    return home;
  }
  return stripLocale(next).locale ? next : home;
}

/**
 * The `next` value for the header's Log in and Sign up links: the page the user is on, so they
 * come back to it. On the login and signup pages themselves, the existing `?next=` is kept.
 */
export function authLinkNextPath(
  pathname: string,
  searchParams: URLSearchParams,
  locale: Locale,
): string {
  if (AUTH_PATHS.includes(stripLocale(pathname).path)) {
    return safeNextPath(searchParams.get("next"), locale);
  }
  const search = searchParams.toString();
  return safeNextPath(search ? `${pathname}?${search}` : pathname, locale);
}

/** Where to go after logging out from `currentPath`: home from a protected page, else stay. */
export function logoutRedirectPath(currentPath: unknown, locale: Locale): string {
  const path = safeNextPath(currentPath, locale);
  return isProtectedPath(path.split("?")[0]) ? `/${locale}` : path;
}
