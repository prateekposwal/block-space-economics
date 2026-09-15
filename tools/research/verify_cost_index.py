#!/usr/bin/env python3
"""Verification Cost Index (VCI) — prototype (BSAHI Phase 3c).

Operationalizes the Satoshi claim (THESIS.md Sec 6):

  "What does it cost, in time and money, for one person to independently
   verify the full chain state, and is that cost growing faster or slower
   than the economic value of verification?"

Measured quantities per era:
  chain_gb      cumulative serialized block data (from frozen avg-block-size)
  state_gb      derived UTXO state (documented ESTIMATE table, not measured)
  total_gb      = chain_gb + state_gb
  sync_days     = total_gb / SYNC_GB_DAY            (documented assumption)
  sync_cost_usd = sync_days * 24 * WAGE_USD_HOUR    (time value of the verifier)
  value_day_usd = miners-revenue/day (what the chain produces: subsidy + fees)
  VCI_ppm       = sync_cost_usd / (value_day_usd * 365)  -- cost of ONE full
                  verification as parts-per-million of one YEAR of chain value
  affordability = sync_cost_usd / MONTHLY_INCOME_USD (% of a month's income)

Deterministic: reads only frozen JSON. No network needed.
Writes data/verify_cost_index.json + prints the era table.

ASSUMPTIONS (all documented in the output, all overridable):
  EFF_SYNC_GB_DAY: era-scaled commodity archive-sync throughput (GB/day).
      Monotone commodity-broadband/CPU curve; ends at 400 GB/day (2026), which
      gives ~2-day sync for the ~800 GB chain — consistent with published IBD
      benchmarks (a day to a few days on decent hardware).
  WAGE_USD_HOUR = 25  constant value-of-time across eras (a person's hour).
  MONTHLY_INCOME_USD = 4000   affordability denominator.
  UTXO_GB era estimates: 2013 0.5, 2015 1.0, 2017 2.5, 2019 4.0, 2021 6.0,
        2023 9.0, 2024 10.0, 2025+ 11.0 (documented estimate; not measured).

Caveat stated up front: the absolute ratios move with the throughput scenario;
the SHAPE (and the affordability trend) is the claim, not the exact number.
"""
import json, datetime, statistics, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "captured-data", "historical", "blockchain.info")
OUT = os.path.join(ROOT, "data", "verify_cost_index.json")

BLOCKS_PER_DAY = 144.0
WAGE_USD_HOUR = 25.0
MONTHLY_INCOME_USD = 4000.0
# Era-scaled commodity sync throughput (documented assumption table,
# broadband/CPU progression; ends at current commodity archive-sync ~400 GB/day).
EFF_SYNC_GB_DAY = {2013: 15, 2014: 30, 2015: 50, 2016: 70, 2017: 90, 2018: 110,
                   2019: 140, 2020: 180, 2021: 220, 2022: 260, 2023: 300,
                   2024: 340, 2025: 380, 2026: 400}
MONTHLY_INCOME_USD = 4000.0
UTXO_GB = {2013: 0.5, 2014: 0.7, 2015: 1.0, 2016: 1.7, 2017: 2.5, 2018: 3.2,
           2019: 4.0, 2020: 5.0, 2021: 6.0, 2022: 7.0, 2023: 9.0,
           2024: 10.0, 2025: 11.0, 2026: 11.0}
YEAR_START = 2013
YEAR_END = 2026

def load(slug):
    with open(os.path.join(SRC, slug + ".json")) as f:
        return json.load(f)["values"]

def cum_chain_gb_at(points, deadline):
    """Cumulative serialized chain size (GB) at a unix deadline, from
    daily avg-block-size values.""" 
    t0 = datetime.datetime(2009, 1, 1, tzinfo=datetime.timezone.utc).timestamp()
    total_bytes = 0.0
    prev_x, prev_y = None, None
    for p in sorted(points, key=lambda q: q["x"]):
        if p["x"] > deadline:
            break
        # integral: daily avg size (MB) * 86400 s/day is handled per interval
        if prev_x is not None and p["x"] > prev_x:
            dt_days = (p["x"] - prev_x) / 86400.0
            seg_mb = max(p["y"], prev_y)  # conservative upper bound per interval
            total_bytes += seg_mb * 1e6 * BLOCKS_PER_DAY * dt_days
        prev_x, prev_y = p["x"], p["y"]
    return total_bytes / 1e9  # GB

def era_value_day_usd(points, t0, t1):
    vals = [p["y"] for p in points if t0 <= p["x"] < t1]
    return statistics.mean(vals) if vals else None

