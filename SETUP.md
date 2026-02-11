# 環境構築方法

## 事前準備

- VSCodeのインストール
- Dockerのインストール
  - Docker Desktop等
- Gitのインストール
- VSCodeに[Dev Container拡張機能](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)をインストール
- 本リポジトリのgit clone

## 構築手順

1. Dockerが起動していることを確認する。
2. VSCodeで本フォルダを開く
3. 画面左下のマークをクリックして「コンテナーで再度開く」をクリックする。
4. コンテナがビルドされ開発環境が起動する。

## デバッグの手順

1. コンテナ内で`npm run dev`を実行する。
2. ステップ実行が必要であれば[実行とデバッグ]のサイドバーから[デバッグの開始]をクリックする。
   1. ブレークポイントを貼ることもできる。
