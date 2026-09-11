# Keep the offset formula in sync with scripts/worktree-ports.ts.
# shellcheck shell=bash

DEV_PORT_BASE=5173
PREVIEW_PORT_BASE=4173
PLAYWRIGHT_HTML_PORT_BASE=9323
VITEST_BROWSER_API_PORT_BASE=63315
WORKTREE_PORT_RANGE=500

_sha256_hex() {
  if command -v shasum >/dev/null 2>&1; then
    printf '%s' "$1" | shasum -a 256 | awk '{print $1}'
    return
  fi
  printf '%s' "$1" | sha256sum | awk '{print $1}'
}

_valid_port() {
  local raw="${1:-}"
  [[ "$raw" =~ ^[0-9]+$ ]] || return 1
  ((raw > 0 && raw < 65536))
}

worktree_port_offset() {
  local cwd="${1:-$PWD}"
  local socket="${CURSOR_AGENT_SOCKET:-/run/cursor/api.sock}"
  if [[ -n "${CI:-}" || -e "$socket" ]]; then
    printf '%s\n' 0
    return
  fi
  local digest hex value
  digest="$(_sha256_hex "$cwd")"
  hex="${digest:0:4}"
  value=$((16#$hex))
  printf '%s\n' $((value % WORKTREE_PORT_RANGE))
}

worktree_port() {
  local base="$1"
  shift
  local name raw
  for name in "$@"; do
    raw="${!name-}"
    if _valid_port "$raw"; then
      printf '%s\n' "$raw"
      return
    fi
  done
  local cwd="${WORKTREE_PORT_CWD:-$PWD}"
  printf '%s\n' $((base + $(worktree_port_offset "$cwd")))
}

worktree_dev_port() {
  worktree_port "$DEV_PORT_BASE" VITE_DEV_PORT PORT
}

worktree_preview_port() {
  worktree_port "$PREVIEW_PORT_BASE" PREVIEW_PORT
}

worktree_playwright_html_port() {
  worktree_port "$PLAYWRIGHT_HTML_PORT_BASE" PLAYWRIGHT_HTML_PORT
}

worktree_vitest_browser_api_port() {
  worktree_port "$VITEST_BROWSER_API_PORT_BASE" VITEST_BROWSER_API_PORT
}
