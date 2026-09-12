import { describe, expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser/context";
import { renderApp } from "../test/renderApp.tsx";
import { MIN_TOUCH_TARGET_PX } from "../touchTarget.ts";

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

  it("主要ボタンがスマホのタップ領域を満たす", async () => {
    await renderApp("/");

    for (const name of ["レシピGETボタン", "開く", "コピーする", "クリア"]) {
      const button = page.getByRole("button", { name });
      await expect.element(button).toBeVisible();
      const rect = button.element().getBoundingClientRect();
      expect(rect.height, name).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
    }
  });
});
