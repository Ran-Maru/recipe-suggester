# Shared deny/allow helpers for Cursor hooks. Do not set -e here; grep mismatches are normal.
# shellcheck shell=bash

json_string() {
  local key="$1"
  local json="$2"
  printf '%s' "$json" | tr '\n' ' ' | awk -v key="$key" '
    BEGIN { needle = "\"" key "\"" }
    {
      idx = index($0, needle)
      if (idx == 0) exit
      rest = substr($0, idx + length(needle))
      sub(/^[[:space:]]*:[[:space:]]*"/, "", rest)
      out = ""
      escaped = 0
      for (i = 1; i <= length(rest); i++) {
        c = substr(rest, i, 1)
        if (escaped) {
          if (c == "n") out = out "\n"
          else if (c == "t") out = out "\t"
          else out = out c
          escaped = 0
          continue
        }
        if (c == "\\") { escaped = 1; continue }
        if (c == "\"") break
        out = out c
      }
      print out
    }
  '
}

allow_json() {
  printf '%s\n' '{"permission":"allow"}'
}

deny_json() {
  local message="$1"
  printf '{"permission":"deny","agent_message":"%s","user_message":"%s"}\n' "$message" "$message"
}

worktree_root() {
  local cwd="$1"
  local root
  root=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null) || true
  if [[ -n "$root" ]]; then
    printf '%s\n' "$root"
    return
  fi
  (CDPATH= cd -- "$cwd" && pwd -P)
}

