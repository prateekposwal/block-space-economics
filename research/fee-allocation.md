# Fee allocation and the security budget

<!-- seo-title: Fee Allocation: Security vs Storage — Who Pays -->

**BSAHI — where Bitcoin's fee revenue must eventually go.**
*Produced: 2026-09-17 · Instrument: `tools/research/fee_allocation.py`*

## The two claims on one revenue stream

Bitcoin's transaction fees are the only long-run revenue. Today **almost none of the competing claims is actually paid by fees** — the block subsidy pays the security bill:

| claim on fees (2026, per block) | USD/block | covered by fees today |
|---|---:|---:|
| **Security / production** (network energy cost to produce a block) | **$198,549** | **0.7%** (subsidy pays 107.0%) |
| **Storage externality** (`L_net`, N=32K, T=10yr) | **$5,628** | **28.8%** (the SCCR) |
| Node operating cost (network-wide, one year) | $563 | 251.4% |

**Actual fee revenue: ~$1,415/block** (measured; frozen series) — against a **$198,549/block** production cost and a **$5,628/block** modeled storage cost. The subsidy ($212,517/block) is what keeps the security budget met today.

> **Miners are fee recipients; validators are cost bearers. That asymmetry is the externality.** Miners are a few dozen pools running nodes; the ~26,586 reachable (and the unobservable non-listening) nodes are the ones carrying the storage and validation burden, and they receive nothing.

## The halving clock

Subsidy halves every ~210,000 blocks. Only this arithmetic is exact:

| year | subsidy (BTC/block) | USD at the current price |
|---:|---:|---:|
| 2024 | 3.12500000 | $212,517 |
| 2028 | 1.56250000 | $106,258 |
| 2032 | 0.78125000 | $53,129 |
| 2036 | 0.39062500 | $26,565 |
| 2040 | 0.19531250 | $13,282 |
| 2048 | 0.04882812 | $3,321 |
| 2076 | 0.00038147 | $26 |
| 2100 | 0.00000596 | $0 |

## When fees must take over

The subsidy alone stops covering the current network-wide energy cost of production in:

| assumed price | subsidy covers energy until |
|---|---:|
| $50,000 | 2024 |
| $78,000 | 2028 |
| $150,000 | 2032 |
| $300,000 | 2036 |

At the current price that crossover is **2028** — after which fees must fund security, and, if the storage externality is to be internalized, roughly **$204,177/block** more on top.

## Grades

| leg | layer | grade |
|---|---|---|
| Halving schedule | observed | A (arithmetic) |
| Energy cost / `L_net` / node opex | modelled | C (documented assumptions on measured legs) |
| Fee revenue | observed | B (frozen series: fees BTC/day × price) |
| Multi-decade projection | modelled | C (scenario, not a forecast) |

## Caveats

- The multi-decade table is a **scenario**, not a forecast: only the subsidy halving is deterministic. Prices, energy prices, ASIC efficiency and the price of block space all move.
- **`N` is provisional** (an address sample, not a node count) — see the [Verification Population Observatory](/research/verification-population). Re-basing N moves the storage claim linearly.
- The 241k/218k "node" figures are **addresses**, not nodes, and are not used here.
- Fees are network-wide revenue; node costs are network-wide costs. Single-node figures are not compared to network fees.

## Why this matters

The SCCR asks whether fees cover the *storage* externality. The security budget asks whether fees cover *hashing*. Both are claims on the same fee stream, and the subsidy is currently masking both. As the subsidy falls, the two claims compete — and that is a research question worth owning.

Data: [`/data/fee_allocation.json`](/data/fee_allocation.json) · Related: [SCCR sensitivity](/research/sccr-sensitivity) · [Production cost](/research/production-cost-note) · [Evidence Matrix](/research/evidence-matrix)
