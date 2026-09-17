#!/usr/bin/env bash
# BSAHI D5 — verify the relay from OUTSIDE and summarize the census evidence.
#   tools/net/relay-verify.sh <public-ip> [port]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IP="${1:-}"; PORT="${2:-8333}"
[ -z "$IP" ] && { echo "usage: relay-verify.sh <public-ip> [port]"; exit 2; }

echo "==> external port check (independent prober)"
curl -s --max-time 20 -X POST https://portchecker.io/api/v1/query -H 'content-type: application/json' \
  -d "{\"host\":\"$IP\",\"ports\":[$PORT]}" | sed 's/^/  /'
echo
echo "==> demuxer: distinct real peer IPs recovered"
if [ -f "$ROOT/data/proxy_inbound.jsonl" ]; then
  python3 - "$ROOT/data/proxy_inbound.jsonl" <<'PY'
import json, sys
rows = [json.loads(l) for l in open(sys.argv[1]) if l.strip()]
peers = [r for r in rows if r.get("bitcoin_peer")]
ips = sorted({r["src_ip"] for r in peers if r.get("src_ip")})
print(f"  total connections: {len(rows)} | bitcoin peers: {len(peers)} | distinct IPs: {len(ips)}")
for ip in ips[:20]:
    print("   ", ip)
PY
else
  echo "  no data/proxy_inbound.jsonl yet"
fi
