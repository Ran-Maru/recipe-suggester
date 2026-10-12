#!/usr/bin/env bash
# Playwright の HTML レポートを Cloudflare Worker（R2）に載せる。
# 載せ先は pr-<PR 番号>/<run id>/。URL は GITHUB_OUTPUT の report_url に書く。
set -euo pipefail

worker_url="${VRT_WORKER_URL:?}"
token="${VRT_UPLOAD_TOKEN:?}"
report_dir="${REPORT_DIR:?}"
pr="${PR_NUMBER:?}"
run_id="${RUN_ID:?}"

if [[ ! "$pr" =~ ^[0-9]+$ || ! "$run_id" =~ ^[0-9]+$ ]]; then
  printf 'PR 番号と run id は数字にしてください: %s %s\n' "$pr" "$run_id" >&2
  exit 1
fi
if [[ ! -f "$report_dir/index.html" ]]; then
  printf 'レポートがありません: %s/index.html\n' "$report_dir" >&2
  exit 1
fi

worker_url="${worker_url%/}"
prefix="pr-${pr}/${run_id}"

count=0
while IFS= read -r -d '' file; do
  relative="${file#"$report_dir"/}"
  curl --fail --silent --show-error --retry 3 --retry-delay 2 \
    --request PUT \
    --header "Authorization: Bearer ${token}" \
    --data-binary "@${file}" \
    "${worker_url}/${prefix}/${relative}" >/dev/null
  count=$((count + 1))
done < <(find "$report_dir" -type f -print0)

printf '%s 件をアップロードしました\n' "$count"
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  printf 'report_url=%s/%s/index.html\n' "$worker_url" "$prefix" >> "$GITHUB_OUTPUT"
fi
