import { expect, test, type Page } from "@playwright/test";
import en from "../messages/en.json";
import ko from "../messages/ko.json";
import { fixtureBundle } from "./fixtures/content";
import {
  createTestUser,
  deleteTestUser,
  LOCAL_SUPABASE_SKIP_REASON,
  localSupabaseEnabled,
  restoreContent,
  seedContent,
  type TestUser,
} from "./local-supabase";

// The surah page with fixture content (e2e/fixtures/content.ts) seeded into a local Supabase.
// The tests share that database, so they run one at a time.
test.describe.configure({ mode: "serial" });

let user: TestUser;

test.beforeAll(async () => {
  test.skip(!localSupabaseEnabled, LOCAL_SUPABASE_SKIP_REASON);
  await seedContent(fixtureBundle());
  user = await createTestUser();
});

test.afterAll(async () => {
  if (localSupabaseEnabled) {
    restoreContent();
    if (user) {
      await deleteTestUser(user);
    }
  }
});

/** Logs in on the login page, which then opens `path`. */
async function openLoggedIn(page: Page, path: string) {
  await page.goto(`/en/login?next=${encodeURIComponent(path)}`);
  await page.getByLabel(en.auth.email).fill(user.email);
  await page.getByLabel(en.auth.password).fill(user.password);
  await page.getByRole("main").getByRole("button", { name: en.auth.login }).click();
  await expect(page).toHaveURL(path, { timeout: 15_000 });
}

const section = (page: Page, label: string) => page.getByRole("region", { name: label });

/** The word 1:1:1, which has a meaning (the first underlined "ابت" on the page). */
const firstWord = (page: Page) => page.getByRole("button", { name: "ابت" }).first();

test.describe("reading sections", () => {
  test("shows each section's verses and explanation, or that it is coming soon", async ({
    page,
  }) => {
    await openLoggedIn(page, "/en/surah/1");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("[Fixture surah 1]");
    const published = section(page, "1:1–2");
    await expect(published.getByRole("heading", { name: en.surah.meaning })).toBeVisible();
    await expect(published.getByText("[meaning 1 en]")).toBeVisible();
    await expect(published.getByText("[background 1 en]")).toBeVisible();
    await expect(published.getByText("[related 1 en]")).toBeVisible();
    // The explanation's word meanings part is only for the word popover.
    await expect(page.getByText("[word meanings part en]")).toHaveCount(0);

    const draft = section(page, "1:3");
    await expect(draft.getByText(en.surah.comingSoonTitle)).toBeVisible();
    await expect(draft.getByText("[meaning")).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: en.surah.readingSections }).getByRole("link", {
        name: `1:3 ${en.surah.inReview}`,
      }),
    ).toBeVisible();
  });

  test("links each citation to its source page and every related verse to the verse", async ({
    page,
  }) => {
    await openLoggedIn(page, "/en/surah/1");
    const published = section(page, "1:1–2");

    await expect(
      published.getByRole("link", { name: /^Source 1: \[Fixture source\], vol\. 1, p\. 10$/ }),
    ).toHaveAttribute("href", "/en/sources/fx-passage-1");
    await expect(
      published.getByRole("link", { name: /^Source 2: \[Fixture source\], on 1:2$/ }),
    ).toHaveAttribute("href", "/en/sources/fx-passage-2");
    await expect(published.getByRole("link", { name: `2:1 ${en.surah.seeVerse}` })).toHaveAttribute(
      "href",
      "/en/surah/2#verse-2-1",
    );
  });

  test("keeps the Listen button disabled until audio arrives", async ({ page }) => {
    await openLoggedIn(page, "/en/surah/1");
    await expect(
      section(page, "1:1–2").getByRole("button", { name: new RegExp(`^${en.surah.listen}`) }),
    ).toBeDisabled();
  });
});

