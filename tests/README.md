# Playwrightの動作確認状況

## 正常動作したもの

- `npm run test:e2e`（`npx playwright test`）
- テスト実行後の`npm run test:e2e:report`（`npx playwright show-report`）
- `npm run test:e2e:ui`（`npx playwright test --ui`）
- `npm run test:e2e:debug`（`npx playwright test --debug`）

## 動作しなかったもの

- `npx playwright codegen`

## 参考

- https://playwright.dev/docs/intro
- GitHub Actionでテストがコケたときのトレースファイル確認方法
  - https://playwright.dev/docs/ci-intro#setting-up-github-actions
- PlaywrightのAIエージェント情報
  - https://playwright.dev/docs/test-agents
