---
name: upgrade-toolchain
description: >-
  Upgrades the Vite Plus global CLI, the project-local vite-plus package,
  Node.js, and pnpm in recipe-suggester. Use when bumping Vite Plus, vp,
  Node.js, .node-version, pnpm, devEngines, or the Vitest pin in
  pnpm-workspace.yaml.
---

# ツールチェーンのバージョンアップ

Vite Plus、Node.js、pnpm は別々に上げる。バージョン番号の正はリポジトリのファイルであり、このスキルに書いてある番号ではない。

作業前に公式を読む。

- グローバル CLI: https://viteplus.dev/guide/upgrade
- プロジェクトの `vite-plus`: https://viteplus.dev/guide/upgrade-project
- Node.js とパッケージマネージャ: https://viteplus.dev/guide/env

rc の間はピンの書き先が変わり得る。公式とこのリポジトリの配置が食い違ったら公式の新しいピンに合わせ、下の「残すもの」は維持する。

人間向けの短いメモは `SETUP.md`。手順を変えたときだけ、その節も合わせる。

## 残すもの

- Node.js は `.node-version` のみ。`.nvmrc` と `devEngines.runtime` は追加しない。`v` プレフィックスは付けない。
- pnpm は `package.json` の `devEngines.packageManager`（`name`、`version`、`onFail: "download"`）。トップレベルの `packageManager` は追加しない。
- `pnpm-workspace.yaml` の default catalog で `vite-plus` と `vite` を同じバージョンにする。`vite` は `npm:@voidzero-dev/vite-plus-core@<そのバージョン>`。
- `package.json` の `vite` と `vite-plus` は `catalog:` のまま。
- overrides のキーは `vite@*` と `vitest@*`。bare key（`vite`、`vitest`）に戻さない。bare key は `catalog:` まで上書きし、更新コマンドが具体バージョンへ書き換える。
- `vite@*` の値は `"catalog:"`。
- `peerDependencyRules` は維持する。

## 現状の確認

ワークスペースルートで実行する。

```bash
vp toolchain
vp toolchain --global
vp env current
```

あわせて `.node-version`、`package.json` の `devEngines`、`pnpm-workspace.yaml` の catalog と overrides を読む。

`vp upgrade`、`vp env`、バージョンを上げるための `vp migrate` はグローバル CLI で実行する。プロジェクトの `node_modules/.bin/vp` は、上げる前の `vite-plus` のままである。

## Vite Plus

グローバル CLI と、プロジェクトの `vite-plus` は独立している。プロジェクトを上げるときは、グローバル CLI を先に目的のバージョンにする。グローバルの方が新しい状態で `vp migrate` を実行すると、プロジェクトはそのグローバルのバージョンへ上がる。

### グローバル CLI

```bash
vp upgrade --check
vp upgrade
vp toolchain --global
```

特定バージョンは `vp upgrade <version>`。Homebrew 管理のインストールでは `vp upgrade` が `brew upgrade vite-plus` を案内するので、それに従う。

### プロジェクト

ワークスペースルートで、対話なし・初回セットアップなしで実行する。

```bash
vp migrate --no-interactive
```

`--full` は付けない。既存の Vite+ プロジェクトでは git hooks、`AGENTS.md`、エディタ設定の再セットアップが走る。`--agent` や `--editor` も付けない。

差分を確認する。残す変更は catalog、`vite` の core エイリアス、`vitest@*` のピン、lockfile、Vitest に追随する直接依存だけにする。`AGENTS.md`、hooks、エディタ設定、無関係な依存の差分は戻す。

`vp migrate` を使わない場合:

1. catalog の `vite-plus` と `vite`（`@voidzero-dev/vite-plus-core`）を同じバージョンにする。
2. そのバージョンの CLI でバンドルされている Vitest を確認する。

   ```bash
   vp toolchain vitest
   ```

3. `overrides` の `vitest@*` をその正確なバージョンにする。古いままだと `vp test` と依存の Vitest が分裂する。
4. `vp install` で lockfile を更新する。

`@vitest/browser-playwright` は `vitest@*` と同じバージョンに揃える。`playwright` と `@playwright/test` は互いのバージョンを揃える。`vitest-browser-react` は Vitest 本体とは別パッケージなので、互換を確認してから上げる。

Dependabot の `vite-plus` グループ（`vite-plus`、`vite`、`vitest`、`@vitest/*`、`vitest-browser-react`）は CI の自動マージ対象外。このグループの PR を取り込むときも、catalog と `vitest@*` が同時に揃っているか見る。

`vp update` は依存全体を上げる。Vite+ だけの更新では使わない。インストールは `vp install`。

## Node.js

```bash
vp env list-remote --lts
```

`.node-version` を正確なバージョンに書き換えてからインストールする。

```bash
vp env install
vp env current
```

`vp env pin <version> --target node-version --force` でも同じファイルを更新できる。`--target` を省略すると、このリポジトリでは既存の `.node-version` が更新される。`devEngines.runtime` へ書かない。

Node.js のメジャーを上げたら `@types/node` のメジャーも合わせる。Dependabot は `@types/node` のメジャー更新を無視している。

CI と GitHub Pages は `voidzero-dev/setup-vp` の `node-version-file: ".node-version"` を読む。ワークフローに Node のバージョンを直書きしない。

## pnpm

```bash
vp env list-remote pnpm
```

`package.json` の `devEngines.packageManager.version` を書き換え、`onFail` は `"download"` のままにする。続けて同じバージョンを `.cursor/install.sh` の `corepack prepare pnpm@...` に書く。これは `node_modules/.bin/vp` がまだ無いときのフォールバックである。

```bash
vp install
```

`vp env pin pnpm@<version>` はトップレベルの `packageManager` を書くので使わない。

## バージョン表記の追随

ピンを変えたら、同じ番号が書いてある次の文書も更新する。

- `AGENTS.md`（`CLAUDE.md` はシンボリックリンク）
- `.cursor/skills/cursor-cloud-setup/SKILL.md`

## 検証

```bash
vp install
vp run check
vp test
vp run build
```

Node.js か pnpm を変えたあとにランタイムが怪しいときは `vp env doctor` の出力を残す。`npx` と `npm` は使わない。コミットと push は依頼されたときだけ行う。
