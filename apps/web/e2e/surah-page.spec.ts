import { expect, test, type Locator, type Page } from "@playwright/test";
import en from "../messages/en.json";
import ko from "../messages/ko.json";
import { FIXTURE_NARRATOR, FIXTURE_PASSAGE_URL, fixtureBundle } from "./fixtures/content";
import { expectNoBrokenLinks } from "./links";
import { E2E_FEEDBACK_URL } from "../playwright.config";
import {
  createTestUser,
  createUnconfirmedUser,
  deleteTestUser,
  assertLocalTestServer,
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
  // The tests log in through the app: its server must use the same local Supabase.
  await assertLocalTestServer(test.info().project.use.baseURL);
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

/** Checks that an element lies within the window's width, so nothing is cut off at the side. */
async function expectInsideWindow(page: Page, element: Locator) {
  const box = (await element.boundingBox())!;
  const width = page.viewportSize()!.width;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);
}

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
    await expect(published.getByText("[meaning 1b en]")).toBeVisible();
    await expect(published.getByText("[background 1 en]")).toBeVisible();
    // The explanation's word meanings part is only for the word popover.
    await expect(page.getByText("[word meanings part en]")).toHaveCount(0);

    // Bold and italic are rendered, and no Markdown marks show.
    await expect(published.locator("strong", { hasText: "bold" })).toBeVisible();
    await expect(published.locator("em", { hasText: "italic" })).toBeVisible();
    await expect(page.getByText(/\*\*/)).toHaveCount(0);

    // The brief, paragraph by paragraph, each with its sources.
    await expect(page.getByText("[brief 1 en]")).toBeVisible();
    await expect(page.getByText("[brief 2 en]")).toBeVisible();

    const draft = section(page, "1:3");
    await expect(draft.getByText(en.surah.comingSoonTitle)).toBeVisible();
    await expect(draft.getByText("[meaning")).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: en.surah.readingSections }).getByRole("link", {
        name: `1:3 ${en.surah.inReview}`,
      }),
    ).toBeVisible();
  });

  test("ends each point with its own sources, naming who a source quotes", async ({ page }) => {
    await openLoggedIn(page, "/en/surah/1");
    const published = section(page, "1:1–2");
    const book = "[Fixture author], [Fixture source] ([Fixture edition])";
    const newTab = en.surah.feedback.newTab;
    const point = (text: string) => published.getByRole("listitem").filter({ hasText: text });

    // A passage with a link: the chip opens it in a new tab, named by the full citation.
    const first = point("[meaning 1a en]");
    const linked = first.getByRole("link", { name: `Source 1: ${book}, vol. 1, p. 10 ${newTab}` });
    await expect(linked).toHaveAttribute("href", FIXTURE_PASSAGE_URL);
    await expect(linked).toHaveAttribute("target", "_blank");
    await expect(linked).toHaveAttribute("rel", "noopener noreferrer");
    await expect(linked).toHaveAttribute("title", `${book}, vol. 1, p. 10`);
    await expect(linked).toHaveText("Source 1");

    // A passage without a link: the chip cites it and links nowhere.
    const unlinked = first.getByTitle(`${FIXTURE_NARRATOR}, via ${book}, on 1:2`);
    await expect(unlinked).toBeVisible();
    await expect(unlinked).toContainText(`Source 2: ${FIXTURE_NARRATOR}, via ${book}, on 1:2`);
    await expect(first.getByRole("link", { name: /^Source / })).toHaveCount(1);

    // A passage keeps its number across the explanation.
    await expect(point("[meaning 1b en]").getByTitle(`${book}, on 1:2`)).toContainText("Source 2");
    await expect(
      point("[background 1 en]").getByRole("link", { name: new RegExp(`^Source 1: `) }),
    ).toHaveAttribute("href", FIXTURE_PASSAGE_URL);
  });

  test("no link on the page leads to a page that isn't built", async ({ page }) => {
    await openLoggedIn(page, "/en/surah/1");
    // With the word popover open, so its source links count too.
    await firstWord(page).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoBrokenLinks(page, /^Source \d+: /);
  });

  test("shows related verses as text, and as links once that verse is imported", async ({
    page,
  }) => {
    await openLoggedIn(page, "/en/surah/1");
    const published = section(page, "1:1–2");

    // 2:1 is in the database, so its reference is a link.
    await expect(published.getByRole("link", { name: `2:1 ${en.surah.seeVerse}` })).toHaveAttribute(
      "href",
      "/en/surah/2#verse-2-1",
    );
    await expect(published.getByText("[why 2:1 en]")).toBeVisible();
    // Surah 40 isn't imported: the reference is text, with its reason and sources.
    const notImported = published.getByRole("listitem").filter({ hasText: "40:6" });
    await expect(notImported).toContainText("40:6: [why 40:6 en]");
    await expect(notImported.getByRole("link", { name: /40:6/ })).toHaveCount(0);
    await expect(notImported.getByText(/^Source 2: /)).toHaveCount(1);
  });

  test("keeps the Listen button disabled until audio arrives", async ({ page }) => {
    await openLoggedIn(page, "/en/surah/1");
    await expect(
      section(page, "1:1–2").getByRole("button", { name: new RegExp(`^${en.surah.listen}`) }),
    ).toBeDisabled();
  });
});

