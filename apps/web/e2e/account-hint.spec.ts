import { expect, test } from "@playwright/test";
import en from "../messages/en.json";
import ko from "../messages/ko.json";

for (const { locale, messages } of [
  { locale: "en", messages: en },
  { locale: "ko", messages: ko },
] as const) {
  test(`logged-out users see the account hint on the ${locale} home page`, async ({ page }) => {
    await page.goto(`/${locale}`);

    await expect(page.getByText(messages.home.accountHint)).toBeVisible();
  });
}

// Needs a real account on the Supabase project in .env.local; see e2e/auth-links.spec.ts.
test.describe("with a real account", () => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  test.skip(!email || !password, "set E2E_EMAIL and E2E_PASSWORD to run");

  test("logged-in users don't see the account hint", async ({ page }) => {
    await page.goto("/en/login?next=%2Fen");
    await page.getByLabel(en.auth.email).fill(email!);
    await page.getByLabel(en.auth.password).fill(password!);
    await page.getByRole("main").getByRole("button", { name: en.auth.login }).click();
    await expect(page).toHaveURL(/\/en$/);

    // Wait until the session-dependent parts have streamed in before checking the hint is absent.
    await expect(
      page.getByRole("banner").getByRole("button", { name: en.auth.logout }),
    ).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("link", { name: en.home.start })).toBeVisible();
    await expect(page.getByText(en.home.accountHint)).toHaveCount(0);
  });
});
