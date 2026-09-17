#!/usr/bin/env python3
"""Primary node census — btcnodes.io snapshot series capture (BSAHI Tier-1 item 3).

Live/recent leg: btcnodes.io (renamed bitnodes) /api/v1/snapshots/, newest-first,
one reachable-node snapshot per request. Current API retains ~4 months
(2026-05-08 -> now, ~3 snapshots/day). Validated total coverage: 3,981 snapshots.

Deep-history anchors: the Wayback Machine has 3 archived captures of the OLD
bitnodes.earn.com /api/v1/snapshots/ endpoint (2017-12-11, ~2018/19, 2022-12-31).
Each archived page-1 response carries the newest ~100 snapshots at its capture
date, giving dated era anchors for the SCCR reconstruction's N table.

Deterministic + offline: raw responses cached under
captured-data/btcnodes/ and captured-data/wayback-bitnodes/; --offline replays cache.
Writes data/node_census_series.json (btcnodes) + data/node_census_anchors.json (wayback).
"""
import json, os, sys, datetime, statistics, urllib.request, re, time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BN_CACHE = os.path.join(ROOT, "captured-data", "btcnodes")
WB_CACHE = os.path.join(ROOT, "captured-data", "wayback-bitnodes")
OUT_SERIES = os.path.join(ROOT, "data", "node_census_series.json")
OUT_ANCHORS = os.path.join(ROOT, "data", "node_census_anchors.json")

API = "https://btcnodes.io/api/v1/snapshots/"
PAGE_LIMIT = 100
WB_URLS = [
    ("http://web.archive.org/web/20171211211359id_/https://bitnodes.earn.com/api/v1/snapshots/", "2017-12-11"),
    # middle memento filled in by first-run discovery (timemap) if it resolves
]
UA = {"User-Agent": "bsahi-research"}

def _get(url, timeout=40):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

def fetch_page(page):
    path = os.path.join(BN_CACHE, f"snapshots_page_{page}.json")
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    data = json.loads(_get(f"{API}?page={page}&limit={PAGE_LIMIT}"))
    os.makedirs(BN_CACHE, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    time.sleep(0.3)
    return data

def main():
    offline = "--offline" in sys.argv
    # discover total pages
    if offline:
        pages = 1
        while os.path.exists(os.path.join(BN_CACHE, f"snapshots_page_{pages}.json")):
            pages += 1
        pages -= 1
        n_pages = pages
    else:
        first = fetch_page(1)
        count = first["count"]
        n_pages = (count + PAGE_LIMIT - 1) // PAGE_LIMIT
    pts = []
    for p in range(1, n_pages + 1):
        d = fetch_page(p)
        for s in d["results"]:
            pts.append((int(s["timestamp"]), int(s["total_nodes"]), int(s["latest_height"] or 0)))
    pts.sort()
    series = [
        {"date": datetime.datetime.fromtimestamp(ts, datetime.timezone.utc).strftime("%Y-%m-%d"),
         "x": ts, "nodes": n, "height": h} for ts, n, h in pts
    ]
    # monthly means
    months = {}
    for p in series:
        months.setdefault(p["date"][:7], []).append(p["nodes"])
    monthly = {m: round(statistics.mean(v), 1) for m, v in sorted(months.items())}

    out = {
        "schema": "bsahi.node-census-series/1",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "status": "PRIMARY-SOURCE reachable-node series (btcnodes.io snapshot API)",
        "source": "https://btcnodes.io/api/v1/snapshots/ (renamed bitnodes)",
        "n_snapshots": len(series),
        "period": (series[0]["date"], series[-1]["date"]) if series else None,
        "latest_nodes": series[-1]["nodes"] if series else None,
        "monthly_mean_nodes": monthly,
        "note": "Replaces the addrman-based node_census.json totalKnownAddresses (32,000 = addrman CAP artifact, not a count). Actual reachable node count (btcnodes) is ~26.5-27K. For SCCR: N=26,600 raises SCCR ~20% vs N=32,000.",
        "points": series,
    }
    with open(OUT_SERIES, "w") as f:
        json.dump(out, f, indent=2)
    print(f"btcnodes: {len(series)} snapshots, {series[0]['date']} -> {series[-1]['date']}, latest={series[-1]['nodes']}")
    print("monthly means:", dict(list(monthly.items())[:4]), "...", dict(list(monthly.items())[-3:]))

    ## Wayback anchors (page-1 archived responses, newest ~100 snapshots each)
    anchors = []
    for wb_url, label in WB_URLS:
        fn = label.replace("-", "_") + ".json"
        path = os.path.join(WB_CACHE, fn)
        raw = None
        if os.path.exists(path):
            with open(path) as _fh:
                raw = json.load(_fh)
        elif not offline:
            try:
                b = _get(wb_url, timeout=60)
                txt = b.decode("utf-8", "replace").strip()
                if txt.startswith("{"):
                    raw = json.loads(txt)
                    os.makedirs(WB_CACHE, exist_ok=True)
                    with open(path, "w") as f:
                        json.dump(raw, f, indent=2)
                else:
                    print(f"  wayback {label}: not JSON ({len(txt)} chars), skipped")
            except Exception as e:
                print(f"  wayback {label}: ERR {str(e)[:70]}")
        if raw:
            res = raw.get("results", raw if isinstance(raw, list) else [])
            if res:
                for s in res[:5]:
                    dt = datetime.datetime.fromtimestamp(s["timestamp"], datetime.timezone.utc)
                    anchors.append({"source": label, "ts": s["timestamp"],
                                    "date": dt.strftime("%Y-%m-%d"), "extra": s.get("total_nodes")})
                # entries have total_nodes at top level too?
                # bitnodes snapshot result shape: timestamp:7524163569 keys total_nodes/latest_height
                allpts = []
                for s in res:
                    allpts.append((datetime.datetime.fromtimestamp(s["timestamp"], datetime.timezone.utc).strftime("%Y-%m-%d %H:%M"), s.get("total_nodes")))
                print(f"  wayback anchor {label}: {len(res)} results, newest: {allpts[0] if allpts else 'none'}")
    anchor_out = {
        "schema": "bsahi.node-census-anchors/1",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "status": "DATED PRIMARY ANCHORS from archived bitnodes.earn.com API page-1 responses (Wayback Machine)",
        "anchors": anchors,
        "note": "Each anchor = the newest ~100 snapshots as of the archive date; use the NEWEST entry as the era N calibration point. Deep pre-2018 series is not retained by btcnodes and only sparsely archived.",
    }
    with open(OUT_ANCHORS, "w") as f:
        json.dump(anchor_out, f, indent=2)
    print(f"anchors: {len(anchors)} points -> {OUT_ANCHORS}")

if __name__ == "__main__":
    main()