import { describe, expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser/context";
import { renderApp } from "../test/renderApp.tsx";
import { MIN_TOUCH_TARGET_PX, TOUCH_ICON_PX } from "../touchTarget.ts";

function documentWidth() {
  return {
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  };
}

describe("一覧ページ", () => {
  it("テーブルのヘッダーと行が表示される", async () => {
    await renderApp("/recipes");

    await expect
      .element(page.getByRole("heading", { name: "レシピ一覧" }))
      .toBeVisible();
    await expect
      .element(page.getByText("メニュー名", { exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByText("リンク", { exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByText("コピー", { exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByRole("cell", { name: "しょうが焼き", exact: true }))
      .toBeVisible();
    await expect
      .element(
        page.getByRole("link", { name: "しょうが焼きのレシピサイトを開く" }),
      )
      .toBeVisible();
    await expect
      .element(page.getByRole("button", { name: "しょうが焼きのURLをコピー" }))
      .toBeVisible();
  });

  it("タイトルで絞り込める", async () => {
    await renderApp("/recipes");

    await page.getByRole("textbox", { name: "レシピを検索" }).fill("しょうが");

    await expect
      .element(page.getByRole("cell", { name: "しょうが焼き", exact: true }))
      .toBeVisible();
    await expect
      .poll(() => page.getByRole("cell", { name: "豚汁", exact: true }).query())
      .toBeNull();
  });

  it("検索をクリアすると全件に戻る", async () => {
    await renderApp("/recipes");

    const searchInput = page.getByRole("textbox", { name: "レシピを検索" });
    await searchInput.fill("とんじる");
    await expect
      .element(page.getByRole("cell", { name: "豚汁", exact: true }))
      .toBeVisible();
    await expect
      .poll(() =>
        page.getByRole("cell", { name: "しょうが焼き", exact: true }).query(),
      )
      .toBeNull();

    await page.getByRole("button", { name: "検索をクリア" }).click();
    await expect.element(searchInput).toHaveValue("");
    await expect
      .element(page.getByRole("cell", { name: "しょうが焼き", exact: true }))
      .toBeVisible();
  });

  it("該当なしのときメッセージを表示する", async () => {
    await renderApp("/recipes");

    await page
      .getByRole("textbox", { name: "レシピを検索" })
      .fill("存在しないレシピ名");

    await expect
      .element(page.getByText("該当するレシピがありません"))
      .toBeVisible();
    expect(page.getByText("メニュー名", { exact: true }).query()).toBeNull();
  });

  it("ページがビューポート幅を超えない", async () => {
    await renderApp("/recipes");

    await expect
      .element(page.getByRole("cell", { name: "しょうが焼き", exact: true }))
      .toBeVisible();

    const { scrollWidth, clientWidth } = documentWidth();
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  it("アイコンボタンと検索欄がスマホのタップ領域を満たす", async () => {
    await renderApp("/recipes");

    const copyButton = page.getByRole("button", {
      name: "しょうが焼きのURLをコピー",
    });
    const openLink = page.getByRole("link", {
      name: "しょうが焼きのレシピサイトを開く",
    });
    const searchInput = page.getByRole("textbox", { name: "レシピを検索" });

    await expect.element(copyButton).toBeVisible();
    await expect.element(openLink).toBeVisible();

    const copyRect = copyButton.element().getBoundingClientRect();
    expect(copyRect.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
    expect(copyRect.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);

    const openRect = openLink.element().getBoundingClientRect();
    expect(openRect.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
    expect(openRect.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);

    const searchRect = searchInput.element().getBoundingClientRect();
    expect(searchRect.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);

    const copyIcon = copyButton.element().querySelector("svg");
    expect(copyIcon).not.toBeNull();
    expect(Number(copyIcon?.getAttribute("width"))).toBe(TOUCH_ICON_PX);
    expect(Number(copyIcon?.getAttribute("height"))).toBe(TOUCH_ICON_PX);

    await searchInput.fill("しょうが");
    const clearButton = page.getByRole("button", { name: "検索をクリア" });
    await expect.element(clearButton).toBeVisible();

    const clearRect = clearButton.element().getBoundingClientRect();
    expect(clearRect.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
    expect(clearRect.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);

    const clearIcon = clearButton.element().querySelector("svg");
    expect(clearIcon).not.toBeNull();
    expect(Number(clearIcon?.getAttribute("width"))).toBe(TOUCH_ICON_PX);
  });

  it("検索入力中もページがビューポート幅を超えない", async () => {
    await renderApp("/recipes");

    await page
      .getByRole("textbox", { name: "レシピを検索" })
      .fill("しょうがやきとんじる");
    await expect
      .element(page.getByRole("button", { name: "検索をクリア" }))
      .toBeVisible();

    const { scrollWidth, clientWidth } = documentWidth();
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
