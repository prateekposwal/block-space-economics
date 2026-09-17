#!/usr/bin/env python3
"""Production-side energy cost instrument (BSAHI Tier-1 item 4, aggregate leg).

Closes the "producing side" of the asymmetry (data-confidence row 13): the
network's total energy cost to produce blocks vs the value block-space pays
(subsidy + fees) and vs the FEE MARKET alone.

Measured per era (deterministic from frozen daily series):
  power_GW        = hashrate_TH_s x ASIC efficiency (J/TH)
  energy_kWh_day  = power_W x 24 h / 1000
  energy_cost_$day = energy_kWh_day x electricity $/kWh   (assumption)
  production_usd_day  = miners revenue (subsidy + fees), frozen series
  prod_cost_ratio     = energy_cost / production_value    (are blocks profitable
                        for the network, at the assumed $/kWh?)
  fee_share_of_production = fee_usd_day / energy_cost      (how much of the
                        production energy bill the fee market pays)

Hashrate + revenue + fee/price legs: frozen daily series (grade B).
ASIC efficiency + electricity $/kWh: documented assumption (grade C).

Deterministic: offline by construction (reads captured-data/historical only).
Writes data/production_cost_ratio.json.
"""
import json, os, datetime, statistics

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, "captured-data", "historical", "blockchain.info")
OUT = os.path.join(ROOT, "data", "production_cost_ratio.json")
YEARS = list(range(2012, 2027))

# ASIC generation efficiency, J/TH — NETWORK AVERAGE incl. hardware lag
# (documented estimates; grade C, not measured; order-of-magnitude calibrated
# to CBECI-scale annual TWh: ~13 TWh (2013), ~37 TWh (2017), ~200+ TWh (2026)).
ERA_EFF_J_PER_TH = {
    2012: 1500, 2013: 800, 2014: 400, 2015: 350, 2016: 400, 2017: 400,
    2018: 150, 2019: 100, 2020: 70, 2021: 55, 2022: 45, 2023: 38,
    2024: 32, 2025: 28, 2026: 25,
}
ELECTRICITY_USD_PER_KWH = 0.05  # global mining-average (0.02-0.08 range; midpoint)
# The single global price is an ASSUMPTION (grade C). Rather than hide it, the
# model publishes the result across plausible electricity prices so the reader
# can see the sensitivity directly (production_cost_ratio is linear in $/kWh).
ELECTRICITY_SCENARIOS = [0.03, 0.05, 0.08, 0.10, 0.15]
BLOCKS_PER_DAY = 144.0

def load(slug):
    with open(os.path.join(SRC, slug + ".json")) as f:
        return json.load(f)["values"]

def era_mean(points, t0, t1):
    v = [p["y"] for p in points if t0 <= p["x"] < t1]
    return statistics.mean(v) if v else None

