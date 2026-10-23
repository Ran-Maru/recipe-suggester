# 環境構築方法

## 事前準備

- VSCode(Cursor)のインストール
- Gitのインストール
- 本リポジトリのgit clone

Node.js, pnpm のバージョンは Vite Plus で管理する。（[`.node-version`](.node-version)[`package.json`](package.json) の `devEngines` の pnpm）。セットアップやランタイムがおかしいときは `vp env doctor` を実行する。

## 構築手順

1. リポジトリを clone したフォルダで `vp install` を実行する（Vite Plus がランタイムと pnpm を揃える）。
2. Playwright のブラウザをインストールする（Vitest Browser Mode と E2E の両方で使う）。

   ```sh
   vp exec playwright install chromium webkit
   ```

3. VSCodeで本フォルダを開く。
4. `vp run dev` を実行し、ターミナルに表示された Local URL で起動を確認する（ポートは `vp run print:dev-port` でも確認できる）。

テスト:

- `vp test` — Vitest の unit と Browser Mode
- `vp exec playwright test` — クリップボード / 別タブの E2E

## デバッグの手順

1. [実行とデバッグ] から **Vite: dev + Chrome** を選ぶ（`vp run dev` 起動後、表示された Local URL で Chrome が開く）。
2. すでに `vp run dev` を起動している場合は **Vite: Chrome（dev 起動済み）** を使い、`vp run print:dev-port` で確認したポートを含む URL を入力する。
3. ステップ実行が必要ならブレークポイントを貼ってから上記を実行する。

## Vite Plusのアップデート手順

- `vp upgrade` でグローバル CLI を上げる。
- ワークスペースルートで `vp migrate --no-interactive` を実行する。`--full` は付けない。
- catalog の `vite-plus` と `vite`（`@voidzero-dev/vite-plus-core`）が同じバージョンか、`pnpm-workspace.yaml` の `vitest@*` が `vp toolchain vitest` のバージョンかを確認する。
- 依存の入れ直しは `vp install`。`vp update` は依存全体が上がる。

詳細は [`.agents/skills/upgrade-toolchain/SKILL.md`](.agents/skills/upgrade-toolchain/SKILL.md) を参照する。

## Node.jsのアップデート方法

- 24 系は Renovate が `.node-version` を更新する。メジャーは人が上げる。
- `vp env list-remote`でインストール可能なnode.jsのバージョンを確認する。
- .node-version に記載されている node.js のバージョンを変更してから`vp env install`を実行する。メジャーのときは `@types/node` のメジャーも合わせる。

## pnpmのアップデート方法

- `package.json` の `devEngines.packageManager.version` を変更する。
- [`.cursor/install.sh`](.cursor/install.sh) はそのフィールドを読む。同じ番号をスクリプトに書かない。
- `vp install` を実行する。

## npm Packages, Action(GitHub Actions)のアップデート方法

- Renovate が作る PR のうち、`hold` が無いものは CI が squash マージする。
- `hold` が付いた PR（vite-plus グループ、`oxc-transform-react`、major）は内容を見てからマージする。
- Node の 24 系は `.node-version`、pnpm は `devEngines.packageManager.version` を Renovate が更新する。

## Zed Editorについて

- VSCodeの前提で記載しているが、Zed Editorで動かす場合は以下を前提とする。
- 拡張機能
  - Oxc
