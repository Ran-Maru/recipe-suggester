# テストについて

検索ロジックと画面操作は Vitest、クリップボードコピーと別タブオープンだけ Playwright E2E。

## Vitest（`vp test`）

- Node: `src/**/*.test.ts`（`searchRecipes` など）
- Browser Mode: `src/**/*.browser.test.tsx`（GET / クリア、一覧・検索 UI、餃子、ナビ、横幅）

## Playwright E2E

`tests/` の `@playwright/test`。コマンドは `package.json` の `test:e2e*`。

残しているケース:

- レシピGET の「開く」で別タブが開くこと
- レシピGET の「コピーする」と一覧のコピーボタンで URL がクリップボードに入ること

## 参考

- https://vitest.dev/guide/
- https://vitest.dev/guide/browser/
- https://playwright.dev/docs/intro
- GitHub Actionでテストがコケたときのトレースファイル確認方法
  - https://playwright.dev/docs/ci-intro#setting-up-github-actions
- PlaywrightのAIエージェント情報
  - https://playwright.dev/docs/test-agents
