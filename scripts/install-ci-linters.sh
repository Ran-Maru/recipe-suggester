#!/usr/bin/env bash
# Pin した ShellCheck と actionlint を、指定ディレクトリへ置く。
set -euo pipefail

dest="${1:?インストール先ディレクトリを指定してください}"
mkdir -p "$dest"

SHELLCHECK_VERSION=0.11.0
ACTIONLINT_VERSION=1.7.12

download_verified() {
  local url="$1"
  local sha="$2"
  local archive="$3"
  curl -fsSL -o "$archive" "$url"
  printf '%s  %s\n' "$sha" "$archive" | sha256sum -c -
}

arch=$(uname -m)
case "$arch" in
  x86_64)
    shellcheck_asset="linux.x86_64"
    shellcheck_sha="8c3be12b05d5c177a04c29e3c78ce89ac86f1595681cab149b65b97c4e227198"
    actionlint_asset="linux_amd64"
    actionlint_sha="8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8"
    ;;
  aarch64 | arm64)
    shellcheck_asset="linux.aarch64"
    shellcheck_sha="12b331c1d2db6b9eb13cfca64306b1b157a86eb69db83023e261eaa7e7c14588"
    actionlint_asset="linux_arm64"
    actionlint_sha="325e971b6ba9bfa504672e29be93c24981eeb1c07576d730e9f7c8805afff0c6"
    ;;
  *)
    printf '未対応のアーキテクチャです: %s\n' "$arch" >&2
    exit 1
    ;;
esac

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

download_verified \
  "https://github.com/koalaman/shellcheck/releases/download/v${SHELLCHECK_VERSION}/shellcheck-v${SHELLCHECK_VERSION}.${shellcheck_asset}.tar.xz" \
  "$shellcheck_sha" \
  "$tmpdir/shellcheck.tar.xz"
tar -xJf "$tmpdir/shellcheck.tar.xz" -C "$tmpdir"
install -m 755 "$tmpdir/shellcheck-v${SHELLCHECK_VERSION}/shellcheck" "$dest/shellcheck"

download_verified \
  "https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/actionlint_${ACTIONLINT_VERSION}_${actionlint_asset}.tar.gz" \
  "$actionlint_sha" \
  "$tmpdir/actionlint.tar.gz"
tar -xzf "$tmpdir/actionlint.tar.gz" -C "$tmpdir" actionlint
install -m 755 "$tmpdir/actionlint" "$dest/actionlint"
