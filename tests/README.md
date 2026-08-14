# Playwrightの動作確認状況

## 正常動作したもの

- `pnpm test:e2e` / `pnpm exec playwright test`
- テスト実行後の`pnpm test:e2e:report` / `pnpm exec playwright show-report --host 0.0.0.0 --port 9323`
- `pnpm test:e2e:ui` / `pnpm exec playwright test --ui`

## 動作しなかったもの

- `pnpm exec playwright test --debug`
  - devcontainerで使うのは難しそう。
  - uiモードやtraceファイルが代わりになりそう。（ステップ実行などはできなさそう）
- `pnpm exec playwright codegen`

## 参考

- https://playwright.dev/docs/intro
- GitHub Actionでテストがコケたときのトレースファイル確認方法
  - https://playwright.dev/docs/ci-intro#setting-up-github-actions
- PlaywrightのAIエージェント情報
  - https://playwright.dev/docs/test-agents
