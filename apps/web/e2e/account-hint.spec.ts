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
