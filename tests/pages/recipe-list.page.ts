import type { Locator, Page } from "@playwright/test";
import { grantClipboard, readClipboard } from "../support/clipboard.ts";

export class RecipeListPage {
  readonly page: Page;
  readonly copyButtons: Locator;

  constructor(page: Page) {
    this.page = page;
    this.copyButtons = page.getByRole("button", { name: /のURLをコピー$/ });
  }

  async goto(): Promise<void> {
    await this.page.goto("/recipes");
  }

  async copyFirstRecipeUrl(): Promise<string> {
    await grantClipboard(this.page);
    await this.copyButtons.first().click();
    return readClipboard(this.page);
  }
}
