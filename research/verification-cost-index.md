# Verification Cost Index — the verification-burden trend

<!-- seo-title: Verification Cost Index: the Verification-Burden Trend -->

**BSAHI — verification-side instrument (prototype)**
*Produced: 2026-09-17 · Instrument: `tools/research/verify_cost_index.py`*

## Headline

**Verification burden trend.** Under this scenario, independent verification did NOT get materially harder across 2013-2026: sync time stayed roughly flat (~1-2 days) while the cost relative to the value verified collapsed ~17x.

Absolute dollar figures are scenario-limited: node throughput is assumed, wage/income is held constant, and UTXO state is reconstructed. The trend is the claim; the level is not.

The absolute dollar figure is deliberately **not** the headline. The index asks
Satoshi's node-burden question — does verification cost grow faster than the value
of what is verified? — and the answer that survives the assumptions is about
**direction**, not level.

## Components (secondary)

| component | role | basis | grade |
|---|---|---|---|
| chain storage | must be downloaded and kept | cumulative frozen avg-block-size series | B |
| UTXO / chain state | must be held in memory/DB to validate | reconstructed era table (anchors + interpolation); observed gettxoutsetinfo layer now being measured | D |
| bandwidth / sync throughput | sets sync time | assumed commodity archive-sync table (era-scaled) | C |
| sync time | the time burden | derived: chain size / assumed throughput | C |
| hardware | capex to verify | not modeled in this leg | — |
| electricity | energy to verify | see the production-cost note (scenario model) | C |
| operator labour | human cost | assumed wage ($25/h) and time share | D |

## Per-era readings

| era | chain GB | total GB | sync days | sync cost $ (scenario) | VCI ppm of annual value | affordability % of monthly income |
|---|---|---|---|---|---|---|
| 2013 | 13.47 | 13.97 | 0.93 | 558.69 | 1.615 | 13.967 |
| 2014 | 27.67 | 28.37 | 0.95 | 567.38 | 0.575 | 14.185 |
| 2015 | 55.51 | 56.51 | 1.13 | 678.1 | 1.591 | 16.952 |
| 2016 | 99.37 | 101.07 | 1.44 | 866.35 | 1.474 | 21.659 |
| 2017 | 150.67 | 153.17 | 1.7 | 1021.16 | 0.296 | 25.529 |
| 2018 | 202.19 | 205.39 | 1.87 | 1120.3 | 0.203 | 28.007 |
| 2019 | 261.75 | 265.75 | 1.9 | 1138.91 | 0.216 | 28.473 |
| 2020 | 327.03 | 332.03 | 1.84 | 1106.78 | 0.22 | 27.669 |
| 2021 | 395.78 | 401.78 | 1.83 | 1095.76 | 0.065 | 27.394 |
| 2022 | 463.71 | 470.71 | 1.81 | 1086.25 | 0.113 | 27.156 |
| 2023 | 555.7 | 564.7 | 1.88 | 1129.41 | 0.106 | 28.235 |
| 2024 | 645.74 | 655.74 | 1.93 | 1157.19 | 0.077 | 28.93 |
| 2025 | 729.64 | 740.64 | 1.95 | 1169.44 | 0.067 | 29.236 |
| 2026 | 789.45 | 800.45 | 2.0 | 1200.67 | 0.096 | 30.017 |

## Confidence

- **Overall grade: C.** Evidence grade C: the trend is robust to the assumptions (it is the SHAPE), but the absolute ratios are scenario-limited and are NOT the headline.
- **Measured:** chain size (frozen daily series); value verified (miners revenue, frozen series).
- **Assumed:** node throughput; UTXO/state size (reconstructed); wage/income; operator time share.
- **What would move it:** capture real IBD benchmarks (sync wall-clock on commodity hardware); swap the reconstructed UTXO table for the observed series as it accumulates; measured hardware/energy/labour costs rather than assumptions.

## Method (brief)

Verification time = total bytes to verify (chain + state) ÷ an assumed
era-scaled commodity throughput. Verifiable value = miners' revenue (frozen
daily series). The index reports verification cost as parts-per-million of one
year of the value verified, plus affordability as a share of a fixed monthly
income. Full assumptions in the data file.

## Roadmap to a harder metric

1. Capture real IBD benchmarks (wall-clock sync on commodity hardware) instead of
   assuming throughput.
2. Swap the reconstructed UTXO/state table for the **observed** series as
   `utxo_state_measure.py` accumulates rows.
3. Replace assumed wage/energy with measured values.
