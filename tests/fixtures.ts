import { test as base, expect } from "@playwright/test";
import { RecipeGetPage } from "./pages/recipe-get.page.ts";
import { RecipeListPage } from "./pages/recipe-list.page.ts";

type AppFixtures = {
  recipeGetPage: RecipeGetPage;
  recipeListPage: RecipeListPage;
};

// 引数名を use にすると React Hooks の lint に当たるので provide にしている
export const test = base.extend<AppFixtures>({
  recipeGetPage: async ({ page }, provide) => {
    await provide(new RecipeGetPage(page));
  },
  recipeListPage: async ({ page }, provide) => {
    await provide(new RecipeListPage(page));
  },
});

export { expect };
