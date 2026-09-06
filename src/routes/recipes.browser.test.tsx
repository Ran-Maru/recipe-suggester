import { describe, expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser/context";
import { renderApp } from "../test/renderApp.tsx";

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
      .element(page.getByRole("columnheader", { name: "No" }))
      .toBeVisible();
    await expect
      .element(page.getByRole("columnheader", { name: "メニュー名" }))
      .toBeVisible();
    await expect
      .element(page.getByRole("columnheader", { name: "リンク" }))
      .toBeVisible();
    await expect
      .element(page.getByRole("columnheader", { name: "コピー" }))
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
      .element(page.getByRole("cell", { name: "豚汁", exact: true }))
      .not.toBeVisible();
  });

  it("検索をクリアすると全件に戻る", async () => {
    await renderApp("/recipes");

    const searchInput = page.getByRole("textbox", { name: "レシピを検索" });
    await searchInput.fill("とんじる");
    await expect
      .element(page.getByRole("cell", { name: "豚汁", exact: true }))
      .toBeVisible();

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
    await expect
      .element(page.getByRole("columnheader", { name: "No" }))
      .not.toBeVisible();
  });

  it("ページがビューポート幅を超えない", async () => {
    await renderApp("/recipes");

    await expect
      .element(page.getByRole("cell", { name: "しょうが焼き", exact: true }))
      .toBeVisible();

    const { scrollWidth, clientWidth } = documentWidth();
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
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
