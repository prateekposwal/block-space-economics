#!/usr/bin/env python3
"""Mining pool concentration — capture (BSAHI Tier-1 item 1).

Closes the row-11 data gap in research/data-confidence.md: per-pool block-tag
attribution from mempool.space /api/v1/mining/pools for validated windows.

Source caveat (documented, not curated away): pool list is coinbase-tag
attribution (regex match on coinbase text). "Unknown" = block whose coinbase
did not match any known pool tag. For the live/recent windows the Unknown share
is small (~0-1%) and block share is a reasonable proxy for hashrate share; block
attribution is NOT hashrate measurement (see honesty banner in the note).

Windows are validated per call against an expected block count band; the 2w/6m
variants of this API silently fall back to ALL-TIME data, so they are excluded.

Deterministic + offline: fetches and caches raw responses under
captured-data/mempool.space/, then computes from cache on re-run (or --offline).
Writes data/mining_concentration.json.
"""
import json, os, sys, statistics, urllib.request, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import sys
sys.path.insert(0, os.path.join(ROOT, "tools"))
from netfetch import bounded_get  # noqa: E402
CACHE = os.path.join(ROOT, "captured-data", "mempool.space")
OUT = os.path.join(ROOT, "data", "mining_concentration.json")

BASE = "https://mempool.space/api/v1/mining/pools/{}"
WINDOWS = {
    "24h": {"days": 1, "expect_blocks": 144},
    "3d":  {"days": 3, "expect_blocks": 432},
    "1w":  {"days": 7, "expect_blocks": 1008},
    "1y":  {"days": 365, "expect_blocks": 52560},
}
BAND = 0.25  # +/-25% on expected block count, else treat as fallback/bad window
UNKNOWN_NAMES = {"Unknown", "unknown"}

def fetch(pair):
    name, info = pair
    path = os.path.join(CACHE, f"pools_{name}.json")
    data = None
    if os.path.exists(path):
        with open(path) as f:
            data = json.load(f)
    if data is None:
        data = bounded_get(BASE.format(name), timeout=20, json=True)
        os.makedirs(CACHE, exist_ok=True)
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
    return name, info, data

def gini(shares):
    s = sorted(shares)
    n = len(s)
    if n == 0 or sum(s) == 0:
        return None
    i = list(range(1, n + 1))
    return (2 * sum(v * (i[j] - (n + 1) / 2.0) for j, v in enumerate(s))) / (n * sum(s))

def compute(name, info, data):
    pools = data.get("pools", [])
    total = data.get("blockCount", 0)
    exp = info["expect_blocks"]
    sane = abs(total - exp) / exp <= BAND
    shares = []
    for p in pools:
        bc = p.get("blockCount", 0)
        if bc > 0:
            shares.append({"pool": p.get("name", "?"), "blocks": bc,
                           "share": round(bc / total, 6) if total else 0,
                           "empty_blocks": p.get("emptyBlocks"),
                           "avg_match_rate": p.get("avgMatchRate"),
                           "avg_fee_delta": p.get("avgFeeDelta"),
                           "slug": p.get("slug")})
    shares.sort(key=lambda s: -s["share"])
    known = [s for s in shares if s["pool"] not in UNKNOWN_NAMES]
    unknown_share = sum(s["share"] for s in shares if s["pool"] in UNKNOWN_NAMES)
    top1 = known[0]["share"] if known else 0
    top3 = sum(s["share"] for s in known[:3])
    top5 = sum(s["share"] for s in known[:5])
    hhi = sum(s["share"] ** 2 for s in known) if known else None
    return {
        "window": name,
        "window_label": f"{info['days']} days",
        "expected_blocks": exp,
        "block_count": total,
        "window_validated": sane,
        "n_pools": len(known),
        "unknown_unattributed_share": round(unknown_share, 6),
        "top_1_pool_share": round(top1, 6),
        "top_3_pool_share": round(top3, 6),
        "top_5_pool_share": round(top5, 6),
        "hhi_known_pools": round(hhi, 6) if hhi else None,
        "effective_n_pools_1_over_hhi": round(1 / hhi, 2) if hhi else None,
        "gini_coefficient": round(gini([s["share"] for s in known]), 6) if known else None,
        "top_pools": shares[:8],
    }

def main():
    offline = "--offline" in sys.argv
    results = []
    for name, info in WINDOWS.items():
        path = os.path.join(CACHE, f"pools_{name}.json")
        if offline and not os.path.exists(path):
            print(f"  !! {name}: no cache, --offline cannot run", flush=True)
            continue
        print(f"  fetching {name} ...", flush=True)
        _, _, data = fetch((name, info))
        r = compute(name, info, data)
        results.append(r)
        print(f"    ok: {r['block_count']} blocks, top1 {r['top_1_pool_share']*100:.1f}% top3 {r['top_3_pool_share']*100:.1f}%", flush=True)
    by = {r["window"]: r for r in results}

    live = by["24h"] if "24h" in by else by["1w"]
    flags = {
        "top1_over_50pct": live["top_1_pool_share"] > 0.50,
        "top3_over_75pct": live["top_3_pool_share"] > 0.75,
        "top5_over_85pct": live["top_5_pool_share"] > 0.85,
        "unknown_share_over_5pct": live["unknown_unattributed_share"] > 0.05,
    }
    note = (
        "Boundary mapping (from research/mining-concentration-note.md): "
        "top-1 > 50% => 51%-attack borderline; top-3 > 75% => coordination risk; "
        "Gini near 1 => extreme concentration. Block-tag attribution is a proxy "
        "for hashrate share, not a measurement of it; attribution of high-match "
        "blocks may differ from pool-reported hashrate."
    )

    out = {
        "schema": "bsahi.mining-concentration/2",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "status": "MEASURED — block-tag attribution from mempool.space pool list, cached raw under captured-data/mempool.space/",
        "source": "mempool.space /api/v1/mining/pools/{24h,3d,1w,1y} (validated windows; 2w/6m excluded — API falls back to all-time)",
        "windows": by,
        "live_window": "24h",
        "boundary_flags": flags,
        "honesty": note,
    }
    with open(OUT, "w") as f:
        json.dump(out, f, indent=2)

    print(f"{'window':6}{'blocks':>8}{'valid':>7}{'known':>6}{'unk%':>7}{'top1%':>7}{'top3%':>7}{'top5%':>7}{'HHI':>8}{'N_eff':>7}{'gini':>7}")
    for r in results:
        print(f"{r['window']:6}{r['block_count']:>8}{str(r['window_validated']):>7}{r['n_pools']:>6}"
              f"{r['unknown_unattributed_share']*100:>7.1f}{r['top_1_pool_share']*100:>7.1f}"
              f"{r['top_3_pool_share']*100:>7.1f}{r['top_5_pool_share']*100:>7.1f}"
              f"{r['hhi_known_pools'] or 0:>8.3f}{r['effective_n_pools_1_over_hhi'] or 0:>7.1f}"
              f"{r['gini_coefficient'] or 0:>7.3f}")
    print("\nBoundary flags (24h):", flags)
    print(f"Wrote {OUT}")

if __name__ == "__main__":
    main()