test.describe("a surah holding only some of its verses", () => {
  test("shows only those verses, says how many, and moves between its sections", async ({
    page,
  }) => {
    await openLoggedIn(page, "/en/surah/4");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("[Fixture surah 4]");
    await expect(page.getByText("Showing 2 of 176 verses")).toBeVisible();
    await expect(page.locator("#verse-4-34")).toBeVisible();
    await expect(page.locator("#verse-4-35")).toBeVisible();
    await expect(page.locator("[id^='verse-4-']")).toHaveCount(2);

    await expect(section(page, "4:34").getByText("[meaning 4:34 en]")).toBeVisible();
    await expect(section(page, "4:34").getByText("Reading section 1 of 2")).toBeVisible();
    await expect(section(page, "4:35").getByText(en.surah.comingSoonTitle)).toBeVisible();

    const nav = page.getByRole("navigation", { name: en.surah.readingSections });
    await nav.getByRole("link", { name: /^4:35/ }).click();
    await expect(page).toHaveURL(/#section-2$/);
    await expect(nav.getByRole("link", { name: /^4:35/ })).toHaveAttribute(
      "aria-current",
      "location",
    );
  });

  test("says how many verses it shows in Korean", async ({ page }) => {
    await openLoggedIn(page, "/ko/surah/4");
    await expect(page.getByText("전체 176절 중 2절 표시")).toBeVisible();
  });

  test("a complete surah doesn't say how many it shows", async ({ page }) => {
    await openLoggedIn(page, "/en/surah/1");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("[Fixture surah 1]");
    await expect(page.getByText(/^Showing \d+ of/)).toHaveCount(0);
  });
});

test.describe("verses with no explanation yet (ADR 0025)", () => {
  test("show in blocks by mushaf page, each saying the explanation is coming soon", async ({
    page,
  }) => {
    await openLoggedIn(page, "/en/surah/2");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("[Fixture surah 2]");
    const first = section(page, "Page 3 · 2:1–2");
    const second = section(page, "Page 4 · 2:3");
    await expect(first.locator("[id^='verse-2-']")).toHaveCount(2);
    await expect(second.locator("[id^='verse-2-']")).toHaveCount(1);
    await expect(first.getByText(en.surah.comingSoonLine)).toBeVisible();
    await expect(second.getByText(en.surah.comingSoonLine)).toBeVisible();
    await expect(page.getByText(/^Reading section \d+ of/)).toHaveCount(0);

    const nav = page.getByRole("navigation", { name: en.surah.readingSections });
    await expect(nav.getByRole("link")).toHaveCount(2);
    await expect(nav.getByText(en.surah.inReview)).toHaveCount(0);
    await nav.getByRole("link", { name: /^Page 4 · 2:3/ }).click();
    await expect(page).toHaveURL(/#section-2$/);
  });

  test("Korean pages name the blocks by page too", async ({ page }) => {
    await openLoggedIn(page, "/ko/surah/2");
    await expect(section(page, "3쪽 · 2:1–2").getByText(ko.surah.comingSoonLine)).toBeVisible();
  });

  test("a surah with no Korean name is titled by its number, with the English name", async ({
    page,
  }) => {
    await openLoggedIn(page, "/ko/surah/2");
    const title = page.getByRole("heading", { level: 1 });
    await expect(title).toHaveText("수라 2[Fixture surah 2]");
    await expect(title.locator("[lang='en']")).toHaveText("[Fixture surah 2]");
    // The number isn't repeated as a chip under the title.
    await expect(page.getByRole("listitem").filter({ hasText: /^수라 2$/ })).toHaveCount(0);
  });

  test("a surah with a Korean name keeps it as the title", async ({ page }) => {
    await openLoggedIn(page, "/ko/surah/1");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "[픽스처 수라 1][Fixture surah 1]",
    );
    await expect(page.getByRole("listitem").filter({ hasText: /^수라 1$/ })).toHaveCount(1);
  });
});

test.describe("the home page's list of surahs", () => {
  // Other spec files open the home page in parallel, maybe before the fixtures are seeded, and the
  // server keeps published content cached; it refreshes an entry in the background once it is a
  // minute old (ADR 0014). So the first test reloads until the list shows the fixtures.
  test.describe.configure({ timeout: 150_000 });

  /** The list on the home page in `locale`, once it shows the fixture surahs. */
  async function fixtureSurahList(page: Page, locale: "en" | "ko") {
    const messages = locale === "en" ? en : ko;
    const list = page.getByRole("region", { name: messages.home.surahsTitle });
    await expect(async () => {
      await page.goto(`/${locale}`);
      await expect(list.getByRole("link")).toHaveCount(3, { timeout: 1_000 });
      await expect(list.getByRole("link").first()).toContainText(
        locale === "en" ? "1. [Fixture surah 1]" : "1. [픽스처 수라 1]",
        { timeout: 1_000 },
      );
    }).toPass({ timeout: 120_000, intervals: [2_000, 5_000] });
    return list;
  }

  test("lists every surah in the database, with the verses a partial one holds", async ({
    page,
  }) => {
    const links = (await fixtureSurahList(page, "en")).getByRole("link");
    await expect(links).toHaveCount(3);
    await expect(links.nth(0)).toContainText("1. [Fixture surah 1]");
    await expect(links.nth(0)).toHaveAttribute("href", "/en/surah/1");
    // Surah 2 has no reading sections: it is listed all the same.
    await expect(links.nth(1)).toContainText("2. [Fixture surah 2]");
    await expect(links.nth(2)).toContainText("4. [Fixture surah 4] 4:34–35");
    await expect(links.nth(2)).toHaveAttribute("href", "/en/surah/4");
    await expect(links.nth(2).locator("[lang='ar']")).toHaveText("اختبار");
  });

  test("names the surahs in Korean on Korean pages, else in English", async ({ page }) => {
    const links = (await fixtureSurahList(page, "ko")).getByRole("link");
    await expect(links.nth(1)).toContainText("2. [Fixture surah 2]");
    await expect(links.nth(2)).toContainText("4. [픽스처 수라 4] 4:34–35");
    await expect(links.nth(2)).toHaveAttribute("href", "/ko/surah/4");
  });

  test("a surah in the list opens its page", async ({ page }) => {
    await openLoggedIn(page, "/en");
    const list = await fixtureSurahList(page, "en");
    await list.getByRole("link", { name: /^4\. \[Fixture surah 4\]/ }).click();
    await expect(page).toHaveURL("/en/surah/4");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("[Fixture surah 4]");
  });
});

/** The links to the surahs before and after, in the header or at the end of the page. */
const pager = (page: Page, where: "header" | "end" = "header") =>
  page.getByRole("navigation", {
    name: where === "header" ? en.surah.pager.label : en.surah.pager.labelEnd,
    exact: true,
  });

/**
 * Opens a fixture surah once the server's cached list of surahs holds the fixtures (1, 2 and 4):
 * the list may still be the one from before they were seeded (see the home page's list above).
 */
async function openWithFixtureList(page: Page, path: string) {
  await openLoggedIn(page, path);
  await expect(async () => {
    await page.goto(path.replace(/\/surah\/\d+$/, "/surah/2"));
    await expect(
      pager(page).getByRole("link", { name: new RegExp(`^${en.surah.pager.next}`) }),
    ).toHaveAttribute("href", "/en/surah/4", { timeout: 1_000 });
  }).toPass({ timeout: 120_000, intervals: [2_000, 5_000] });
  await page.goto(path);
}

test.describe("moving between surahs (issue 6)", () => {
  test.describe.configure({ timeout: 150_000 });

  test("the previous and next links follow the surahs on the site, skipping missing ones", async ({
    page,
  }) => {
    await openWithFixtureList(page, "/en/surah/2");
    for (const where of ["header", "end"] as const) {
      const links = pager(page, where).getByRole("link");
      await expect(links).toHaveCount(2);
      await expect(links.nth(0)).toHaveText(`${en.surah.pager.previous}1. [Fixture surah 1]اختبار`);
      await expect(links.nth(0)).toHaveAttribute("href", "/en/surah/1");
      // Surah 3 isn't in the fixtures, so the next surah is 4.
      await expect(links.nth(1)).toHaveText(`${en.surah.pager.next}4. [Fixture surah 4]اختبار`);
      await expect(links.nth(1)).toHaveAttribute("href", "/en/surah/4");
    }

    // The first surah has no previous one, and the last on the site no next one.
    await page.goto("/en/surah/1");
    await expect(pager(page).getByRole("link")).toHaveCount(1);
    await pager(page)
      .getByRole("link", { name: new RegExp(`^${en.surah.pager.next}`) })
      .click();
    await expect(page).toHaveURL("/en/surah/2");
    await page.goto("/en/surah/4");
    await expect(pager(page).getByRole("link")).toHaveCount(1);
    await expect(pager(page).getByRole("link")).toHaveAttribute("href", "/en/surah/2");
  });

  test("the header's switcher finds a surah by number or name and opens it", async ({ page }) => {
    await openWithFixtureList(page, "/en/surah/1");
    const button = page.getByRole("button", { name: en.surah.switcher.open });
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");

    const search = page.getByRole("searchbox", { name: en.surah.switcher.searchLabel });
    await expect(search).toBeFocused();
    const panel = page.locator(`#${await button.getAttribute("aria-controls")}`);
    const results = panel.getByRole("link");
    await expect(results).toHaveCount(3);
    await expect(panel.getByText("3 surahs")).toBeVisible();
    // The page's own surah is marked.
    await expect(results.nth(0)).toHaveAttribute("aria-current", "page");
    await expect(results.nth(0)).toHaveText("1. [Fixture surah 1]اختبار");

    await search.fill("4");
    await expect(results).toHaveCount(1);
    await expect(panel.getByText("1 surah", { exact: true })).toBeVisible();
    await search.fill("fixture SURAH 2");
    await expect(results).toHaveText(["2. [Fixture surah 2]اختبار"]);
    // The Arabic name, typed with a vowel mark the stored name doesn't have.
    await search.fill("اِختبار");
    await expect(results).toHaveCount(3);
    await search.fill("zzz");
    await expect(results).toHaveCount(0);
    await expect(panel.getByText("No surah matches")).toBeVisible();

    await search.fill("4");
    await results.first().click();
    await expect(page).toHaveURL("/en/surah/4");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("[Fixture surah 4]");
    await expect(page.getByRole("searchbox", { name: en.surah.switcher.searchLabel })).toHaveCount(
      0,
    );
  });

  test("the switcher finds a surah by its Korean name on Korean pages", async ({ page }) => {
    await openWithFixtureList(page, "/en/surah/1");
    await page.goto("/ko/surah/1");
    await page.getByRole("button", { name: ko.surah.switcher.open }).click();
    await page
      .getByRole("searchbox", { name: ko.surah.switcher.searchLabel })
      .fill("픽스처 수라 4");
    const result = page.getByRole("link", { name: /^4\. \[픽스처 수라 4\]/ });
    await expect(result).toBeVisible();
    await result.click();
    await expect(page).toHaveURL("/ko/surah/4");
  });

  test("the switcher works from the keyboard alone", async ({ page }) => {
    await openWithFixtureList(page, "/en/surah/1");
    const button = page.getByRole("button", { name: en.surah.switcher.open });

    // Escape closes it and puts focus back on the button.
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("searchbox", { name: en.surah.switcher.searchLabel }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("searchbox", { name: en.surah.switcher.searchLabel })).toHaveCount(
      0,
    );
    await expect(button).toBeFocused();

    // Type, go down to the results, and open one.
    await page.keyboard.press("Enter");
    await page.keyboard.type("2");
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("link", { name: /^2\. \[Fixture surah 2\]/ })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/en/surah/2");
  });

  test("a press outside closes the switcher", async ({ page }) => {
    await openWithFixtureList(page, "/en/surah/1");
    await page.getByRole("button", { name: en.surah.switcher.open }).click();
    await expect(
      page.getByRole("searchbox", { name: en.surah.switcher.searchLabel }),
    ).toBeVisible();
    // The panel covers the title, so press on a section further down.
    await section(page, "1:4–5").getByRole("heading", { name: "1:4–5" }).click();
    await expect(page.getByRole("searchbox", { name: en.surah.switcher.searchLabel })).toHaveCount(
      0,
    );
  });
});

test.describe("toggles", () => {
  test("the English explanation on Korean pages is off by default and the choice persists", async ({
    page,
  }) => {
    await openLoggedIn(page, "/ko/surah/1");
    const toggle = page.getByRole("switch", { name: ko.surah.showEnglish });
    const english = section(page, "1:1–2").getByText("[meaning 1b en]");

    await expect(page.getByText("[meaning 1b ko]")).toBeVisible();
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

  test("shows the meaning in this verse, the owner's elsewhere notes, and the sources", async ({
    page,
  }) => {
    await openLoggedIn(page, "/en/surah/1");
    await firstWord(page).click();
    const popover = page.getByRole("dialog");
    const book = "[Fixture author], [Fixture source] ([Fixture edition])";

    await expect(popover.getByText("[meaning of 1:1:1 en]")).toBeVisible();
    await expect(popover.getByText(en.surah.word.elsewhere)).toBeVisible();
    // A note on an imported verse links to it and shows its Arabic; a usage note has no verse.
    await expect(popover.getByText("[elsewhere in 2:1 en]")).toBeVisible();
    await expect(popover.getByRole("link", { name: "2:1" })).toHaveAttribute(
      "href",
      "/en/surah/2#verse-2-1",
    );
    await expect(popover.locator('[lang="ar"]', { hasText: "ابت ثجح خدذ رزس" })).toBeVisible();
    await expect(popover.getByText("[usage note en]")).toBeVisible();
    // The root lookup is gone: another word's meaning with the same root isn't listed.
    await expect(popover.getByText("[meaning of 2:1:1 en]")).toHaveCount(0);

    // A source with a link opens it in a new tab; one without is cited as text.
    const linked = popover.getByRole("link", {
      name: `${book}, vol. 1, p. 10 ${en.surah.feedback.newTab}`,
    });
    await expect(linked).toHaveAttribute("href", FIXTURE_PASSAGE_URL);
    await expect(linked).toHaveAttribute("target", "_blank");
    await expect(popover.getByText(`${FIXTURE_NARRATOR}, via ${book}, on 1:2`)).toBeVisible();
    await expect(popover.getByRole("link").filter({ hasText: FIXTURE_NARRATOR })).toHaveCount(0);
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

test.describe("note and feedback for user testing", () => {
  for (const [locale, messages] of [
    ["en", en],
    ["ko", ko],
  ] as const) {
    test(`the note at the top tells every reader about the review (${locale})`, async ({
      page,
    }) => {
      await openLoggedIn(page, `/${locale}/surah/1`);
      const note = page.getByRole("note");
      await expect(note).toContainText(messages.surah.reviewNote.status);
      await expect(note).toContainText(messages.surah.reviewNote.feedback);
      // Above the reading: before the surah's heading.
      const noteBox = await note.boundingBox();
      const headingBox = await page.getByRole("heading", { level: 1 }).boundingBox();
      expect(noteBox!.y).toBeLessThan(headingBox!.y);
    });
  }

  test("on a wide screen, the feedback button stays in the right column", async ({ page }) => {
    await openLoggedIn(page, "/en/surah/1");
    const button = page
      .getByRole("complementary")
      .getByRole("link", { name: `${en.surah.feedback.button} ${en.surah.feedback.newTab}` });
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute("href", E2E_FEEDBACK_URL);
    await expect(button).toHaveAttribute("target", "_blank");
    await expect(button).toHaveAttribute("rel", "noopener noreferrer");
    // The phone copy at the end of the page is hidden: this is the only one shown.
    await expect(
      page.getByRole("link", { name: new RegExp(en.surah.feedback.button) }),
    ).toHaveCount(1);

    // Still in view after scrolling to the last section.
    await section(page, "1:4–5").scrollIntoViewIfNeeded();
    await expect(button).toBeInViewport();
  });
});

test.describe("confirming an email", () => {
  test("the link from the email works in a browser other than the one that signed up", async ({
    browser,
  }) => {
    const { user: confirmed, tokenHash } = await createUnconfirmedUser();
    // A fresh browser: no PKCE verifier from a sign-up, as when the email opens in a phone's mail app.
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      const next = encodeURIComponent("/ko/surah/1");
      await page.goto(`/auth/confirm?token_hash=${tokenHash}&type=email&locale=ko&next=${next}`);
      await expect(page).toHaveURL(/\/ko\/surah\/1$/, { timeout: 15_000 });
      await expect(
        page.getByRole("banner").getByRole("button", { name: ko.header.account }),
      ).toBeVisible();
      await expect(page.getByRole("note")).toContainText(ko.surah.reviewNote.status);
    } finally {
      await context.close();
      await deleteTestUser(confirmed);
    }
  });

  test("a used or wrong token lands on the login page, which suggests logging in", async ({
    page,
  }) => {
    await page.goto("/auth/confirm?token_hash=not-a-real-token&type=email&locale=ko");
    await expect(page).toHaveURL(/\/ko\/login\?error=confirmFailed$/);
    await expect(page.getByText(ko.auth.errors.confirmFailed)).toBeVisible();
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
    // Each section lists its own questions; tapping one opens its answer.
    const questions = section(page, "1:1–2").getByRole("list", { name: ko.qa.questionsLabel });
    await questions.getByRole("button", { name: "[question 1 ko]" }).tap();
    await expect(questions.getByText("[answer 1 ko]")).toBeVisible();
    await expect(
      section(page, "1:4–5").getByRole("button", { name: "[question 3 ko]" }),
    ).toBeAttached();

    await firstWord(page).tap();
    const popover = page.getByRole("dialog");
    await expect(popover.getByText("[meaning of 1:1:1 ko]")).toBeVisible();
    await popover.getByRole("button", { name: ko.surah.word.close }).tap();
    await expect(popover).toBeHidden();
  });

  test("the surah switcher and the previous and next links fit a narrow screen", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await openWithFixtureList(page, "/en/surah/2");
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 800 });
      await expectInsideWindow(page, pager(page));
      await page.getByRole("button", { name: en.surah.switcher.open }).tap();
      const search = page.getByRole("searchbox", { name: en.surah.switcher.searchLabel });
      await expect(search).toBeVisible();
      await expectInsideWindow(page, search.locator(".."));
      await page.getByRole("button", { name: en.surah.switcher.open }).tap();
      await expect(search).toHaveCount(0);
    }
  });

  // Testers saw the word box run past the screen's edge (issue 66). It did with the phone's text
  // set large: the word beside the close button couldn't shrink. The page's text is doubled here.
  test("the word box stays inside a narrow screen, even with large text", async ({ page }) => {
    await openLoggedIn(page, "/en/surah/1");
    await page.setViewportSize({ width: 320, height: 800 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    // Opened from the keyboard: at this size a tap's target point, the middle of the word's tall
    // line, falls on the section around it. Tapping is tested above.
    await firstWord(page).focus();
    await page.keyboard.press("Enter");
    const popover = page.getByRole("dialog");
    await expect(popover).toBeVisible();
    await expectInsideWindow(page, popover);
    const box = (await popover.boundingBox())!;
    const close = (await popover.getByRole("button", { name: en.surah.word.close }).boundingBox())!;
    expect(close.x + close.width).toBeLessThanOrEqual(box.x + box.width);
    // The row above the verses (label, Listen button, section count) wraps too.
    await expectInsideWindow(
      page,
      section(page, "1:1–2").getByRole("button", { name: new RegExp(`^${en.surah.listen}`) }),
    );
  });

  test("the feedback button comes at the end of the page", async ({ page }) => {
    await openLoggedIn(page, "/ko/surah/1");
    // The right column is hidden, so this is the only one shown.
    const button = page.getByRole("link", {
      name: `${ko.surah.feedback.button} ${ko.surah.feedback.newTab}`,
    });
    await expect(button).toHaveCount(1);
    await expect(button).toHaveAttribute("href", E2E_FEEDBACK_URL);
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeVisible();
    // After the last section.
    const last = await section(page, "1:4–5").boundingBox();
    expect((await button.boundingBox())!.y).toBeGreaterThan(last!.y + last!.height);
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

test("the questions panel lists the section's questions and opens each answer with its sources", async ({
  page,
}) => {
  await openLoggedIn(page, "/en/surah/1");
  const panel = page.getByRole("complementary");
  const questions = panel.getByRole("list", { name: en.qa.questionsLabel });
  const book = "[Fixture author], [Fixture source] ([Fixture edition])";
  const first = questions.getByRole("button", { name: "[question 1 en]" });
  const second = questions.getByRole("button", { name: "[question 2 en]" });

  await expect(questions.getByRole("button")).toHaveCount(2);
  await expect(first).toHaveAttribute("aria-expanded", "false");
  await expect(panel.getByText("[answer 1 en]")).toBeHidden();

  // The answer ends with its sources: a chip that opens the cited pages in a new tab.
  await first.click();
  await expect(first).toHaveAttribute("aria-expanded", "true");
  await expect(panel.getByText("[answer 1 en]")).toBeVisible();
  const chip = panel.getByRole("link", {
    name: `Source 1: ${book}, vol. 1, p. 10 ${en.surah.feedback.newTab}`,
  });
  await expect(chip).toHaveAttribute("href", FIXTURE_PASSAGE_URL);
  await expect(chip).toHaveAttribute("target", "_blank");

  // One answer is open at a time; a source that quotes someone names them.
  await second.click();
  await expect(panel.getByText("[answer 1 en]")).toBeHidden();
  await expect(panel.getByText("[answer 2 en]")).toBeVisible();
  await expect(panel.getByTitle(`${FIXTURE_NARRATOR}, via ${book}, on 1:2`)).toBeVisible();

  // Another section, other questions; the draft question of 1:3 never shows.
  const nav = page.getByRole("navigation", { name: en.surah.readingSections });
  await nav.getByRole("link", { name: /^1:3/ }).click();
  await expect(panel.getByText("Reading now: 1:3")).toBeVisible();
  await expect(panel.getByText(en.qa.noQuestions)).toBeVisible();
  await nav.getByRole("link", { name: /^1:4–5/ }).click();
  await expect(panel.getByText("Reading now: 1:4–5")).toBeVisible();
  await expect(questions.getByRole("button")).toHaveText(["[question 3 en]"]);
  await expect(panel.getByLabel(en.qa.askLabel)).toBeDisabled();
});
