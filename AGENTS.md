<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

## Cursor Cloud 向けの手順

このリポジトリはフロントエンドだけのアプリ `recipe-suggester`（「レシピGET!」）だ。React + TypeScript + Vite+ で、`src/mapping.json` からレシピ URL をランダムに提案する。バックエンドはない。

### UI

- UI コンポーネントは [Mantine](https://mantine.dev/)（`@mantine/core` / `@mantine/hooks`）。`src/main.tsx` が `@mantine/core/styles.css` を import し、ルーターを `MantineProvider` で包む。テーマは `src/theme.ts`（ブランドパレットは `#646cff` から生成、`defaultColorScheme="auto"`）。
- `postcss.config.cjs` は `postcss-preset-mantine`（`@mixin dark` や `rem()`）と、`$mantine-breakpoint-*` 用の `postcss-simple-vars` を有効にする。Mantine の `style` prop（`w`, `mt`, `bg` など）は使わない。コンポーネント固有の props（`variant`, `layout`, `striped` など）は積極的に使う。見た目は `className` / `classNames` と CSS Modules で実装し、動的スタイルが必要な場合のみ `style` で CSS Modules 内の CSS 変数を参照する。Mantine の `styles` prop は使わない。
- `src/index.css` には、Mantine のリセットがカバーしない少数のグローバルだけを置く。
- アイコンは `@phosphor-icons/react`。PascalCase の名前で import する（例: `Copy`, `ArrowSquareOut`）。
- スマホのタップ領域とアイコンサイズは `.cursor/skills/mobile-touch-targets/SKILL.md` と `src/touchTarget.ts` に従う。単独の `ActionIcon` は `xl`（44px）、Phosphor アイコンは 24px。検索欄は `TextInput` `lg`。16px / 18px のアイコンは使わない。

### ツールチェーン / ランタイム

- Node は Vite Plus が管理する（`.node-version` の `24.19.0` と一致）。`pnpm` は `11.22.0` に固定（`devEngines` の要件と一致）。pnpm を直接呼ばず、`vp install` / `vp add` / `vp remove` を使う。固定版の pnpm は Vite+ がダウンロードする。
- `vp` はプロジェクトローカルのバイナリ（`node_modules/.bin/vp`）で、グローバルには入っていない。`vp run <script>`（`vp run dev`、`vp run check`、`vp run build`）か `./node_modules/.bin/vp` で呼ぶ。`npx` / `npm` は使わない。Vite+ は、別のパッケージマネージャ向けのコマンドには置き換えない。

### 実行 / lint / build / test

- Dev server: `vp run dev`（中身は `vp dev`）。ポートは worktree ごとに `scripts/worktree-ports.ts` で決まる（ベース 5173 + cwd 由来の offset）。`vp run print:dev-port` またはターミナルの Local URL を使う。CI / Cloud は offset 0。上書きは `VITE_DEV_PORT` または `PORT`。
- Lint + 型チェック + mapping 検証: `vp run check`（`cmk`、続けて `vp check`、stylelint、`scripts/check-mapping.json.js`）。
- Unit + Browser Mode のテスト: `vp test`。
- E2E（クリップボードへのコピーと、新しいタブで開く）: `vp exec playwright test`。Playwright は同じ worktree のポートを `baseURL` にする。別 worktree の dev server は使わない。
- Build: `vp run build`（`cmk && tsc -b && vp build`）。`tsc` は TypeScript 7（`typescript-7`）。CSS Modules Kit 向けに `typescript` は TypeScript 6 へエイリアスされている。
- CSS: stylelint（`vp run lint:css`）と CSS Modules Kit（`cmk` / ts-plugin）。フォーマットは Oxfmt のまま。

### Worktree のポート

複数 worktree を同時に起動してもポートがぶつからないようにする。

| 用途                   | ベース | 上書き                    |
| ---------------------- | ------ | ------------------------- |
| Vite+ dev              | 5173   | `VITE_DEV_PORT` / `PORT`  |
| Vite+ preview          | 4173   | `PREVIEW_PORT`            |
| Playwright HTML report | 9323   | `PLAYWRIGHT_HTML_PORT`    |
| Vitest Browser API     | 63315  | `VITEST_BROWSER_API_PORT` |

`CI` または `/run/cursor/api.sock` があるときは offset 0（ベースポートのまま）。Vite は `strictPort: true`。衝突したら次の空きポートへ逃げず失敗するので、`PORT=` で上書きする。

Playwright UI は config にポートが無い。`vp exec playwright test --ui --ui-port <8080+offset>` のようにずらす。

### 安全フック

`.cursor/hooks.json` の bash hook（`failClosed`、危険そうなコマンドだけ matcher）が戻らない破壊を拒否する。実装は `scripts/dangerous-command-policy.sh`。

- `beforeShellExecution`: 素の `git push --force` / `-f` / `+refspec`、`git reset --hard`、`git clean -x`/`-X`、worktree 全体を捨てる `checkout`/`restore`、`rm -rf` の `/` / `$HOME` / `.git` / `src/` / worktree ルート、`chmod 777`、worktree 外への `mv`、`/tmp` 以外の worktree 外への `cp`
- `preToolUse` (`Write` / `StrReplace` / `Delete` / `EditNotebook`): 現在の worktree の外と `.git/` 配下の編集
- Cloud 専用: commit と push の同一コマンド禁止、commit 後の Co-authored-by 修正

許可する例: `git push --force-with-lease`、`git clean -fd`、`rm -rf tmp` / `node_modules` / `/tmp/...`、`cp file /tmp/file`、`git reset`（`--hard` なし）、単一ファイルの `git restore`。

### プロジェクトのスキル

詳しい手順は `.cursor/skills/` と `.agents/skills/` にある。該当するスキルを読んでから作業する。

| Skill                  | 使うとき                                                                 |
| ---------------------- | ------------------------------------------------------------------------ |
| `recipe-mapping`       | `src/mapping.json` の追加・編集                                          |
| `playwright-e2e`       | E2E テストの作成・実行、Playwright / CI の失敗調査                       |
| `cursor-cloud-setup`   | Cloud Agent の初期化、Node / nvm の不整合、`.cursor/install.sh`          |
| `mobile-touch-targets` | ボタン、アイコン、検索欄（アドレスバー相当）のサイズ、スマホのタップ領域 |
| `natural-japanese`     | 日本語を自然に書く・直す                                                 |
| `upgrade-toolchain`    | Vite Plus、Node.js、pnpm、Vitest ピンのバージョンアップ                  |
