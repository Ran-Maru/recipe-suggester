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
      page.getByRole("cell", { name: "しょうが焼き", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "しょうが焼きのレシピサイトを開く" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "しょうが焼きのURLをコピー" }),
    ).toBeVisible();
  });

  test("ページがビューポート幅を超えない", async ({ page }) => {
    await page.goto("/recipes");

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
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

  test("タイトルで部分一致検索できる", async ({ page }) => {
    await page.goto("/recipes");
    await page.getByRole("textbox", { name: "レシピを検索" }).fill("しょうが");

    await expect(
      page.getByRole("cell", { name: "しょうが焼き", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "豚汁", exact: true }),
    ).not.toBeVisible();
  });

  test("かなで部分一致検索できる", async ({ page }) => {
    await page.goto("/recipes");
    await page.getByRole("textbox", { name: "レシピを検索" }).fill("とんじる");

    await expect(
      page.getByRole("cell", { name: "豚汁", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "しょうが焼き", exact: true }),
    ).not.toBeVisible();
  });

  test("濁点・半濁点を区別せず検索できる", async ({ page }) => {
    await page.goto("/recipes");
    await page
      .getByRole("textbox", { name: "レシピを検索" })
      .fill("しようかやき");

    await expect(
      page.getByRole("cell", { name: "しょうが焼き", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "豚汁", exact: true }),
    ).not.toBeVisible();
  });

  test("小文字かなを区別せず検索できる", async ({ page }) => {
    await page.goto("/recipes");
    await page.getByRole("textbox", { name: "レシピを検索" }).fill("とんしる");

    await expect(
      page.getByRole("cell", { name: "豚汁", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "しょうが焼き", exact: true }),
    ).not.toBeVisible();
  });

  test("検索をクリアすると全件に戻る", async ({ page }) => {
    await page.goto("/recipes");
    const searchInput = page.getByRole("textbox", { name: "レシピを検索" });
    await searchInput.fill("とんじる");
    await expect(
      page.getByRole("cell", { name: "豚汁", exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: "検索をクリア" }).click();
    await expect(searchInput).toHaveValue("");
    await expect(
      page.getByRole("cell", { name: "しょうが焼き", exact: true }),
    ).toBeVisible();
  });

  test("該当なしのときメッセージを表示する", async ({ page }) => {
    await page.goto("/recipes");
    await page
      .getByRole("textbox", { name: "レシピを検索" })
      .fill("存在しないレシピ名");

    await expect(page.getByText("該当するレシピがありません")).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "No" }),
    ).not.toBeVisible();
  });

  test("検索入力中もページがビューポート幅を超えない", async ({ page }) => {
    await page.goto("/recipes");
    await page
      .getByRole("textbox", { name: "レシピを検索" })
      .fill("しょうがやきとんじる");

    await expect(
      page.getByRole("button", { name: "検索をクリア" }),
    ).toBeVisible();

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));

    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
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
