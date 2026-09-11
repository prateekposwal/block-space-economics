# Mining Concentration Measurement — Research Note

**BSAHI — Resource Concentration Observatory**
*Produced: 2026-09-11*

---

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

**This task is DEFERRED due to a data gap.** The repository does not contain
per-pool hashrate data. The concentration measurement script was written and
the network-level statistics were computed from existing data. The Gini
coefficient and top-N pool shares cannot be produced without external data
sources. No numbers were fabricated.

To complete this task, one of the following is needed:
- Add per-pool hashrate capture to the data-engineering pipeline (e.g., a
  new agent that calls mempool.space pool API)
- Use a historical pool dataset from a primary source (e.g., blockchain.info
  pool distribution archive)

---

*Data source: `data/hashrate.json` (mempool.space API). Output:
`data/mining_concentration.json`.*
