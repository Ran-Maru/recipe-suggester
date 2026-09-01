---
name: playwright-e2e
description: >-
  Runs and authors Playwright E2E tests for recipe-suggester. Use when writing
  E2E tests, debugging Playwright or CI test failures, or running
  vp exec playwright test.
---

# Playwright E2E

End-to-end tests live in `tests/` and use `@playwright/test`.

## Run tests

Primary command (via Vite+):

```bash
vp exec playwright test
```

Do **not** start `vp run dev` first. `playwright.config.ts` starts the dev server automatically via `webServer`:

- Command: `vp dev`
- URL: `http://localhost:5173`
- `reuseExistingServer: !process.env.CI` — reuses a running local server outside CI

## package.json scripts

| Script                   | Purpose                                     |
| ------------------------ | ------------------------------------------- |
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

- Page title contains レシピ
- **レシピGET page**: GET button shows recipe name, 開く opens new tab, コピー copies URL, クリア resets
- **一覧 (`/recipes`)**: table headers/rows, no horizontal overflow, copy button
- **餃子 page** (`/family-recipe/gyoza`)
- **Navigation** between レシピGET and 一覧

Selectors favor accessible roles (`getByRole`, `getByTestId`).

## CI behavior

- `forbidOnly: !!process.env.CI`
- `retries: 2` on CI only
- `workers: 1` on CI
- Reporter: `github` + `html` on CI; `html` locally

## Troubleshooting

- **Browser missing**: run `vp exec playwright install --with-deps chromium webkit`
- **Port 5173 busy**: stop other dev servers or let `reuseExistingServer` pick up the existing one locally
- **CI trace**: download artifact and open with Playwright trace viewer
