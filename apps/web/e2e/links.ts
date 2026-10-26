import { expect, type Page } from "@playwright/test";

/**
 * Every link on the page that stays on this site must reach a page that is built: each internal
 * href is requested with the page's own session and must answer below 400 (no 404s). Source chips
 * and source links must leave the site (https) or not be links at all (#37).
 */
export async function expectNoBrokenLinks(page: Page, sourceName: RegExp) {
  const hrefs = await page
    .locator("a[href]")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  const internal = [...new Set(hrefs.filter((href) => href.startsWith("/")))];
  expect(internal.length).toBeGreaterThan(0);
  for (const href of internal) {
    const response = await page.request.get(href.split("#")[0]);
    expect(response.status(), `${href} answers`).toBeLessThan(400);
  }

  const sources = page.getByRole("link", { name: sourceName });
  for (const href of await sources.evaluateAll((links) =>
    links.map((link) => link.getAttribute("href") ?? ""),
  )) {
    expect(href, "a source link leaves the site").toMatch(/^https:\/\//);
  }
}
