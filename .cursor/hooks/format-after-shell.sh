#!/usr/bin/env bash
# afterShellExecution: shell redirects (cat > file.md, python, tee) do not emit
# afterFileEdit. Format whatever the command left dirty, including Markdown.
set -u

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
node "$REPO_ROOT/scripts/format-agent-files.mjs" after-shell
exit 0
