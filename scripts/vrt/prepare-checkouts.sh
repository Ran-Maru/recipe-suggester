#!/usr/bin/env bash
# 変更前と変更後のコミットを worktree に取り出してビルドする。
# 手動再実行のときも、保存済みの画像には依存しない。
set -euo pipefail

mode="${CHECKOUT_MODE:?}"
before_dir="${BEFORE_DIR:?}"
after_dir="${AFTER_DIR:?}"
pr_number="${PR_NUMBER:?}"
before_sha="${BEFORE_SHA:-}"
head_sha="${HEAD_SHA:-}"
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

fetch_sha() {
  local sha="$1"
  if git cat-file -e "${sha}^{commit}" 2>/dev/null; then
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

case "$mode" in
  open)
    if [[ -z "$before_sha" || -z "$head_sha" ]]; then
      printf 'open モードでは BEFORE_SHA と HEAD_SHA が必要です\n' >&2
      exit 1
    fi
    if ! git fetch --no-tags origin "pull/${pr_number}/head"; then
      printf 'pull/%s/head を取得できません。PR のコミットが残っているか確認してください。\n' "$pr_number" >&2
      exit 1
    fi
    fetch_sha "$before_sha"
    fetch_sha "$head_sha"
    git worktree add --detach "$before_dir" "$before_sha"
    git worktree add --detach "$after_dir" "$head_sha"
    if ! GIT_AUTHOR_NAME='github-actions[bot]' \
      GIT_AUTHOR_EMAIL='41898282+github-actions[bot]@users.noreply.github.com' \
      GIT_COMMITTER_NAME='github-actions[bot]' \
      GIT_COMMITTER_EMAIL='41898282+github-actions[bot]@users.noreply.github.com' \
      git -C "$after_dir" merge --no-edit "$before_sha"; then
      printf 'base と head のマージで衝突しています。衝突を解いてから再実行してください。\n' >&2
      exit 1
    fi
    ;;
  merged)
    if [[ -z "$merge_commit_sha" ]]; then
      printf 'merged モードでは MERGE_COMMIT_SHA が必要です\n' >&2
      exit 1
    fi
    fetch_sha "$merge_commit_sha"
    before_sha=$(git rev-parse "${merge_commit_sha}^1")
    git worktree add --detach "$before_dir" "$before_sha"
    git worktree add --detach "$after_dir" "$merge_commit_sha"
    ;;
  *)
    printf '未知のモードです: %s\n' "$mode" >&2
    exit 1
    ;;
esac

build_tree "$before_dir"
build_tree "$after_dir"

built_after=$(git -C "$after_dir" rev-parse HEAD)
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  {
    printf 'before_sha=%s\n' "$before_sha"
    printf 'built_after_sha=%s\n' "$built_after"
  } >> "$GITHUB_OUTPUT"
fi
