import { describe, expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser/context";
import { renderApp } from "../test/renderApp.tsx";

describe("餃子ページ", () => {
  it("見出しが表示される", async () => {
    await renderApp("/family-recipe/gyoza");

    await expect
      .element(page.getByRole("heading", { name: "うちの餃子" }))
      .toBeVisible();
  });
});
