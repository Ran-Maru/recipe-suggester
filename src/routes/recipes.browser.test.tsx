import { describe, expect, it } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser/context";
import { renderApp } from "../test/renderApp.tsx";
import { MIN_TOUCH_TARGET_PX, TOUCH_ICON_PX } from "../touchTarget.ts";

const MEMO_TEXT = "破れたり余ったキャベツを鍋に入れるとたくさん食べれて嬉しい";

/** タップ相当。iOS Safari と同じく、フォーカスは移さない。 */
function tap(element: Element) {
  element.dispatchEvent(
    new PointerEvent("pointerdown", { pointerType: "touch", bubbles: true }),
  );
  if (element instanceof HTMLElement) {
    element.click();
  }
}

function documentWidth() {
  return {
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  };
}

describe("一覧ページ", () => {
  it("テーブルのヘッダーと行が表示される", async () => {
    await renderApp("/recipes");

    await expect
      .element(page.getByRole("heading", { name: "レシピ一覧" }))
      .toBeVisible();
    await expect
      .element(page.getByText("メニュー名", { exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByText("リンク", { exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByText("コピー", { exact: true }))
      .not.toBeVisible();
    await expect.element(page.getByText("メモ", { exact: true })).toBeVisible();
    await expect
      .element(page.getByRole("cell", { name: "しょうが焼き", exact: true }))
      .toBeVisible();
    await expect
      .element(
        page.getByRole("link", { name: "しょうが焼きのレシピサイトを開く" }),
      )
      .toBeVisible();
    await expect
      .poll(() =>
        page.getByRole("button", { name: "しょうが焼きのURLをコピー" }).query(),
      )
      .toBeNull();
    await expect
      .poll(() =>
        page.getByRole("button", { name: "しょうが焼きのメモ" }).query(),
      )
      .toBeNull();
  });

  it("タイトルで絞り込める", async () => {
    await renderApp("/recipes");

    await page.getByRole("textbox", { name: "レシピを検索" }).fill("しょうが");

    await expect
      .element(page.getByRole("cell", { name: "しょうが焼き", exact: true }))
      .toBeVisible();
    await expect
      .poll(() => page.getByRole("cell", { name: "豚汁", exact: true }).query())
      .toBeNull();
  });

  it("検索をクリアすると全件に戻る", async () => {
    await renderApp("/recipes");

    const searchInput = page.getByRole("textbox", { name: "レシピを検索" });
    await searchInput.fill("とんじる");
    await expect
      .element(page.getByRole("cell", { name: "豚汁", exact: true }))
      .toBeVisible();
    await expect
      .poll(() =>
        page.getByRole("cell", { name: "しょうが焼き", exact: true }).query(),
      )
      .toBeNull();

    await page.getByRole("button", { name: "検索をクリア" }).click();
    await expect.element(searchInput).toHaveValue("");
    await expect
      .element(page.getByRole("cell", { name: "しょうが焼き", exact: true }))
      .toBeVisible();
  });

  it("該当なしのときメッセージを表示する", async () => {
    await renderApp("/recipes");

    await page
      .getByRole("textbox", { name: "レシピを検索" })
      .fill("存在しないレシピ名");

    await expect
      .element(page.getByText("該当するレシピがありません"))
      .toBeVisible();
    expect(page.getByText("メニュー名", { exact: true }).query()).toBeNull();
  });

  it("ページがビューポート幅を超えない", async () => {
    await renderApp("/recipes");

    await expect
      .element(page.getByRole("cell", { name: "しょうが焼き", exact: true }))
      .toBeVisible();

    const { scrollWidth, clientWidth } = documentWidth();
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  it("アイコンボタンと検索欄がスマホのタップ領域を満たす", async () => {
    await renderApp("/recipes");

    const memoButton = page.getByRole("button", {
      name: "ロールキャベツのメモ",
    });
    const openLink = page.getByRole("link", {
      name: "しょうが焼きのレシピサイトを開く",
    });
    const searchInput = page.getByRole("textbox", { name: "レシピを検索" });

    await expect.element(memoButton).toBeVisible();
    await expect.element(openLink).toBeVisible();

    const memoRect = memoButton.element().getBoundingClientRect();
    expect(memoRect.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
    expect(memoRect.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);

    const openRect = openLink.element().getBoundingClientRect();
    expect(openRect.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
    expect(openRect.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);

    const searchRect = searchInput.element().getBoundingClientRect();
    expect(searchRect.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);

    const memoIcon = memoButton.element().querySelector("svg");
    expect(memoIcon).not.toBeNull();
    expect(Number(memoIcon?.getAttribute("width"))).toBe(TOUCH_ICON_PX);
    expect(Number(memoIcon?.getAttribute("height"))).toBe(TOUCH_ICON_PX);

    await searchInput.fill("しょうが");
    const clearButton = page.getByRole("button", { name: "検索をクリア" });
    await expect.element(clearButton).toBeVisible();

    const clearRect = clearButton.element().getBoundingClientRect();
    expect(clearRect.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
    expect(clearRect.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);

    const clearIcon = clearButton.element().querySelector("svg");
    expect(clearIcon).not.toBeNull();
    expect(Number(clearIcon?.getAttribute("width"))).toBe(TOUCH_ICON_PX);
  });

  it("メモはタップで開き、もう一度タップすると閉じる", async () => {
    await renderApp("/recipes");

    const memoButton = page.getByRole("button", {
      name: "ロールキャベツのメモ",
    });
    await expect.element(memoButton).toBeVisible();

    tap(memoButton.element());
    await expect
      .element(page.getByRole("tooltip"))
      .toHaveTextContent(MEMO_TEXT);

    tap(memoButton.element());
    await expect.poll(() => page.getByRole("tooltip").query()).toBeNull();
  });

  it("メモは外側をタップすると閉じる", async () => {
    await renderApp("/recipes");

    const memoButton = page.getByRole("button", {
      name: "ロールキャベツのメモ",
    });
    await expect.element(memoButton).toBeVisible();

    tap(memoButton.element());
    await expect.element(page.getByRole("tooltip")).toBeVisible();

    tap(document.body);
    await expect.poll(() => page.getByRole("tooltip").query()).toBeNull();
  });

  it("メモは Escape で閉じる", async () => {
    await renderApp("/recipes");

    const memoButton = page.getByRole("button", {
      name: "ロールキャベツのメモ",
    });
    await expect.element(memoButton).toBeVisible();

    tap(memoButton.element());
    await expect.element(page.getByRole("tooltip")).toBeVisible();

    await userEvent.keyboard("{Escape}");
    await expect.poll(() => page.getByRole("tooltip").query()).toBeNull();
  });

  it("メモはマウスでクリックしても開いたまま", async () => {
    await renderApp("/recipes");

    const memoButton = page.getByRole("button", {
      name: "ロールキャベツのメモ",
    });
    await memoButton.click();

    await expect
      .element(page.getByRole("tooltip"))
      .toHaveTextContent(MEMO_TEXT);
  });

  it("メモがある行はホバーで文面を出す", async () => {
    await renderApp("/recipes");

    const memoButton = page.getByRole("button", {
      name: "ロールキャベツのメモ",
    });
    await expect.element(memoButton).toBeVisible();
    await memoButton.hover();

    await expect
      .element(page.getByRole("tooltip"))
      .toHaveTextContent(MEMO_TEXT);
  });

  it("検索入力中もページがビューポート幅を超えない", async () => {
    await renderApp("/recipes");

    await page
      .getByRole("textbox", { name: "レシピを検索" })
      .fill("しょうがやきとんじる");
    await expect
      .element(page.getByRole("button", { name: "検索をクリア" }))
      .toBeVisible();

    const { scrollWidth, clientWidth } = documentWidth();
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
