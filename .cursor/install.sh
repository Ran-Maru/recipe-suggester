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
  # vp is not installed yet. Renovate updates devEngines.packageManager.version,
  # and this fallback reads that pin instead of hardcoding it.
  corepack enable
  PNPM_VERSION="$(
    node -p 'JSON.parse(require("fs").readFileSync("package.json","utf8")).devEngines.packageManager.version'
  )"
  if [[ ! "${PNPM_VERSION}" =~ ^[0-9]+\.[0-9]+\.[0-9]+([+][A-Za-z0-9.]+)?$ ]]; then
    echo "pnpm のバージョンを読めませんでした: ${PNPM_VERSION}" >&2
    exit 1
  fi
  corepack prepare "pnpm@${PNPM_VERSION}" --activate
  pnpm install
fi

"${VP}" install
"${VP}" exec playwright install --with-deps chromium webkit
