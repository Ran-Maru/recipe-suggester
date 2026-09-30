#!/usr/bin/env bash
# PR に VRT の結果を書く。同じ印のコメントがあれば更新する。
set -euo pipefail

repo="${REPO:?}"
pr="${PR_NUMBER:?}"
body_file="${COMMENT_BODY_FILE:?}"
marker="<!-- vrt-report -->"

if [[ ! "$pr" =~ ^[0-9]+$ ]]; then
  printf 'PR 番号が不正です: %s\n' "$pr" >&2
  exit 1
fi
if [[ ! "$repo" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
  printf 'リポジトリ名が不正です: %s\n' "$repo" >&2
  exit 1
fi

body=$(cat "$body_file")
case "$body" in
  *"$marker"*) ;;
  *)
    printf 'コメントに印がありません\n' >&2
    exit 1
    ;;
esac

ids=$(
  gh api --paginate "repos/${repo}/issues/${pr}/comments" \
    --jq '.[] | select(.body | contains("<!-- vrt-report -->")) | .id'
)
existing=${ids%%$'\n'*}

if [[ -n "$existing" ]]; then
  gh api --method PATCH "repos/${repo}/issues/comments/${existing}" \
    -f "body=@${body_file}" >/dev/null
else
  gh api --method POST "repos/${repo}/issues/${pr}/comments" \
    -f "body=@${body_file}" >/dev/null
fi
