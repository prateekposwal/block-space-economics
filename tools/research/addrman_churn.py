#!/usr/bin/env python3
"""D4 — addrman churn (empirical address-pool staleness, first-party).

Our node's address manager is a longitudinal **gossip sampler**: every sample of
`getnodeaddresses 0` is the set of addresses peers have recently gossiped. Sampling
it over time and measuring how many addresses *persist* between samples gives a
measured churn/rotation rate — i.e. the "zombie / stale IP" effect as a number
rather than an assertion.

Append-only: data/addrman_samples.jsonl (one line per sample, addresses hashed to
keep the file small) and data/addrman_churn.json (site view).

Run on a schedule (daily/weekly). No dependencies beyond the local node.
"""
import datetime
import hashlib
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    import utxo_state_measure as node  # reuse the RPC layer (single implementation)
except Exception:
    node = None

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
JSONL = os.path.join(ROOT, "data", "addrman_samples.jsonl")
OUT = os.path.join(ROOT, "data", "addrman_churn.json")


def h(a):
    return hashlib.sha256(a.encode()).hexdigest()[:16]


def sample():
    cfg = node.parse_conf(node.find_conf())
    return node.rpc(cfg, "getnodeaddresses", [0])


def load_samples():
    rows = []
    if os.path.exists(JSONL):
        with open(JSONL) as f:
            for line in f:
                line = line.strip()
                if line:
                    rows.append(json.loads(line))
    return rows


def main():
    if node is None:
        raise SystemExit("cannot import the RPC layer")
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    try:
        addrs = sample()
    except SystemExit as e:
        raise SystemExit(f"node unreachable: {e}")
    ids = sorted({h(a.get("address", "")) for a in addrs if a.get("address")})
    with open(JSONL, "a") as f:
        f.write(json.dumps({"at": now, "count": len(ids), "ids": ids}) + "\n")

    rows = load_samples()
    prev = set(rows[-2]["ids"]) if len(rows) >= 2 else set()
    cur = set(ids)
    persisted = prev & cur
    new = cur - prev
    gone = prev - cur
    all_ids = set()
    for r in rows:
        all_ids |= set(r["ids"])

    out = {
        "schema": "bsahi.addrman-churn/1",
        "layer": "observed",
        "generated_at": now,
        "source": "Bitcoin Core getnodeaddresses 0 on the project's node (gossip sampler)",
        "method": "tools/research/addrman_churn.py — sample the addrman over time and measure persistence",
        "latest_count": len(cur),
        "samples": len(rows),
        "distinct_addresses_ever": len(all_ids),
        "churn": {
            "prev_count": len(prev), "persisted": len(persisted),
            "new": len(new), "gone": len(gone),
            "persistence_rate_pct": round(100 * len(persisted) / len(prev), 1) if prev else None,
            "note": ("Persistence = share of the previous sample's addresses still present. Low persistence "
                     "at a fixed interval = high address rotation (dynamic IPs, ephemeral wallets). Compare "
                     "like-for-like intervals only."),
        },
        "caveat": ("A single node's addrman is a SAMPLE shaped by peer count and uptime; it is a lower bound "
                   "on gossip-observed addresses and says nothing about nodes. Addresses != nodes."),
    }
    with open(OUT, "w") as f:
        json.dump(out, f, indent=2)
    print(f"addrman: {len(cur)} addresses | samples: {len(rows)} | distinct ever: {len(all_ids)}")
    if out["churn"]["persistence_rate_pct"] is not None:
        print(f"churn vs prev: persisted {out['churn']['persistence_rate_pct']}% "
              f"(+{len(new)} new, -{len(gone)} gone)")
    print(f"\nwrote {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
