#!/usr/bin/env bash
# BSAHI D5 — recurring discovery: keep gossiping our census IPv6 to peers so they
# add it to their addrman and dial us. Without this the census endpoint stays
# known only to the peers we told ONCE, and inbound never starts.
#
# INERT unless the tunnel is up and fresh, so it is safe to schedule always.
# Uses a NON-Core listen port (default 18333) because bitcoind already owns 8333.
#
#   advertise.sh            # default 2 rounds (~2 min)
#   ROUNDS=5 advertise.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONF="${HOME}/.bsahi/route64.conf"
LISTEN_PORT="${LISTEN_PORT:-18333}"
ROUNDS="${ROUNDS:-2}"
LOG="${ROOT}/data/sentinel.jsonl"

if [ ! -s "$CONF" ]; then echo "advertise: no $CONF — idle"; exit 0; fi

# tunnel must be established (fresh handshake) or there is nothing to advertise
TS="$(sudo -n "$ROOT/tools/net/tunnel-root.sh" hsage 2>/dev/null | tr -dc '0-9')"
NOW="$(date +%s)"
if [ -z "$TS" ] || [ "$TS" = "0" ] || [ $((NOW - TS)) -gt 300 ]; then
  echo "advertise: tunnel not fresh (ts=${TS:-none}) — skipping"
  exit 0
fi

# our routable IPv6 from the tunnel config (first IPv6 in the Address line)
ADDR="$(sed -n 's/^[[:space:]]*Address[[:space:]]*=[[:space:]]*//p' "$CONF" \
        | tr ',' '\n' | tr -d ' ' | grep ':' | head -1 | cut -d/ -f1)"
if [ -z "$ADDR" ]; then echo "advertise: no IPv6 in $CONF — skipping"; exit 0; fi

# Advertise EVERY reachable address we hold, not just the first. Each address is
# gossiped separately, which is what makes each one a distinct capture channel for
# capture-recapture (data/inbound_samples.jsonl tags arrivals by local address).
ADDRS="$ADDR"
SECOND="$(printf '%s' "$ADDR" | sed -E 's/::[0-9a-fA-F]+$/::3/')"
if [ -n "$SECOND" ] && [ "$SECOND" != "$ADDR" ]; then ADDRS="$ADDR $SECOND"; fi

for A in $ADDRS; do
  echo "advertise: gossiping [$A]:8333 (${ROUNDS} round(s), listen ${LISTEN_PORT})"
  python3 "$ROOT/tools/net/seed_sentinel.py" \
    --listen "$LISTEN_PORT" --advertise "[$A]:8333" \
    --log "$LOG" --rounds "$ROUNDS" 2>&1 | tail -3
done
exit 0