def main():
    blocks = load("avg-block-size")
    rev    = load("miners-revenue")

    eras = []
    for yr in range(YEAR_START, YEAR_END + 1):
        t1 = datetime.datetime(yr + 1, 1, 1, tzinfo=datetime.timezone.utc).timestamp()
        if yr == YEAR_END:
            t1 = 1 << 62
        chain_gb = cum_chain_gb_at(blocks, t1)
        state_gb = UTXO_GB.get(yr, 11.0)
        total_gb = chain_gb + state_gb
        sync_days = total_gb / EFF_SYNC_GB_DAY.get(yr, 400.0)
        sync_cost = sync_days * 24 * WAGE_USD_HOUR
        val_day = era_value_day_usd(rev, datetime.datetime(yr, 1, 1, tzinfo=datetime.timezone.utc).timestamp(), t1)
        vci_ppm = (sync_cost / (val_day * 365) * 1e6) if val_day else None
        affr = sync_cost / MONTHLY_INCOME_USD * 100.0
        eras.append({
            "era": str(yr),
            "chain_gb": round(chain_gb, 2),
            "utxo_state_gb": state_gb,
            "total_gb": round(total_gb, 2),
            "sync_days": round(sync_days, 2),
            "sync_cost_usd": round(sync_cost, 2),
            "value_verified_usd_day": round(val_day, 2) if val_day else None,
            "vci_ppm_of_annual_value": round(vci_ppm, 3) if val_day else None,
            "affordability_pct_monthly_income": round(affr, 3),
        })

    affr_2013 = next((e["affordability_pct_monthly_income"] for e in eras if e["era"] == "2013"), None)
    affr_2026 = next((e["affordability_pct_monthly_income"] for e in eras if e["era"] == "2026"), None)
    vci_2013 = next((e["vci_ppm_of_annual_value"] for e in eras if e["era"] == "2013"), None)
    vci_2026 = next((e["vci_ppm_of_annual_value"] for e in eras if e["era"] == "2026"), None)

    out = {
        "schema": "bsahi.verify-cost-index.v1",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "status": "PROTOTYPE — documented assumptions, deterministic from frozen series",
        "thesis_anchor": "THESIS.md Sec 6 — the Satoshi node-burden claim, operationalized as verification time+money vs the value of what is verified.",
        "assumptions": {
            "sync_gb_per_day_table": EFF_SYNC_GB_DAY,
            "wage_usd_per_hour": WAGE_USD_HOUR,
            "monthly_income_usd": MONTHLY_INCOME_USD,
            "utxo_state_gb_table": UTXO_GB,
            "note": "Commodity archive-sync ~400 GB/day (2026) gives ~2-day sync for the ~800 GB chain, consistent with published IBD benchmarks. Wage/income held constant so the comparison is about the chain, not incomes. Absolute ratios are scenario-limited; the trend is the claim.",
        },
        "headline_readings": {
            "verification_time_days_stayed_flat": "~1-2 days across 2013-2026 (chain growth offset by era-scaled commodity throughput assumption)",
            "affordability_pct_of_monthly_income": "2013=%.1f%% -> 2026=%.1f%% (modest rise)" % (affr_2013 or 0, affr_2026 or 0),
            "cost_relative_to_value_verified_ppm_of_annual_value": "2013=%.3f ppm -> 2026=%.3f ppm (collapsed ~%.1fx: verification became far cheaper relative to what it checks)" % (vci_2013 or 0, vci_2026 or 0, (vci_2013 / vci_2026) if vci_2026 else 0),
            "satoshi_claim_reading": "On time-cost, node burden stayed FLAT (Satoshi's bigger-farms prediction did not materialize as runaway sync time). On value-relative cost, independent verification became far MORE affordable. The verification-access boundary was not crossed on cost grounds in 2013-2026 under this scenario.",
            "sensitivity": "Result scales linearly in the throughput assumption; lower per-era throughput raises both the flat time curve and the affordability rise. No IBD-benchmark or real UTXO series is captured yet — grade C live, D historical.",
        },
        "inputs": ["captured-data/historical/blockchain.info/avg-block-size.json",
                   "captured-data/historical/blockchain.info/miners-revenue.json"],
        "eras": eras,
    }
    with open(OUT, "w") as f:
        json.dump(out, f, indent=2)

    print(f"{'yr':6}{'chain_GB':>10}{'total_GB':>10}{'sync_days':>11}{'cost_$':>9}{'value_day_$':>13}{'VCI_ppm':>10}{'afford%':>9}")
    for e in eras:
        print(f"{e['era']:6}{e['chain_gb']:>10.1f}{e['total_gb']:>10.1f}{e['sync_days']:>11.2f}{e['sync_cost_usd']:>9.0f}"
              f"{e['value_verified_usd_day'] or 0:>13.0f}{e['vci_ppm_of_annual_value'] or 0:>10.3f}{e['affordability_pct_monthly_income']:>9.3f}")
    print(f"\nWrote {OUT}")

if __name__ == "__main__":
    main()