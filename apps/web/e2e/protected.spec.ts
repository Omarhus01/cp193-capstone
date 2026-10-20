import { expect, test } from "@playwright/test";
import en from "../messages/en.json";
import ko from "../messages/ko.json";

test("a surah page redirects to login when logged out", async ({ page }) => {
  await page.goto("/en/surah/1");

  await expect(page).toHaveURL("/en/login?next=%2Fen%2Fsurah%2F1");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.auth.loginTitle);
});

test("the redirect keeps the Korean locale", async ({ page }) => {
  await page.goto("/ko/surah/2");

  await expect(page).toHaveURL("/ko/login?next=%2Fko%2Fsurah%2F2");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(ko.auth.loginTitle);
});
