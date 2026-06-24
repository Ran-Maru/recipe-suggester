# Playwrightの動作確認状況

## 正常動作したもの

- `npx playwright test`
- テスト実行後の`npx playwright show-report --host 0.0.0.0 --port 9323`
- `npx playwright test --ui`

## 動作しなかったもの

- `npx playwright test --debug`
  - devcontainerで使うのは難しそう。
  - uiモードやtraceファイルが代わりになりそう。（ステップ実行などはできなさそう）
- `npx playwright codegen`

## 参考

- https://playwright.dev/docs/intro
- GitHub Actionでテストがコケたときのトレースファイル確認方法
  - https://playwright.dev/docs/ci-intro#setting-up-github-actions
- PlaywrightのAIエージェント情報
  - https://playwright.dev/docs/test-agents