resolve_user_path() {
  local raw="$1"
  local cwd="$2"
  raw="${raw/#\~/$HOME}"
  raw="${raw/#\$HOME/$HOME}"
  raw="${raw/#\$\{HOME\}/$HOME}"
  if [[ "$raw" != /* ]]; then
    raw="$cwd/$raw"
  fi
  local dir base
  dir=$(dirname -- "$raw")
  base=$(basename -- "$raw")
  if [[ -d "$raw" ]]; then
    (CDPATH= cd -- "$raw" && pwd -P)
    return
  fi
  if [[ -d "$dir" ]]; then
    printf '%s/%s\n' "$(CDPATH= cd -- "$dir" && pwd -P)" "$base"
    return
  fi
  printf '%s\n' "$raw"
}

is_inside_worktree() {
  local path="$1"
  local root="$2"
  [[ "$path" == "$root" || "$path" == "$root"/* ]]
}

is_git_metadata() {
  local path="$1"
  local root="$2"
  local rel="${path#"$root"/}"
  [[ "$path" == "$root/.git" || "$rel" == .git || "$rel" == .git/* ]]
}

is_allowed_rm_target() {
  local path="$1"
  local root="$2"
  if is_git_metadata "$path" "$root" || ! is_inside_worktree "$path" "$root"; then
    return 1
  fi
  local rel="${path#"$root"/}"
  case "$rel" in
    node_modules | dist | dist-ssr | generated | test-results | playwright-report | blob-report | coverage | playwright/.cache | playwright/.auth)
      return 0
      ;;
  esac
  case "$(basename -- "$path")" in
    node_modules | dist | dist-ssr | generated | test-results | playwright-report | blob-report | coverage)
      return 0
      ;;
  esac
  return 1
}

split_shell_commands() {
  printf '%s' "$1" | sed -E 's/(&&|\|\||;|\|)/\'$'\n/g'
}

command_tokens() {
  read -ra _POLICY_TOKENS <<< "$1"
}

has_recursive_rm_flag() {
  local token
  for token in "${_POLICY_TOKENS[@]:1}"; do
    if [[ "$token" == "--" ]]; then
      continue
    fi
    if [[ "$token" == "--recursive" ]]; then
      return 0
    fi
    if [[ "$token" == -* && "$token" != --* && "$token" != "-" ]]; then
      if [[ "$token" == *[rR]* ]]; then
        return 0
      fi
    fi
  done
  return 1
}

rm_paths() {
  local token
  _POLICY_PATHS=()
  for token in "${_POLICY_TOKENS[@]:1}"; do
    if [[ "$token" == "--" ]]; then
      continue
    fi
    if [[ "$token" == --recursive || "$token" == --force || "$token" == --dir || "$token" == --preserve-root || "$token" == --no-preserve-root ]]; then
      continue
    fi
    if [[ "$token" == -* && "$token" != --* && "$token" != "-" ]]; then
      continue
    fi
    _POLICY_PATHS+=("$token")
  done
}

positional_paths() {
  local token
  _POLICY_PATHS=()
  for token in "${_POLICY_TOKENS[@]:1}"; do
    if [[ "$token" == "--" ]]; then
      continue
    fi
    if [[ "$token" == -* && "$token" != "-" ]]; then
      continue
    fi
    _POLICY_PATHS+=("$token")
  done
}

basename_of() {
  local token="$1"
  token="${token%%/}"
  printf '%s\n' "${token##*/}"
}

decide_rm() {
  local cwd="$1"
  local root="$2"
  local name
  name=$(basename_of "${_POLICY_TOKENS[0]}")
  if [[ "$name" != rm ]]; then
    return 1
  fi
  if ! has_recursive_rm_flag; then
    return 1
  fi
  rm_paths
  if [[ ${#_POLICY_PATHS[@]} -eq 0 ]]; then
    deny_json "worktree 全体を消しうる rm は禁止です。"
    return 0
  fi
  local raw target
  for raw in "${_POLICY_PATHS[@]}"; do
    if [[ "$raw" == "/" || "$raw" == "~" || "$raw" == "\$HOME" || "$raw" == "\${HOME}" ]]; then
      deny_json "危険な rm 対象です: $raw"
      return 0
    fi
    target=$(resolve_user_path "$raw" "$cwd")
    if [[ "$target" == / || "$target" == "$HOME" ]]; then
      deny_json "危険な rm 対象です: $raw"
      return 0
    fi
    if ! is_allowed_rm_target "$target" "$root"; then
      deny_json "rm -r は node_modules / dist / Playwright 成果物など許可されたディレクトリ以外では禁止です。"
      return 0
    fi
  done
  return 1
}

decide_chmod() {
  local name
  name=$(basename_of "${_POLICY_TOKENS[0]}")
  [[ "$name" == chmod ]] || return 1
  local token
  for token in "${_POLICY_TOKENS[@]:1}"; do
    case "$token" in
      777 | 0777 | a+rwx | ugo+rwx)
        deny_json "chmod 777 は禁止です。"
        return 0
        ;;
    esac
    if [[ "$token" =~ ^0*777$ ]]; then
      deny_json "chmod 777 は禁止です。"
      return 0
    fi
  done
  return 1
}

decide_copy_or_move() {
  local cwd="$1"
  local root="$2"
  local name dest
  name=$(basename_of "${_POLICY_TOKENS[0]}")
  [[ "$name" == mv || "$name" == cp ]] || return 1
  positional_paths
  if [[ ${#_POLICY_PATHS[@]} -lt 2 ]]; then
    return 1
  fi
  dest=$(resolve_user_path "${_POLICY_PATHS[${#_POLICY_PATHS[@]} - 1]}" "$cwd")
  if is_git_metadata "$dest" "$root"; then
    deny_json "$name で .git 配下へ書き込むことは禁止です。"
    return 0
  fi
  if ! is_inside_worktree "$dest" "$root"; then
    deny_json "$name のコピー先/移動先がこの worktree の外です: ${_POLICY_PATHS[${#_POLICY_PATHS[@]} - 1]}"
    return 0
  fi
  return 1
}

decide_git() {
  local name
  name=$(basename_of "${_POLICY_TOKENS[0]}")
  [[ "$name" == git ]] || return 1
  local joined=" ${_POLICY_TOKENS[*]} "
  if printf '%s' "$joined" | grep -Eq '[[:space:]]push[[:space:]]'; then
    if printf '%s' "$joined" | grep -Eq -- '--force|--force-with-lease'; then
      deny_json "git push --force / -f / --force-with-lease は禁止です。"
      return 0
    fi
    if printf '%s' "$joined" | grep -Eq '[[:space:]]-[a-zA-Z]*f[a-zA-Z]*[[:space:]]'; then
      deny_json "git push --force / -f / --force-with-lease は禁止です。"
      return 0
    fi
    if printf '%s' "$joined" | grep -Eq '[[:space:]]\+'; then
      deny_json "git push --force / -f / --force-with-lease は禁止です。"
      return 0
    fi
  fi
  if printf '%s' "$joined" | grep -Eq '[[:space:]]reset[[:space:]].*--hard'; then
    deny_json "git reset --hard は禁止です。"
    return 0
  fi
  if printf '%s' "$joined" | grep -Eq '[[:space:]]clean[[:space:]]'; then
    if printf '%s' "$joined" | grep -Eq -- '--force|[[:space:]]-[a-zA-Z]*f'; then
      deny_json "git clean -f は禁止です。"
      return 0
    fi
  fi
  if printf '%s' "$joined" | grep -Eq '[[:space:]](checkout|restore)[[:space:]]+(--[[:space:]]+)?(\.|:/|\*)[[:space:]]*$'; then
    deny_json "git checkout/restore で worktree 全体の変更を捨てる操作は禁止です。"
    return 0
  fi
  if printf '%s' "$joined" | grep -Eq '[[:space:]](filter-branch|filter-repo)[[:space:]]'; then
    deny_json "git filter-branch / filter-repo は禁止です。"
    return 0
  fi
  return 1
}

decide_one_command() {
  local command="$1"
  local cwd="$2"
  local root="$3"
  command_tokens "$command"
  if [[ ${#_POLICY_TOKENS[@]} -eq 0 ]]; then
    return 1
  fi
  if decide_git; then
    return 0
  fi
  if decide_rm "$cwd" "$root"; then
    return 0
  fi
  if decide_chmod; then
    return 0
  fi
  if decide_copy_or_move "$cwd" "$root"; then
    return 0
  fi
  return 1
}

decide_shell_command() {
  local command="$1"
  local cwd="$2"
  if [[ -z "${command//[[:space:]]/}" ]]; then
    allow_json
    return
  fi
  local root part
  root=$(worktree_root "$cwd")
  while IFS= read -r part || [[ -n "$part" ]]; do
    part="${part#"${part%%[![:space:]]*}"}"
    part="${part%"${part##*[![:space:]]}"}"
    [[ -z "$part" ]] && continue
    if decide_one_command "$part" "$cwd" "$root"; then
      return
    fi
  done < <(split_shell_commands "$command")
  allow_json
}

decide_file_edit() {
  local path="$1"
  local cwd="$2"
  if [[ -z "${path//[[:space:]]/}" ]]; then
    allow_json
    return
  fi
  local root target
  root=$(worktree_root "$cwd")
  target=$(resolve_user_path "$path" "$cwd")
  if is_git_metadata "$target" "$root"; then
    deny_json ".git 配下のファイルは編集禁止です。"
    return
  fi
  if ! is_inside_worktree "$target" "$root"; then
    deny_json "この worktree の外は編集禁止です: $path"
    return
  fi
  allow_json
}

decide_pre_tool_use() {
  local payload="$1"
  local tool_name path cwd
  tool_name=$(json_string tool_name "$payload")
  case "$tool_name" in
    Write | StrReplace | Delete | EditNotebook) ;;
    *)
      allow_json
      return
      ;;
  esac
  path=$(json_string path "$payload")
  if [[ -z "$path" ]]; then
    path=$(json_string target_notebook "$payload")
  fi
  cwd=$(json_string cwd "$payload")
  decide_file_edit "$path" "${cwd:-$PWD}"
}
