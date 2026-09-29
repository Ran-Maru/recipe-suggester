#!/usr/bin/env bash
# Linux x86_64 で、Pin した similarity-ts を指定ディレクトリへ置く。
set -euo pipefail

dest="${1:?インストール先ディレクトリを指定してください}"

SIMILARITY_VERSION=0.5.0
SIMILARITY_SHA256=2afda6201b6afb1ee36c1ce51b95a538ec99310c79f661905536d917470a406a

download_verified() {
  local url="$1"
  local sha="$2"
  local archive="$3"
  curl -fsSL -o "$archive" "$url"
  printf '%s  %s\n' "$sha" "$archive" | sha256sum -c -
}

os=$(uname -s)
arch=$(uname -m)
case "$os:$arch" in
  Linux:x86_64) ;;
  *)
    printf '未対応の OS またはアーキテクチャです: %s %s\n' "$os" "$arch" >&2
    printf 'Linux の x86_64 だけに対応しています。\n' >&2
    exit 1
    ;;
esac

mkdir -p "$dest"

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

asset="similarity-v${SIMILARITY_VERSION}-x86_64-unknown-linux-gnu.tar.gz"
download_verified \
  "https://github.com/mizchi/similarity/releases/download/v${SIMILARITY_VERSION}/${asset}" \
  "$SIMILARITY_SHA256" \
  "$tmpdir/$asset"
tar -xzf "$tmpdir/$asset" -C "$tmpdir"
install -m 755 "$tmpdir/similarity-v${SIMILARITY_VERSION}-x86_64-unknown-linux-gnu/similarity-ts" "$dest/similarity-ts"
