#!/usr/bin/env bash
# マージされた PR のレポートを Worker（R2）から消し、PR コメントを案内に書き換える。
set -euo pipefail

worker_url="${VRT_WORKER_URL:-}"
token="${VRT_UPLOAD_TOKEN:-}"
pr="${PR_NUMBER:?}"

if [[ -z "$worker_url" || -z "$token" ]]; then
  printf 'VRT_WORKER_URL と VRT_UPLOAD_TOKEN がないので、削除はしません（未設定）。\n'
  exit 0
fi

if [[ ! "$pr" =~ ^[0-9]+$ ]]; then
  printf 'PR 番号が不正です: %s\n' "$pr" >&2
  exit 1
fi

worker_url="${worker_url%/}"
curl --fail --silent --show-error --retry 3 --retry-delay 2 \
  --request DELETE \
  --header "Authorization: Bearer ${token}" \
  "${worker_url}/pr-${pr}/"
printf '\n'

notice_file="${RUNNER_TEMP:-/tmp}/vrt-cleanup-comment.md"
cat > "$notice_file" <<EOF
<!-- vrt-report -->
## 見た目の比較

PR がマージされたため、この PR の比較レポートを削除しました。

もう一度見たいときは、Actions の Visual Regression を手動実行し、PR 番号に \`${pr}\` を入れてください。マージ直前の main と PR の head を、その場でビルドして比べ直します。
EOF

if [[ -n "${GH_TOKEN:-}" && -n "${REPO:-}" ]]; then
  COMMENT_BODY_FILE="$notice_file" UPDATE_ONLY=1 \
    bash "$(dirname -- "$0")/post-comment.sh"
fi
