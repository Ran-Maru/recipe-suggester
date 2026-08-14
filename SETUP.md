# 環境構築方法

ホストで開発するのが既定です。Dev Container は任意です。

## ホストで開発する場合

### 事前準備

- Node.js 24.19.0（`.node-version`。nvm なら `nvm use`）
- npm 11.6.2（`package.json` の `devEngines`）
- Git

### 構築手順

1. リポジトリを clone する（または git worktree を切る）
2. `npm install`
3. 初回のみ `npx playwright install`（chromium と webkit）
4. `npm run dev` で開発サーバを起動する。ポートは `node scripts/dev-ports.js` で確認できる

並列 worktree では、リンクされた worktree だけ Vite / Playwright のポートが自動でずれる。明示する場合は `DEV_PORT=5180 npm run dev`。

Cursor の Agent は `.cursor/hooks.json` で危険なシェルコマンドを deny する。

## Dev Container を使う場合

### 事前準備

- VSCodeのインストール
- Dockerのインストール
  - Docker Desktop等
- Gitのインストール
- VSCodeに[Dev Container拡張機能](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)をインストール
- 本リポジトリのgit clone

### 構築手順

1. Dockerが起動していることを確認する。
2. VSCodeで本フォルダを開く
3. 画面左下のマークをクリックして「コンテナーで再度開く」をクリックする。
4. コンテナがビルドされ開発環境が起動する。

## デバッグの手順

1. コンテナ内で`npm run dev`を実行する。
2. ステップ実行が必要であれば[実行とデバッグ]のサイドバーから[デバッグの開始]をクリックする。
   1. ブレークポイントを貼ることもできる。

## Zed Editorについて

- 基本的にVSCodeの前提で記載しているが、Zed Editorで動かす場合は以下を前提として試す。
- 拡張機能
  - Dockerfile
  - Oxc
- devcontainerを使う場合の制約
  - デバッガー（.vscode/launch.json）を使うとタイムアウトする。
    - https://github.com/zed-industries/zed/issues/57021
  - ローカルだと問題なくうまくいく。

## devcontainerとローカルの違い

- ローカルだとtsファイルに対して謎のフォーマットが実行される。
  - Oxcの拡張機能をON/OFFにして確認したら、Oxc拡張機能が原因の模様
- devcontainerだとOxc拡張機能が起動できない。
  - devcontainerの権限 or Oxc拡張機能のdevcontainer対応が進んでいないかのどちらか
    - devcontainer使わなくても良い気がしてきた。。。。
