#!/usr/bin/env python3
"""
BSAHI — Mining Concentration Measurement

Reads data/hashrate.json and computes network-level hashrate statistics.
NOTE: Per-pool hashrate distribution data does not exist in this repository.
hashrate.json contains only network-wide instantaneous hashrate (EH/s).
Concentration metrics (top-N pool share, Gini) require per-pool data that
is not available. This script computes what CAN be computed and documents
the data gap.

Usage: python3 tools/research/mining_concentration.py
Output: data/mining_concentration.json
"""
import json
import os
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_PATH = os.path.join(REPO_ROOT, 'data', 'hashrate.json')
OUTPUT_PATH = os.path.join(REPO_ROOT, 'data', 'mining_concentration.json')

def main():
    with open(DATA_PATH) as f:
        hdata = json.load(f)

    points = hdata['points']
    hashrates = [p['eh'] for p in points]
    timestamps = [p['t'] for p in points]
    n = len(hashrates)

    if n == 0:
        print("ERROR: No hashrate data points found.")
        sys.exit(1)

    mean_hr = sum(hashrates) / n
    min_hr = min(hashrates)
    max_hr = max(hashrates)
    range_hr = max_hr - min_hr
    cv = range_hr / mean_hr
    max_idx = hashrates.index(max_hr)
    min_idx = hashrates.index(min_hr)

    result = {
        "schema": "bsahi.mining-concentration/1",
        "generated_at": hdata['generated_at'],
        "source": hdata['source'],
        "unit": hdata['unit'],
        "note": (
            "DATA GAP — hashrate.json contains network-wide INSTANTANEOUS hashrate (EH/s) ONLY. "
            "Per-pool hashrate distribution data does not exist in this repository. "
            "Top-1/top-3/top-5 pool share and Gini coefficient CANNOT be computed from this data. "
            "See research/mining-concentration-note.md for the full analysis and data requirements."
        ),
        "network_statistics": {
            "n_observations": n,
            "period_start": timestamps[0],
            "period_end": timestamps[-1],
            "mean_eh": round(mean_hr, 2),
            "min_eh": round(min_hr, 2),
            "max_eh": round(max_hr, 2),
            "range_eh": round(range_hr, 2),
            "coefficient_of_variation": round(cv, 4),
            "peak_at": timestamps[max_idx],
            "trough_at": timestamps[min_idx],
            "peak_to_trough_ratio": round(max_hr / min_hr, 4)
        },
        "concentration_metrics": {
            "top_1_pool_share": None,
            "top_3_pool_share": None,
            "top_5_pool_share": None,
            "gini_coefficient": None,
            "most_concentrated_period": None,
            "least_concentrated_period": None,
            "reason": (
                "Per-pool hashrate data does not exist in the repository. "
                "hashrate.json only contains network total hashrate over time. "
                "Pool-level distribution requires a different data source "
                "(e.g., mempool.space /api/v1/mining/pools, BTC.com pool API, blockchain.info pool statistics)."
            )
        }
    }

    # Guard: tools/research/pool_concentration.py writes the canonical v2 file at
    # this SAME path. This legacy v1 writer must never clobber it — doing so once
    # silently replaced MEASURED pool-attribution data with a NOT-COMPUTABLE stub.
    if os.path.exists(OUTPUT_PATH):
        try:
            with open(OUTPUT_PATH) as fh:
                existing = json.load(fh)
            if str(existing.get('schema', '')).endswith('/2'):
                print(f"refusing to overwrite canonical {existing.get('schema')} at {OUTPUT_PATH} "
                      f"— this is the legacy v1 writer; the canonical writer is "
                      f"tools/research/pool_concentration.py")
                return existing
        except Exception:
            pass

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, 'w') as f:
        json.dump(result, f, indent=2)

    print(f"Output: {OUTPUT_PATH}")
    print(f"Network hashrate: mean={mean_hr:.2f} EH/s, range={min_hr:.2f}-{max_hr:.2f} EH/s")
    print(f"Concentration metrics: NOT COMPUTABLE (per-pool data missing)")
    return result

if __name__ == '__main__':
    main()
