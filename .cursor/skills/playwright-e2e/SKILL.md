---
name: playwright-e2e
description: >-
  Runs and authors Playwright E2E tests for recipe-suggester. Use when writing
  E2E tests, debugging Playwright or CI test failures, running
  vp exec playwright test, or choosing worktree ports (Vite dev and preview,
  Playwright HTML report, Vitest browser API).
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
- URL: この worktree の dev ポート（下の表。`vp run print:dev-port` でも確認できる）
- `reuseExistingServer: !process.env.CI` — 同じ worktree で既に立っている dev server だけ再利用する。別 worktree の dev server には繋がない。

## Worktree のポート

複数 worktree を同時に起動してもポートがぶつからないように、`scripts/worktree-ports.ts` が cwd から offset を足す。`CI` または `/run/cursor/api.sock` があるときは offset 0（ベースポートのまま）。

| 用途                   | ベース | 上書き                    |
| ---------------------- | ------ | ------------------------- |
| Vite+ dev              | 5173   | `VITE_DEV_PORT` / `PORT`  |
| Vite+ preview          | 4173   | `PREVIEW_PORT`            |
| Playwright HTML report | 9323   | `PLAYWRIGHT_HTML_PORT`    |
| Vitest Browser API     | 63315  | `VITEST_BROWSER_API_PORT` |

Vite は `strictPort: true`。衝突したら次の空きポートへ逃げず失敗するので、表の環境変数で上書きする。

Playwright UI は config にポートが無い。ベース 8080 に dev と同じ offset を足して `--ui-port` を渡す。

```bash
vp exec playwright test --ui --ui-port <8080+offset>
```

## package.json の script

| Script                   | 用途                                            |
| ------------------------ | ----------------------------------------------- |
| `vp test`                | Vitest の unit + browser mode                   |
| `vp run test:e2e`        | `playwright test` と同じ                        |
| `vp run test:e2e:trace`  | trace を常時オンで実行                          |
| `vp run test:e2e:ui`     | trace 付きの対話 UI モード                      |
| `vp run test:e2e:debug`  | Playwright inspector                            |
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

## 見た目の比較（VRT）

`.github/workflows/vrt.yml` が PR と手動実行で動く。手動実行の入力は PR 番号。変更前・変更後の画面をその場でビルドして Playwright で撮り、画素比較する。画像は `vrt-output/`（gitignore）と Actions の artifact（`vrt-before`、`vrt-after`、`vrt-diff`、`vrt-report`）にだけ置く。スナップショットはリポジトリにコミットしない。

保持は 14 日。期限が切れても、保存済みの画像は使わず、PR 番号から SHA を引き直して同じ比較をやり直す。開いている PR は base と、head にその base をマージしたビルド。マージ済みならマージコミットと、その第一親（マージ直前）を比べる。

結果の HTML は `.github/workflows/vrt-publish.yml` が GitHub Pages の `/vrt/runs/<run-id>/` に載せ、URL を PR コメントへ書く。本番デプロイ（`gh-pages-deploy.yml`）は既存の `/vrt/` を消さない。

撮影シーンは `tests/vrt/vrt.spec.ts`。通常の E2E では `testIgnore` により走らない。

```bash
VRT=1 VRT_PREVIEW_CWD="$PWD" VRT_OUT_DIR=vrt-output/after bash scripts/vrt/capture.sh
```

`VRT_PREVIEW_CWD` は `vp run build` 済みのディレクトリ。比較は `node scripts/vrt/compare.ts <before> <after> <report>`。

## テスト範囲

`tests/test.spec.ts` がカバーするもの:

- **レシピGET ページ**: 「開く」が新しいタブを開く、「コピーする」がレシピ URL をコピーする
- **一覧（`/recipes`）**: コピーボタンが URL をクリップボードへ書く。スマホ幅（Mobile Chrome / Mobile Safari）ではコピー列を出さないので、このテストは `isMobile` のとき skip する

その他の UI と検索は `src/**/*.test.ts`（Node）と `src/**/*.browser.test.tsx`（Vitest Browser Mode）にある。

セレクタはアクセシブルなロールを優先する（`getByRole`、`getByTestId`）。

## CI の挙動

- `forbidOnly: !!process.env.CI`
- `retries: 2` は CI のみ
- `workers: 1` は CI
- Reporter: CI は `github` + `html`、ローカルは `html`
- ブラウザバイナリ（`~/.cache/ms-playwright`）は GitHub Actions のキャッシュに載せる。キーは OS、アーキテクチャ、Playwright のバージョン
- OS パッケージはランナーへ毎回 `install-deps` する。ブラウザの取得と同時に走らせ、キャッシュが当たったときはダウンロードを飛ばす

## トラブルシューティング

- **ブラウザが無い**: `vp exec playwright install --with-deps chromium webkit` を実行する
- **ポートが使用中**: この worktree のポートは `scripts/worktree-ports.ts` で決まる。`strictPort` のため勝手に次のポートへは行かない。`VITE_DEV_PORT` / `PORT` で上書きするか、そのポートのプロセスを止める
- **CI の trace**: アーティファクトをダウンロードし、Playwright の trace viewer で開く
