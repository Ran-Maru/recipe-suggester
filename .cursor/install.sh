#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Cloud Agent non-login shells may resolve `node` to /exec-daemon/node (v22).
# Prefer the pinned Node from nvm when this snapshot has it.
export NVM_DIR="${NVM_DIR:-${HOME}/.nvm}"
if [[ -s "${NVM_DIR}/nvm.sh" ]]; then
  # shellcheck disable=SC1091
  . "${NVM_DIR}/nvm.sh"
  NODE_VERSION="$(tr -d '[:space:]' < .node-version)"
  nvm install "${NODE_VERSION}"
  nvm use "${NODE_VERSION}"
  export PATH="${NVM_DIR}/versions/node/v${NODE_VERSION}/bin:${PATH}"
fi

VP="node_modules/.bin/vp"
if [[ ! -x "${VP}" ]]; then
  corepack enable
  corepack prepare pnpm@11.22.0 --activate
  pnpm install
fi

"${VP}" install
"${VP}" exec playwright install --with-deps chromium webkit
