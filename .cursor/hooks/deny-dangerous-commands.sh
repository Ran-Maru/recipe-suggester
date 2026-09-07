#!/usr/bin/env bash
# beforeShellExecution: block destructive git and system commands.
set -u

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
# shellcheck source=../../scripts/dangerous-command-policy.sh
. "$REPO_ROOT/scripts/dangerous-command-policy.sh"

payload=$(cat || true)
command=$(json_string command "$payload")
cwd=$(json_string cwd "$payload")
decide_shell_command "$command" "${cwd:-$PWD}"
