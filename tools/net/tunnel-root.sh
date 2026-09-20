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
# macOS utun is POINTOPOINT: an IPv4 address needs a peer/destination or ifconfig
# fails with "Destination address required". For a /30 the peer is the other host.
ipv4_peer() {  # $1=ip $2=prefix -> peer ip
  local a b c d ip plen size net off peer
  IFS=. read -r a b c d <<<"$1"
  plen="$2"
  ip=$(( (a<<24)|(b<<16)|(c<<8)|d ))
  [ "$plen" -ge 31 ] && { echo "$1"; return; }
  size=$(( 1 << (32-plen) ))
  net=$(( ip & ~(size-1) ))
  off=$(( ip - net ))
  peer=$(( net + size - 1 - off ))
  printf '%d.%d.%d.%d' $((peer>>24&255)) $((peer>>16&255)) $((peer>>8&255)) $((peer&255))
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
          *)   echo "       ifconfig $IFACE inet $ip $(ipv4_peer "$ip" "$plen") up" ;;
        esac
      done
      [ -n "$EXTRA" ] && echo "       ifconfig $IFACE inet6 $EXTRA alias"
      exit 0
    fi

    if ! ifconfig "$IFACE" >/dev/null 2>&1; then
      "$BIN/wireguard-go" "$IFACE"; sleep 2
    else
      echo "  ($IFACE already exists — not restarting wireguard-go)"
    fi
    wg_only "$CONF" > "$WG_ONLY"
    "$BIN/wg" setconf "$IFACE" "$WG_ONLY" || { rm -f "$WG_ONLY"; echo "  wg setconf FAILED"; exit 4; }
    rm -f "$WG_ONLY"

    # Assign every address. Each is best-effort and NON-FATAL: a transport IPv4
    # that will not stick must not stop the essential IPv6 address being added.
    addresses "$CONF" | while read -r a; do
      [ -z "$a" ] && continue
      ip="${a%%/*}"; plen="${a##*/}"
      case "$ip" in
        *:*)
          if ifconfig "$IFACE" inet6 "$ip" prefixlen "$plen" up 2>/dev/null; then echo "  assigned $a"
          else echo "  WARN: could not assign $a (non-fatal)"; fi ;;
        *)
          # point-to-point: give the /30 peer as destination
          if ifconfig "$IFACE" inet "$ip" "$(ipv4_peer "$ip" "$plen")" up 2>/dev/null; then echo "  assigned $a"
          else echo "  WARN: could not assign $a (non-fatal)"; fi ;;
      esac
    done
    [ -n "$EXTRA" ] && ifconfig "$IFACE" inet6 "$EXTRA" alias || true
    ifconfig "$IFACE" | grep -E "inet6? |inet " | sed 's/^/  /' || true
    echo "tunnel $IFACE up"; "$BIN/wg" show "$IFACE" || true
    ;;
  status)
    echo "--- wg show $IFACE ---"; "$BIN/wg" show "$IFACE" 2>&1 || true
    echo "--- addresses ---"; ifconfig "$IFACE" 2>/dev/null | grep -E "inet6? |inet " || true
    echo "--- routes via $IFACE ---"; netstat -rn -f inet6 2>/dev/null | grep "$IFACE" || true
    ;;
  down)
    pkill -f "wireguard-go $IFACE" 2>/dev/null || true
    echo "tunnel $IFACE down"
    ;;
  *) echo "usage: tunnel-root.sh up <conf> [extra_ipv6] | status | down"; exit 2;;
esac
