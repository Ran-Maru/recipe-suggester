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

# recipe-suggester

フロントエンドだけのアプリ（「レシピGET!」）。React + TypeScript + Vite+ で、`src/mapping.json` からレシピ URL をランダムに提案する。バックエンドはない。

該当するものを読んでから作業する。手順の本文はスキルとルール側にある。

| 読むもの                                                                 | 使うとき                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.cursor/rules/mantine-ui.mdc`                                           | `src/**/*.{tsx,css}` の Mantine、CSS Modules、Phosphor                                                                                                                                                                                                |
| `.cursor/rules/mobile-touch-targets.mdc` とスキル `mobile-touch-targets` | ボタン、アイコン、検索欄（アドレスバー相当）、スマホのタップ領域                                                                                                                                                                                      |
| `recipe-mapping`                                                         | `src/mapping.json` の追加・編集                                                                                                                                                                                                                       |
| `playwright-e2e`                                                         | E2E テストの作成・実行、Playwright / CI の失敗調査、worktree のポート                                                                                                                                                                                 |
| `cursor-cloud-setup`                                                     | Cloud Agent の初期化、Node / nvm の不整合、`.cursor/install.sh`、`vp` の呼び方、lint / build、安全フック                                                                                                                                              |
| `scripts/lint-shell-and-workflows.sh`                                    | ShellCheck と actionlint（CI の `ShellCheck and actionlint`）。Linux では `scripts/install-ci-linters.sh <dir>` で同じ版を入れ、PATH を通してこのスクリプトを実行する。ほかの OS では PATH にある shellcheck と actionlint で同じスクリプトを実行する |
| `natural-japanese`                                                       | 日本語を自然に書く・直す                                                                                                                                                                                                                              |
| `upgrade-toolchain`                                                      | Vite Plus、Node.js、pnpm、Vitest ピンのバージョンアップ                                                                                                                                                                                               |

スキルは `.cursor/skills/` と `.agents/skills/` にある。`.cursor/rules/` は `alwaysApply: false` で、上の glob のファイルを触るときだけ付く。
