import { expect, type Locator, type Page } from "@playwright/test";
import { grantClipboard, readClipboard } from "../support/clipboard.ts";

export class RecipeGetPage {
  readonly page: Page;
  readonly getButton: Locator;
  readonly recipeName: Locator;
  readonly openButton: Locator;
  readonly copyButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.getButton = page.getByRole("button", { name: "レシピGETボタン" });
    this.recipeName = page.getByTestId("recipe-name");
    this.openButton = page.getByRole("button", { name: "開く" });
    this.copyButton = page.getByRole("button", { name: "コピーする" });
  }

  async goto(): Promise<void> {
    await this.page.goto("");
  }

  async getRecipe(): Promise<void> {
    await this.getButton.click();
    await expect(this.recipeName).not.toHaveText("");
  }

  async openInNewTab(): Promise<Page> {
    const newPage = this.page.context().waitForEvent("page");
    await this.openButton.click();
    return newPage;
  }

  async copyRecipeUrl(): Promise<string> {
    await grantClipboard(this.page);
    await this.copyButton.click();
    return readClipboard(this.page);
  }
}
