#!/usr/bin/env bash
# preToolUse: block edits outside the current worktree.
set -u

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
# shellcheck source=../../scripts/dangerous-command-policy.sh
. "$REPO_ROOT/scripts/dangerous-command-policy.sh"

payload=$(cat || true)
decide_pre_tool_use "$payload"
