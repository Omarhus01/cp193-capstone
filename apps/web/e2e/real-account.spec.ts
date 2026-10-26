import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import en from "../messages/en.json";
import ko from "../messages/ko.json";

// Tests that log in with a real account on the Supabase project in .env.local. They run only when
// E2E_EMAIL and E2E_PASSWORD are set in the environment (never commit them):
//   E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e
// They can share one account and run in parallel because logging out only ends the current
// browser's session.
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

type Messages = typeof en;

/** Fills in and submits the login form on the current page. */
async function submitLogin(page: Page, messages: Messages) {
  await page.getByLabel(messages.auth.email).fill(email!);
  await page.getByLabel(messages.auth.password).fill(password!);
  await page.getByRole("main").getByRole("button", { name: messages.auth.login }).click();
}

/** The Account button in the top bar, shown only to a logged-in user. */
function accountButton(page: Page, messages: Messages) {
  return page.getByRole("banner").getByRole("button", { name: messages.header.account });
}

/** Logs out through the Account menu in the top bar. */
async function logOut(page: Page, messages: Messages) {
  await accountButton(page, messages).click();
  await page.getByRole("banner").getByRole("button", { name: messages.auth.logout }).click();
}

/**
 * Marks the browser's Supabase session as expired, so its next request has to use the refresh
 * token. The session cookie holds "base64-" + the session JSON, possibly split into chunks
 * (name.0, name.1, ...). The new expiry has as many digits as the old one, so the encoded value
 * keeps its length and the chunks keep their boundaries.
 */
async function expireSession(context: BrowserContext) {
  const chunks = (await context.cookies())
    .filter((cookie) => /^sb-.+-auth-token(\.\d+)?$/.test(cookie.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const encoded = chunks.map((cookie) => cookie.value).join("");
  const session = JSON.parse(
    Buffer.from(encoded.replace(/^base64-/, ""), "base64url").toString("utf8"),
  );
  session.expires_at = 10 ** (String(session.expires_at).length - 1); // e.g. 1000000000 (2001)
  const updated = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  expect(updated).toHaveLength(encoded.length);

  let offset = 0;
  await context.addCookies(
    chunks.map((cookie) => {
      const value = updated.slice(offset, offset + cookie.value.length);
      offset += cookie.value.length;
      return { ...cookie, value };
    }),
  );
}

/** Logging in makes a round trip to Supabase, so allow more than the default 5 seconds. */
const AFTER_LOGIN = { timeout: 15_000 };

test.describe("with a real account", () => {
  test.skip(!email || !password, "set E2E_EMAIL and E2E_PASSWORD to run");

  test("logging out in one browser keeps the session in another", async ({ browser }) => {
    const [laptop, phone] = await Promise.all([browser.newContext(), browser.newContext()]);
    const [laptopPage, phonePage] = await Promise.all([laptop.newPage(), phone.newPage()]);
    for (const page of [laptopPage, phonePage]) {
      await page.goto("/en/login?next=%2Fen");
      await submitLogin(page, en);
      await expect(page).toHaveURL(/\/en$/, AFTER_LOGIN);
    }

    await logOut(laptopPage, en);
    await expect(
      laptopPage.getByRole("banner").getByRole("link", { name: en.auth.login }),
    ).toBeVisible();

    // The other browser's access token would stay valid until it expires even after a global
    // sign-out, so force a refresh: that only works if its session was not ended too.
    await expireSession(phone);
    await phonePage.goto("/en/surah/1");
    await expect(phonePage).toHaveURL(/\/en\/surah\/1$/);
    await expect(accountButton(phonePage, en)).toBeVisible();

    await Promise.all([laptop.close(), phone.close()]);
  });

  test("logging in from the header returns to the page, and logging out of a public page stays there", async ({
    page,
  }) => {
    await page.goto("/ko");
    await page.getByRole("banner").getByRole("link", { name: ko.auth.login }).click();
    await expect(page).toHaveURL(/\/ko\/login\?next=%2Fko$/);
    await submitLogin(page, ko);

    // Back on the page the user came from.
    await expect(page).toHaveURL(/\/ko$/, AFTER_LOGIN);
    await expect(accountButton(page, ko)).toBeVisible();

    await logOut(page, ko);
    await expect(page.getByRole("banner").getByRole("link", { name: ko.auth.login })).toBeVisible();
    await expect(page).toHaveURL(/\/ko$/);
  });

  test("logging out from a protected page goes home", async ({ page }) => {
    await page.goto("/en/login?next=%2Fen%2Fsurah%2F1");
    await submitLogin(page, en);
    await expect(page).toHaveURL(/\/en\/surah\/1$/, AFTER_LOGIN);

    await logOut(page, en);
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.getByRole("banner").getByRole("link", { name: en.auth.login })).toBeVisible();
  });

  test("logged-in users don't see the home page account hint", async ({ page }) => {
    await page.goto("/en/login?next=%2Fen");
    await submitLogin(page, en);
    await expect(page).toHaveURL(/\/en$/, AFTER_LOGIN);

    // Wait until the session-dependent parts have streamed in before checking the hint is absent.
    await expect(accountButton(page, en)).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("link", { name: en.home.start })).toBeVisible();
    await expect(page.getByText(en.home.accountHint)).toHaveCount(0);
  });
});
