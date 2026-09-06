import { describe, expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser/context";
import { renderApp } from "../test/renderApp.tsx";

describe("レシピGETページ", () => {
  it("GETするとレシピ名が表示され、クリアで空に戻る", async () => {
    await renderApp("/");

    await page.getByRole("button", { name: "レシピGETボタン" }).click();
    await expect
      .element(page.getByTestId("recipe-name"))
      .not.toHaveTextContent("");

    await page.getByRole("button", { name: "クリア" }).click();
    await expect.element(page.getByTestId("recipe-name")).toHaveTextContent("");
  });
});
