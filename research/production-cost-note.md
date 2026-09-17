# Production-Cost Ratio — research note (Tier-1 item 4, aggregate leg)

<!-- seo-title: Bitcoin Production-Cost Ratio: Miners vs Fees -->

**BSAHI — producing-side instrument**
*Produced: 2026-09-16*

## The instrument

`tools/research/production_cost_ratio.py` + `data/production_cost_ratio.json`.
Deterministic from frozen daily series (hash-rate TH/s, miners-revenue USD/day,
transaction-fees BTC/day, market-price USD — all under `captured-data/historical/`).
Per era:

    power_GW        = hashrate_TH/s x network-average ASIC efficiency (J/TH)
    energy_cost_$day = power_x_hours x electricity $/kWh (assumption; scenario range shown below)
    production_value_$day = miners revenue (subsidy + fees)
    production_cost_ratio = energy_cost / production_value   (network viability)
    fee_coverage_of_production = fee_usd_day / energy_cost   (block-space's share)

## Electricity scenarios — the assumption, made explicit

The single global price of **$0.05/kWh** is an *assumption* (grade C), not a
measurement. Rather than hide it behind one number, the model publishes the
production-cost ratio across plausible electricity prices. The ratio is linear in
$/kWh, so this is the assumption shown as a range:

| era | $0.03/kWh | $0.05/kWh | $0.08/kWh | $0.10/kWh | $0.15/kWh |
|---|---|---|---|---|---|
| 2012 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| 2013 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| 2014 | 0.01 | 0.03 | 0.04 | 0.05 | 0.07 |
| 2015 | 0.09 | 0.15 | 0.23 | 0.29 | 0.44 |
| 2016 | 0.27 | 0.45 | 0.73 | 0.91 | **1.36** |
| 2017 | 0.19 | 0.32 | 0.51 | 0.64 | 0.96 |
| 2018 | 0.27 | 0.44 | 0.71 | 0.88 | **1.33** |
| 2019 | 0.33 | 0.56 | 0.89 | **1.11** | **1.67** |
| 2020 | 0.44 | 0.73 | **1.18** | **1.47** | **2.20** |
| 2021 | 0.12 | 0.20 | 0.33 | 0.41 | 0.61 |
| 2022 | 0.27 | 0.45 | 0.72 | 0.91 | **1.36** |
| 2023 | 0.36 | 0.59 | 0.95 | **1.19** | **1.78** |
| 2024 | 0.36 | 0.59 | 0.95 | **1.19** | **1.78** |
| 2025 | 0.40 | 0.66 | **1.06** | **1.32** | **1.99** |
| 2026 | 0.50 | 0.84 | **1.34** | **1.68** | **2.52** |

**Bold = above 1.0** (the modeled network-wide energy bill exceeds what miners earn —
subsidy + fees — on the flow-cost basis). Years that cross the wall:

- **$0.03/kWh:** none
- **$0.05/kWh:** none
- **$0.08/kWh:** 2020, 2025, 2026
- **$0.10/kWh:** 2019, 2020, 2023, 2024, 2025, 2026
- **$0.15/kWh:** 2016, 2018, 2019, 2020, 2022, 2023, 2024, 2025, 2026

The point is not which price is "right" — it is that the producing-side stress is
**visible as a function of a decision variable** instead of a hidden constant.

## First reading (2026-09-16)

| era | EH/s | GW | energyⱼₖ (kWh/day) | cost $/day | prod value $/day | cost/value | fee % of prod. cost |
|---|---|---|---|---|---|---|---|
| 2017 | 6.3 | 2.5 | 60.7M | 3.03M | 9.44M | 0.32 | 35.7 |
| 2019 | 66.8 | 6.7 | 160.2M | 8.01M | 14.4M | 0.56 | 5.0 |
| 2020 | 120 | 8.4 | 202M | 10.1M | 13.8M | 0.73 | 8.1 |
| 2023 | 380 | 14.4 | 347M | 17.3M | 29.2M | 0.59 | 10.9 |
| 2024 | 636 | 20.3 | 488M | 24.4M | 41.2M | 0.59 | 14.0 |
| 2025 | 937 | 26.2 | 630M | 31.5M | 47.6M | 0.66 | 1.6 |
| 2026 | 953 | 23.8 | 572M | 28.6M | 34.1M | 0.84 | 0.7 |

Total is in the CBECI-consistent ballpark (2017 ≈ 22 TWh/yr, 2026 ≈ 209 TWh/yr;
efficiency table is a documented estimate, grade C).

## Reading

- **2026: energy cost ≈ 84% of miner revenue at $0.05/kWh.** Near the
  flow-cost viability wall; at $0.06/kWh the network's aggregate energy bill
  would exceed its revenue. This is the producing-side stress (boundary class E)
  in its strongest form yet — a cost squeeze, not a fee shortage symptom.
- **Block-space fees pay 0.7% of the energy cost that produces the blocks they live in** (2026). The fee market internalizes ≈ nothing of the physical
  production cost. (2012-2017 fee coverage looks high only because the estimated
  energy bills were tiny — grade-C baseline effect.)
- The trend is rising: cost/value went 0.32 (2017) → 0.56 (2019) → 0.73 (2020)
  → 0.59-0.66 (2023-25) → 0.84 (2026). Pressure is concentrated in subsidy-halving
  years as subsidy steps down against a growing energy bill.

## Honesty block

- **Efficiency ($/kWh, J/TH) are documented assumptions, not measurements (grade C).** The ratio is linear in both. The hashrate + revenue + fee + price
  legs are frozen primary series (grade B).
- **Aggregate only — regional split NOT included.** The Cambridge-mining-map /
  regional-electricity capture that row 13 names is still grade D. This closes
  the "producing side has no instrument" gap, not the regional-granularity gap.
- No number above is the regional production cost; do not read the two as the
  same thing.

## Next step for this row

Regional share capture (Cambridge map or pool-country attribution) + regional
electricity series (EIA/IEA) → row 13 D → B. Aggregate stays C (assumption-bound)
until a measured network-average efficiency series is captured.