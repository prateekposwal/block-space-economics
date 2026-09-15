import json, os
import random, math, statistics

# Canonical centers from research/model-spec.json v2.0.0 (P1.8).
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'model-spec.json')) as _f:
    Q = json.load(_f)['quantities']
SPEC_C = Q['C']['value']   # 925 pinned canonical node cost (USD/yr); component sum is 924.35
I_BYTES = Q['I_bytes']['value']    # 400
I_RATE = Q['I_rate']['value']      # 100000
T = Q['T']['value']                # 10

def run_simulation():
    hw_cost = random.triangular(200, 1000, 500)
    hw_lifetime = random.triangular(2, 6, 3)
    bw_monthly = random.triangular(20, 100, 50)
    node_watts = random.triangular(30, 250, 150)
    elec_rate = random.triangular(0.08, 0.40, 0.12)
    insc_bytes = random.triangular(200, 1000, I_BYTES)
    insc_monthly = random.triangular(30000, 300000, I_RATE)
    utxo_life = random.triangular(2, 30, T)

    hw_annual = hw_cost / hw_lifetime
    bw_annual = bw_monthly * 12
    kwh_year = node_watts * 24 * 365 / 1000
    elec_annual = kwh_year * elec_rate
    total_node = hw_annual + bw_annual + elec_annual

    bytes_yr = insc_bytes * insc_monthly * 12
    cost_per_byte = total_node / bytes_yr
    cost_per_insc = cost_per_byte * insc_bytes * utxo_life

    return {
        "node_cost": total_node,
        "cost_per_byte": cost_per_byte,
        "cost_per_inscription": cost_per_insc,
    }

def main():
    print("=" * 62)
    print("  Monte Carlo Simulation — UTXO Cost Model")
    print("  10,000 scenarios")
    print("=" * 62)

    N = 10000
    results = [run_simulation() for _ in range(N)]

    node_costs = [r["node_cost"] for r in results]
    costs = [r["cost_per_inscription"] for r in results]

    costs.sort()
    node_costs.sort()

    node_p10 = node_costs[int(N * 0.10)]
    node_p90 = node_costs[int(N * 0.90)]

    print(f"\n  Node Cost / Year:")
    print(f"    Median:    ${statistics.median(node_costs):.0f}")
    print(f"    P10:       ${node_p10:.0f}")
    print(f"    P90:       ${node_p90:.0f}")

    p5 = costs[int(N * 0.05)]
    p10 = costs[int(N * 0.10)]
    p50 = costs[int(N * 0.50)]
    p90 = costs[int(N * 0.90)]
    p95 = costs[int(N * 0.95)]

    print(f"\n  Storage Cost per Inscription (lifetime):")
    print(f"    5th percentile:  ${p5:.5f}")
    print(f"    10th percentile: ${p10:.5f}")
    print(f"    50th percentile: ${p50:.5f} (median)")
    print(f"    90th percentile: ${p90:.5f}")
    print(f"    95th percentile: ${p95:.5f}")
    print(f"\n  90% confidence interval: ${p5:.5f} – ${p90:.5f}")
    print(f"  Range: {p90/p5:.0f}x between P5 and P90")

    out = {
        "runs": N,
        "p5": p5, "p10": p10, "p50": p50, "p90": p90, "p95": p95,
        "node_cost_median": statistics.median(node_costs),
    }
    with open('/Users/prateekposwal/block-space-economics/tools/monte_carlo_output.json', 'w') as f:
        json.dump(out, f, indent=2)

if __name__ == "__main__":
    main()
