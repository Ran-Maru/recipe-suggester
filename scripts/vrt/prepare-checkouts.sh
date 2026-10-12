#!/usr/bin/env bash
# 変更前（PR の分岐点）と変更後（PR の head）を worktree に取り出してビルドする。
# 分岐点は head と base の merge-base。base が先に進んでいても、PR 自身の変更だけが差分になる。
# マージ済みの PR は、マージ直前の main（マージコミットの第一親）を base とする。
# 手動再実行のときも、保存済みの画像には依存しない。
set -euo pipefail

before_dir="${BEFORE_DIR:?}"
after_dir="${AFTER_DIR:?}"
pr_number="${PR_NUMBER:?}"
head_sha="${HEAD_SHA:?}"
base_sha="${BASE_SHA:-}"
merge_commit_sha="${MERGE_COMMIT_SHA:-}"

if [[ ! "$pr_number" =~ ^[0-9]+$ ]]; then
  printf 'PR 番号が不正です: %s\n' "$pr_number" >&2
  exit 1
fi

repo_root=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
cd -- "$repo_root"
export GIT_TERMINAL_PROMPT=0
if command -v vp >/dev/null 2>&1; then
  vp_bin=$(command -v vp)
else
  vp_bin="$repo_root/node_modules/.bin/vp"
fi

has_commit() {
  git cat-file -e "${1}^{commit}" 2>/dev/null
}

fetch_commit() {
  local sha="$1"
  if has_commit "$sha"; then
    return 0
  fi
  git fetch --no-tags origin "$sha"
}

build_tree() {
  local dir="$1"
  (
    cd -- "$dir" || exit 1
    "$vp_bin" install
    "$vp_bin" run build
  )
}

if ! has_commit "$head_sha"; then
  if ! git fetch --no-tags origin "pull/${pr_number}/head"; then
    printf 'pull/%s/head を取得できません。PR のコミットが残っているか確認してください。\n' "$pr_number" >&2
    exit 1
  fi
fi
if ! has_commit "$head_sha"; then
  printf 'head のコミットが見つかりません: %s\n' "$head_sha" >&2
  exit 1
fi

if [[ -n "$merge_commit_sha" ]]; then
  fetch_commit "$merge_commit_sha"
  base_sha=$(git rev-parse "${merge_commit_sha}^1")
fi
if [[ -z "$base_sha" ]]; then
  printf 'BASE_SHA か MERGE_COMMIT_SHA が必要です\n' >&2
  exit 1
fi
fetch_commit "$base_sha"

before_sha=$(git merge-base "$base_sha" "$head_sha")

git worktree add --detach "$before_dir" "$before_sha"
git worktree add --detach "$after_dir" "$head_sha"

build_tree "$before_dir"
build_tree "$after_dir"

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    printf 'before_sha=%s\n' "$before_sha"
    printf 'head_sha=%s\n' "$head_sha"
  } >> "$GITHUB_OUTPUT"
fi
