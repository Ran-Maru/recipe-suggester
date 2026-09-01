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

## Cursor Cloud specific instructions

This repo is a single frontend app: `recipe-suggester` ("レシピGET!"), a React + TypeScript + Vite+ site that suggests a random recipe URL from `src/mapping.json`. There is no backend.

### UI

- UI components come from [Mantine](https://mantine.dev/) (`@mantine/core` / `@mantine/hooks`). `src/main.tsx` imports `@mantine/core/styles.css` and wraps the router in `MantineProvider` with the theme from `src/theme.ts` (brand palette generated from `#646cff`, `defaultColorScheme="auto"`).
- `postcss.config.cjs` enables `postcss-preset-mantine` (mixins such as `@mixin dark`, and the `rem()` function) plus `postcss-simple-vars` for the `$mantine-breakpoint-*` variables. Mantine の `style` prop（`w`, `mt`, `bg` など）は使わない。コンポーネント固有の props（`variant`, `layout`, `striped` など）は積極的に使う。見た目は `className` / `classNames` と CSS Modules で実装し、動的スタイルが必要な場合のみ `style` で CSS Modules 内の CSS 変数を参照する。Mantine の `styles` prop は使わない。
- `src/index.css` only holds the few globals Mantine's reset does not cover.
- Icons come from `@phosphor-icons/react`. Import icons by their PascalCase name (e.g. `Copy`, `ArrowSquareOut`).

### Toolchain / runtime

- Node is managed by Vite Plus (matches `.node-version` `24.19.0`), and `pnpm` is pinned to `11.22.0` (matches the `devEngines` requirement). Use `vp install` / `vp add` / `vp remove` rather than calling pnpm directly; Vite+ downloads the pinned pnpm.
- `vp` is a project-local binary (`node_modules/.bin/vp`), not global here. Invoke it via `vp run <script>` (`vp run dev`, `vp run check`, `vp run build`) or `./node_modules/.bin/vp`. Do not use `npx` / `npm`; Vite+ does not translate mismatched package-manager commands.

### Run / lint / build / test

- Dev server: `vp run dev` (runs `vp dev`) serves on `http://localhost:5173`.
- Lint + typecheck + mapping validation: `vp run check` (`vp check` then `scripts/check-mapping.json.js`).
- Build: `vp run build` (`tsc -b && vp build`).

### Project skills

Detailed workflows live in `.cursor/skills/` — read the matching skill when relevant:

| Skill                | When to use                                                    |
| -------------------- | -------------------------------------------------------------- |
| `recipe-mapping`     | Adding or editing `src/mapping.json`                           |
| `playwright-e2e`     | Writing or running E2E tests, debugging Playwright/CI failures |
| `cursor-cloud-setup` | Cloud Agent bootstrap, Node/nvm issues, `.cursor/install.sh`   |
