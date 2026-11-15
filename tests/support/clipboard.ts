import { expect, test, type Page } from "@playwright/test";

export function appOrigin(): string {
  const baseURL = test.info().project.use.baseURL;
  if (!baseURL) {
    throw new Error("Playwright baseURL is not configured");
  }
  return new URL(baseURL).origin;
}

export async function grantClipboard(page: Page): Promise<void> {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: appOrigin(),
  });
}

export function readClipboard(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}

export function expectRecipeUrl(clipboardText: string): void {
  const origin = appOrigin();
  expect(clipboardText).not.toBe("");
  expect(
    clipboardText.startsWith("https://") || clipboardText.startsWith(origin),
  ).toBe(true);
}
