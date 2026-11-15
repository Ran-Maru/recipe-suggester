import { expectRecipeUrl } from "./support/clipboard.ts";
import { test } from "./fixtures.ts";

test.describe("一覧ページ", () => {
  test("リンクをコピーできる", async ({
    recipeListPage,
    browserName,
    isMobile,
  }) => {
    test.skip(browserName === "webkit", "WebKit lacks clipboard API support");
    test.skip(isMobile, "スマホ幅ではコピー列を出さない");

    await recipeListPage.goto();
    const clipboardText = await recipeListPage.copyFirstRecipeUrl();
    expectRecipeUrl(clipboardText);
  });
});
