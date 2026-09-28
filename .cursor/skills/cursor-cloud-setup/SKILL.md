---
name: cursor-cloud-setup
description: >-
  Sets up and troubleshoots the Cursor Cloud Agent environment for
  recipe-suggester, and documents how to call vp. Use when configuring Cloud
  Agent, debugging Node or nvm version mismatches, environment.json, or
  .cursor/install.sh, when running vp run dev, vp run check, vp run build, or
  vp test, or when a safety hook blocks a command.
---

# Cursor Cloud のセットアップ

このリポジトリの Cloud Agent 初期化は `.cursor/` 配下で定義している。

## environment.json

`.cursor/environment.json` の設定:

| キー           | 値                                                |
| -------------- | ------------------------------------------------- |
| `install`      | `bash .cursor/install.sh`                         |
| `terminals[0]` | `vp run dev`（Cloud はベースポート 5173）         |
| `ports`        | 5173（Vite+ dev）、9323（Playwright HTML report） |

ローカルで複数 worktree を並列起動する場合、dev / preview / Playwright HTML のポートは `scripts/worktree-ports.ts` が cwd からずらす。Cloud VM と CI は隔離済みなので 5173 / 4173 / 9323 のまま。この `environment.json` のポート宣言は Cloud 用なので変更しない。ポートの一覧（Vitest Browser API の 63315 を含む）と `strictPort` は `playwright-e2e` スキルにある。

## install.sh

`.cursor/install.sh` は Cloud Agent の起動時に走る。

1. nvm を読み込み、`.node-version` の Node（`24.19.0`）を入れて使う
2. nvm の Node を `PATH` の先頭に置く（非ログインシェルで `/exec-daemon/node` の v22 を避ける）
3. `node_modules/.bin/vp` があることを確認する（無ければ corepack で pnpm `11.22.0` を用意する）
4. `vp install` を実行する
5. `vp exec playwright install --with-deps chromium webkit` を実行する

## Node / nvm の落とし穴

非ログインシェルでは、固定した Node ではなく `/exec-daemon/node`（v22）が `node` として解決されることがある。

- nvm が読み込まれるよう、**ログインシェル**でコマンドを実行する（Cursor のターミナルは既定でそうなる）。
- install スクリプトも、nvm の Node を `PATH` の先頭に置く。

確認:

```bash
node --version   # v24.19.0 であること
which node       # ~/.nvm/versions/node/... の下であること
```

## vp の呼び方

`vp` はプロジェクトローカル（`node_modules/.bin/vp`）で、グローバルではない。

```bash
vp run dev
vp run check
vp run build
vp exec playwright test
```

`npx` や `npm` は使わない。Vite+ は、別のパッケージマネージャ向けのコマンドには置き換えない。

pnpm を直接呼ばず、`vp install` / `vp add` / `vp remove` を使う。

## lint / build / CSS

- Lint + 型チェック + レシピ検証: `vp run check`。中身は `cmk -p tsconfig.app.json`、続けて `vp check`、stylelint（`src/**/*.css`）、`scripts/check-mapping.json.js`、`scripts/check-original-recipes.json.js`。
- Unit + Browser Mode のテスト: `vp test`。E2E は `playwright-e2e` スキル。
- Build: `vp run build`（`cmk -p tsconfig.app.json && tsc -b && vp build`）。`tsc` は TypeScript 7（`typescript-7`）。CSS Modules Kit 向けに `typescript` は TypeScript 6 へエイリアスされている。
- CSS: stylelint（`vp run lint:css`）と CSS Modules Kit（`cmk` / `@css-modules-kit/ts-plugin`）。フォーマットは Oxfmt のまま。

## Git hook について

`vp config`（pnpm の `prepare`）は、Cursor がすでに agent hook を指しているとき `core.hooksPath` を触らない。想定どおりで、エラーではない。

## Cloud Agent のコミットメール

Cursor アカウントの個人メールが `Co-authored-by` に付くのを防ぐ公式設定は無い。
`.cursor/hooks.json` の `afterShellExecution` が、ホスト型 Cloud Agent（`/run/cursor/api.sock` があるとき）の `git commit` 直後だけメッセージを直す。
同じコマンドで `git commit` と `git push` をつなぐと、その前に `beforeShellExecution` が拒否する。ローカルではその commit+push 分割 hook は動かない。

## 安全フック

`.cursor/hooks.json` の bash hook（`failClosed`、危険そうなコマンドだけ matcher）が戻らない破壊を拒否する。実装は `scripts/dangerous-command-policy.sh`。ローカルでも `deny-dangerous-commands.sh` と `deny-outside-worktree.sh` が動く。

- `beforeShellExecution`: 素の `git push --force` / `-f` / `+refspec`、`git reset --hard`、`git clean -x`/`-X`、worktree 全体を捨てる `checkout`/`restore`、`rm -rf` の `/` / `$HOME` / `.git` / `src/` / worktree ルート、`chmod 777`、worktree 外への `mv`、`/tmp` 以外の worktree 外への `cp`
- `preToolUse` (`Write` / `StrReplace` / `Delete` / `EditNotebook`): 現在の worktree の外と `.git/` 配下の編集
- Cloud 専用: commit と push の同一コマンド禁止、commit 後の Co-authored-by 修正

許可する例: `git push --force-with-lease`、`git clean -fd`、`rm -rf tmp` / `node_modules` / `/tmp/...`、`cp file /tmp/file`、`git reset`（`--hard` なし）、単一ファイルの `git restore`。

## セットアップがおかしいとき

1. `bash .cursor/install.sh` を再実行する
2. `vp env doctor` を実行し、助けを求めるときにその出力を添える
3. 環境の準備ができたと伝える前に、`vp run check` が通ることを確認する
