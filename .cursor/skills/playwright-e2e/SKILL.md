---
name: playwright-e2e
description: >-
  Runs and authors Playwright E2E tests for recipe-suggester. Use when writing
  E2E tests, debugging Playwright or CI test failures, or running
  vp exec playwright test.
---

# Playwright E2E

E2E テストは `tests/` にあり、`@playwright/test` を使う。カバーするのはクリップボードへのコピーと、レシピを新しいタブで開く動作だけだ。検索ロジックとその他の UI は Vitest（`vp test`）側にある。

## テストの実行

Unit + Browser Mode（Vitest、Vite+ 経由）:

```bash
vp test
```

Playwright E2E:

```bash
vp exec playwright test
```

先に `vp run dev` を起動しない。`playwright.config.ts` が `webServer` で dev server を自動起動する。

- コマンド: `vp dev`
- URL: この worktree のポート（`scripts/worktree-ports.ts`。`vp run print:dev-port` で確認。CI / Cloud は offset 0）
- `reuseExistingServer: !process.env.CI` — 同じ worktree で既に立っている dev server だけ再利用する。別 worktree の dev server には繋がない。
- HTML report のポートも同じ offset（ベース 9323）

Playwright UI を並行起動するときは `--ui-port` を worktree ごとにずらす。

```bash
vp exec playwright test --ui --ui-port 8080
```

## package.json の script

| Script                   | 用途                                        |
| ------------------------ | ------------------------------------------- |
| `vp test`                | Vitest の unit + browser mode               |
| `vp run test:e2e`        | `playwright test` と同じ                    |
| `vp run test:e2e:trace`  | trace を常時オンで実行                      |
| `vp run test:e2e:ui`     | trace 付きの対話 UI モード                  |
| `vp run test:e2e:debug`  | Playwright inspector                        |
| `vp run test:e2e:report` | HTML レポートを開く（`playwright show-report`） |

## ブラウザプロジェクト

`playwright.config.ts` の設定:

- `chromium`（Desktop Chrome）
- `Mobile Chrome`（Pixel 7）
- `Mobile Safari`（iPhone 13 Pro）

Cloud Agent のインストール（`.cursor/install.sh`）は `chromium` と `webkit` のブラウザバイナリも入れる。

## WebKit のクリップボード skip

WebKit はクリップボード API を安定してサポートしていない。クリップボードのテストは WebKit では意図的に skip する。

```typescript
test.skip(browserName === "webkit", "WebKit lacks clipboard API support");
```

この skip を失敗として扱わない。

## テスト範囲

`tests/test.spec.ts` がカバーするもの:

- **レシピGET ページ**: 「開く」が新しいタブを開く、「コピーする」がレシピ URL をコピーする
- **一覧（`/recipes`）**: コピーボタンが URL をクリップボードへ書く

その他の UI と検索は `src/**/*.test.ts`（Node）と `src/**/*.browser.test.tsx`（Vitest Browser Mode）にある。

セレクタはアクセシブルなロールを優先する（`getByRole`、`getByTestId`）。

## CI の挙動

- `forbidOnly: !!process.env.CI`
- `retries: 2` は CI のみ
- `workers: 1` は CI
- Reporter: CI は `github` + `html`、ローカルは `html`

## トラブルシューティング

- **ブラウザが無い**: `vp exec playwright install --with-deps chromium webkit` を実行する
- **ポートが使用中**: この worktree のポートは `scripts/worktree-ports.ts` で決まる。`strictPort` のため勝手に次のポートへは行かない。`VITE_DEV_PORT` / `PORT` で上書きするか、そのポートのプロセスを止める
- **CI の trace**: アーティファクトをダウンロードし、Playwright の trace viewer で開く
