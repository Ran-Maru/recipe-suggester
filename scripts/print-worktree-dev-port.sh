#!/usr/bin/env bash
# Print this worktree's Vite+ dev port (stdout only).
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
# shellcheck source=worktree-ports.sh
source "$SCRIPT_DIR/worktree-ports.sh"
worktree_dev_port
