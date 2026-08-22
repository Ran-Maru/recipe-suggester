# Playwrightの動作確認状況

## 正常動作したもの

- `vp run test:e2e`（`vp exec playwright test`）
- テスト実行後の`vp run test:e2e:report`（`vp exec playwright show-report`）
- `vp run test:e2e:ui`（`vp exec playwright test --ui`）
- `vp run test:e2e:debug`（`vp exec playwright test --debug`）

## 動作しなかったもの

- `vp exec playwright codegen`

## 参考

- https://playwright.dev/docs/intro
- GitHub Actionでテストがコケたときのトレースファイル確認方法
  - https://playwright.dev/docs/ci-intro#setting-up-github-actions
- PlaywrightのAIエージェント情報
  - https://playwright.dev/docs/test-agents
