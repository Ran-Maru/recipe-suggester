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

### Toolchain / runtime

- Node is managed by `nvm` with the default alias set to `24.19.0` (matches `.node-version`), and `pnpm` is pinned to `11.21.0` via Corepack (matches the `packageManager` / `devEngines` fields and the devcontainer `Dockerfile`). The update script only runs `pnpm install` + a Playwright browser install; the node/pnpm versions come from this persisted nvm setup.
- Gotcha: run commands in a login shell so `nvm` is sourced. A non-login shell may resolve `node` to `/exec-daemon/node` (v22) and mismatch the pinned `pnpm`, which triggers package-manager engine errors on `pnpm install`. The Cursor terminal login shells already handle this.
- `vp` is a project-local binary (`node_modules/.bin/vp`), not global here. Invoke it via the `package.json` scripts (`pnpm run dev`, `pnpm run check`, `pnpm run build`) or `pnpm exec vp`.

### Run / lint / build / test

- Dev server: `pnpm run dev` (runs `vp dev --host`) serves on `http://localhost:5173`.
- Lint + typecheck + mapping validation: `pnpm run check` (`vp check` then `scripts/check-mapping.json.js`).
- Build: `pnpm run build` (`tsc -b && vp build`).
- E2E tests: `pnpm exec playwright test`. Playwright auto-starts the dev server via the `webServer` block in `playwright.config.ts`, so you do NOT need to start `pnpm run dev` first. Browsers `chromium` and `webkit` are required; the `webkit` clipboard test is intentionally skipped (WebKit lacks clipboard API support).
- Git hooks: `vp config` (run by `pnpm` `prepare`) leaves `core.hooksPath` alone because Cursor already points it at its own agent hooks; this is expected, not an error.
