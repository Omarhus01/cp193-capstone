import { expect, test } from "@playwright/test";
import en from "../messages/en.json";
import ko from "../messages/ko.json";

const homePages = [
  { locale: "en", messages: en },
  { locale: "ko", messages: ko },
] as const;

for (const { locale, messages } of homePages) {
  test(`home page loads in ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}`);

    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(messages.home.title);
    await expect(page.getByRole("link", { name: messages.header.logo })).toBeVisible();
  });
}

test("the root path redirects to English", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);
});

test("the search bar is visible, disabled, and says it is coming soon", async ({ page }) => {
  await page.goto("/en");

  const search = page.getByRole("searchbox", { name: en.header.searchLabel });
  await expect(search).toBeVisible();
  await expect(search).toBeDisabled();
  await expect(search).toHaveAccessibleDescription(en.header.searchComingSoon);
});
