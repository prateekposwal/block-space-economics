#!/usr/bin/env python3
"""Historical series extension — difficulty (row 10) + mempool congestion (row 3).
Deterministic; freezes raw to captured-data/historical/blockchain.info/charts/,
computes per-era aggregates, writes data/difficulty_series.json and
data/mempool_congestion_series.json.
"""
import json, os, datetime, statistics, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "captured-data", "historical", "blockchain.info")
CHART = os.path.join(ROOT, "captured-data", "historical", "blockchain.info", "charts")
UA = {"User-Agent": "bsahi-research/0.1"}
BASE = "https://api.blockchain.info/charts/{}?timespan=all&format=json"

def ensure(slug):
    path = os.path.join(CHART, f"{slug}.json")
    if not os.path.exists(path):
        req = urllib.request.Request(BASE.format(slug), headers=UA)
        with urllib.request.urlopen(req, timeout=30) as r:
            d = json.load(r)
        os.makedirs(CHART, exist_ok=True)
        with open(path, "w") as f:
            json.dump(d, f, indent=2)
    else:
        with open(path) as f:
            d = json.load(f)
    return d["values"]

def era_pts(points, yr, end_of_last=False):
    t0 = datetime.datetime(yr, 1, 1, tzinfo=datetime.timezone.utc).timestamp()
    t1 = datetime.datetime(yr + 1, 1, 1, tzinfo=datetime.timezone.utc).timestamp()
    if end_of_last:
        t1 = 1 << 62
    return [p for p in points if t0 <= p["x"] < t1]

def main():
    diff = ensure("difficulty")
    mc = ensure("mempool-count")  # txs waiting
    ms = ensure("mempool-size")   # bytes waiting

    # --- difficulty: freeze full series first (row 10 history = the series itself)
    first_d = datetime.datetime.fromtimestamp(diff[0]["x"], datetime.timezone.utc).date()
    last_d = datetime.datetime.fromtimestamp(diff[-1]["x"], datetime.timezone.utc).date()
    with open(os.path.join(SRC, "difficulty.json"), "w") as f:  # a copy next to other frozen series
        json.dump({"schema": "bsahi.historical.difficulty/1", "unit": "Difficulty", "values": diff,
                   "frozen_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                   "source": "https://api.blockchain.info/charts/difficulty"}, f, indent=2)

    diff_out = {
        "schema": "bsahi.difficulty-series/1",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source": "blockchain.info chart difficulty (frozen), daily ~4-day cadence 2009-01-03 -> 2026-09-15",
        "n_points": len(diff),
        "period": [str(first_d), str(last_d)],
        "latest_difficulty": round(diff[-1]["y"], 0),
        "hashrate_cross_check_note": "difficulty tracks mining target; hashrate (frozen hash-rate.json) is the effort side. Both freeze independently; row 10 operational.",
        "points": diff,
    }
    with open(os.path.join(ROOT, "data", "difficulty_series.json"), "w") as f:
        json.dump(diff_out, f, indent=2)

    # --- congestion: per-era aggregates from mempool-count
    errors = []
    eras = []
    for yr in range(2016, 2027):
        pts = era_pts(mc, yr, end_of_last=(yr == 2026))
        if not pts:
            continue
        vals = [p["y"] for p in pts]
        peak = max(vals)
        peak_date = datetime.datetime.fromtimestamp(pts[vals.index(peak)]["x"], datetime.timezone.utc).date()
        n_above_50k = sum(1 for v in vals if v > 50_000)
        n_above_100k = sum(1 for v in vals if v > 100_000)
        n_above_200k = sum(1 for v in vals if v > 200_000)
        n_above_500k = sum(1 for v in vals if v > 500_000)
        eras.append({
            "era": str(yr), "n_samples": len(vals),
            "mean_mempool_txs": round(statistics.mean(vals), 1),
            "peak_mempool_txs": int(peak), "peak_date": str(peak_date),
            "days_above_50k_pct": round(n_above_50k / len(vals) * 100, 1),
            "days_above_100k_pct": round(n_above_100k / len(vals) * 100, 1),
            "days_above_200k_pct": round(n_above_200k / len(vals) * 100, 1),
            "days_above_500k_pct": round(n_above_500k / len(vals) * 100, 1),
            "congestion_regime": ("HIGH (>500k sustained)" if n_above_500k / len(vals) > 0.05
                                  else "MODERATE (>100k present)" if n_above_100k > 0
                                  else "LOW")
        })

    cong_out = {
        "schema": "bsahi.mempool-congestion/1",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source": "blockchain.info charts mempool-count + mempool-size (frozen), daily from 2016-06-14",
        "note": "Primary frozen series for congestion reconstruction 2016-2026 (row 3 historical leg). Pre-2016 congestion not capturable from this series (chart starts 2016-06); those eras remain reconstruction-only.",
        "eras": eras,
        "mempool_size_bytes_last": ms[-1]["y"] if ms else None,
        "mempool_count_last": mc[-1]["y"] if mc else None,
    }
    with open(os.path.join(ROOT, "data", "mempool_congestion_series.json"), "w") as f:
        json.dump(cong_out, f, indent=2)

    print(f"difficulty: {len(diff)} pts, {first_d} -> {last_d}, latest {round(diff[-1]['y'],0):,}")
    print(f"congestion eras (mempool-count, txs):")
    print(f"{'era':6}{'n':>5}{'mean':>9}{'peak':>10}{'peak_date':>12}{'>50k%':>8}{'>100k%':>8}{'>200k%':>8}{'>500k%':>8}  regime")
    for e in eras:
        print(f"{e['era']:6}{e['n_samples']:>5}{e['mean_mempool_txs']:>9.0f}{e['peak_mempool_txs']:>10}{e['peak_date']:>12}"
              f"{e['days_above_50k_pct']:>8.1f}{e['days_above_100k_pct']:>8.1f}{e['days_above_200k_pct']:>8.1f}{e['days_above_500k_pct']:>8.1f}  {e['congestion_regime']}")
    print("Wrote data/difficulty_series.json + data/mempool_congestion_series.json")

if __name__ == "__main__":
    main()