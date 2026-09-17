# Fee allocation and the security budget

<!-- seo-title: Fee Allocation: Security vs Storage — Who Pays -->

**BSAHI — where Bitcoin's fee revenue must eventually go.**
*Produced: 2026-09-17 · Instrument: `tools/research/fee_allocation.py`*

## The two claims on one revenue stream

Bitcoin's transaction fees are the only long-run revenue. Today **almost none of the competing claims is actually paid by fees** — the block subsidy pays the security bill:

{{TABLE:fee_allocation}}

**Actual fee revenue: ~$1,415/block** (measured; frozen series) — against a **$198,549/block** production cost and a **$4,676/block** modeled storage cost (N=26,586). The subsidy ($212,517/block) is what keeps the security budget met today.

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


## Temporal expansion — the fee requirement per halving epoch

Price paths are **scenarios** (grade C); the halving is arithmetic (grade A).

### Specified price path (aggressive appreciation)

| year | price | subsidy USD/block | production deficit | storage claim | **total fee needed** |
|---:|---:|---:|---:|---:|---:|
| 2024 | $50,000 | $156,250 | $42,299 | $4,676 | **$46,975** |
| 2028 | $78,000 | $121,875 | $76,674 | $4,676 | **$81,350** |
| 2032 | $150,000 | $117,188 | $81,362 | $4,676 | **$86,038** |
| 2036 | $300,000 | $117,188 | $81,362 | $4,676 | **$86,038** |
| 2040 | $600,000 | $117,187 | $81,362 | $4,676 | **$86,038** |
| 2044 | $1,200,000 | $117,187 | $81,362 | $4,676 | **$86,038** |

**The structural invariant:** when the price **doubles each epoch**, the USD subsidy is **constant** — the halving cancels the appreciation. On this path the nominal security protection **plateaus at ~$117,188/block** and does not grow again. The security-budget cliff is therefore a **protocol invariant**, not a pricing problem: no amount of fiat appreciation on a doubling path raises the subsidy above the plateau, while the production deficit and the storage claim are set by costs and by schedule.

### Flat-price path (no appreciation)

| year | price | subsidy USD/block | production deficit | storage claim | **total fee needed** |
|---:|---:|---:|---:|---:|---:|
| 2024 | $68,005 | $212,517 | $0 | $4,676 | **$4,676** |
| 2028 | $68,005 | $106,258 | $92,291 | $4,676 | **$96,967** |
| 2032 | $68,005 | $53,129 | $145,420 | $4,676 | **$150,096** |
| 2036 | $68,005 | $26,565 | $171,985 | $4,676 | **$176,660** |
| 2040 | $68,005 | $13,282 | $185,267 | $4,676 | **$189,943** |
| 2044 | $68,005 | $6,641 | $191,908 | $4,676 | **$196,584** |

Under a flat price the crossover arrives sooner and hardens, because the subsidy and the protection fall together.

### Doubling-each-epoch from today

| year | price | subsidy USD/block | production deficit | storage claim | **total fee needed** |
|---:|---:|---:|---:|---:|---:|
| 2024 | $68,005 | $212,517 | $0 | $4,676 | **$4,676** |
| 2028 | $136,011 | $212,517 | $0 | $4,676 | **$4,676** |
| 2032 | $272,022 | $212,517 | $0 | $4,676 | **$4,676** |
| 2036 | $544,043 | $212,517 | $0 | $4,676 | **$4,676** |
| 2040 | $1,088,086 | $212,517 | $0 | $4,676 | **$4,676** |
| 2044 | $2,176,172 | $212,517 | $0 | $4,676 | **$4,676** |

Machine-readable: `data/fee_allocation.json` → `temporal.paths` (per path, per epoch).

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
