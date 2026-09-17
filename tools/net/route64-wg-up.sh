#!/usr/bin/env bash
# BSAHI D5 — bring up a routed IPv6 tunnel (Route64 / any WireGuard broker) on
# macOS so the census node accepts inbound IPv6 with NATIVE source addresses.
#
# WHY THIS BEATS EVERYTHING ELSE HERE: the tunnel is OUTBOUND-established
# (WireGuard + persistent keepalive), so the carrier's CGNAT AND its IPv6
# firewall are both bypassed. The broker routes a public IPv6 prefix to us over
# the tunnel, so an inbound Bitcoin peer's own source address reaches bitcoind
# unaltered — no NAT, no proxy, no identity collapse (unlike Tor/relays).
#
# Avoids wg-quick entirely: the macOS wg-quick needs bash 4 (system bash is 3.2).
# wireguard-go + `wg setconf` + ifconfig/route do the same job.
#
# Route64: https://route64.org — free, no card, automated. Create an IPv6
# tunnelbroker with protocol WireGuard; note the tunnel Address and routed /56.
#
#   sudo tools/net/route64-wg-up.sh ~/.bsahi/route64.conf [address-from-routed-subnet]
set -euo pipefail
BIN="$HOME/.bsahi/bin"
CONF="${1:-$HOME/.bsahi/route64.conf}"
ROUTED_ADDR="${2:-}"
IFACE="${IFACE:-utun72}"
WG_ONLY="/tmp/bsahi-wg-only.conf"

[ "$(id -u)" = "0" ] || { echo "run with sudo"; exit 2; }
for b in wireguard-go wg; do [ -x "$BIN/$b" ] || { echo "missing $BIN/$b"; exit 2; }; done
[ -f "$CONF" ] || { echo "no config at $CONF"; exit 2; }

# tunnel address straight from the config (Address = ...)
TUN_ADDR="$(awk -F= '/^[[:space:]]*Address/{gsub(/ /,"",$2); print $2; exit}' "$CONF")"
[ -n "$TUN_ADDR" ] || { echo "config has no Address line"; exit 2; }
# strip Address -> wg setconf only wants PrivateKey + Peer blocks
grep -vE '^[[:space:]]*Address' "$CONF" > "$WG_ONLY"

echo "==> starting wireguard-go on $IFACE"
"$BIN/wireguard-go" "$IFACE"
sleep 2
"$BIN/wg" setconf "$IFACE" "$WG_ONLY"

echo "==> assigning tunnel address $TUN_ADDR"
ifconfig "$IFACE" inet6 "$TUN_ADDR" prefixlen 64 up

if [ -n "$ROUTED_ADDR" ]; then
  echo "==> adding routed address $ROUTED_ADDR"
  ifconfig "$IFACE" inet6 "$ROUTED_ADDR" alias || true
fi

echo "==> handshake"
sleep 3
"$BIN/wg" show "$IFACE"

echo "==> bitcoind localaddresses (Core picks up new interface addrs dynamically)"
BC="$HOME/Library/Application Support/Bitcoin/bitcoin.conf"
U=$(grep -E '^rpcuser=' "$BC" | cut -d= -f2-); P=$(grep -E '^rpcpassword=' "$BC" | cut -d= -f2-)
curl -s --max-time 8 --user "$U:$P" -X POST -H 'content-type: application/json' \
  --data '{"jsonrpc":"1.0","id":"x","method":"getnetworkinfo","params":[]}' http://127.0.0.1:8332/ \
  | python3 -c "import sys,json;d=json.load(sys.stdin)['result'];print('  ',[a['address'] for a in d.get('localaddresses',[])])" 2>/dev/null || true

cat <<MSG

==> tunnel up. Next:
 1. Confirm your routed IPv6 appears in localaddresses above (no bitcoind
    restart needed -> the reindex survives).
 2. External check:  tools/net/relay-verify.sh <routed-ipv6> 8333
 3. IPv6 Bitcoin peers connect; their NATIVE source IPs land in the census.
 Teardown:  sudo kill \$(pgrep -f "wireguard-go $IFACE")
MSG
