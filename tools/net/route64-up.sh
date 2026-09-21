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

# Reply path: without this, inbound SYNs arrive on the tunnel but the kernel sends
# the SYN-ACK out the physical interface (invalid source), so no peer ever
# completes the handshake. route-on pins the endpoint /128 to the physical gateway
# and routes 2000::/3 via the tunnel. Reversible with route-off.
EP="$(sed -n 's/.*Endpoint *= *\[\{0,1\}\([0-9a-fA-F:]\{6,\}\)\]\{0,1\}:.*/\1/p' "$CONF" 2>/dev/null | head -1 || true)"
EP="${EP:-2a11:6c7:3::1}"
if sudo -n "$ROOT/tools/net/tunnel-root.sh" route-on "$EP"; then
  echo "  reply-path routes installed (route-off to revert)"
else
  echo "  WARN: route-on failed — inbound will arrive but replies may not return"
fi

# SECOND LISTENING ADDRESS -> a second capture channel for capture-recapture.
# Two addresses in the same routed /64, each gossiped separately, so a peer that
# learned one may still be caught by the other. Weak independence (same host,
# same peer set) — stated as such in the estimate — but it is a real second
# channel and it costs nothing.
# Derive the second address from OUR address in the conf — never from the
# endpoint. The endpoint lives in the PROVIDER's prefix (adding an alias there
# yields an address they do not route to us, which is unreachable: found by an
# external probe 2026-09-21).
SELF="$(sed -n 's/.*Address *= *[^,]*, *\([0-9a-fA-F:]\{6,\}\)\/[0-9]*.*/\1/p' "$CONF" | head -1)"
SECOND="$(printf '%s' "$SELF" | sed -E 's/::[0-9a-fA-F]+$/::3/')"
[ "$SECOND" = "$SELF" ] && SECOND=""
if [ -n "$SECOND" ] && [ "$SECOND" != "$EP" ]; then
  sudo -n "$ROOT/tools/net/tunnel-root.sh" addaddr "$SECOND" 64 >/dev/null 2>&1 \
    && echo "  second listening address: $SECOND/64 (capture channel 2)" || true
fi

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
