import { expect, test } from "@playwright/test";
import en from "../messages/en.json";
import ko from "../messages/ko.json";
import { expectPublishedAlFatiha } from "./al-fatiha";

// A read-only smoke run against a deployed site (docs/deploy.md, "Check it worked"):
//
//   E2E_BASE_URL=https://<domain> npm run test:smoke
//
// It never signs up or changes data. With E2E_EMAIL and E2E_PASSWORD (an existing account), it
// also logs in and opens the surah page. Without E2E_BASE_URL it runs against
// a local production build, like the other e2e tests.
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe("smoke @smoke", () => {
  test("the root redirects to English, and the home page loads in both languages", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
    for (const [locale, messages] of [
      ["en", en],
      ["ko", ko],
    ] as const) {
      await page.goto(`/${locale}`);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(messages.home.title);
    }
  });

  test("every page credits Tanzil for the Quran text", async ({ page }) => {
    await page.goto("/ko");
    await expect(
      page.getByRole("contentinfo").getByRole("link", { name: "Tanzil Project (tanzil.net)" }),
    ).toHaveAttribute("href", "https://tanzil.net");
  });

  test("a surah page asks a logged-out visitor to log in", async ({ page }) => {
    await page.goto("/en/surah/1");
    await expect(page).toHaveURL(/\/en\/login\?next=%2Fen%2Fsurah%2F1$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(en.auth.loginTitle);
  });

  test("the email confirmation route answers, and sends a link without a code to login", async ({
    page,
  }) => {
    await page.goto("/auth/confirm");
    await expect(page).toHaveURL(/\/en\/login\?error=confirmFailed$/);
    // The message suggests the email may already be confirmed.
    await expect(page.getByText(en.auth.errors.confirmFailed)).toBeVisible();
  });

  test("the sign-up page tells new users to look for the confirmation email", async ({ page }) => {
    for (const [locale, messages] of [
      ["en", en],
      ["ko", ko],
    ] as const) {
      await page.goto(`/${locale}/signup`);
      await expect(page.getByText(messages.auth.signupEmailNote)).toBeVisible();
    }
  });

  test("the health check answers without revealing the Supabase URL", async ({ request }) => {
    const response = await request.get("/health");
    expect(response.status()).toBe(200);
    const report = await response.json();
    expect(report.ok).toBe(true);
    expect(["local", "remote"]).toContain(report.supabase);
    expect(JSON.stringify(report)).not.toMatch(/supabase\.co|https?:\/\//);
  });

  test("a logged-in reader reads Al-Fatiha", async ({ page }) => {
    test.skip(!email || !password, "set E2E_EMAIL and E2E_PASSWORD to run");

    await page.goto("/en/login?next=%2Fko%2Fsurah%2F1");
    await page.getByLabel(en.auth.email).fill(email!);
    await page.getByLabel(en.auth.password).fill(password!);
    await page.getByRole("main").getByRole("button", { name: en.auth.login }).click();
    await expect(page).toHaveURL(/\/ko\/surah\/1$/, { timeout: 15_000 });

    for (const [path, messages, name] of [
      ["/ko/surah/1", ko, "알파티하"],
      ["/en/surah/1", en, "Al-Fatiha"],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(name);
      await expectPublishedAlFatiha(page, messages);
    }

    // Log out again; the run leaves nothing behind.
    await page.getByRole("banner").getByRole("button", { name: en.header.account }).click();
    await page.getByRole("banner").getByRole("button", { name: en.auth.logout }).click();
    await expect(page.getByRole("banner").getByRole("link", { name: en.auth.login })).toBeVisible();
  });
});
