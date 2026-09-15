# Mining Concentration Measurement — Research Note

**BSAHI — Resource Concentration Observatory**
*Produced: 2026-09-11* | *Updated: 2026-09-16 (row-11 gap closed, first measurement)*

---

## Measurement update (2026-09-16) — the gap is closed

`tools/research/pool_concentration.py` now captures per-pool block-tag attribution
from mempool.space `/api/v1/mining/pools` for four validated windows
(24h / 3d / 1w / 1y). The 2w / 6m variants of this endpoint silently return
**all-time** data and are excluded by a block-count sanity band. Raw responses are
cached under `captured-data/mempool.space/` for offline reproduction.

### First reading (2026-09-16)

| window | blocks | known | unknown% | top-1 | top-3 | top-5 | HHI | N_eff | Gini |
|---|---|---|---|---|---|---|---|---|---|
| 24h | 163 | 14 | 2.5 | 23.3% | 55.8% | 76.7% | 0.140 | 7.1 | 0.539 |
| 3d | 470 | 16 | 1.3 | 26.6% | 59.8% | 77.4% | 0.150 | 6.7 | 0.594 |
| 1w | 1075 | 17 | 1.2 | 26.3% | 57.7% | 76.6% | 0.144 | 7.0 | 0.603 |
| 1y | 52335 | 31 | 0.6 | 28.5% | 58.6% | 77.4% | 0.152 | 6.6 | 0.782 |

Top-1 shares: Foundry USA 28.5%, AntPool 17.9%, F2Pool 12.2%, ViaBTC 9.9%,
SpiderPool 8.9%, MARA 4.9%, SECPOOL 4.1%, Luxor 3.2% (1y).

- **No boundary threshold crossed.** Top-1 is far below 50% (51%-attack
  borderline); top-3 ≈ 59%, below the 75% coordination-risk line; top-5 ≈ 77%
  below 85%.
- **HHI ≈ 0.15 (≈1500 DOJ points) = "moderately concentrated"** — far below the
  2500 "highly concentrated" line; effective pool count N_eff ≈ 6.6–7.1.
- **Gini ≈ 0.54 (24h) / 0.78 (1y).** The distribution is skewed toward the top
  pools; 1y Gini is higher because long-run shares concentrate more than any
  single day.
- **Unknown share 0.6–2.5%** — coinbase-tag attribution is near-complete;
  well below the 5% noise flag.

### Honesty block (applies to every number above)

Block-tag attribution is a **proxy for hashrate share, not a measurement of it**:
pools can sign externally and public block lists aggregate at pool level, and a
pool's *reported* hashrate (e.g., via their own dashboards) can deviate from the
block-observed share. Underlying attribution comes from regex-matching coinbase
text. Historical per-pool attribution is still weak pre-2014, and merged mining
(e.g., Rootstock/RSK sidechains) is invisible to coinbase scanning. Ground-truth
pool-reported hashrate is a cross-check not yet captured — that is the next step
for this row (C → B).

---

## Data Availability Assessment (original, retained for context)

## Data Availability Assessment

### What exists in the repo

`data/hashrate.json` contains **network-wide instantaneous hashrate** (EH/s) captured
every ~80 minutes over 240 observations (2026-08-17 to 2026-09-09) from the public
mempool.space API (`/api/v1/mining/hashrate/24h`). The data is a single time series
of total network hashrate, NOT per-pool distribution.

### What is MISSING for concentration measurement

To compute mining concentration metrics, the repository needs **per-pool hashrate
data** — a snapshot or time series where each pool's hashrate contribution is
individually recorded. Such data exists at:

- **mempool.space /api/v1/mining/pools** — per-pool hashrate with names and EH/s
- **BTC.com pool statistics** — historical pool hashrate share
- **Blockchain.info pool pages** — miner distribution estimates
- **CKPool / SlushPool / F2Pool / AntPool / ViaBTC** — individual pool APIs

**None of these data sources are captured by the current BSAHI pipeline.**

---

## What CAN be measured from existing data (network-level)

| Metric | Value | Source |
|---|---|---|
| Observations | 240 | `data/hashrate.json` |
| Period | 2026-08-17 to 2026-09-09 | Computed |
| Mean network hashrate | 912.98 EH/s | Computed |
| Range (min→max) | 850.36 → 964.58 EH/s | Computed |
| Peak-to-trough ratio | 1.134× | Computed |
| Coefficient of variation | 0.125 | Computed |

These describe **network health and hashrate stability**, not mining pool
concentration. A stable hashrate at ~910 EH/s (varying only ±13% over 24 days)
suggests the network is healthy, but tells us nothing about whether one pool
controls 30% or 50% of that hashrate.

---

## What the missing data would reveal

If per-pool data were available, the concentration metrics would directly test
the thesis question: *"How much stress can Bitcoin absorb before the cost of
participating, verifying, producing, or coordinating becomes meaningfully
asymmetric?"*

Specifically:

1. **Top-1 pool share > 50%** would signal a potential 51% attack boundary.
   The cost asymmetry here is that a single entity controls block production.
2. **Top-3 pool share > 75%** would signal coordination risk — three pools
   could censor transactions or reorganize the chain.
3. **Gini coefficient approaching 1.0** would signal extreme concentration
   where a few pools capture nearly all block rewards, creating a
   centralization pressure that increases the cost for new miners to enter.

The current network hashrate (~913 EH/s) makes individual ASIC mining
economically infeasible, meaning mining is already concentrated by capital
requirements alone. The pool layer is where this concentration becomes
observable and measurable.

---

## Honest statement

**RESOLVED 2026-09-16.** The deferred task is complete: per-pool block-tag
attribution is now captured (returns ~7 effective pools, no boundary threshold
crossed — see Measurement update above). `data/mining_concentration.json` is
schema v2 with measured metrics; raw responses cached and reproducible.

Still open (not fabricated, live-graded C): pool-reported hashrate ground-truth
cross-check; pre-2023 historical attribution; merged-mining visibility.

To go from C → B, the following is needed:
- A pool-reported hashrate cross-check capture (pools' own dashboards or the
  Cambridge Bitcoin Mining Map pool attribution)
- Historical per-pool attribution for the 2013–2023 era from a primary source

---

*Data source: `data/hashrate.json` (mempool.space API). Output:
`data/mining_concentration.json`.*
