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

// Logging in needs a real account on the Supabase project in .env.local, so this only runs when
// E2E_EMAIL and E2E_PASSWORD are set: E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e
test.describe("with a real account", () => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  test.skip(!email || !password, "set E2E_EMAIL and E2E_PASSWORD to run");

  test("logging in from the header returns to the page, and logging out follows the page type", async ({
    page,
  }) => {
    await page.goto("/ko/signup");
    await page.getByRole("banner").getByRole("link", { name: ko.auth.login }).click();
    await page.getByLabel(ko.auth.email).fill(email!);
    await page.getByLabel(ko.auth.password).fill(password!);
    await page.getByRole("main").getByRole("button", { name: ko.auth.login }).click();

    // Back on the page the user came from.
    await expect(page).toHaveURL(/\/ko$/);
    const logout = page.getByRole("banner").getByRole("button", { name: ko.auth.logout });
    await expect(logout).toBeVisible();

    // Logging out from a public page stays on it.
    await logout.click();
    await expect(page.getByRole("banner").getByRole("link", { name: ko.auth.login })).toBeVisible();
    await expect(page).toHaveURL(/\/ko$/);
  });

  test("logging out from a protected page goes home", async ({ page }) => {
    await page.goto("/en/login?next=%2Fen%2Fsurah%2F1");
    await page.getByLabel(en.auth.email).fill(email!);
    await page.getByLabel(en.auth.password).fill(password!);
    await page.getByRole("main").getByRole("button", { name: en.auth.login }).click();
    await expect(page).toHaveURL(/\/en\/surah\/1$/);

    await page.getByRole("banner").getByRole("button", { name: en.auth.logout }).click();
    await expect(page).toHaveURL(/\/en$/);
  });
});