test.describe("toggles", () => {
  test("the English explanation on Korean pages is off by default and the choice persists", async ({
    page,
  }) => {
    await openLoggedIn(page, "/ko/surah/1");
    const toggle = page.getByRole("switch", { name: ko.surah.showEnglish });
    const english = section(page, "1:1–2").getByText("[meaning 1 en]");

    await expect(page.getByText("[meaning 1 ko]")).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(english).toBeHidden();

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(english).toBeVisible();

    await page.reload();
    await expect(page.getByRole("switch", { name: ko.surah.showEnglish })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(english).toBeVisible();

    // Through English and back, and away and back through the navigation.
    await page.getByRole("link", { name: ko.header.languages.en }).click();
    await expect(page).toHaveURL("/en/surah/1");
    await expect(page.getByRole("switch", { name: en.surah.showEnglish })).toHaveCount(0);
    await page.getByRole("link", { name: en.header.languages.ko }).click();
    await expect(page).toHaveURL("/ko/surah/1");
    await expect(english).toBeVisible();

    await page.getByRole("banner").getByRole("link", { name: ko.header.home }).click();
    await page.getByRole("banner").getByRole("link", { name: ko.header.surah }).click();
    await expect(page).toHaveURL("/ko/surah/1");
    await expect(english).toBeVisible();
  });

  test("pronunciation shows the transliteration in the page's language, and the choice persists", async ({
    page,
  }) => {
    await openLoggedIn(page, "/en/surah/1");
    const toggle = page.getByRole("switch", { name: en.surah.showPronunciation });

    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText("[latin 1:1]")).toBeVisible();
    // 1:4 has a Hangul transliteration only, and 1:2's Latin one is a draft.
    await expect(page.getByText("[hangul 1:4]")).toHaveCount(0);
    await expect(section(page, "1:4–5").getByText(`${en.surah.pronunciation}:`)).toHaveCount(0);
    await expect(section(page, "1:3").getByText(`${en.surah.pronunciation}:`)).toHaveCount(0);

    await toggle.click();
    await expect(page.getByText("[latin 1:1]")).toBeHidden();
    await page.reload();
    await expect(page.getByRole("switch", { name: en.surah.showPronunciation })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await expect(page.getByText("[latin 1:1]")).toBeHidden();

    await page.getByRole("switch", { name: en.surah.showPronunciation }).click();
    await page.goto("/ko/surah/1");
    await expect(page.getByText("[hangul 1:4]")).toBeVisible();
    await expect(page.getByText("[latin 1:1]")).toHaveCount(0);
  });
});

test.describe("word popover", () => {
  test("hovering a word opens its popover, and moving away closes it", async ({ page }) => {
    await openLoggedIn(page, "/en/surah/1");
    const word = firstWord(page);

    await word.hover();
    const popover = page.getByRole("dialog");
    await expect(popover).toBeVisible();
    await expect(word).toHaveAttribute("aria-expanded", "true");
    await expect(word).not.toBeFocused();

    await page.mouse.move(5, 5);
    await expect(popover).toBeHidden();
  });

  test("shows the meaning in this verse, the root's meanings elsewhere, and the sources", async ({
    page,
  }) => {
    await openLoggedIn(page, "/en/surah/1");
    await firstWord(page).click();
    const popover = page.getByRole("dialog");

    await expect(popover.getByText("[meaning of 1:1:1 en]")).toBeVisible();
    await expect(popover.getByText(en.surah.word.elsewhere)).toBeVisible();
    await expect(popover.getByText("[meaning of 2:1:1 en]")).toBeVisible();
    await expect(popover.getByRole("link", { name: "2:1" })).toHaveAttribute(
      "href",
      "/en/surah/2#verse-2-1",
    );
    await expect(
      popover.getByRole("link", { name: "[Fixture source], vol. 1, p. 10" }),
    ).toHaveAttribute("href", "/en/sources/fx-passage-1");
  });

  test("opens from the keyboard, moves focus inside, and Escape returns focus", async ({
    page,
  }) => {
    await openLoggedIn(page, "/en/surah/1");
    const word = firstWord(page);

    await word.focus();
    await page.keyboard.press("Enter");
    const popover = page.getByRole("dialog");
    await expect(popover).toBeVisible();
    await expect(popover.getByRole("button", { name: en.surah.word.close })).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(popover).toBeHidden();
    await expect(word).toBeFocused();

    await page.keyboard.press("Space");
    await expect(popover).toBeVisible();
  });

  test("the close button closes it and returns focus to the word", async ({ page }) => {
    await openLoggedIn(page, "/en/surah/1");
    const word = firstWord(page);

    await word.click();
    await page.getByRole("dialog").getByRole("button", { name: en.surah.word.close }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(word).toBeFocused();
  });

  test("only words with a meaning open a popover", async ({ page }) => {
    await openLoggedIn(page, "/en/surah/1");
    // Each verse has four words; only 1:1:1 and 1:2:2 have a meaning.
    await expect(page.locator('[aria-haspopup="dialog"]')).toHaveCount(2);
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("sections are a dropdown, questions sit under each section, and a tap opens a word", async ({
    page,
  }) => {
    await openLoggedIn(page, "/ko/surah/1");

    await expect(page.getByRole("navigation", { name: ko.surah.readingSections })).toBeHidden();
    const dropdown = page.getByRole("combobox", { name: ko.surah.readingSections });
    await dropdown.selectOption({ label: `1:3 · ${ko.surah.inReview}` });
    await expect(page).toHaveURL(/#section-2$/);

    await expect(page.getByRole("complementary")).toBeHidden();
    await expect(section(page, "1:1–2").getByRole("heading", { name: ko.qa.title })).toBeVisible();
    await expect(section(page, "1:1–2").getByLabel(ko.qa.askLabel)).toBeDisabled();
    // A section without a published explanation has no questions yet.
    await expect(section(page, "1:3").getByRole("heading", { name: ko.qa.title })).toHaveCount(0);

    await firstWord(page).tap();
    const popover = page.getByRole("dialog");
    await expect(popover.getByText("[meaning of 1:1:1 ko]")).toBeVisible();
    await popover.getByRole("button", { name: ko.surah.word.close }).tap();
    await expect(popover).toBeHidden();
  });
});

test("the questions panel follows the section in view", async ({ page }) => {
  await openLoggedIn(page, "/en/surah/1");
  const panel = page.getByRole("complementary");

  await expect(panel.getByRole("heading", { name: en.qa.title })).toBeVisible();
  await expect(panel.getByText("Reading now: 1:1–2")).toBeVisible();
  await expect(panel.getByLabel(en.qa.askLabel)).toBeDisabled();

  await page
    .getByRole("navigation", { name: en.surah.readingSections })
    .getByRole("link", { name: /^1:4–5/ })
    .click();
  await expect(panel.getByText("Reading now: 1:4–5")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: en.surah.readingSections }).getByRole("link", {
      name: /^1:4–5/,
    }),
  ).toHaveAttribute("aria-current", "location");
});
