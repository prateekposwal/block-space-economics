#!/usr/bin/env python3
"""Node geography & network-class census (population-geography Phase 1).

Two btcnodes.io crawler aggregates cover the whole reachable network WITHOUT
pagination (the per-node list needs 260 pages; this does not):

  /api/v1/snapshots/latest/?field=top          -> network class (Tor/I2P/clearnet),
                                                  top ASNs, top user agents
  /api/v1/snapshots/latest/?field=coordinates  -> one [lat,lon] per clearnet node

btcnodes enforces 10 requests/day/IP, so raw responses are cached under
captured-data/btcnodes/ and this tool reads the cache unless --fetch is given
and the cache is older than MIN_AGE_H.

WHAT THIS IS / IS NOT
  * "reachable" = the node answered a bitcoin handshake, i.e. LISTENING nodes.
    NAT'd / non-listening nodes are invisible to every crawler: this is a FLOOR.
  * Tor and I2P nodes announce no location by design; only clearnet nodes carry
    coordinates, so the geographic split is over CLERNET nodes only.
  * Region buckets are coarse lat/lon boxes (approximate), NOT geoip.
Writes data/node_geography.json.
"""
import argparse
import datetime
import json
import os
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import sys
sys.path.insert(0, os.path.join(ROOT, "tools"))
from netfetch import bounded_get  # noqa: E402
OUT = os.path.join(ROOT, "data", "node_geography.json")
CACHE = os.path.join(ROOT, "captured-data", "btcnodes")
BASE = "https://btcnodes.io/api/v1/snapshots/latest/?field="
UA = {"User-Agent": "bitcoinsahi-research/1.0 (+https://bitcoinsahi.com)"}
MIN_AGE_H = 6.0


def _get(url):
    return bounded_get(url, timeout=60, json=True)   # deadline also covers DNS


def _cache_path(field):
    return os.path.join(CACHE, "geo_%s.json" % field)


def _fresh(path):
    if not os.path.exists(path):
        return False
    age = (datetime.datetime.now().timestamp() - os.path.getmtime(path)) / 3600
    return age < MIN_AGE_H


def load(field, do_fetch):
    p = _cache_path(field)
    if do_fetch and not _fresh(p):
        os.makedirs(CACHE, exist_ok=True)
        d = _get(BASE + field)
        with open(p, "w") as f:
            json.dump(d, f)
        return d, True
    if os.path.exists(p):
        with open(p) as f:
            return json.load(f), False
    raise SystemExit("node_geography: no cache for field=%s and --fetch not given" % field)


# Coarse lat/lon boxes, checked in order. Approximate by design; a point may fall
# in a box that straddles a border. Overlaps resolved by first match.
REGIONS = [
    ("Oceania",       -50, 0,   110, 180),
    ("South America", -60, 13,  -85, -30),
    ("North America", 13,  72,  -170, -50),
    ("Europe",        35,  72,  -15, 45),
    ("Africa",        -35, 37,  -20, 55),
    ("Asia",          0,   80,  45,  180),
    ("Middle East",   12,  45,  25,  63),
]


def region_of(lat, lon):
    for name, la0, la1, lo0, lo1 in REGIONS:
        if la0 <= lat <= la1 and lo0 <= lon <= lo1:
            return name
    return "Other/unknown"


def build(top, coords):
    md = top.get("metadata", {})
    total = top.get("total_nodes")
    tasn = (top.get("top") or {}).get("top_asns", []) or []
    uas = (top.get("top") or {}).get("top_user_agents", []) or []

    tor = next((c for n, c in tasn if n == "TOR"), 0)
    i2p = next((c for n, c in tasn if n == "I2P"), 0)
    clearnet_asns = [[n, c] for n, c in tasn if n not in ("TOR", "I2P")]
    clearnet_top = sum(c for _, c in clearnet_asns)
    overlay = tor + i2p

    pts = coords.get("coordinates", []) or []
    hist = {}
    for p in pts:
        if isinstance(p, list) and len(p) == 2:
            lats, lons = p[0], p[1]
            hist[region_of(lats, lons)] = hist.get(region_of(lats, lons), 0) + 1
    geo_total = sum(hist.values())

    def share(n):
        return round(100.0 * n / total, 2) if total else None

    return {
        "schema": "bsahi.node-geography/1",
        "layer": "observed",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source": ("btcnodes.io crawler aggregates: /api/v1/snapshots/latest/"
                   "?field=top and ?field=coordinates (crawler ~2x/day)"),
        "snapshot_ts": top.get("timestamp"),
        "latest_height": top.get("latest_height"),
        "network_class": {
            "reachable_nodes": md.get("reachable_nodes", total),
            "validated_nodes": md.get("validation_successes", total),
            "total_nodes": total,
            "tor": tor, "i2p": i2p, "overlay": overlay,
            "clearnet_top_asns_sum": clearnet_top,
            "overlay_share_pct": share(overlay),
            "tor_share_pct": share(tor),
            "note": ("Overlay = Tor + I2P: nodes that announce NO location. Clearnet "
                     "count is only the sum of the top ASNs shown, a lower bound on "
                     "clearnet nodes (the tail is not listed)."),
        },
        "top_asns": clearnet_asns,
        "top_user_agents": uas,
        "geography": {
            "unique_coordinate_pairs": geo_total,
            "unique_pairs_share_pct": share(geo_total),
            "region_counts": dict(sorted(hist.items(), key=lambda kv: -kv[1])),
            "region_method": "coarse lat/lon boxes over unique coordinate pairs; approximate",
            "note": ("btcnodes returns UNIQUE [lat,lon] pairs, not per-node rows: nodes "
                     "collocated in one city/datacenter count ONCE, so region_counts are "
                     "distinct locations, not node counts. Only clearnet nodes carry "
                     "coordinates; Tor/I2P are locationless by design."),
        },
        "note": ("Reachable = answered a bitcoin handshake (LISTENING nodes). Nodes "
                 "behind NAT/non-listening are invisible to every crawler, so every "
                 "count here is a FLOOR, never the network's true size."),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fetch", action="store_true", help="refresh from btcnodes (rate-limited)")
    args = ap.parse_args()
    top, f1 = load("top", args.fetch)
    coords, f2 = load("coordinates", args.fetch)
    doc = build(top, coords)
    with open(OUT, "w") as f:
        json.dump(doc, f, indent=2)
    nc = doc["network_class"]
    print("node-geography: %s reachable | tor=%s i2p=%s (%.1f%% overlay) | unique coord pairs=%s"
          % (nc["reachable_nodes"], nc["tor"], nc["i2p"],
             nc["overlay_share_pct"] or 0, doc["geography"]["unique_coordinate_pairs"]))
    print("  fetched: top=%s coordinates=%s -> %s" % (f1, f2, OUT))


if __name__ == "__main__":
    main()
