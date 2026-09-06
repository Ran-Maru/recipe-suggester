import { describe, expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser/context";
import { renderApp } from "../test/renderApp.tsx";

describe("ナビ", () => {
  it("レシピGETと一覧を行き来できる", async () => {
    await renderApp("/");

    await page.getByRole("link", { name: "一覧" }).click();
    await expect
      .element(page.getByRole("heading", { name: "レシピ一覧" }))
      .toBeVisible();

    await page.getByRole("link", { name: "レシピGET" }).click();
    await expect
      .element(page.getByRole("heading", { name: "クリックしてレシピをGET!" }))
      .toBeVisible();
  });
});
