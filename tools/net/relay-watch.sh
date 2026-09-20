#!/usr/bin/env bash
# BSAHI D5 — Mac-side relay supervisor (run in the FOREGROUND under launchd).
#
# Keeps the two Mac-side halves of the census relay alive forever:
#   1. proxyproto_demux.py  :8344 -> bitcoind :8333   (recovers the REAL peer IP)
#   2. ssh -N -R entry:9000 -> Mac 127.0.0.1:8344     (borrowed public address)
#
#   peers -> [entry host :8333 HAProxy send-proxy-v2] -> ssh -R -> [demuxer] -> Core
#
# INERT BY DEFAULT: if ~/.bsahi/relay.conf has no HOST, this exits 0 and launchd
# (KeepAlive.SuccessfulExit=false) leaves it down — so it is safe to install and
# load before a host exists. It starts working the moment HOST is set.
#
# Config:  ~/.bsahi/relay.conf   with one line:  HOST=user@public-ip
# Env:     PORT (8333) TUNNEL_PORT (9000) DEMUX_PORT (8344)
#
# It does NOT modify Bitcoin Core or the SCCR model; it only forwards P2P traffic
# to the already-listening node and records source IPs to data/proxy_inbound.jsonl.

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONF="${HOME}/.bsahi/relay.conf"
HOST=""; [ -f "$CONF" ] && HOST="$(sed -n 's/^HOST=//p' "$CONF" | head -1 | tr -d ' ')"
PORT="${PORT:-8333}"; TUNNEL_PORT="${TUNNEL_PORT:-9000}"; DEMUX_PORT="${DEMUX_PORT:-8344}"
LOG="${ROOT}/data/proxy_inbound.jsonl"

log() { echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') $*"; }

if [ -z "$HOST" ]; then
  log "relay not configured (set HOST in $CONF) — supervisor idle"
  exit 0
fi

# 1. demuxer (idempotent — never start a second one)
if pgrep -f "proxyproto_demux.py" >/dev/null 2>&1; then
  log "demuxer already running"
else
  log "starting demuxer :$DEMUX_PORT -> 127.0.0.1:8333"
  nohup python3 "$ROOT/tools/net/proxyproto_demux.py" \
    --listen "$DEMUX_PORT" --forward 8333 --forward-host 127.0.0.1 \
    --log "$LOG" >>/tmp/bsahi-demux.log 2>&1 &
  sleep 1
fi

# 2. reverse tunnel, foreground, with reconnect (launchd supervises this process)
log "relay supervisor up: $HOST:$TUNNEL_PORT -> 127.0.0.1:$DEMUX_PORT (log $LOG)"
while true; do
  ssh -N \
    -o BatchMode=yes \
    -o ServerAliveInterval=20 -o ServerAliveCountMax=3 \
    -o ExitOnForwardFailure=yes \
    -o ConnectTimeout=15 \
    -R "${TUNNEL_PORT}:127.0.0.1:${DEMUX_PORT}" "$HOST"
  log "tunnel to $HOST exited ($?); reconnecting in 15s"
  sleep 15
done
