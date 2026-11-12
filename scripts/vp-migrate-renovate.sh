#!/usr/bin/env bash
# Renovate の renovate/vite-plus 上で、対象版のグローバル vp から公式の migrate を実行する。
# 実行前に PATH の vp をその版にしておく。コミットと push はワークフローが行う。
# version / commit-subject / already-applied は vp も Node も要らない。
set -euo pipefail

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
CDPATH='' cd -- "$script_dir/.."

usage() {
  printf '%s\n' "usage: vp-migrate-renovate.sh version|commit-subject|already-applied|apply" >&2
  exit 2
}

read_vite_plus_version() {
  local line value
  line=$(grep -E '^[[:space:]]*["'\'']?vite-plus["'\'']?[[:space:]]*:' pnpm-workspace.yaml | head -n 1 || true)
  if [[ -z "$line" ]]; then
    printf '%s\n' "catalog の vite-plus が見つかりません。" >&2
    exit 1
  fi
  value=${line#*:}
  value=${value%%#*}
  value=${value//[[:space:]\"\']/}
  if [[ ! "$value" =~ ^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$ ]]; then
    printf '%s\n' "vite-plus の版が不正です: ${value}" >&2
    exit 1
  fi
  printf '%s\n' "$value"
}

commit_subject() {
  local version
  version=$(read_vite_plus_version)
  printf '%s\n' "chore: vp migrate ${version}"
}

head_is_migrated() {
  local subject expected
  subject=$(git log -1 --format=%s)
  expected=$(commit_subject)
  [[ "$subject" == "$expected" ]]
}

restore_generated_paths() {
  local list path
  list=$(
    {
      git diff --name-only HEAD
      git ls-files --others --exclude-standard
    } | node --experimental-strip-types "$script_dir/vp-migrate-pins.ts" filter-restore-paths
  )
  if [[ -z "$list" ]]; then
    return 0
  fi
  while IFS= read -r path; do
    if [[ -z "$path" ]]; then
      continue
    fi
    if git cat-file -e "HEAD:${path}" 2>/dev/null; then
      git checkout -- "$path"
    else
      rm -rf -- "$path"
    fi
  done <<<"$list"
}

cmd_apply() {
  local version vp_bin orig_ws orig_pkg toolchain_file
  version=$(read_vite_plus_version)
  if head_is_migrated; then
    printf '%s\n' "すでに $(commit_subject) を適用済みです。"
    exit 0
  fi
  if ! command -v vp >/dev/null 2>&1; then
    printf '%s\n' "vp が PATH にありません。対象版のグローバル CLI を先に入れてください。" >&2
    exit 1
  fi
  # migrate が node_modules/.bin/vp を作ったあとでも、同じグローバル CLI を使う。
  # プロジェクトの vp は --global を受け付けない。
  vp_bin=$(command -v vp)
  orig_ws=$(mktemp)
  orig_pkg=$(mktemp)
  toolchain_file=$(mktemp)
  # shellcheck disable=SC2064
  trap "rm -f -- '${orig_ws}' '${orig_pkg}' '${toolchain_file}'" EXIT
  cp -- pnpm-workspace.yaml "$orig_ws"
  cp -- package.json "$orig_pkg"
  "$vp_bin" migrate --no-interactive
  restore_generated_paths
  "$vp_bin" toolchain vitest --global --json >"$toolchain_file"
  node --experimental-strip-types "$script_dir/vp-migrate-pins.ts" apply-pins \
    "$orig_ws" "$orig_pkg" pnpm-workspace.yaml package.json "$version" "$toolchain_file"
  "$vp_bin" install
}

if [[ $# -ne 1 ]]; then
  usage
fi

case "$1" in
  version)
    read_vite_plus_version
    ;;
  commit-subject)
    commit_subject
    ;;
  already-applied)
    if head_is_migrated; then
      exit 0
    fi
    exit 1
    ;;
  apply)
    cmd_apply
    ;;
  *)
    usage
    ;;
esac
