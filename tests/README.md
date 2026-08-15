# Playwrightの動作確認状況

## 正常動作したもの

- `npx playwright test`
- テスト実行後の`npm run test:e2e:report`（ポートは worktree ごとに `scripts/dev-ports.js` が決める）
- `npx playwright test --ui`

## 参考

- https://playwright.dev/docs/intro
- GitHub Actionでテストがコケたときのトレースファイル確認方法
  - https://playwright.dev/docs/ci-intro#setting-up-github-actions
- PlaywrightのAIエージェント情報
  - https://playwright.dev/docs/test-agents
