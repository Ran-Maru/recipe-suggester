---
name: cursor-cloud-setup
description: >-
  Sets up and troubleshoots the Cursor Cloud Agent environment for
  recipe-suggester. Use when configuring Cloud Agent, debugging Node or nvm
  version mismatches, environment.json, or .cursor/install.sh.
---

# Cursor Cloud setup

Cloud Agent bootstrap for this repo is defined under `.cursor/`.

## environment.json

`.cursor/environment.json` configures:

| Key            | Value                                           |
| -------------- | ----------------------------------------------- |
| `install`      | `bash .cursor/install.sh`                       |
| `terminals[0]` | `vp run dev` on port 5173                       |
| `ports`        | 5173 (Vite+ dev), 9323 (Playwright HTML report) |

## install.sh

`.cursor/install.sh` runs on Cloud Agent boot:

1. Sources nvm and installs/uses Node from `.node-version` (`24.19.0`)
2. Prepends nvm Node to `PATH` (avoids `/exec-daemon/node` v22 in non-login shells)
3. Ensures `node_modules/.bin/vp` exists (bootstraps pnpm `11.22.0` via corepack if needed)
4. Runs `vp install`
5. Runs `vp exec playwright install --with-deps chromium webkit`

## Node / nvm gotcha

Non-login shells may resolve `node` to `/exec-daemon/node` (v22) instead of the pinned Node.

- Run commands in a **login shell** so nvm is sourced (Cursor terminals handle this by default).
- The install script also prepends nvm's Node onto `PATH`.

Verify with:

```bash
node --version   # expect v24.19.0
which node       # should be under ~/.nvm/versions/node/...
```

## vp invocation

`vp` is project-local (`node_modules/.bin/vp`), not global.

```bash
vp run dev
vp run check
vp run build
vp exec playwright test
```

Do **not** use `npx` or `npm`; Vite+ does not translate mismatched package-manager commands.

Use `vp install` / `vp add` / `vp remove` instead of calling pnpm directly.

## Git hooks note

`vp config` (pnpm `prepare`) leaves `core.hooksPath` alone when Cursor already points at agent hooks. This is expected, not an error.

## Cloud Agent のコミットメール

Cursor アカウントの個人メールが `Co-authored-by` に付くのを防ぐ公式設定は無い。
`.cursor/hooks.json` の `afterShellExecution` が、ホスト型 Cloud Agent（`/run/cursor/api.sock` があるとき）の `git commit` 直後だけメッセージを直す。
同じコマンドで `git commit` と `git push` をつなぐと、その前に `beforeShellExecution` が拒否する。ローカルではどちらも動かない。

## When setup looks wrong

1. Re-run `bash .cursor/install.sh`
2. Run `vp env doctor` and include output when asking for help
3. Confirm `vp run check` passes before declaring the environment ready
