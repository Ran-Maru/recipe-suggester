import { expect, test, type Page } from "@playwright/test";

async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });
}

test.use({
  colorScheme: "light",
  locale: "ja-JP",
  timezoneId: "Asia/Tokyo",
  reducedMotion: "reduce",
});

test.beforeEach(async ({ page }) => {
  // GTM の差し込みで画素が揺れるので、比較のときは読み込まない。
  await page.route(
    (url) =>
      url.hostname.endsWith("googletagmanager.com") ||
      url.hostname.endsWith("google-analytics.com"),
    (route) => route.abort(),
  );
});

test.describe("見た目", () => {
  test.describe.configure({ timeout: 60_000 });

  const scenes: {
    name: string;
    path: string;
    ready: (page: Page) => Promise<void>;
  }[] = [
    {
      name: "home",
      path: "/",
      ready: async (page) => {
        await expect(
          page.getByRole("heading", { name: "クリックしてレシピをGET!" }),
        ).toBeVisible();
      },
    },
    {
      name: "recipes",
      path: "/recipes",
      ready: async (page) => {
        await expect(
          page.getByRole("heading", { name: "レシピ一覧" }),
        ).toBeVisible();
      },
    },
    {
      name: "recipes-search",
      path: "/recipes",
      ready: async (page) => {
        await page.getByRole("textbox", { name: "レシピを検索" }).fill("餃子");
        await expect(
          page.getByRole("cell", { name: "うちの餃子", exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("cell", { name: "長野きのこパスタ", exact: true }),
        ).toHaveCount(0);
      },
    },
    {
      name: "family-gyoza",
      path: "/family-recipe/gyoza",
      ready: async (page) => {
        await expect(
          page.getByRole("heading", { name: "うちの餃子" }),
        ).toBeVisible();
      },
    },
    {
      name: "family-missing",
      path: "/family-recipe/missing-id",
      ready: async (page) => {
        await expect(
          page.getByRole("heading", { name: "レシピが見つかりません" }),
        ).toBeVisible();
      },
    },
  ];

  for (const scene of scenes) {
    test(scene.name, async ({ page }) => {
      await page.goto(scene.path);
      await scene.ready(page);
      await settle(page);
      await expect(page).toHaveScreenshot(`${scene.name}.png`, {
        fullPage: true,
      });
    });
  }
});
