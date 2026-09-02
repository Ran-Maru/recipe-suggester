#!/usr/bin/env bash
# Cloud Agent の git commit 直後だけ動く。
# Cursor アカウントの個人メールを Co-authored-by から外し、GitHub noreply に付け替える。
set -euo pipefail

cat >/dev/null || true

# ホスト型 Cloud Agent 以外（ローカル IDE など）では何もしない
[[ -S "${CURSOR_AGENT_SOCKET:-/run/cursor/api.sock}" ]] || exit 0

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
[[ "$(git log -1 --format=%ae)" == "cursoragent@cursor.com" ]] || exit 0
(( "$(date +%s)" - "$(git log -1 --format=%ct)" < 180 )) || exit 0

noreply='Ran-Maru <63487316+Ran-Maru@users.noreply.github.com>'
msg="$(git log -1 --format=%B)"
filtered="$(
  printf '%s' "${msg}" | awk -v noreply="${noreply}" '
    BEGIN { IGNORECASE = 1 }
    /^Co-authored-by:/ {
      email = $0
      if (match(email, /<[^>]+>/)) email = substr(email, RSTART + 1, RLENGTH - 2)
      el = tolower(email)
      if (el ~ /cursoragent@cursor\.com$/ || el ~ /users\.noreply\.github\.com$/ || el == "noreply@github.com") {
        print
        last = $0
        if (el ~ /ran-maru@users\.noreply\.github\.com$/) has = 1
      }
      next
    }
    { print; last = $0 }
    END {
      if (!has) {
        if (last != "" && last !~ /^Co-authored-by:/) print ""
        print "Co-authored-by: " noreply
      }
    }
  '
)"

[[ "${msg}" == *$'\n' ]] || msg+=$'\n'
[[ "${filtered}" == *$'\n' ]] || filtered+=$'\n'
[[ "${msg}" == "${filtered}" ]] && exit 0

printf '%s' "${filtered}" | git commit --amend --no-verify -F -
