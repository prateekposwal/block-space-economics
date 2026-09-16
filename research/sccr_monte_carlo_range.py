#!/usr/bin/env python3
"""
Headline SCCR Monte Carlo — CURRENT-N-band edition (added 2026-08-03, second
reviewer pass). Anchored at the live baseline (SCCR 0.2228 @ N=32K, 167 blocks,
2026-08-02, P~$63,018) with the frozen-capture cross-check (0.2406, 155 blocks, 2026-09-16 snapshot).

The N band is updated to the paper's stated uncertainty — independent estimates
span ~10K–100K reachable nodes; the 32K census is the mode (best available
estimate, a lower bound). C / T / P bands match the sensitivity brackets of
working-paper §5.3. Uses the model's homogeneity (SCCR ∝ fee×P/(C×T×N)) so each
draw rescales the anchored per-block ratios exactly.

Run:  python3 research/sccr_monte_carlo_range.py
Writes: tools/sccr_monte_carlo_range_output.json
"""
import json
import os
import random
import sys

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

N_SAMPLES = 10000
SEED = 20260803

# Anchors (documented in working-paper §5.1/§5.3 + tools/research/sccr_dynamics.py)
LIVE_SCCR = 0.2228      # 167 blocks, 2026-08-02, P=$63,018
LIVE_P = 63018.0
FROZEN_SCCR = 0.240641  # 155 blocks, 2026-09-16 frozen snapshot, reproduce.py cross-check
N_CENSUS = 32000.0
C_CANON = 925.0
T_CANON = 10.0


def triangular(a, b, c):
    u = random.random()
    f = (c - a) / (b - a)
    if u < f:
        return a + (u * (b - a) * (c - a)) ** 0.5
    return b - ((1 - u) * (b - a) * (b - c)) ** 0.5


def run():
    random.seed(SEED)
    live = []
    frozen = []
    for _ in range(N_SAMPLES):
        N = triangular(10000, 100000, 32000)   # nodes: band 10K-100K, mode 32K (census)
        C = triangular(600, 1400, 925)          # node cost USD/yr (sensitivity brackets)
        T = triangular(5, 15, 10)               # horizon years
        P = triangular(30000, 120000, LIVE_P)   # BTC price USD
        scale = (P / LIVE_P) * (C_CANON / C) * (T_CANON / T) * (N_CENSUS / N)
        live.append(LIVE_SCCR * scale)
        frozen.append(FROZEN_SCCR * scale)

    def report(vals, label):
        vals.sort()
        def pct(p):
            return vals[int(p / 100.0 * N_SAMPLES)]
        below1 = sum(1 for v in vals if v < 1.0)
        print(f"  {label}: P5 {pct(5):.4f} | P25 {pct(25):.4f} | "
              f"P50 {pct(50):.4f} | P75 {pct(75):.4f} | P95 {pct(95):.4f} | "
              f"below-1x {below1 / N_SAMPLES * 100:.1f}%")
        return {
            "p5": round(pct(5), 4), "p25": round(pct(25), 4),
            "p50": round(pct(50), 4), "p75": round(pct(75), 4),
            "p95": round(pct(95), 4),
            "below_1x_pct": round(below1 / N_SAMPLES * 100, 1),
            "mean": round(sum(vals) / N_SAMPLES, 4),
        }

    print("=" * 74)
    print("  Headline SCCR — Joint Monte Carlo, CURRENT N band (10K-100K, mode 32K)")
    print("=" * 74)
    print("  N  ~ Triangular(10K,100K,mode 32K)   (paper-stated band, census mode)")
    print("  C  ~ Triangular($600,$1400,mode $925) (sensitivity brackets §5.3)")
    print("  T  ~ Triangular(5,15,mode 10 yr)      (sensitivity brackets §5.3)")
    print("  P  ~ Triangular($30K,$120K,mode $63,018)")
    print("  anchors: live 0.2406 @ N=32K (155 blk, 2026-09-16); frozen 0.2406 (155 blk)")
    live_r = report(live, "live anchor  ")
    frozen_r = report(frozen, "frozen anchor")

    out = {
        "n_samples": N_SAMPLES,
        "seed": SEED,
        "distributions": {"N": "tri(10K,100K,mode 32K)", "C": "tri(600,1400,mode 925)",
                          "T": "tri(5,15,mode 10)", "P": "tri(30K,120K,mode 63018)"},
        "anchors": {"live_sccr": LIVE_SCCR, "live_P_usd": LIVE_P,
                    "frozen_sccr": FROZEN_SCCR, "n_census": N_CENSUS,
                    "C_canon": C_CANON, "T_canon": T_CANON},
        "live_anchor": live_r,
        "frozen_anchor": frozen_r,
    }
    with open(os.path.join(REPO, 'tools', 'sccr_monte_carlo_range_output.json'), 'w') as f:
        json.dump(out, f, indent=2)
    print(f"  wrote tools/sccr_monte_carlo_range_output.json")
    return out


if __name__ == "__main__":
    sys.exit(0 if run() else 1)
