#!/usr/bin/env python3
"""Block-relay provenance (population-geography Phase 2).

Answers "which nodes carried this block, and how many announced it, and how
tightly" — the observable contribution of nodes to BLOCK RELAY (not production).

Source: btcnodes.io inventory sampler —
  /api/v1/inv/?type=2&limit=N        -> recent block invs + announcing-node count
  /api/v1/inv/<hash>/                -> per-node announcing list + timing stats
                                        (mean / 50% / 90% / max / head)

WHAT THIS IS / IS NOT
  * "nodes" = how many peers BTC Nodes' pinger observed announce that inv. It is a
    SAMPLE of listening peers, not the whole network, and NOT the block producer.
  * A block is PRODUCED by a miner/pool; this measures its RELAY. Do not read
    "announcing nodes" as "who mined the block".
  * btcnodes allows 10 requests/day/IP, so the raw list is cached and per-block
    detail is opt-in (--detail N).
Writes data/block_propagation.json.
"""
import argparse
import datetime
import json
import os
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "data", "block_propagation.json")
CACHE = os.path.join(ROOT, "captured-data", "btcnodes")
LIST_URL = "https://btcnodes.io/api/v1/inv/?type=2&limit=%d"
DETAIL_URL = "https://btcnodes.io/api/v1/inv/%s/"
UA = {"User-Agent": "bitcoinsahi-research/1.0 (+https://bitcoinsahi.com)"}
MIN_AGE_H = 1.0


def _get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8")), r.headers.get("ratelimit-remaining")


def _fresh(path, hours):
    return os.path.exists(path) and (datetime.datetime.now().timestamp()
                                     - os.path.getmtime(path)) / 3600 < hours


def fetch_list(limit, do_fetch):
    p = os.path.join(CACHE, "inv_blocks.json")
    if do_fetch and not _fresh(p, MIN_AGE_H):
        os.makedirs(CACHE, exist_ok=True)
        d, rem = _get(LIST_URL % limit)
        d["_ratelimit_remaining"] = rem
        with open(p, "w") as f:
            json.dump(d, f)
        return d
    if os.path.exists(p):
        with open(p) as f:
            return json.load(f)
    raise SystemExit("block_propagation: no cached inv list; run with --fetch")


def fetch_detail(h, do_fetch):
    p = os.path.join(CACHE, "inv_%s.json" % h)
    if do_fetch and not _fresh(p, 24.0):
        try:
            d, rem = _get(DETAIL_URL % h)
        except Exception as e:
            return {"_error": str(e)[:80]}
        d["_ratelimit_remaining"] = rem
        os.makedirs(CACHE, exist_ok=True)
        with open(p, "w") as f:
            json.dump(d, f)
        return d
    if os.path.exists(p):
        with open(p) as f:
            return json.load(f)
    return None


def build(lst, details):
    rows = []
    for r in (lst.get("results") or []):
        h = r.get("inv_hash") or r.get("hash")
        row = {"hash": h, "announcing_nodes": r.get("nodes"),
               "latest_seen": r.get("latest_seen")}
        d = details.get(h)
        if d and isinstance(d, dict):
            st = d.get("stats")
            if isinstance(st, dict):
                row["propagation_stats"] = st
            ns = d.get("nodes")
            if isinstance(ns, list):
                row["announcer_sample"] = ns[:25]
        rows.append(row)
    counts = [r["announcing_nodes"] for r in rows if isinstance(r.get("announcing_nodes"), int)]
    return {
        "schema": "bsahi.block-propagation/1",
        "layer": "observed",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source": "btcnodes.io inventory sampler (/api/v1/inv/?type=2, /api/v1/inv/<hash>/)",
        "ratelimit_remaining": lst.get("_ratelimit_remaining"),
        "blocks": rows,
        "summary": {
            "blocks_in_window": len(rows),
            "announcing_nodes_min": min(counts) if counts else None,
            "announcing_nodes_max": max(counts) if counts else None,
            "announcing_nodes_mean": round(sum(counts) / len(counts), 2) if counts else None,
        },
        "note": ("'announcing_nodes' is how many peers BTC Nodes' pinger observed "
                 "announce the block inv — a SAMPLE of listening peers, NOT a network "
                 "count and NOT the block producer. This measures RELAY contribution, "
                 "not mining. A block is produced by a miner/pool; who announced it "
                 "first is a separate (latency) question."),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fetch", action="store_true")
    ap.add_argument("--limit", type=int, default=50)
    ap.add_argument("--detail", type=int, default=0, help="fetch per-block detail for the newest N blocks")
    args = ap.parse_args()
    lst = fetch_list(args.limit, args.fetch)
    details = {}
    for r in (lst.get("results") or [])[:max(0, args.detail)]:
        h = r.get("inv_hash") or r.get("hash")
        d = fetch_detail(h, args.fetch)
        if d:
            details[h] = d
    doc = build(lst, details)
    with open(OUT, "w") as f:
        json.dump(doc, f, indent=2)
    s = doc["summary"]
    print("block-propagation: %d blocks | announcing nodes min/mean/max = %s/%s/%s | remaining=%s"
          % (s["blocks_in_window"], s["announcing_nodes_min"], s["announcing_nodes_mean"],
             s["announcing_nodes_max"], doc.get("ratelimit_remaining")))
    print("  detail fetched for %d block(s) -> %s" % (len(details), OUT))


if __name__ == "__main__":
    main()
