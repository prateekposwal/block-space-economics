#!/usr/bin/env bash
# BSAHI D5 — bring up the routed-IPv6 census tunnel. macOS-correct, unattended.
#
#   tools/net/route64-up.sh [conf_path] [addr_from_routed_/56]
#
# Default conf: ~/.bsahi/route64.conf   (download it from Route64)
# Requires the one-time unlock:  sudo tools/net/bsahi-net-unlock.sh
#
# Uses `sudo -n` (non-interactive). It does NOT read or store your password —
# if the one-time sudoers rule is absent it fails loudly instead.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONF="${1:-$HOME/.bsahi/route64.conf}"
EXTRA="${2:-}"
IFACE="${IFACE:-utun72}"

[ -f "$CONF" ] || { echo "no WireGuard conf at $CONF"; echo "  get it from https://route64.org (free, no card): create an IPv6 tunnelbroker, protocol WireGuard"; exit 2; }
if [ -n "$EXTRA" ]; then
  # the + prefix tells ifconfig to ADD rather than replace the tunnel address
  EXTRA="$EXTRA"
fi

echo "==> preflight: is the one-time unlock in place?"
if ! sudo -n "$ROOT/tools/net/tunnel-root.sh" down >/dev/null 2>&1; then
  echo "  not unlocked. Run ONCE (needs your password that one time):"
  echo "     sudo $ROOT/tools/net/bshai-net-unlock.sh"
  exit 3
fi
echo "  ok"

echo "==> bringing up the tunnel ($IFACE)"
sudo -n "$ROOT/tools/net/tunnel-root.sh" up "$CONF" "$EXTRA"

echo "==> waiting for handshake"
for i in $(seq 1 10); do
  if ~/.bsahi/bin/wg show "$IFACE" 2>/dev/null | grep -q "latest handshake"; then echo "  handshake established"; break; fi
  sleep 3
done
~/.bsahi/bin/wg show "$IFACE" 2>/dev/null | sed 's/^/  /' || true

echo "==> interface + routes"
ifconfig "$IFACE" 2>/dev/null | grep inet6 | sed 's/^/  /' || true
netstat -rn -f inet6 2>/dev/null | grep "$IFACE" | head -3 | sed 's/^/  /' || true

echo "==> bitcoind localaddresses (should now include the tunnel IPv6; no restart needed)"
BC="$HOME/Library/Application Support/Bitcoin/bitcoin.conf"
U=$(grep -E '^rpcuser=' "$BC" | cut -d= -f2-); P=$(grep -E '^rpcpassword=' "$BC" | cut -d= -f2-)
curl -s --max-time 8 --user "$U:$P" -X POST -H 'content-type: application/json' \
  --data '{"jsonrpc":"1.0","id":"x","method":"getnetworkinfo","params":[]}' http://127.0.0.1:8332/ \
  | python3 -c "import sys,json;d=json.load(sys.stdin)['result'];print('  ',[a['address'] for a in d.get('localaddresses',[])])" 2>/dev/null || true

echo
echo "==> live. IPv6 peers will now reach the node with NATIVE source addresses."
echo "    verify from outside:  tools/net/relay-verify.sh <tunnel-ipv6> 8333"
echo "    tear down:            sudo -n $ROOT/tools/net/tunnel-root.sh down"
