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

- `vp upgrade`でグローバルコマンド vp のバージョンを上げる。
- pnpm-workspace.yaml に指定するVitestのバージョンを最新にする。
  - Vite Plusのリポジトリを見て、バージョンアップ先のVitestのバージョンを確認する。
    - 少なくともv1.0.0-rc.0の時点ではVitestのバージョンは明記する必要がありそう。
- `vp update`コマンドを実行する。

## Node.jsのアップデート方法

- `vp env list-remote`でインストール可能なnode.jsのバージョンを確認する。
- .node-version に記載されている node.js のバージョンを変更してから`vp env install`を実行する。

## pnpmのアップデート方法

- package.json に記載されている pnpm のバージョンを変更してから`vp install`を実行する。

## npm Packages, Action(GitHub Actions)のアップデート方法

- 基本的にdependabotが作成するPRをマージすればOK

## Zed Editorについて

- VSCodeの前提で記載しているが、Zed Editorで動かす場合は以下を前提とする。
- 拡張機能
  - Oxc
