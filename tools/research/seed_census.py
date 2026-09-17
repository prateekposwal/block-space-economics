#!/usr/bin/env python3
"""D3 — DNS-seed address census (a third, independent view of the node population).

Bitcoin's hardcoded DNS seeds are the bootstrap path every node uses to find
peers. Querying them ourselves gives a *seed-visible address set* — distinct from
(a) the crawler's reachable-node scan and (b) our own node's addrman. Comparing
the three is the triangulation; their disagreement is the uncertainty.

Append-only: each run stores a timestamped sample of every seed's A/AAAA answers.
Then reports, across samples, the union size and the address persistence rate
(how many addresses seen before are still returned) — an empirical, first-party
measure of address-pool churn.

Writes data/seed_census.jsonl (append-only) and data/seed_census.json (site view).
No dependencies.

Usage: seed_census.py
"""
import datetime
import json
import os
import socket

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
JSONL = os.path.join(ROOT, "data", "seed_census.jsonl")
OUT = os.path.join(ROOT, "data", "seed_census.json")

SEEDS = [
    "seed.bitcoin.sipa.be",
    "dnsseed.bluematt.me",
    "seed.bitcoin.jonasschnelli.ch",
    "seed.btc.petertodd.net",
    "seed.bitcoin.sprovoost.nl",
    "dnsseed.emzy.de",
    "seed.bitcoin.wiz.biz",
    "seed.bitcoinstats.com",
]


def resolve(host, timeout=5):
    socket.setdefaulttimeout(timeout)
    addrs = set()
    try:
        for fam, _, _, _, sa in socket.getaddrinfo(host, 8333, proto=socket.IPPROTO_TCP):
            addrs.add(sa[0])
    except Exception:
        pass
    return addrs


def load_jsonl():
    rows = []
    if os.path.exists(JSONL):
        with open(JSONL) as f:
            for line in f:
                line = line.strip()
                if line:
                    rows.append(json.loads(line))
    return rows


def main():
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    per_seed, union = {}, set()
    for s in SEEDS:
        a = resolve(s)
        per_seed[s] = sorted(a)
        union |= a
    sample = {"schema": "bsahi.seed-census/1", "layer": "observed", "at": now,
              "seeds": len(SEEDS), "per_seed": per_seed, "union": sorted(union),
              "union_size": len(union)}

    with open(JSONL, "a") as f:
        f.write(json.dumps({"at": now, "per_seed_counts": {k: len(v) for k, v in per_seed.items()},
                            "union": sorted(union)}) + "\n")

    rows = load_jsonl()
    first_seen, last_seen = {}, {}
    for r in rows:
        t = r["at"]
        for a in r.get("union", []):
            first_seen.setdefault(a, t)
            last_seen[a] = t
    prev = set(rows[-2]["union"]) if len(rows) >= 2 else set()
    cur = set(union)
    persisted = sorted(prev & cur)

    out = {
        "schema": "bsahi.seed-census/1",
        "layer": "observed",
        "generated_at": now,
        "method": "tools/research/seed_census.py — resolve Bitcoin's DNS seeds (A/AAAA) and log the address set",
        "source": "Bitcoin Core DNS seeds (hardcoded bootstrap list)",
        "latest": sample,
        "samples": len(rows),
        "history": [{"at": r["at"], "union_size": len(r.get("union", []))} for r in rows[-60:]],
        "distinct_addresses_ever": len(first_seen),
        "persistence": {
            "prev_sample_size": len(prev), "cur_sample_size": len(cur),
            "persisted": len(persisted),
            "persistence_rate_pct": round(100 * len(persisted) / len(prev), 1) if prev else None,
            "note": ("Fraction of the previous sample's addresses still returned now. A low rate is "
                     "empirical evidence of address-pool churn (dynamic IP rotation / stale entries) — "
                     "the 'zombie IP' effect, measured rather than asserted. Levels depend on sampling "
                     "interval, so compare like-for-like intervals."),
        },
        "caveat": ("The seeds are one bootstrap view: they return addresses their operator has recently "
                   "seen, biased toward nodes that query them. This is a third independent view, not a census."),
        "views": {"crawler_reachable_nodes": None, "node_addrman": "data/node_census.json",
                  "dns_seeds": "data/seed_census.json"},
    }
    with open(OUT, "w") as f:
        json.dump(out, f, indent=2)

    print(f"seeds: {len(SEEDS)} | union addresses: {len(union)} | samples: {len(rows)}")
    for k, v in sorted(per_seed.items()):
        print(f"   {k:34} {len(v):>5}")
    if out["persistence"]["persistence_rate_pct"] is not None:
        print(f"persistence vs previous sample: {out['persistence']['persistence_rate_pct']}% "
              f"({len(persisted)}/{len(prev)})")
    print(f"\nwrote {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
