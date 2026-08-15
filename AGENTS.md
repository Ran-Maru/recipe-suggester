<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

## Cursor Cloud specific instructions

This repo is a single frontend app: `recipe-suggester` ("レシピGET!"), a React + TypeScript + Vite+ site that suggests a random recipe URL from `src/mapping.json`. There is no backend.

### Toolchain / runtime

- Node.js and npm are managed by Vite+ (`vp env`). `.node-version` pins Node 24.19.0; `package.json` `devEngines.packageManager` pins npm 11.6.2. `.cursor/environment.json` `install` runs `vp install` and a Playwright browser install.
- Prefer `vp install` and `vp run <script>` so the managed runtime is used. Bare `npm` from `/exec-daemon/node` (v22) can fail with `npm error EBADDEVENGINES`. If runtime or package-manager behavior looks wrong, run `vp env doctor`.
- After install, `vp` is available as `node_modules/.bin/vp`. Invoke it via the `package.json` scripts (`npm run dev`, `npm run check`, `npm run build`) or `npx vp`.

### Run / lint / build / test

- Dev server: `npm run dev` (runs `vp dev --host`) serves on `http://localhost:5173`.
- Lint + typecheck + mapping validation: `npm run check` (`vp check` then `scripts/check-mapping.json.js`).
- Build: `npm run build` (`tsc -b && vp build`).
- E2E tests: `npx playwright test`. Playwright auto-starts the dev server via the `webServer` block in `playwright.config.ts`, so you do NOT need to start `npm run dev` first. Browsers `chromium` and `webkit` are required; the `webkit` clipboard test is intentionally skipped (WebKit lacks clipboard API support).
- Git hooks: `vp config` (run by `npm` `prepare`) leaves `core.hooksPath` alone because Cursor already points it at its own agent hooks; this is expected, not an error.
