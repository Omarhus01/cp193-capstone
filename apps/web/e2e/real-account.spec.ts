import { expect, test, type Page } from "@playwright/test";
import en from "../messages/en.json";
import ko from "../messages/ko.json";

// Tests that log in with a real account on the Supabase project in .env.local. They run only when
// E2E_EMAIL and E2E_PASSWORD are set in the environment (never commit them):
//   E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e
//
// They share one account, and logging out ends every session of that account (Supabase's
// signOut is global), so they run one at a time in this one file. Running the suite also logs
// that account out in any other browser.
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

type Messages = typeof en;

/** Fills in and submits the login form on the current page. */
async function submitLogin(page: Page, messages: Messages) {
  await page.getByLabel(messages.auth.email).fill(email!);
  await page.getByLabel(messages.auth.password).fill(password!);
  await page.getByRole("main").getByRole("button", { name: messages.auth.login }).click();
}

/** Logging in makes a round trip to Supabase, so allow more than the default 5 seconds. */
const AFTER_LOGIN = { timeout: 15_000 };

test.describe("with a real account", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!email || !password, "set E2E_EMAIL and E2E_PASSWORD to run");

  test("logging in from the header returns to the page, and logging out of a public page stays there", async ({
    page,
  }) => {
    await page.goto("/ko");
    await page.getByRole("banner").getByRole("link", { name: ko.auth.login }).click();
    await expect(page).toHaveURL(/\/ko\/login\?next=%2Fko$/);
    await submitLogin(page, ko);

    // Back on the page the user came from.
    await expect(page).toHaveURL(/\/ko$/, AFTER_LOGIN);
    const logout = page.getByRole("banner").getByRole("button", { name: ko.auth.logout });
    await expect(logout).toBeVisible();

    await logout.click();
    await expect(page.getByRole("banner").getByRole("link", { name: ko.auth.login })).toBeVisible();
    await expect(page).toHaveURL(/\/ko$/);
  });

  test("logging out from a protected page goes home", async ({ page }) => {
    await page.goto("/en/login?next=%2Fen%2Fsurah%2F1");
    await submitLogin(page, en);
    await expect(page).toHaveURL(/\/en\/surah\/1$/, AFTER_LOGIN);

    await page.getByRole("banner").getByRole("button", { name: en.auth.logout }).click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.getByRole("banner").getByRole("link", { name: en.auth.login })).toBeVisible();
  });

  test("logged-in users don't see the home page account hint", async ({ page }) => {
    await page.goto("/en/login?next=%2Fen");
    await submitLogin(page, en);
    await expect(page).toHaveURL(/\/en$/, AFTER_LOGIN);

    // Wait until the session-dependent parts have streamed in before checking the hint is absent.
    await expect(
      page.getByRole("banner").getByRole("button", { name: en.auth.logout }),
    ).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("link", { name: en.home.start })).toBeVisible();
    await expect(page.getByText(en.home.accountHint)).toHaveCount(0);
  });
});
