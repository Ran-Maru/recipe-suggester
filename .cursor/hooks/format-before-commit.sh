#!/usr/bin/env bash
# beforeShellExecution: run vp fmt on files a commit would include, including
# Markdown, and refuse commands that skip the git hook (so `vp staged` still runs).
# No matcher: `bash script.sh` can hide `git commit --no-verify`.
set -u

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
exec node "$REPO_ROOT/scripts/format-agent-files.mjs" before-commit