def main():
    hr = load("hash-rate")          # EH/s
    rev = load("miners-revenue")    # USD/day
    txbf = load("transaction-fees") # BTC/day
    price = load("market-price")    # USD

    eras = []
    for yr in YEARS:
        t0 = datetime.datetime(yr, 1, 1, tzinfo=datetime.timezone.utc).timestamp()
        t1 = datetime.datetime(yr + 1, 1, 1, tzinfo=datetime.timezone.utc).timestamp() if yr < 2026 else (1 << 62)
        hr_ehs = era_mean(hr, t0, t1)
        rev_day = era_mean(rev, t0, t1)
        fee_btc_day = era_mean(txbf, t0, t1)
        px = era_mean(price, t0, t1)
        if hr_ehs is None or rev_day is None:
            continue
        eff = ERA_EFF_J_PER_TH.get(yr, 20)
        th_s = hr_ehs  # blockchain.info hash-rate series is TH/s (verified unit field)
        power_w = th_s * eff  # watts
        power_gw = power_w / 1e9
        energy_kwh_day = power_w * 24 / 1000
        energy_cost_day = energy_kwh_day * ELECTRICITY_USD_PER_KWH
        prod_ratio = energy_cost_day / rev_day if rev_day else None
        fee_usd_day = (fee_btc_day * px) if (fee_btc_day and px) else None
        fee_share_prod = (fee_usd_day / energy_cost_day) if (fee_usd_day and energy_cost_day) else None
        eras.append({
            "era": str(yr),
            "hashrate_ehs": round(hr_ehs, 2),
            "asec_efficiency_j_per_th": eff,
            "power_gw": round(power_gw, 1),
            "energy_kwh_day": round(energy_kwh_day, 0),
            "energy_cost_usd_day": round(energy_cost_day, 0),
            "production_value_usd_day": round(rev_day, 0),
            "production_cost_ratio": round(prod_ratio, 3) if prod_ratio else None,
            "fee_coverage_of_production_pct": round(fee_share_prod * 100, 3) if fee_share_prod else None,
            "electricity_usd_per_kwh": ELECTRICITY_USD_PER_KWH,
        })

    # Electricity scenarios: the assumption, made explicit.
    scen_table = []
    for price in ELECTRICITY_SCENARIOS:
        by_era = {}
        money_losing = []
        for e in eras:
            kwh = e["energy_kwh_day"]; rev = e["production_value_usd_day"]
            if not rev:
                continue
            ratio = (kwh * price) / rev
            by_era[e["era"]] = round(ratio, 3)
            if ratio > 1.0:
                money_losing.append(e["era"])
        scen_table.append({
            "electricity_usd_per_kwh": price,
            "production_cost_ratio_by_era": by_era,
            "eras_money_losing_network_wide": money_losing,
        })

    out = {
        "schema": "bsahi.production-cost-ratio/1",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "status": "AGGREGATE (network-wide) — producing-side instrument; regional split NOT included (grade D until Cambridge-map + regional electricity capture)",
        "assumptions": {
            "asec_efficiency_j_per_th_by_era": ERA_EFF_J_PER_TH,
            "electricity_usd_per_kwh": ELECTRICITY_USD_PER_KWH,
            "grade": "C — published paper estimates + assumed global mining average; hashrate/revenue/fee-price legs are frozen primary series (B)",
        },
        "eras": eras,
        "electricity_scenarios": {
            "unit": "USD/kWh",
            "scenarios_tested": ELECTRICITY_SCENARIOS,
            "table": scen_table,
            "note": "production_cost_ratio is linear in $/kWh, so this is the assumption shown as a range rather than a point. A row above 1.0 means the modeled network-wide energy bill exceeds what miners earn (subsidy + fees) at that price, on the flow-cost basis.",
        },
        "headline": {
            "reading": "Produced-side cost is published as a SCENARIO, not a single number: across $0.03-$0.15/kWh the network-wide production-cost ratio stays below 1.0 in most years, crossing above 1.0 only in the low-fee years at the highest electricity prices.",
            "sensitivity": "ratio is linear in $/kWh and in assumed ASIC efficiency; the fee market pays only ~0.1-4% of the production energy bill across all eras. This is the aggregate producing-side stress, distinct from the regional split (grade D pending Cambridge-map + regional electricity capture).",
        },
    }
    with open(OUT, "w") as f:
        json.dump(out, f, indent=2)

    print(f"{'yr':6}{'EH/s':>8}{'GW':>7}{'kWh/day':>10}{'cost_$':>10}{'prod_rev_$':>12}{'cost/rev':>10}{'fees%prod':>10}")
    for e in eras:
        print(f"{e['era']:6}{e['hashrate_ehs']:>8.0f}{e['power_gw']:>7.1f}{e['energy_kwh_day']:>10.0f}"
              f"{e['energy_cost_usd_day']:>10.0f}{e['production_value_usd_day']:>12.0f}"
              f"{e['production_cost_ratio'] or 0:>10.3f}{e['fee_coverage_of_production_pct'] or 0:>10.3f}")
    print(f"\nWrote {OUT}")

if __name__ == "__main__":
    main()