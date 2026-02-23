import { test, expect } from "@playwright/test";

const URL = "http://localhost:5173/";

test("has title", async ({ page }) => {
  await page.goto(URL);

  await expect(page).toHaveTitle(/レシピ/);
});

test.describe("レシピGETページのテスト軍", () => {
  // テスト前の共通処理共通処理
  test.beforeEach(async ({ page }) => {
    await page.goto(URL);
  });

  test("レシピサイトを開く", async ({ page, context }) => {
    // ボタンを押すとレシピ名が表示される。
    await page.getByRole("button", { name: "レシピGETボタン" }).click();
    const name = page.getByTestId("recipe-name");
    await expect(name).not.toHaveText("");

    // 開くボタンを押すとレシピサイトが別タブで開く
    // 'page'イベントの待機開始
    const pagePromise = context.waitForEvent("page");

    await page.getByText("開く").click();
    const newPage = await pagePromise;
    await expect(newPage).toBeDefined();
  });

  test("レシピサイトのURLをコピーする", async ({
    page,
    context,
    browserName,
  }) => {
    // webkitはクリップボードにアクセスできないためこのテストをスキップする。
    test.skip(browserName === "webkit", "WebKit lacks clipboard API support");

    // クリップボードへのアクセス権限を付与
    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: URL,
    });

    // ボタンを押すとレシピ名が表示される。
    await page.getByRole("button", { name: "レシピGETボタン" }).click();
    const name = page.getByTestId("recipe-name");
    await expect(name).not.toHaveText("");

    // URLがコピーできること
    await page.getByRole("button", { name: "コピーする" }).click();
    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );
    expect(clipboardText).toContain("https://");
  });

  test("クリアボタンが動作すること", async ({ page }) => {
    // ボタンを押すとレシピ名が表示される。
    await page.getByRole("button", { name: "レシピGETボタン" }).click();
    const name = page.getByTestId("recipe-name");
    await expect(name).not.toHaveText("");

    await page.getByText("クリア").click();
    await expect(name).toHaveText("");
  });
});
