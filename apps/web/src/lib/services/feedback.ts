/**
 * The user-testing feedback form, from NEXT_PUBLIC_FEEDBACK_URL (set in Vercel, docs/deploy.md), or
 * null while there is none. Only an http(s) URL counts, so a typo can't become a broken or unsafe
 * link. Next.js builds the value into the site, so a change needs a new deploy.
 */
export function feedbackFormUrl(
  value: string | undefined = process.env.NEXT_PUBLIC_FEEDBACK_URL,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const { protocol } = new URL(trimmed);
    return protocol === "https:" || protocol === "http:" ? trimmed : null;
  } catch {
    return null;
  }
}
