import { expect, test, type Page } from "@playwright/test";
import en from "../messages/en.json";
import ko from "../messages/ko.json";

/** Collects console errors and uncaught exceptions, such as React hydration mismatches. */
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function expectLocale(page: Page, locale: "en" | "ko") {
  const messages = locale === "en" ? en : ko;
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(page.getByRole("link", { name: messages.header.surah })).toBeVisible();
  // Rendered by AuthControls, which streams in behind Suspense after the static shell.
  await expect(page.getByRole("link", { name: messages.auth.login })).toBeVisible();
}

test("switching between /en and /ko when logged out renders without errors", async ({ page }) => {
  const errors = trackErrors(page);

  // Where logging out lands: a fresh document load of the home page, then language switches.
  await page.goto("/ko");
  await expectLocale(page, "ko");

  await page.getByRole("link", { name: ko.header.languages.en }).click();
  await expect(page).toHaveURL(/\/en$/);
  await expectLocale(page, "en");

  await page.getByRole("link", { name: en.header.languages.ko }).click();
  await expect(page).toHaveURL(/\/ko$/);
  await expectLocale(page, "ko");

  // Full reloads hydrate each locale's server HTML again.
  for (const path of ["/en/login", "/ko/login", "/ko", "/en"]) {
    await page.goto(path);
    await expectLocale(page, path.startsWith("/ko") ? "ko" : "en");
  }
  await page.reload();
  await expectLocale(page, "en");

  expect(errors).toEqual([]);
});
