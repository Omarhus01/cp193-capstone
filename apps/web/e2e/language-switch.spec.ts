import { expect, test } from "@playwright/test";
import en from "../messages/en.json";
import ko from "../messages/ko.json";

test("the switcher names each language in that language", async ({ page }) => {
  await page.goto("/en");

  const switcher = page.getByRole("navigation", { name: en.header.languageLabel });
  await expect(switcher.getByRole("link", { name: en.header.languages.en })).toHaveText("English");
  await expect(switcher.getByRole("link", { name: en.header.languages.ko })).toHaveText("한국어");
});

test("switching to Korean keeps the current page", async ({ page }) => {
  await page.goto("/en/login");

  await page.getByRole("link", { name: en.header.languages.ko }).click();

  await expect(page).toHaveURL(/\/ko\/login$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(ko.auth.loginTitle);
});

test("switching back to English keeps the current page", async ({ page }) => {
  await page.goto("/ko/signup");

  await page.getByRole("link", { name: ko.header.languages.en }).click();

  await expect(page).toHaveURL(/\/en\/signup$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.auth.signupTitle);
});
