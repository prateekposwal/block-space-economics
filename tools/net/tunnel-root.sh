#!/usr/bin/env bash
# BSAHI D5 — PRIVILEGED tunnel setup (root only). Kept to one auditable script so
# the sudoers grant can be scoped to exactly this file, not to ifconfig/route/wg.
#
#   tunnel-root.sh up   <conf> [extra_ipv6]
#   tunnel-root.sh down [iface]
set -euo pipefail
BIN="$HOME/.bsahi/bin"; [ -x "$BIN/wireguard-go" ] || BIN="/Users/prateekposwal/.bsahi/bin"
IFACE="${IFACE:-utun72}"
WG_ONLY="/tmp/bsahi-wg-only.$$"

case "${1:-}" in
  up)
    CONF="${2:?conf path}"; EXTRA="${3:-}"
    [ -f "$CONF" ] || { echo "no conf: $CONF"; exit 2; }
    TUN_ADDR="$(awk -F= '/^[[:space:]]*Address/{gsub(/ /,"",$2); print $2; exit}' "$CONF")"
    grep -vE '^[[:space:]]*Address' "$CONF" > "$WG_ONLY"
    "$BIN/wireguard-go" "$IFACE"
    sleep 2
    "$BIN/wg" setconf "$IFACE" "$WG_ONLY"
    ifconfig "$IFACE" inet6 "$TUN_ADDR" prefixlen 64 up
    [ -n "$EXTRA" ] && ifconfig "$IFACE" inet6 "$EXTRA" alias || true
    rm -f "$WG_ONLY"
    echo "tunnel $IFACE up: $TUN_ADDR"; "$BIN/wg" show "$IFACE" || true
    ;;
  down)
    pkill -f "wireguard-go $IFACE" 2>/dev/null || true
    echo "tunnel $IFACE down"
    ;;
  *) echo "usage: tunnel-root.sh up <conf> [extra_ipv6] | down"; exit 2;;
esac
