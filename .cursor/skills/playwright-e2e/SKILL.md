---
name: playwright-e2e
description: >-
  Runs and authors Playwright E2E tests for recipe-suggester. Use when writing
  E2E tests, debugging Playwright or CI test failures, or running
  vp exec playwright test.
---

# Playwright E2E

End-to-end tests live in `tests/` and use `@playwright/test`. They cover only
clipboard copy and opening a recipe in a new tab. Search logic and other UI
behavior live in Vitest (`vp test`).

## Run tests

Unit + Browser Mode (Vitest, via Vite+):

```bash
vp test
```

Playwright E2E:

```bash
vp exec playwright test
```

Do **not** start `vp run dev` first. `playwright.config.ts` starts the dev server automatically via `webServer`:

- Command: `vp dev`
- URL: this worktree's port from `scripts/worktree-ports.ts` (CI/Cloud は `http://localhost:5173`)
- `reuseExistingServer: !process.env.CI` — 同じ worktree で既に立っている dev server だけ再利用する。別 worktree の 5173 には繋がない。
- HTML report ポートも同じ offset（ベース 9323）

Playwright UI を並行起動するときは `--ui-port` を worktree ごとにずらす:

```bash
vp exec playwright test --ui --ui-port 8080
```

## package.json scripts

| Script                   | Purpose                                     |
| ------------------------ | ------------------------------------------- |
| `vp test`                | Vitest unit + browser mode                  |
| `vp run test:e2e`        | Same as `playwright test`                   |
| `vp run test:e2e:trace`  | Run with trace always on                    |
| `vp run test:e2e:ui`     | Interactive UI mode with trace              |
| `vp run test:e2e:debug`  | Playwright inspector                        |
| `vp run test:e2e:report` | Open HTML report (`playwright show-report`) |

## Browser projects

Configured in `playwright.config.ts`:

- `chromium` (Desktop Chrome)
- `Mobile Chrome` (Pixel 7)
- `Mobile Safari` (iPhone 13 Pro)

Cloud Agent install (`.cursor/install.sh`) also installs `chromium` and `webkit` browser binaries.

## WebKit clipboard skip

WebKit lacks reliable clipboard API support. Clipboard tests intentionally skip on WebKit:

```typescript
test.skip(browserName === "webkit", "WebKit lacks clipboard API support");
```

Do not treat these skips as failures.

## Test coverage overview

`tests/test.spec.ts` covers:

- **レシピGET page**: 開く opens a new tab, コピーする copies the recipe URL
- **一覧 (`/recipes`)**: copy button writes the URL to the clipboard

Other UI and search coverage is in `src/**/*.test.ts` (Node) and
`src/**/*.browser.test.tsx` (Vitest Browser Mode).

Selectors favor accessible roles (`getByRole`, `getByTestId`).

## CI behavior

- `forbidOnly: !!process.env.CI`
- `retries: 2` on CI only
- `workers: 1` on CI
- Reporter: `github` + `html` on CI; `html` locally

## Troubleshooting

- **Browser missing**: run `vp exec playwright install --with-deps chromium webkit`
- **Port busy**: この worktree のポートは `scripts/worktree-ports.ts` で決まる。`strictPort` のため勝手に次ポートへは行かない。`VITE_DEV_PORT` / `PORT` で上書きするか、そのポートのプロセスを止める。
- **CI trace**: download artifact and open with Playwright trace viewer
