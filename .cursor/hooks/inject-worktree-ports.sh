#!/usr/bin/env bash
# sessionStart: tell the agent this worktree's dev / preview / report ports.
set -u

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
# shellcheck source=../../scripts/worktree-ports.sh
. "$REPO_ROOT/scripts/worktree-ports.sh"

cat >/dev/null || true

dev_port=$(worktree_dev_port)
preview_port=$(worktree_preview_port)
html_port=$(worktree_playwright_html_port)
vitest_port=$(worktree_vitest_browser_api_port)

printf '%s\n' "{\"env\":{\"WORKTREE_DEV_PORT\":\"${dev_port}\",\"WORKTREE_PREVIEW_PORT\":\"${preview_port}\",\"WORKTREE_PLAYWRIGHT_HTML_PORT\":\"${html_port}\",\"WORKTREE_VITEST_BROWSER_API_PORT\":\"${vitest_port}\"},\"additional_context\":\"This worktree's Vite+ dev server is http://localhost:${dev_port} (preview http://localhost:${preview_port}, Playwright HTML report http://localhost:${html_port}, Vitest Browser API ${vitest_port}). Do not assume port 5173. Override with VITE_DEV_PORT or PORT.\"}"
