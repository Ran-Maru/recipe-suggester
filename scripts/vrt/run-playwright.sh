#!/usr/bin/env bash
# 起動した preview に対して VRT の Playwright テストを実行する。
#   VRT_MODE=update : 変更前の画面を基準画像として $VRT_OUT_DIR/snapshots に書き出す。
#   VRT_MODE=compare: 変更後の画面を基準画像と比べる。差分があれば失敗し、$VRT_OUT_DIR/report に HTML を出す。
set -euo pipefail

if [[ -z "${VRT_PREVIEW_CWD:-}" || -z "${VRT_OUT_DIR:-}" ]]; then
  printf 'VRT_PREVIEW_CWD と VRT_OUT_DIR が必要です\n' >&2
  exit 1
fi

case "${VRT_MODE:-compare}" in
  update) update_snapshots=all ;;
  compare) update_snapshots=none ;;
  *)
    printf 'VRT_MODE は update か compare にしてください: %s\n' "$VRT_MODE" >&2
    exit 1
    ;;
esac

repo_root=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
cd -- "$repo_root"
export VRT=1
mkdir -p "$VRT_OUT_DIR"
if command -v vp >/dev/null 2>&1; then
  vp_bin=$(command -v vp)
else
  vp_bin="$repo_root/node_modules/.bin/vp"
fi
"$vp_bin" exec playwright test tests/vrt --update-snapshots "$update_snapshots"
