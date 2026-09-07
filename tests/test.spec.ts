import { test, expect } from "@playwright/test";

function appOrigin(): string {
  const baseURL = test.info().project.use.baseURL;
  if (!baseURL) {
    throw new Error("Playwright baseURL is not configured");
  }
  return new URL(baseURL).origin;
}

test.describe("レシピGETページ", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("");
  });

  test("レシピサイトを別タブで開く", async ({ page, context }) => {
    await page.getByRole("button", { name: "レシピGETボタン" }).click();
    const name = page.getByTestId("recipe-name");
    await expect(name).not.toHaveText("");

    const pagePromise = context.waitForEvent("page");
    await page.getByText("開く").click();
    const newPage = await pagePromise;
    expect(newPage).toBeDefined();
  });

  test("レシピサイトのURLをコピーする", async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName === "webkit", "WebKit lacks clipboard API support");

    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: appOrigin(),
    });

    await page.getByRole("button", { name: "レシピGETボタン" }).click();
    const name = page.getByTestId("recipe-name");
    await expect(name).not.toHaveText("");

    await page.getByRole("button", { name: "コピーする" }).click();
    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );
    expect(clipboardText).not.toBe("");
    expect(
      clipboardText.startsWith("https://") ||
        clipboardText.startsWith(appOrigin()),
    ).toBe(true);
  });
});

test.describe("一覧ページ", () => {
  test("リンクをコピーできる", async ({ page, context, browserName }) => {
    test.skip(browserName === "webkit", "WebKit lacks clipboard API support");

    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: appOrigin(),
    });

    await page.goto("/recipes");
    await page.getByRole("button", { name: "コピー" }).first().click();
    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );
    expect(clipboardText).not.toBe("");
    expect(
      clipboardText.startsWith("https://") ||
        clipboardText.startsWith(appOrigin()),
    ).toBe(true);
  });
});
