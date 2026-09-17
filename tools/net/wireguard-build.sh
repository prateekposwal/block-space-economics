#!/usr/bin/env bash
# BSAHI D5 — build the WireGuard userspace toolchain on macOS WITHOUT Homebrew.
# Produces ~/.bsahi/bin/{wireguard-go,wg}. Run once (no sudo needed).
set -euo pipefail
mkdir -p "$HOME/.bsahi/bin"
export PATH="$HOME/.bsahi/go/bin:$PATH"

if [ ! -x "$HOME/.bsahi/go/bin/go" ]; then
  echo "==> fetching Go (userland)"
  curl -sL --max-time 300 -o /tmp/go.tgz https://go.dev/dl/go1.23.4.darwin-arm64.tar.gz
  rm -rf "$HOME/.bsahi/go" && tar -xzf /tmp/go.tgz -C "$HOME/.bsahi" && rm -f /tmp/go.tgz
fi
"$HOME/.bsahi/go/bin/go" version

echo "==> building wireguard-go"
[ -d "$HOME/.bsahi/wireguard-go" ] || git clone -q --depth 1 https://git.zx2c4.com/wireguard-go "$HOME/.bsahi/wireguard-go"
( cd "$HOME/.bsahi/wireguard-go" && "$HOME/.bsahi/go/bin/go" build -o "$HOME/.bsahi/bin/wireguard-go" . )

echo "==> building wg"
if [ ! -d "$HOME/.bsahi/wireguard-tools" ]; then
  curl -sL --max-time 120 -o /tmp/wgt.tar.xz https://git.zx2c4.com/wireguard-tools/snapshot/wireguard-tools-1.0.20210914.tar.xz
  mkdir -p "$HOME/.bsahi/wireguard-tools"
  tar -xJf /tmp/wgt.tar.xz -C "$HOME/.bsahi/wireguard-tools" --strip-components=1 && rm -f /tmp/wgt.tar.xz
fi
( cd "$HOME/.bsahi/wireguard-tools/src" && make wg >/dev/null && cp wg "$HOME/.bsahi/bin/" )

echo "==> done:"
"$HOME/.bsahi/bin/wireguard-go" --version
"$HOME/.bsahi/bin/wg" --version
