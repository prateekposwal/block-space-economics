#!/usr/bin/env bash
# BSAHI D5 — PRIVILEGED tunnel setup (root only). Kept to one auditable script so
# the sudoers grant can be scoped to exactly this file, not to ifconfig/route/wg.
#
#   tunnel-root.sh up   <conf> [extra_ipv6]
#   tunnel-root.sh down [iface]
#
# Handles BOTH config shapes we see in the wild:
#   * tunnelbroker : Address = 2a11:...::2/64                      (one address)
#   * BGP tunnel   : Address = 100.64.252.214/30, 2a11:...::2/64   (two, mixed)
#     plus wg-quick-only directives (Table/DNS/MTU/...) that `wg setconf` rejects.
#
# DRY=1 tunnel-root.sh up <conf>   -> print what WOULD run (no root needed)
set -euo pipefail
BIN="$HOME/.bsahi/bin"; [ -x "$BIN/wireguard-go" ] || BIN="/Users/prateekposwal/.bsahi/bin"
IFACE="${IFACE:-utun72}"
WG_ONLY="/tmp/bsahi-wg-only.$$"

# Address lines -> one address per line (comma or space separated)
addresses() {
  awk '/^[[:space:]]*Address[[:space:]]*=/{sub(/^[^=]*=/,""); print; exit}' "$1" \
    | tr ', ' '\n\n' | grep -v '^$' || true
}
# Strip wg-quick-only keys that `wg setconf` does not understand
wg_only() {
  grep -vE '^[[:space:]]*(Address|Table|DNS|MTU|SaveConfig|PreUp|PostUp|PreDown|PostDown)[[:space:]]*=' "$1" || true
}
cidr2mask() {  # $1 prefix 1..32 -> dotted mask
  local p="$1" bits; bits=$(( 0xffffffff << (32-p) & 0xffffffff ))
  printf '%d.%d.%d.%d' $((bits>>24&255)) $((bits>>16&255)) $((bits>>8&255)) $((bits&255))
}

case "${1:-}" in
  up)
    CONF="${2:?conf path}"; EXTRA="${3:-}"
    [ -f "$CONF" ] || { echo "no conf: $CONF"; exit 2; }

    if [ "${DRY:-0}" = "1" ]; then
      echo "DRY: $BIN/wireguard-go $IFACE"
      echo "DRY: wg setconf $IFACE <<<"
      wg_only "$CONF" | sed 's/^/       /'
      echo "DRY: addresses to assign:"
      addresses "$CONF" | while read -r a; do
        [ -z "$a" ] && continue
        ip="${a%%/*}"; plen="${a##*/}"
        case "$ip" in
          *:*) echo "       ifconfig $IFACE inet6 $ip prefixlen $plen up" ;;
          *)   echo "       ifconfig $IFACE inet $ip netmask $(cidr2mask "$plen") up" ;;
        esac
      done
      [ -n "$EXTRA" ] && echo "       ifconfig $IFACE inet6 $EXTRA alias"
      exit 0
    fi

    "$BIN/wireguard-go" "$IFACE"
    sleep 2
    wg_only "$CONF" > "$WG_ONLY"
    "$BIN/wg" setconf "$IFACE" "$WG_ONLY"
    rm -f "$WG_ONLY"

    addresses "$CONF" | while read -r a; do
      [ -z "$a" ] && continue
      ip="${a%%/*}"; plen="${a##*/}"
      case "$ip" in
        *:*) ifconfig "$IFACE" inet6 "$ip" prefixlen "$plen" up ;;
        *)   ifconfig "$IFACE" inet "$ip" netmask "$(cidr2mask "$plen")" up ;;
      esac
      echo "  assigned $a"
    done
    [ -n "$EXTRA" ] && ifconfig "$IFACE" inet6 "$EXTRA" alias || true
    ifconfig "$IFACE" | grep -E "inet6? |inet " | sed 's/^/  /' || true
    echo "tunnel $IFACE up"; "$BIN/wg" show "$IFACE" || true
    ;;
  down)
    pkill -f "wireguard-go $IFACE" 2>/dev/null || true
    echo "tunnel $IFACE down"
    ;;
  *) echo "usage: tunnel-root.sh up <conf> [extra_ipv6] | down"; exit 2;;
esac
