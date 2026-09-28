#!/usr/bin/env bash
# afterFileEdit: vp fmt the file the agent just wrote. Markdown is included.
# Ignored paths such as .agents/**/*.md stay untouched because Oxfmt skips them.
set -u

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
node "$REPO_ROOT/scripts/format-agent-files.mjs" after-edit
exit 0
