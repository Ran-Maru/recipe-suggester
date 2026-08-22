import { test, expect } from "@playwright/test";

const URL = "http://localhost:5173/";

test("has title", async ({ page }) => {
  await page.goto("");

  await expect(page).toHaveTitle(/レシピ/);
});

test.describe("レシピGETページのテスト軍", () => {
  // テスト前の共通処理共通処理
  test.beforeEach(async ({ page }) => {
    await page.goto("");
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
    expect(newPage).toBeDefined();
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

    // URLがコピーできること（外部httpsまたは同一オリジンの相対レシピ）
    await page.getByRole("button", { name: "コピーする" }).click();
    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );
    expect(clipboardText).not.toBe("");
    expect(
      clipboardText.startsWith("https://") || clipboardText.startsWith(URL),
    ).toBe(true);
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

test.describe("一覧ページのテスト", () => {
  test("テーブルのヘッダーと行が表示される", async ({ page }) => {
    await page.goto("/recipes");

    await expect(page.getByRole("columnheader", { name: "No" })).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "メニュー名" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "リンク" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "コピー" }),
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "しょうが焼き" }),
    ).toBeVisible();
  });

  test("リンクをコピーできる", async ({ page, context, browserName }) => {
    test.skip(browserName === "webkit", "WebKit lacks clipboard API support");

    await context.grantPermissions(["clipboard-read", "clipboard-write"], {
      origin: URL,
    });

    await page.goto("/recipes");
    await page.getByRole("button", { name: "コピー" }).first().click();
    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );
    expect(clipboardText).not.toBe("");
    expect(
      clipboardText.startsWith("https://") || clipboardText.startsWith(URL),
    ).toBe(true);
  });
});

test("餃子ページが表示される", async ({ page }) => {
  await page.goto("/family-recipe/gyoza");

  await expect(page.getByRole("heading", { name: "うちの餃子" })).toBeVisible();
});

test("ナビでレシピGETと一覧を行き来できる", async ({ page }) => {
  await page.goto("");

  await page.getByRole("link", { name: "一覧" }).click();
  await expect(page).toHaveURL(/\/recipes$/);

  await page.getByRole("link", { name: "レシピGET" }).click();
  await expect(page).toHaveURL(new RegExp(`${URL.replaceAll("/", "\\/")}$`));
});
