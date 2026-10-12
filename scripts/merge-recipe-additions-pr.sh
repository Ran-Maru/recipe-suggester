#!/usr/bin/env bash
# CI が成功した「レシピ追加だけ」の PR を squash マージする。
# マージ後は main の CI を手動起動する。成功すると ci.yml の pages がデプロイする。
# マージコマンドが失敗しても、PR がマージ済みなら起動まで進む。
# このスクリプトは既定ブランチのものを使う。PR ブランチのコードは実行しない。
# カレントディレクトリは、ベース側を checkout した git リポジトリであること。
set -euo pipefail

: "${HEAD_SHA:?HEAD_SHA が必要です}"
: "${REPO:?REPO が必要です}"

if [[ ! "$HEAD_SHA" =~ ^[0-9a-fA-F]{40}$ ]]; then
  printf '%s\n' "HEAD_SHA がコミット SHA ではありません。" >&2
  exit 1
fi

if [[ ! "$REPO" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
  printf '%s\n' "REPO の形式が不正です。" >&2
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
merge_status=0
gh pr merge "$number" --repo "$REPO" --squash --match-head-commit "$HEAD_SHA" || merge_status=$?

# 起動だけ失敗したジョブを再実行すると、マージは済みで merge が失敗する。
# そのときも main の CI は起動する。未マージの失敗では起動しない。
if [[ "$merge_status" -ne 0 ]]; then
  state=$(gh pr view "$number" --repo "$REPO" --json state --jq .state)
  if [[ "$state" != "MERGED" ]]; then
    printf '%s\n' "PR #${number} をマージできませんでした。" >&2
    exit "$merge_status"
  fi
  printf '%s\n' "PR #${number} はマージ済みです。main の CI を起動します。"
fi

# GITHUB_TOKEN のマージでは push が発火しないため、main の CI（test と lint のあとに pages）を手動で起動する。
printf '%s\n' "main の CI を起動してデプロイします。"
gh workflow run ci.yml --repo "$REPO" --ref main
