#!/usr/bin/env bash
# Cloud Agent では git commit と git push を同じコマンドにまとめない。
# ローカル IDE など、ホスト型 Cloud Agent 以外は常に許可する。
set -euo pipefail

payload="$(cat || true)"

allow() {
  printf '%s\n' '{"permission":"allow"}'
}

if [[ ! -S "${CURSOR_AGENT_SOCKET:-/run/cursor/api.sock}" ]]; then
  allow
  exit 0
fi

# commit と、&& / ; でつながった push が同じコマンドにあるときだけ拒否する
if printf '%s' "${payload}" | grep -Eq 'git[[:space:]]+commit' &&
  printf '%s' "${payload}" | grep -Eqi '(&&|;|\\n)[[:space:]]*git[[:space:]]+push'; then
  cat <<'EOF'
{"permission":"deny","agent_message":"Cloud Agent では git commit と git push を同じコマンドにまとめないでください。先に git commit だけ実行し、そのあと別コマンドで git push してください。"}
EOF
  exit 0
fi

allow
