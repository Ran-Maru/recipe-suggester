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

is_tmp_path() {
  local path="$1"
  [[ "$path" == /tmp || "$path" == /tmp/* || "$path" == /private/tmp || "$path" == /private/tmp/* ]]
}

is_src_path() {
  local path="$1"
  local root="$2"
  local rel="${path#"$root"/}"
  [[ "$path" == "$root/src" || "$rel" == src || "$rel" == src/* ]]
}

# Deny only irreversible targets: /, $HOME, .git, src/, worktree root, or an ancestor of the worktree.
is_denied_rm_target() {
  local path="$1"
  local root="$2"
  if [[ "$path" == / || "$path" == "$HOME" ]]; then
    return 0
  fi
  if is_git_metadata "$path" "$root"; then
    return 0
  fi
  if is_src_path "$path" "$root"; then
    return 0
  fi
  if [[ "$path" == "$root" || "$root" == "$path"/* ]]; then
    return 0
  fi
  return 1
}

unquote_token() {
  local token="$1"
  if [[ ${#token} -ge 2 ]]; then
    local first="${token:0:1}"
    local last="${token: -1}"
    if [[ "$first" == "$last" && ( "$first" == '"' || "$first" == "'" ) ]]; then
      token="${token:1:${#token}-2}"
    fi
  fi
  printf '%s\n' "$token"
}

skip_env_assignments() {
  local i=0
  while [[ $i -lt ${#_POLICY_TOKENS[@]} ]]; do
    local token="${_POLICY_TOKENS[$i]}"
    if [[ "$token" == [A-Za-z_]*=* ]]; then
      i=$((i + 1))
      continue
    fi
    break
  done
  if [[ $i -gt 0 ]]; then
    _POLICY_TOKENS=("${_POLICY_TOKENS[@]:$i}")
  fi
}

split_shell_commands() {
  printf '%s' "$1" | sed -E 's/(&&|\|\||;|\|)/\'$'\n/g'
}

command_tokens() {
  local raw token
  _POLICY_TOKENS=()
  read -ra raw <<< "$1"
  for token in "${raw[@]}"; do
    _POLICY_TOKENS+=("$(unquote_token "$token")")
  done
  skip_env_assignments
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
    if is_denied_rm_target "$target" "$root"; then
      deny_json "危険な rm 対象です: $raw"
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
  if is_inside_worktree "$dest" "$root"; then
    return 1
  fi
  if [[ "$name" == cp ]] && is_tmp_path "$dest"; then
    return 1
  fi
  if [[ "$name" == mv ]]; then
    deny_json "mv の移動先がこの worktree の外です: ${_POLICY_PATHS[${#_POLICY_PATHS[@]} - 1]}"
    return 0
  fi
  deny_json "cp のコピー先がこの worktree と /tmp の外です: ${_POLICY_PATHS[${#_POLICY_PATHS[@]} - 1]}"
  return 0
}

git_subcommand_index() {
  local i=1
  local token
  while [[ $i -lt ${#_POLICY_TOKENS[@]} ]]; do
    token="${_POLICY_TOKENS[$i]}"
    case "$token" in
      -C | -c | --git-dir | --work-tree | --namespace | --config-env)
        i=$((i + 2))
        continue
        ;;
      --git-dir=* | --work-tree=* | --namespace=* | --config-env=* | -c*)
        i=$((i + 1))
        continue
        ;;
      --)
        i=$((i + 1))
        printf '%s\n' "$i"
        return 0
        ;;
      -*)
        i=$((i + 1))
        continue
        ;;
      *)
        printf '%s\n' "$i"
        return 0
        ;;
    esac
  done
  return 1
}

is_whole_worktree_path() {
  local path="$1"
  path="${path%%/}"
  [[ "$path" == "." || "$path" == ":/" || "$path" == "*" ]]
}

has_git_short_flag() {
  local needle="$1"
  local token
  for token in "${_POLICY_TOKENS[@]:1}"; do
    if [[ "$token" == --* || "$token" == "-" ]]; then
      continue
    fi
    if [[ "$token" == -* && "$token" == *"$needle"* ]]; then
      return 0
    fi
  done
  return 1
}

decide_git() {
  local name
  name=$(basename_of "${_POLICY_TOKENS[0]}")
  [[ "$name" == git ]] || return 1
  local sub_index subcommand
  sub_index=$(git_subcommand_index) || return 1
  subcommand="${_POLICY_TOKENS[$sub_index]}"
  local token
  case "$subcommand" in
    push)
      local has_bare_force=0
      for token in "${_POLICY_TOKENS[@]:sub_index+1}"; do
        if [[ "$token" == --force-with-lease || "$token" == --force-with-lease=* ]]; then
          continue
        fi
        if [[ "$token" == --force || "$token" == --force=* ]]; then
          has_bare_force=1
          break
        fi
        if [[ "$token" == -* && "$token" != --* && "$token" != "-" && "$token" == *f* ]]; then
          has_bare_force=1
          break
        fi
        if [[ "$token" == +* ]]; then
          has_bare_force=1
          break
        fi
      done
      if [[ $has_bare_force -eq 1 ]]; then
        deny_json "git push --force / -f / +refspec は禁止です。"
        return 0
      fi
      ;;
    reset)
      for token in "${_POLICY_TOKENS[@]:sub_index+1}"; do
        if [[ "$token" == --hard ]]; then
          deny_json "git reset --hard は禁止です。"
          return 0
        fi
      done
      ;;
    clean)
      if has_git_short_flag x || has_git_short_flag X; then
        deny_json "git clean の -x / -X は禁止です。"
        return 0
      fi
      ;;
    checkout | restore)
      for token in "${_POLICY_TOKENS[@]:sub_index+1}"; do
        if [[ "$token" == "--" ]]; then
          continue
        fi
        if [[ "$token" == -* && "$token" != "-" ]]; then
          continue
        fi
        if is_whole_worktree_path "$token"; then
          deny_json "git checkout/restore で worktree 全体の変更を捨てる操作は禁止です。"
          return 0
        fi
      done
      ;;
    filter-branch | filter-repo)
      deny_json "git filter-branch / filter-repo は禁止です。"
      return 0
      ;;
  esac
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
