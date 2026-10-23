import { expect, test } from "@playwright/test";
import en from "../messages/en.json";
import ko from "../messages/ko.json";

test("the header login link carries the current page as next", async ({ page }) => {
  await page.goto("/ko");

  await page.getByRole("banner").getByRole("link", { name: ko.auth.login }).click();

  await expect(page).toHaveURL(/\/ko\/login\?next=%2Fko$/);
  await expect(page.locator('input[name="next"]')).toHaveValue("/ko");
});

test("the header signup link carries the current page as next", async ({ page }) => {
  await page.goto("/en");

  await page.getByRole("banner").getByRole("link", { name: en.auth.signup }).click();

  await expect(page).toHaveURL(/\/en\/signup\?next=%2Fen$/);
  await expect(page.locator('input[name="next"]')).toHaveValue("/en");
});

test("on the login page, the header link keeps the existing next", async ({ page }) => {
  // A protected page sends logged-out users to login with next set to that page.
  await page.goto("/en/surah/1");
  await expect(page).toHaveURL(/\/en\/login\?next=%2Fen%2Fsurah%2F1$/);

  const headerLogin = page.getByRole("banner").getByRole("link", { name: en.auth.login });
  await expect(headerLogin).toHaveAttribute("href", "/en/login?next=%2Fen%2Fsurah%2F1");
});
