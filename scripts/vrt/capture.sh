#!/usr/bin/env bash
# 起動中の preview に対して、Playwright で画面を PNG に保存する。
set -euo pipefail

if [[ -z "${VRT_PREVIEW_CWD:-}" || -z "${VRT_OUT_DIR:-}" ]]; then
  printf 'VRT_PREVIEW_CWD と VRT_OUT_DIR が必要です\n' >&2
  exit 1
fi

repo_root=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
cd -- "$repo_root"
export VRT=1
mkdir -p "$VRT_OUT_DIR"
if command -v vp >/dev/null 2>&1; then
  vp_bin=$(command -v vp)
else
  vp_bin="$repo_root/node_modules/.bin/vp"
fi
"$vp_bin" exec playwright test tests/vrt
