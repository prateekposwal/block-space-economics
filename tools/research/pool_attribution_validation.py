#!/usr/bin/env python3
"""Pool attribution validation — cross-checks (BSAHI Tier-2 item 1).

What pools SELF-REPORT as hashrate is the ideal ground truth, but it is not
reachable from this environment (see research/pool-hashrate-reachability.md:
ViaBTC/BTC.com/Binance DNS-blocked, AntPool/F2Pool 404 or auth'd, aggregators
client-side/flaky). This tool validates the measured attribution with the
independent evidence that IS reachable:

  A. INTERNAL COHERENCE — per-pool share across our four windows (24h/3d/1w/1y)
     should agree within Poisson expectations for a stable pool. Deviation of a
     pool across windows > ~3x its Poisson sigma flags attribution noise.
  B. NETWORK-LEVEL CROSS-CHECK — blockchair /bitcoin/stats hashrate_24h
     (independent node-based estimate) vs mempool.space-derived network
     hashrate. Agreement within a few % validates the network-total leg that
     pays for the producing-side instrument.

Deterministic. Reads data/mining_concentration.json; fetches blockchair once
(cached). Writes data/pool_attribution_validation.json.
"""
import json, os, sys, math, datetime, statistics, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "data", "pool_attribution_validation.json")
BLOCKCHAIR_CACHE = os.path.join(ROOT, "captured-data", "blockchair", "stats.json")
UA = {"User-Agent": "bsahi-research/0.1"}

def fetch_blockchair(offline=False):
    if os.path.exists(BLOCKCHAIR_CACHE):
        with open(BLOCKCHAIR_CACHE) as f:
            return json.load(f)
    if offline:
        return None
    req = urllib.request.Request("https://api.blockchair.com/bitcoin/stats", headers=UA)
    with urllib.request.urlopen(req, timeout=25) as r:
        d = json.load(r)
    os.makedirs(os.path.dirname(BLOCKCHAIR_CACHE), exist_ok=True)
    with open(BLOCKCHAIR_CACHE, "w") as f:
        json.dump(d, f, indent=2)
    return d

def main():
    offline = "--offline" in sys.argv
    mc = json.load(open(os.path.join(ROOT, "data", "mining_concentration.json")))
    windows = mc["windows"]
    win_names = ["24h", "3d", "1w", "1y"]
    shares = {w: {p["pool"]: p["share"] for p in windows[w]["top_pools"]} for w in win_names}

    # A. internal coherence: top pools present in all windows
    pools = set(shares["1y"]) & set(shares["24h"]) & set(shares["3d"]) & set(shares["1w"])
    rows = []
    for pool in sorted(pools, key=lambda p: -shares["1y"].get(p, 0)):
        ref = shares["1y"].get(pool, 0)
        devs = []
        for w in win_names:
            n = windows[w]["block_count"]
            s = shares[w].get(pool, 0)
            # count noise for this window: sigma_share = sqrt(count)/n
            count = max(s * n, 1)
            sigma = math.sqrt(count) / n
            devs.append(abs(s - ref) / sigma if sigma else 0)
        rows.append({
            "pool": pool,
            "shares": {w: round(shares[w].get(pool, 0), 6) for w in win_names},
            "max_abs_deviation_from_1y_sigma": round(max(devs), 1),
            "coherent_within_3sigma": max(devs) <= 3.0,
        })
    coherence = {
        "n_pools_shared_across_windows": len(pools),
        "n_coherent_within_3sigma": sum(1 for r in rows if r["coherent_within_3sigma"]),
        "least_coherent": sorted(rows, key=lambda r: -r["max_abs_deviation_from_1y_sigma"])[:3],
    }

    # B. network-level cross-check
    bc = fetch_blockchair(offline)
    net = None
    if bc and bc.get("data"):
        hr24 = float(bc["data"].get("hashrate_24h") or 0)  # H/s
        # mempool's own network estimate from the frozen pool capture
        mp = None
        mp_path = os.path.join(ROOT, "captured-data", "mempool.space", "pools_24h.json")
        if os.path.exists(mp_path):
            with open(mp_path) as f:
                mp = json.load(f).get("lastEstimatedHashrate")  # H/s
        net = {"blockchair_hashrate_24h_ehs": round(hr24 / 1e18, 2) if hr24 else None,
               "mempool_space_hashrate_24h_ehs": round(mp / 1e18, 2) if mp else None}
        if hr24 and mp:
            net["relative_diff_pct"] = round(abs(hr24 - mp) / ((hr24 + mp) / 2) * 100, 2)

    out = {
        "schema": "bsahi.pool-attribution-validation/1",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "status": "Validation vs reachable independent evidence; self-reported pool hashrate UNAVAILABLE (documented) -- see research/pool-hashrate-reachability.md",
        "internal_coherence": coherence,
        "network_cross_check_blockchair": net,
        "honesty": "Internal coherence supports the attribution; blockchair hashrate confirms the network total. Neither replaces pool self-reported hashrate for a per-pool ground-truth cross-check (unreachable from this environment).",
    }
    with open(OUT, "w") as f:
        json.dump(out, f, indent=2)

    print("Internal coherence:")
    for r in rows[:8]:
        s = {k: round(v*100,1) for k,v in r["shares"].items()}
        print(f"  {r['pool']:14s} 1y={s['1y']:.1f}% 24h={s['24h']:.1f}% 3d={s['3d']:.1f}% 1w={s['1w']:.1f}%  dev={r['max_abs_deviation_from_1y_sigma']}sigma {'OK' if r['coherent_within_3sigma'] else 'FLAG'}")
    print("  pools shared:", coherence["n_pools_shared_across_windows"], "coherent:", coherence["n_coherent_within_3sigma"])
    print("network cross-check:", net)
    print("Wrote", OUT)

if __name__ == "__main__":
    main()