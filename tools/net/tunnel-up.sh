#!/usr/bin/env bash
# BSAHI D5 — Mac side: bring up the census relay WITHOUT a public IP on the Mac.
#   tools/net/tunnel-up.sh user@entry-host
# Starts (1) an outbound reverse tunnel and (2) the PROXY-protocol demuxer, which
# recovers the real peer IPs and feeds them to the census.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HOST="${1:-}"; [ -z "$HOST" ] && { echo "usage: tunnel-up.sh user@entry-host"; exit 2; }
TUNNEL_PORT="${TUNNEL_PORT:-9000}"     # must match the entry point's backend
DEMUX_PORT="${DEMUX_PORT:-8344}"

# 1) reverse tunnel: entry-host:127.0.0.1:TUNNEL_PORT -> Mac 127.0.0.1:DEMUX_PORT
pkill -f "ssh -N -R ${TUNNEL_PORT}:127.0.0.1:${DEMUX_PORT}" 2>/dev/null || true
nohup ssh -N -o BatchMode=yes -o ServerAliveInterval=20 -o ServerAliveCountMax=3 \
  -o ExitOnForwardFailure=yes \
  -R "${TUNNEL_PORT}:127.0.0.1:${DEMUX_PORT}" "$HOST" >/tmp/bsahi-tunnel.log 2>&1 &
echo "  tunnel up: $HOST:$TUNNEL_PORT -> 127.0.0.1:$DEMUX_PORT"

# 2) demuxer (idempotent)
if ! pgrep -f proxyproto_demux >/dev/null; then
  nohup python3 "$ROOT/tools/net/proxyproto_demux.py" \
    --listen "$DEMUX_PORT" --forward 8333 \
    --log "$ROOT/data/proxy_inbound.jsonl" >>/tmp/bsahi-demux.log 2>&1 &
  echo "  demuxer up on :$DEMUX_PORT -> bitcoind :8333"
else
  echo "  demuxer already running"
fi
echo "  evidence: $ROOT/data/proxy_inbound.jsonl"
