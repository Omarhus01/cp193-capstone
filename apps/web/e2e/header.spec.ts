import { expect, test } from "@playwright/test";
import en from "../messages/en.json";
import ko from "../messages/ko.json";

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the top bar collapses into a menu button", async ({ page }) => {
    await page.goto("/en");
    const banner = page.getByRole("banner");
    const menuButton = banner.getByRole("button", { name: en.header.menu });

    await expect(banner.getByRole("searchbox")).toBeHidden();
    await expect(banner.getByRole("button", { name: en.header.searchComingSoon })).toBeDisabled();
    await expect(banner.getByRole("link", { name: en.header.surah })).toBeHidden();
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");

    await menuButton.click();
    const closeButton = banner.getByRole("button", { name: en.header.closeMenu });
    await expect(closeButton).toHaveAttribute("aria-expanded", "true");
    await expect(banner.getByRole("link", { name: en.header.surah })).toBeVisible();
    await expect(banner.getByRole("link", { name: en.header.languages.ko })).toBeVisible();
    await expect(banner.getByRole("link", { name: en.auth.login })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(banner.getByRole("link", { name: en.header.surah })).toBeHidden();
    await expect(menuButton).toBeFocused();
  });

  test("following a link in the menu closes it", async ({ page }) => {
    await page.goto("/en");
    const banner = page.getByRole("banner");

    await banner.getByRole("button", { name: en.header.menu }).click();
    await banner.getByRole("link", { name: en.header.languages.ko }).click();

    await expect(page).toHaveURL(/\/ko$/);
    await expect(banner.getByRole("button", { name: ko.header.menu })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});

test("every page credits Tanzil for the Quran text", async ({ page }) => {
  for (const [path, messages] of [
    ["/en", en],
    ["/ko/login", ko],
  ] as const) {
    await page.goto(path);
    const credit = page.getByRole("contentinfo").getByRole("link", {
      name: "Tanzil Project (tanzil.net)",
    });
    await expect(credit).toHaveAttribute("href", "https://tanzil.net");
    await expect(page.getByRole("contentinfo")).toContainText(
      messages.footer.quranText.split("<link>")[0],
    );
  }
});
