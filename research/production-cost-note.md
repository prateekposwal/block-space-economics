# Production-Cost Ratio — research note (Tier-1 item 4, aggregate leg)

**BSAHI — producing-side instrument**
*Produced: 2026-09-16*

## The instrument

`tools/research/production_cost_ratio.py` + `data/production_cost_ratio.json`.
Deterministic from frozen daily series (hash-rate TH/s, miners-revenue USD/day,
transaction-fees BTC/day, market-price USD — all under `captured-data/historical/`).
Per era:

    power_GW        = hashrate_TH/s x network-average ASIC efficiency (J/TH)
    energy_cost_$day = power_x_hours x electricity $/kWh (assumption = 0.05)
    production_value_$day = miners revenue (subsidy + fees)
    production_cost_ratio = energy_cost / production_value   (network viability)
    fee_coverage_of_production = fee_usd_day / energy_cost   (block-space's share)

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