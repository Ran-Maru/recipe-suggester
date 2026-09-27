---
name: cursor-cloud-setup
description: >-
  Sets up and troubleshoots the Cursor Cloud Agent environment for
  recipe-suggester. Use when configuring Cloud Agent, debugging Node or nvm
  version mismatches, environment.json, or .cursor/install.sh.
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

ローカルで複数 worktree を並列起動する場合、dev / preview / Playwright HTML のポートは `scripts/worktree-ports.ts` が cwd からずらす。Cloud VM と CI は隔離済みなので 5173 / 4173 / 9323 のまま。この `environment.json` のポート宣言は Cloud 用なので変更しない。

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

## Git hook について

`vp config`（pnpm の `prepare`）は、Cursor がすでに agent hook を指しているとき `core.hooksPath` を触らない。想定どおりで、エラーではない。

## Cloud Agent のコミットメール

Cursor アカウントの個人メールが `Co-authored-by` に付くのを防ぐ公式設定は無い。
`.cursor/hooks.json` の `afterShellExecution` が、ホスト型 Cloud Agent（`/run/cursor/api.sock` があるとき）の `git commit` 直後だけメッセージを直す。
同じコマンドで `git commit` と `git push` をつなぐと、その前に `beforeShellExecution` が拒否する。ローカルではその commit+push 分割 hook は動かない。

ローカルでも `bash .cursor/hooks/deny-dangerous-commands.sh` と `deny-outside-worktree.sh` が、素の force push / `reset --hard` / 危険な `rm -rf`（`/`・ホーム・`.git`・`src/`・worktree ルート）/ worktree 外への編集を拒否する。`git push --force-with-lease` と `git clean -fd` は許可する。

## セットアップがおかしいとき

1. `bash .cursor/install.sh` を再実行する
2. `vp env doctor` を実行し、助けを求めるときにその出力を添える
3. 環境の準備ができたと伝える前に、`vp run check` が通ることを確認する
