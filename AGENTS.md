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

- Node is managed by `nvm` with the default alias set to `24.19.0` (matches `.node-version`), and `npm` is pinned globally to `11.6.2` (matches the `devEngines` requirement and the devcontainer `Dockerfile`). The update script only runs `npm install` + a Playwright browser install; the node/npm versions come from this persisted nvm setup.
- Gotcha: run commands in a login shell so `nvm` is sourced. A non-login shell may resolve `node` to `/exec-daemon/node` (v22) and mismatch the pinned `npm`, which triggers `npm error EBADDEVENGINES` on `npm install`. The Cursor terminal login shells already handle this.
- `vp` is a project-local binary (`node_modules/.bin/vp`), not global here. Invoke it via the `package.json` scripts (`npm run dev`, `npm run check`, `npm run build`) or `npx vp`.

### Run / lint / build / test

- Dev server: `npm run dev` (runs `vp dev --host`). The primary clone and CI use `http://localhost:5173`. Linked git worktrees get a stable offset from the worktree path so parallel checkouts do not collide. `strictPort` is on, so a busy port fails instead of Vite silently incrementing. Print the ports with `node scripts/dev-ports.js`. Override with `DEV_PORT=5180 npm run dev` (HTML report / Playwright UI / preview shift by the same offset).
- Host Playwright (no Dev Container): `npx playwright install` once (chromium + webkit). Then `npx playwright test` — Playwright auto-starts the matching-port dev server via `webServer`, so you do NOT need to start `npm run dev` first. The `webkit` clipboard test is intentionally skipped (WebKit lacks clipboard API support).
- Lint + typecheck + mapping validation: `npm run check` (`vp check` then `scripts/check-mapping.json.js`).
- Build: `npm run build` (`tsc -b && vp build`).
- Git hooks: `vp config` (run by `npm` `prepare`) leaves `core.hooksPath` alone because Cursor already points it at its own agent hooks; this is expected, not an error.
- Agent shell: `.cursor/hooks.json` denies `sudo`, `git push --force`, recursive `rm` of system paths, `chmod -R`, `mkfs`, `dd`, and `security dump-keychain`. `ask` is not used because Cursor currently only enforces `deny`.
