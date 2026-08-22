# 環境構築方法

## 事前準備

- VSCode(Cursor)のインストール
- Gitのインストール
- 本リポジトリのgit clone

Node.js, pnpm のバージョンは Vite Plus で管理する。（[`.node-version`](.node-version)[`package.json`](package.json) の `devEngines` の pnpm）。セットアップやランタイムがおかしいときは `vp env doctor` を実行する。

## 構築手順

1. リポジトリを clone したフォルダで `vp install` を実行する（Vite Plus がランタイムと pnpm を揃える）。
2. Playwright のブラウザをインストールする。

   ```sh
   vp exec playwright install chromium webkit
   ```

3. VSCodeで本フォルダを開く。
4. `vp run dev` を実行し、`http://localhost:5173` で起動を確認する。

## デバッグの手順

1. `vp run dev` を実行する。
2. ステップ実行が必要であれば[実行とデバッグ]のサイドバーから[デバッグの開始]をクリックする。
   1. ブレークポイントを貼ることもできる。

## Zed Editorについて

- VSCodeの前提で記載しているが、Zed Editorで動かす場合は以下を前提とする。
- 拡張機能
  - Oxc
