# 環境構築方法

## 事前準備

- Vite+（`vp`）。未導入なら https://viteplus.dev/guide/ の手順でインストール
- Node.js は Vite+ が `.node-version`（24.19.0）から解決する
- npm は `package.json` の `devEngines.packageManager`（11.6.2）
- Git

## 構築手順

1. リポジトリを clone する（または git worktree を切る）
2. `vp install`
3. 初回のみ `npx playwright install`（chromium と webkit）
4. `npm run dev` で開発サーバを起動する。ポートは `node scripts/dev-ports.js` で確認できる

並列 worktree では、リンクされた worktree だけ Vite / Playwright のポートが自動でずれる。明示する場合は `DEV_PORT=5180 npm run dev`。

Cursor の Agent は `.cursor/hooks.json` で危険なシェルコマンドを deny する。

## デバッグの手順

1. `npm run dev` を実行する。
2. ステップ実行が必要であれば[実行とデバッグ]のサイドバーから[デバッグの開始]をクリックする。
   1. ブレークポイントを貼ることもできる。

## Zed Editorについて

- 基本的にVSCodeの前提で記載しているが、Zed Editorで動かす場合は以下を前提として試す。
- 拡張機能
  - Oxc

## 過去の Dev Container 設定

ホスト開発へ移行したため `.devcontainer/` は削除した。再導入したくなった場合は、次のコミットに当時のファイルが残っている。

- コミット: [`75a04d848c840d7682f78856519f1ef1e8d2c669`](https://github.com/Ran-Maru/recipe-suggester/commit/75a04d848c840d7682f78856519f1ef1e8d2c669)（当時の `main`。`feat: replace raw CSS with Tailwind CSS v4 (#60)`）
- 含まれるファイル:
  - `.devcontainer/devcontainer.json`
  - `.devcontainer/DockerFile`
  - `.devcontainer/devcontainer-lock.json`

復元例:

```bash
git checkout 75a04d848c840d7682f78856519f1ef1e8d2c669 -- .devcontainer
```
