#!/usr/bin/env bash
# マージされた PR の VRT artifact を消し、PR コメントを「消した」という案内に書き換える。
set -euo pipefail

repo="${REPO:?}"
pr="${PR_NUMBER:?}"
branch="${HEAD_BRANCH:?}"

if [[ ! "$pr" =~ ^[0-9]+$ ]]; then
  printf 'PR 番号が不正です: %s\n' "$pr" >&2
  exit 1
fi
if [[ ! "$repo" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
  printf 'リポジトリ名が不正です: %s\n' "$repo" >&2
  exit 1
fi

title="見た目の比較 #${pr}"
run_ids=$(
  gh api --method GET --paginate "repos/${repo}/actions/workflows/vrt.yml/runs" \
    -f "branch=${branch}" -f "event=pull_request" -F "per_page=100" \
    --jq ".workflow_runs[] | select(.display_title == \"${title}\") | .id"
)

deleted=0
for run_id in $run_ids; do
  artifact_ids=$(
    gh api --paginate "repos/${repo}/actions/runs/${run_id}/artifacts" \
      --jq '.artifacts[] | select(.expired == false) | .id'
  )
  for artifact_id in $artifact_ids; do
    gh api --method DELETE "repos/${repo}/actions/artifacts/${artifact_id}" >/dev/null
    deleted=$((deleted + 1))
  done
done
printf 'artifact を %s 件削除しました\n' "$deleted"

notice_file="${RUNNER_TEMP:-/tmp}/vrt-cleanup-comment.md"
cat > "$notice_file" <<EOF
<!-- vrt-report -->
## 見た目の比較

PR がマージされたため、この PR の比較結果（artifact）を削除しました。

もう一度見たいときは、Actions の Visual Regression を手動実行し、PR 番号に \`${pr}\` を入れてください。マージ直前の main と PR の head を、その場でビルドして比べ直します。
EOF

export COMMENT_BODY_FILE="$notice_file"
export UPDATE_ONLY=1
bash "$(dirname -- "$0")/post-comment.sh"
