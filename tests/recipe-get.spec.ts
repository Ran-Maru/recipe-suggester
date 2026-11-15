import { expectRecipeUrl } from "./support/clipboard.ts";
import { expect, test } from "./fixtures.ts";

test.describe("レシピGETページ", () => {
  test("レシピサイトを別タブで開く", async ({ recipeGetPage }) => {
    await recipeGetPage.goto();
    await recipeGetPage.getRecipe();
    const newPage = await recipeGetPage.openInNewTab();
    expect(newPage).toBeDefined();
  });

  test("レシピサイトのURLをコピーする", async ({
    recipeGetPage,
    browserName,
  }) => {
    test.skip(browserName === "webkit", "WebKit lacks clipboard API support");

    await recipeGetPage.goto();
    await recipeGetPage.getRecipe();
    const clipboardText = await recipeGetPage.copyRecipeUrl();
    expectRecipeUrl(clipboardText);
  });
});
