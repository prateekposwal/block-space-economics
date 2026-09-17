#!/usr/bin/env bash
# BSAHI — pull the VPS census node's inbound data onto the Mac.
#
# The VPS census node (tools/net/vps-census-node.sh) writes
# /var/lib/bsahi/inbound.json. This pulls it and merges into
# data/vps_inbound_census.json (schema bashi.vps-inbound-census/1), which is the
# CLEARNET distinct-IP evidence the Mac's CGNAT link cannot produce.
#
# Config: ~/.bsahi/vps-census.conf  with one line:  HOST=user@your.vps.ip
# Usage:  tools/net/vps_census_pull.sh [user@host]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONF="${HOME}/.bsahi/vps-census.conf"
HOST="${1:-}"; [ -z "$HOST" ] && [ -f "$CONF" ] && HOST="$(sed -n 's/^HOST=//p' "$CONF" | head -1)"
[ -z "$HOST" ] && { echo "no VPS host (set HOST in $CONF or pass user@host)"; exit 2; }

RAW="$(ssh -o BatchMode=yes -o ConnectTimeout=12 "$HOST" 'cat /var/lib/bsahi/inbound.json' 2>/dev/null)"
[ -z "$RAW" ] && { echo "pull failed (ssh/read)"; exit 1; }
echo "$RAW" | jq -e . >/dev/null || { echo "remote file is not valid JSON"; exit 1; }

OUT="$ROOT/data/vps_inbound_census.json"
python3 - "$OUT" <<PY
import json, sys, os, datetime
out = sys.argv[1]
rec = json.loads('''$RAW''')
try:
    cur = json.load(open(out))
except Exception:
    cur = {"schema": "bsahi.vps-inbound-census/1", "layer": "observed",
           "source": "listening bitcoind on a public-IP VPS (clearnet distinct IPs)",
           "samples": []}
ips = rec.get("inbound_ips", [])
cur["generated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
cur["latest"] = rec
cur.setdefault("samples", []).append(rec)
cur["samples"] = cur["samples"][-2000:]
ever = sorted({ip for s in cur["samples"] for ip in s.get("inbound_ips", [])})
cur["distinct_inbound_ips_ever"] = len(ever)
cur["max_concurrent_inbound"] = max((s.get("connections_in") or 0) for s in cur["samples"]) if cur["samples"] else 0
cur["headline"] = (f"{len(ever)} distinct clearnet IP(s) have dialled the census VPS; "
                   f"latest concurrent inbound: {rec.get('connections_in')}")
json.dump(cur, open(out, "w"), indent=2)
print(f"pulled: in={rec.get('connections_in')} distinct_ips_ever={len(ever)} -> {out}")
PY
