#!/usr/bin/env bash
# BSAHI D5 — routed-IPv6 tunnel supervisor (run in the FOREGROUND under launchd).
#
# The no-card, no-account path to a public endpoint: a free WireGuard IPv6
# tunnelbroker (Route64) hands out a ROUTED /56. Because the tunnel is
# outbound-established with keepalive it bypasses both the CGNAT and the
# carrier's inbound-IPv6 firewall, and because the prefix is routed (not NATed)
# an inbound peer's own IPv6 source address reaches bitcoind ALTERED — real
# distinct identities, the whole point.
#
# INERT until BOTH of these exist:
#   ~/.bsahi/route64.conf                    (downloaded from https://route64.org)
#   /etc/sudoers.d/bsahi-networking          (the one-time `sudo bashi-net-unlock.sh`)
# launchd watches both paths and starts this the moment they appear.
#
# It does NOT modify Bitcoin Core or the SCCR model.

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONF="${HOME}/.bsahi/route64.conf"
UNLOCK="/etc/sudoers.d/bsahi-networking"
log() { echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') $*"; }

[ -f "$CONF" ] || { log "route64 not configured (no $CONF) — idle"; exit 0; }
if ! sudo -n "$ROOT/tools/net/tunnel-root.sh" down >/dev/null 2>&1; then
  log "route64 conf present but sudo is LOCKED — run once: sudo $ROOT/tools/net/bsahi-net-unlock.sh"
  exit 0
fi

log "bringing up routed-IPv6 tunnel (conf present, sudo unlocked)"
"$ROOT/tools/net/route64-up.sh" "$CONF" || log "route64-up.sh failed"

# Keepalive loop. SAFETY: 2000::/3 is routed via the tunnel, so a dead tunnel
# would blackhole ALL host IPv6. On a lapsed handshake we first tear down (which
# removes the routes and restores normal IPv6), then bring it back with fresh
# routes. Never leave the routes pointing at a dead tunnel.
STALE=180
while true; do
  TS="$(sudo -n "$ROOT/tools/net/tunnel-root.sh" hsage 2>/dev/null | tr -dc '0-9')"
  NOW="$(date +%s)"
  if [ -z "$TS" ] || [ "$TS" = "0" ] || [ $((NOW - TS)) -gt "$STALE" ]; then
    log "handshake stale (ts=${TS:-none}, age=$((NOW - ${TS:-0}))s) — tearing down (routes off), then re-up"
    sudo -n "$ROOT/tools/net/tunnel-root.sh" down >/dev/null 2>&1 || true
    sleep 5
    "$ROOT/tools/net/route64-up.sh" "$CONF" >/dev/null 2>&1 || true
    sleep 45
  else
    sleep 120
  fi
done
