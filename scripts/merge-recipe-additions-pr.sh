#!/usr/bin/env bash
# CI が成功した「レシピ追加だけ」の PR を squash マージする。
# このスクリプトは既定ブランチのものを使う。PR ブランチのコードは実行しない。
# カレントディレクトリは、ベース側を checkout した git リポジトリであること。
set -euo pipefail

: "${HEAD_SHA:?HEAD_SHA が必要です}"
: "${REPO:?REPO が必要です}"
: "${CI_TRUSTED:?CI_TRUSTED が必要です}"

if [[ ! "$HEAD_SHA" =~ ^[0-9a-fA-F]{40}$ ]]; then
  printf '%s\n' "HEAD_SHA がコミット SHA ではありません。" >&2
  exit 1
fi

if [[ ! "$REPO" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
  printf '%s\n' "REPO の形式が不正です。" >&2
  exit 1
fi

if [[ "$CI_TRUSTED" != "true" && "$CI_TRUSTED" != "false" ]]; then
  printf '%s\n' "CI_TRUSTED は true か false です。" >&2
  exit 1
fi

export GIT_TERMINAL_PROMPT=0
export NODE_NO_WARNINGS=1

script_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
pulls_file=$(mktemp)
trap 'rm -f "$pulls_file"' EXIT

gh api "repos/${REPO}/commits/${HEAD_SHA}/pulls" >"$pulls_file"

selection=$(
  node --experimental-strip-types \
    "$script_dir/recipe-additions-only.ts" \
    select-pr \
    "$pulls_file" \
    "$HEAD_SHA" \
    "$REPO"
)

number=""
base_sha=""
head_sha=""
head_ref=""
skip="false"

while IFS='=' read -r key value; do
  case "$key" in
    number) number=$value ;;
    base) base_sha=$value ;;
    head) head_sha=$value ;;
    ref) head_ref=$value ;;
    skip) skip=$value ;;
    "") ;;
    *)
      printf '%s\n' "判定出力を解釈できません: ${key}" >&2
      exit 1
      ;;
  esac
done <<<"$selection"

if [[ "$skip" == "true" ]]; then
  exit 0
fi

if [[ ! "$number" =~ ^[0-9]+$ ]]; then
  printf '%s\n' "PR 番号が不正です。" >&2
  exit 1
fi

if [[ "$head_sha" != "$HEAD_SHA" ]]; then
  printf '%s\n' "判定した先頭コミットが HEAD_SHA と一致しません。" >&2
  exit 1
fi

if [[ ! "$base_sha" =~ ^[0-9a-fA-F]{40}$ ]]; then
  printf '%s\n' "ベース SHA が不正です。" >&2
  exit 1
fi

# ブランチ名は fetch の refspec に入る。空、先頭のスラッシュ、.. は拒否する。
if [[ ! "$head_ref" =~ ^[A-Za-z0-9._/-]+$ || "$head_ref" == *..* || "$head_ref" == /* || "$head_ref" == -* ]]; then
  printf '%s\n' "ブランチ名が不正です。" >&2
  exit 1
fi

if [[ "$CI_TRUSTED" != "true" ]]; then
  count=$(
    gh api \
      "repos/${REPO}/actions/workflows/ci.yml/runs?head_sha=${HEAD_SHA}&event=pull_request&status=success&per_page=1" \
      --jq '.total_count'
  )
  if [[ ! "$count" =~ ^[0-9]+$ ]]; then
    printf '%s\n' "CI の成功件数を読めませんでした。" >&2
    exit 1
  fi
  if [[ "$count" -lt 1 ]]; then
    printf '%s\n' "このコミットの CI はまだ成功していません。" >&2
    exit 0
  fi
fi

git fetch --no-tags origin main
if ! git cat-file -e "${base_sha}^{commit}" >/dev/null 2>&1; then
  printf '%s\n' "ベースコミットを取得できませんでした。" >&2
  exit 1
fi

git fetch --no-tags origin "refs/heads/${head_ref}"
fetched=$(git rev-parse FETCH_HEAD)
if [[ "$fetched" != "$HEAD_SHA" ]]; then
  printf '%s\n' "ブランチの先頭が CI を走らせたコミットと違うため、マージしません。" >&2
  exit 0
fi

diff_result=$(
  node --experimental-strip-types \
    "$script_dir/recipe-additions-only.ts" \
    diff \
    "$base_sha" \
    "$HEAD_SHA"
)

diff_ok="false"
while IFS='=' read -r key value; do
  case "$key" in
    ok) diff_ok=$value ;;
    "") ;;
    *)
      printf '%s\n' "差分判定の出力を解釈できません: ${key}" >&2
      exit 1
      ;;
  esac
done <<<"$diff_result"

if [[ "$diff_ok" != "true" ]]; then
  exit 0
fi

printf '%s\n' "レシピの追加だけなので、PR #${number} をマージします。"
gh pr merge "$number" --repo "$REPO" --squash --match-head-commit "$HEAD_SHA"
