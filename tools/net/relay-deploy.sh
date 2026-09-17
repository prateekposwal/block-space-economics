#!/usr/bin/env bash
# BSAHI D5 — ONE COMMAND: deploy the entry point, bring up the tunnel + demuxer,
# and verify the relay end to end.
#
#   tools/net/relay-deploy.sh ubuntu@<public-ip>
#
# Does: scp entrypoint files -> run entrypoint-setup.sh -> start reverse tunnel
# -> start demuxer -> verify a PROXY header arrives with the real source IP.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HOST="${1:-}"; [ -z "$HOST" ] && { echo "usage: relay-deploy.sh user@public-ip"; exit 2; }
PORT="${PORT:-8333}"; TUNNEL_PORT="${TUNNEL_PORT:-9000}"; DEMUX_PORT="${DEMUX_PORT:-8344}"
SSH_CMD="ssh -o BatchMode=yes -o ConnectTimeout=15"

echo "==> [1/5] reachability"
$SSH_CMD "$HOST" 'echo ok' >/dev/null || { echo "  ssh failed to $HOST (check key/security list)"; exit 3; }
echo "  ok"

echo "==> [2/5] install entry point"
scp -q tools/net/entrypoint-haproxy.cfg tools/net/entrypoint-setup.sh "$HOST:"
$SSH_CMD "$HOST" "sudo PORT=$PORT TUNNEL_PORT=$TUNNEL_PORT bash entrypoint-setup.sh"

echo "==> [3/5] reverse tunnel + demuxer (Mac)"
PORT="$PORT" TUNNEL_PORT="$TUNNEL_PORT" DEMUX_PORT="$DEMUX_PORT" "$ROOT/tools/net/tunnel-up.sh" "$HOST"
sleep 3

echo "==> [4/5] verify the tunnel is listening on the entry point"
$SSH_CMD "$HOST" "ss -ltn 2>/dev/null | grep -E ':($PORT|$TUNNEL_PORT)\b' || netstat -ltn 2>/dev/null | grep -E ':($PORT|$TUNNEL_PORT)'" \
  | sed 's/^/  /' || echo "  (could not read listeners)"

echo "==> [5/5] verify a real PROXY v2 header reaches the demuxer"
IP="${HOST#*@}"
# self-test: connect from the Mac to the entry point's public port; HAProxy should
# forward with PROXY v2 and the demuxer should log OUR public egress IP.
before=$(wc -l < "$ROOT/data/proxy_inbound.jsonl" 2>/dev/null || echo 0)
python3 - "$IP" "$PORT" <<'PY'
import socket, sys, time
ip, port = sys.argv[1], int(sys.argv[2])
try:
    s = socket.create_connection((ip, port), timeout=12)
    s.sendall(bytes.fromhex("f9beb4d9") + b"relay-selftest")   # bitcoin magic
    time.sleep(1.5); s.close()
    print("  sent a magic-prefixed connection to %s:%d" % (ip, port))
except Exception as e:
    print("  connect failed:", e)
PY
sleep 2
after=$(wc -l < "$ROOT/data/proxy_inbound.jsonl" 2>/dev/null || echo 0)
echo "  demuxer log lines: $before -> $after"
if [ "$after" -gt "$before" ]; then
  tail -1 "$ROOT/data/proxy_inbound.jsonl" | sed 's/^/  last record: /'
  echo "  RELAY WORKING — real source IP captured."
else
  echo "  No new record. Check: provider security list, haproxy status, ssh -R."
fi
