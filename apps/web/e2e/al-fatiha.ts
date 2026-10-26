import { expect, type Page } from "@playwright/test";
import type en from "../messages/en.json";
import { expectNoBrokenLinks } from "./links";

type Messages = typeof en;

/** Al-Fatiha's four reading sections, all published (#35). */
const SECTIONS = 4;

/**
 * What a logged-in reader sees on the published Al-Fatiha page during user testing: the review
 * note at the top, every section's explanation with its sources, and the feedback button (or, while
 * no form is set, "Feedback form coming soon"). Source chips open Shamela or link nowhere, and no
 * link on the page leads to a 404 (#37). Shared by the real-account and smoke runs, which read the
 * real content.
 */
export async function expectPublishedAlFatiha(page: Page, messages: Messages) {
  const note = page.getByRole("note");
  await expect(note).toContainText(messages.surah.reviewNote.status);
  await expect(note).toContainText(messages.surah.reviewNote.feedback);

  const sections = page.getByRole("navigation", { name: messages.surah.readingSections });
  await expect(sections.getByRole("link")).toHaveCount(SECTIONS);
  await expect(page.getByText(messages.surah.comingSoonTitle)).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: messages.surah.meaning, exact: true }),
  ).toHaveCount(SECTIONS);
  // Source chips are named "Source 1: …" / "출처 1: …": as a link to Shamela, or, without a link,
  // in their screen-reader text.
  const sourceName = new RegExp(`^${messages.surah.sourceLabel.split("{number}")[0]}\\d+: `);
  const links = page.getByRole("link", { name: sourceName });
  expect(await links.or(page.getByText(sourceName)).count()).toBeGreaterThanOrEqual(SECTIONS);
  for (const href of await links.evaluateAll((all) => all.map((a) => a.getAttribute("href")))) {
    expect(href).toMatch(/^https:\/\/shamela\.ws\//);
  }
  await expectNoBrokenLinks(page, sourceName);

  const feedback = page
    .getByRole("link", { name: new RegExp(messages.surah.feedback.button) })
    .or(page.getByText(messages.surah.feedback.comingSoon))
    .filter({ visible: true });
  await expect(feedback).toHaveCount(1);
}
