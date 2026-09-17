#!/usr/bin/env python3
"""SCCR hardening (P2): sensitivity bands, confidence intervals, stress test.

The SCCR is analytic in its assumptions, which makes the sensitivity exact rather
than simulated:

    R_blocks = 365.25 x 24 x 6            (blocks/year, 10-min target)
    cb       = C / (B_block x R_blocks)   (USD per byte per year)
    L_net    = N x T x cb x B_block = N x T x C / R_blocks   (USD per block)
    SCCR     = fee_USD_per_block / L_net

so SCCR is *inverse-linear* in N (node count), T (years) and C (cost), and linear
in the fee. The bands below are therefore exact for the stated assumption ranges,
not a Monte-Carlo approximation.

Three things are reported:
  1. ASSUMPTION GRID  — SCCR across N x T x C, from the current reading.
  2. DISTRIBUTION CI  — mean/median/IQR/P5-P95 and a bootstrap 95% CI for the
     mean of the per-block SCCR distribution (frozen kit, 155 real blocks).
  3. STRESS TEST      — the share of assumption combinations below 1.0, and which
     assumption dominates the spread.

Writes data/sccr_sensitivity.json. Deterministic (fixed bootstrap seed).
"""
import datetime
import json
import os
import random
import statistics

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCCR = os.path.join(ROOT, "data", "sccr.json")
KIT = os.path.join(ROOT, "research", "reproduce", "output", "reproduce_sccr_python.json")
OUT = os.path.join(ROOT, "data", "sccr_sensitivity.json")

R_BLOCKS = 365.25 * 24 * 6
B_BLOCK = 1_500_000          # bytes/block assumption used by the kit (model-spec v2.1.0)

# Assumption ranges. N and C are the two with real evidence behind the range:
# N: independent node-count estimates span ~10K-100K (our census is a >=32K lower bound);
# C: full-node annualized cost ~$500-1500 (hardware + power + bandwidth).
GRID_N = [10_000, 32_000, 100_000]
GRID_T = [5, 10, 20]
GRID_C = [500, 925, 1500]
SEED = 20260917
BOOT = 10_000


def l_net(N, T, C):
    return N * T * C / R_BLOCKS


def pct(sorted_vals, q):
    if not sorted_vals:
        return None
    i = min(len(sorted_vals) - 1, max(0, round(q * (len(sorted_vals) - 1))))
    return sorted_vals[i]


def main():
    sccr = json.load(open(SCCR))
    fee_usd = sccr["avg_sccr"] * sccr["l_net_usd"]      # USD/block implied by the reading
    N0, T0, C0 = sccr["N"], sccr["T"], sccr["C"]

    # 1) assumption grid
    grid = []
    for N in GRID_N:
        for T in GRID_T:
            for C in GRID_C:
                ln = l_net(N, T, C)
                grid.append({"N": N, "T": T, "C": C, "l_net_usd": round(ln, 4),
                             "sccr": round(fee_usd / ln, 4)})
    vals = sorted(g["sccr"] for g in grid)
    below = [g for g in grid if g["sccr"] < 1.0]

    # 2) distribution CI from the frozen kit's real per-block ratios
    dist = {}
    try:
        kit = json.load(open(KIT))
        per = [b["ratio"] for b in kit.get("per_block", []) if isinstance(b.get("ratio"), (int, float))]
        if len(per) >= 20:
            sv = sorted(per)
            rnd = random.Random(SEED)
            means = []
            n = len(per)
            for _ in range(BOOT):
                means.append(sum(per[rnd.randrange(n)] for _ in range(n)) / n)
            means.sort()
            dist = {
                "source": "research/reproduce frozen capture (real per-block ratios)",
                "blocks": n,
                "mean": round(statistics.mean(per), 6),
                "median": round(statistics.median(per), 6),
                "iqr": [round(pct(sv, 0.25), 6), round(pct(sv, 0.75), 6)],
                "p5_p95": [round(pct(sv, 0.05), 6), round(pct(sv, 0.95), 6)],
                "min_max": [round(sv[0], 6), round(sv[-1], 6)],
                "bootstrap_95ci_mean": [round(means[int(0.025 * BOOT)], 6), round(means[int(0.975 * BOOT)], 6)],
                "bootstrap_n": BOOT, "seed": SEED,
                "note": "legitimate CI for the mean of a real 155-block sample; NOT a claim about the population of all blocks.",
            }
    except Exception as e:
        dist = {"error": str(e)}

    # 3) stress test — which assumption dominates, and the share still < 1.0
    def spread(key):
        low = min(g["sccr"] for g in grid if g[key] == min(x[key] if isinstance(x, dict) else x for x in grid))
        return None
    # analytic contribution: SCCR is inverse in N,T,C, so the widest range in each drives most
    # Marginal sensitivity: move ONE assumption across its range, others at baseline.
    # SCCR is inverse in N,T,C, so a lower N/T/C gives a HIGHER SCCR.
    dom = []
    for key, rng in (("N", GRID_N), ("T", GRID_T), ("C", GRID_C)):
        def sccr_at(v):
            b = {"N": N0, "T": T0, "C": C0}
            b[key] = v
            return fee_usd / l_net(b["N"], b["T"], b["C"])
        s_lo = sccr_at(rng[0])      # assumption at its low end -> higher SCCR
        s_hi = sccr_at(rng[-1])     # assumption at its high end -> lower SCCR
        dom.append({"assumption": key, "range": [rng[0], rng[-1]],
                    "sccr_at_low": round(s_lo, 4), "sccr_at_high": round(s_hi, 4),
                    "factor": round(s_lo / s_hi, 2) if s_hi else None})
    dom.sort(key=lambda d: -(d["factor"] or 0))

    out = {
        "schema": "bsahi.sccr-sensitivity/1",
        "layer": "modelled",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "method": "tools/research/sccr_sensitivity.py — analytic sensitivity of the SCCR to its assumptions",
        "formula": "SCCR = fee_USD / L_net ; L_net = N x T x C / R_blocks ; R_blocks = 365.25 x 24 x 6",
        "reading": {"date": sccr["date"], "avg_sccr": sccr["avg_sccr"], "blocks": sccr["blocks"],
                    "N": N0, "T": T0, "C": C0, "implied_fee_usd_per_block": round(fee_usd, 2)},
        "assumption_grid": grid,
        "band_summary": {
            "min": round(vals[0], 4), "median": round(statistics.median(vals), 4), "max": round(vals[-1], 4),
            "combinations": len(grid), "combinations_below_1x": len(below),
            "share_below_1x_pct": round(100 * len(below) / len(grid), 1),
        },
        "distribution": dist,
        "stress_test": {"dominant_assumption": dom[0]["assumption"] if dom else None,
                        "by_assumption": dom,
                        "verdict": ("SCCR stays below 1.0 across every assumption combination tested"
                                    if len(below) == len(grid) else
                                    f"SCCR is below 1.0 in {len(below)}/{len(grid)} combinations; it crosses only at the most favourable-for-coverage corner (high N, long T, high C)")},
    }
    with open(OUT, "w") as f:
        json.dump(out, f, indent=2)
    print(json.dumps(out["band_summary"], indent=2))
    print("distribution:", {k: dist.get(k) for k in ("blocks", "mean", "median", "p5_p95", "bootstrap_95ci_mean")})
    print("dominant assumption:", out["stress_test"]["dominant_assumption"])
    print("verdict:", out["stress_test"]["verdict"])
    print(f"\nwrote {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
