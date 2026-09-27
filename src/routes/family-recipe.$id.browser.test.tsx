import { describe, expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser/context";
import { renderApp } from "../test/renderApp.tsx";

describe("オリジナルレシピ", () => {
  it("JSON の本文を表示する", async () => {
    await renderApp("/family-recipe/gyoza");

    await expect
      .element(page.getByRole("heading", { name: "うちの餃子" }))
      .toBeVisible();
    await expect
      .element(
        page.getByText("野菜多めにして、にんにく、しょうがは好きなように"),
      )
      .toBeVisible();
  });

  it("未知の id では見つからないと出す", async () => {
    await renderApp("/family-recipe/missing");

    await expect
      .element(page.getByRole("heading", { name: "レシピが見つかりません" }))
      .toBeVisible();
  });

  it("一覧のリンクが family-recipe の url になる", async () => {
    await renderApp("/recipes");

    await page
      .getByRole("textbox", { name: "レシピを検索" })
      .fill("うちの餃子");

    const link = page.getByRole("link", {
      name: "うちの餃子のレシピサイトを開く",
    });
    await expect.element(link).toBeVisible();
    expect(link.element().getAttribute("href")).toBe("./family-recipe/gyoza");
  });
});
