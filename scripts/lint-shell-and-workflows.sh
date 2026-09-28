#!/usr/bin/env bash
# 追跡しているシェルスクリプトを ShellCheck し、ワークフローを actionlint する。
set -euo pipefail

CDPATH='' cd -- "$(dirname -- "$0")/.."

require_tool() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    printf '%s が PATH にありません。scripts/install-ci-linters.sh で入れてください。\n' "$name" >&2
    exit 1
  fi
}

require_tool shellcheck
require_tool actionlint

sh_files=()
while IFS= read -r -d '' path; do
  sh_files+=("$path")
done < <(git ls-files -z -- '*.sh')

if ((${#sh_files[@]} == 0)); then
  printf '%s\n' '検査対象のシェルスクリプトがありません。' >&2
  exit 1
fi

shellcheck -x -P SCRIPTDIR "${sh_files[@]}"
actionlint -color -shellcheck "$(command -v shellcheck)"
