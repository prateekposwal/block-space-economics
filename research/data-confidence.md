# BitcoinSahi — Data Confidence Matrix

**The instrument's honest front page.** Every arrow of the core loop
(THESIS.md §2) is graded on the quality of data available to measure it —
live (what this repo captures today) and historical (what survives for
calibration). A grade is never asserted; it is attached to a dated capture or
a cited source, and this document is regenerated when a capture or
reconstruction lands.

*Last regenerated: 2026-09-15.*

---

## Grade definitions (from THESIS.md §5)

| Grade | Meaning |
|---|---|
| **A** | Solid longitudinal data, captured in this repo, recoverable end-to-end |
| **B** | Strong primary-source archives; reproducible but external to this repo |
| **C** | Partial primary data + reconstruction; real but gappy |
| **D** | Thin or contested; not measurable from a surviving primary source |

Rules the matrix obeys:
1. A grade is attached to a **dated capture** or a **named source**, never to a vibe.
2. Any arrow graded D may run **live**, but it is labeled "measurement, not calibrated."
3. Improving a grade is a tracked task (historical SCCR reconstruction, new captures), not an editorial decision.

---

## The matrix

| # | Arrow (core loop) | Live grade | Historical grade | What exists today (dated) | Known gap / noise | File / source |
|---|---|---|---|---|---|---|
| 1 | Fee market (fees sat/vB, per block) | **A** | **B** | Per-block history `fee_history_blocks.json`, `fee_history.json`; capture continuity Jul 31–Aug 22 + Sep 15 2026; **historical daily BTC aggregates now frozen** (`captured-data/historical/`) | Per-block fee reconstructions pre-2026 still derive from daily aggregates | `data/fee_history*.json`, `research/sccr_historical_reconstruct.py` |
| 2 | USD price | **A** | **A** | `btc_price` in every `data/snapshot.json` capture; continuous daily series available back to 2010 from public APIs | — | `data/snapshot.json`, CoinGecko/archive APIs |
| 3 | Mempool pressure | **A** | **B** | `mempool_fee_histogram.json`, `mempool_tx` per snapshot; `block_interval.json`; historical tx aggregates frozen | Congestion episodes before the frozen series need per-era reconstruction | `data/`, `captured-data/historical/` |
| 4 | Block/state size | **A** | **B** | Block size/weight captured per block (Jul-Aug 2026 captures); `adoption.json`; historical avg-block-size daily series frozen (2009→2026) | Historical per-block weights, not just daily averages | `data/adoption.json`, `captured-data/historical/blockchain.info/avg-block-size.json` |
| 5 | Storage cost coverage (SCCR) | **A** | **B\*** | `sccr.json`, `sccr_latest.json`, `sccr_history.json`, model-spec v2.0.1, 3 independent implementations | **Historical leg now RECONSTRUCTED-ESTIMATE** (14 eras, deterministic tool): fee/price/blocksize from frozen daily aggregates (grade B); era node-count leg remains approximation (grade C/D). Q7 2021/2023 verified within 50%; 2017/2024 do not reproduce the claims. | `data/sccr_historical_series.json`, `tools/research/sccr_historical_reconstruct.py`, `research/HISTORICAL_SCCR_RECONSTRUCTION.md` |
| 6 | UTXO cost (state persistence as externality) | **B** | **D** | `utxo_cost_ratio.json`: 144 blocks (966127–966270), avg UCIR 2.87, 84% of blocks above 1× | Pre-2016 UTXO series thin; earlier reconstruction only. **2026-09-16 reachability filed** (`utxo-series-reachability.md`): no reachable primary UTXO-count source (CoinMetrics: no metric; blockchair: stats lacks unspent count, /blocks rate-limited 430; esplora/mempool: none; bitinfocharts & legacy /q: hang). D holds until a synced local node (gettxoutsetinfo) or blockchair full scan lands. | `data/utxo_cost_ratio.json`, `research/utxo-series-reachability.md` |
| 7 | Validation/verification cost (VCI target) | **C** | **D** | **VCI prototype shipped** (`tools/research/verify_cost_index.py`, `data/verify_cost_index.json`): chain-size + era-scaled throughput scenario → sync days, cost, affordability, value-relative ppm; `bandwidth_bound.json` bounds; **chain-leg cross-check 2.7% vs blockchair direct measurement** (`utxo_series.json`) | Hardening needs a captured IBD-benchmark series + a real UTXO set size series; **UTXO-count source not reachable** (`utxo-series-reachability.md`); until then the result is scenario-limited (documented in the tool) | `data/verify_cost_index.json`, `tools/research/verify_cost_index.py`, `data/utxo_series.json`, `research/bandwidth-bound-note.md`, `research/validation-cost.md` |
| 8 | Bandwidth/relay (propagation) | **C** | **D** | `bandwidth_bound.json` bounds (block + batch model) | Marginal propagation leg unbundled from fixed node cost; no topology data | `research/bandwidth-bound-note.md` |
| 9 | Node count / distribution | **B** | **C** | `node_census_series.json` (btcnodes.io snapshot API, 3,981 snapshots 2026-05-08→09-15, ~26.6K reachable nodes, primary source); `node_census.json` addrman=32,000 is the **addrman cap, not a count**; `liveConnections=8` | **2017-12-11 and 2026 are primary-anchored** (N=11,891 and N=26,635 in the SCCR N table, grade B\*); pre-2018 continuous series not recoverable (btcnodes retains ~4mo; wayback has only 2017-12 API capture); 2013-2016 and 2018-2025 remain approximation | `data/node_census_series.json`, `data/node_census_anchors.json`, `tools/research/node_census_capture.py`, `research/node-census-staleness-note.md` |
| 10 | Mining hashrate level | **B** | **B** | `hashrate.json`: 240 points from 2026-08-19 (~934 EH/s) | Historical difficulty/hashrate series recoverable from public archives (not yet pulled into repo) | `data/hashrate.json` |
| 11 | Mining pool concentration | **C** | **D** | `mining_concentration.json` schema v2: live block-tag attribution from mempool.space (24h/3d/1w/1y validated windows); `tools/research/pool_concentration.py`; **live measurement now exists**: 24h top-1=23%, top-3=56%, top-5=77%, HHI 0.140, gini 0.539; 1y top-1=29%, top-3=59%, top-5=77%, HHI 0.152 (1520 pts, moderately concentrated per DOJ), gini 0.782. Unknown share 0.6–2.5%. **Validation 2026-09-16** (`pool_attribution_validation.py`): 7/7 top pools coherent ≤1.5σ across windows; network-level blockchair↔mempool hashrate agree 2.34%. | Pre-2023 per-pool attribution (historical D); **pool self-reported hashrate unavailable** (DNS/token/SPA — `pool-hashrate-reachability.md`); block-tag attribution ≠ pool-reported hashrate | `data/mining_concentration.json`, `tools/research/pool_concentration.py`, `data/pool_attribution_validation.json`, `research/pool-hashrate-reachability.md` |
| 12 | Governance signaling (BIP-110) | **A** | **B** | `bip110.json` + `bip110_daily.json` (full signaling series, 0% at lock-in, height 963648); 2017 signaling in primary archives; **software/version distribution proxy captured 2026-09-16** (`node_version_distribution.json`: 97.7% Core, 38.8% on Core 30/31, self-declared UA) | Pre-BIP-110 signaling requires archive reconstruction; version share is self-declared, not verified | `data/bip110*.json`, `research/bip110-post-lockin-case-study.md`, `data/node_version_distribution.json` |
| 13 | Regional production cost (energy) | **C** | **C** | **Aggregate producing-side instrument SHIPPED 2026-09-16** (`production_cost_ratio.py` + `production_cost_ratio.json`): network energy cost vs miner revenue vs fee-market share, per era 2012-2026 from frozen series. 2026: energy ≈ 84% of revenue at $0.05/kWh mid; fees pay ≈ 0.7% of the energy bill. Efficiency + $/kWh documented assumptions (grade C) | **Regional granularity stays D** — Cambridge-map pool-country shares and regional electricity series not yet captured; efficiency table is CBECI-calibrated estimate, not measured | `data/production_cost_ratio.json`, `tools/research/production_cost_ratio.py`, `research/production-cost-note.md` |

---

## Critical gaps (grade D, named as build-or-document decisions)

1. **Mining pool concentration (row 11).** **Live gap CLOSED 2026-09-16** —
   `tools/research/pool_concentration.py` + `data/mining_concentration.json`
   (block-tag attribution, mempool.space `/api/v1/mining/pools`, validated windows
   24h/3d/1w/1y, raw cached under `captured-data/mempool.space/`). First live
   reading: 24h top-1=23.3%, top-3=55.8%, top-5=76.7%, HHI 0.140, gini 0.539 — no
   boundary threshold crossed. **Historical leg stays D**: pre-2023 per-pool
   attribution, and pool-reported hashrate (ground truth) is not yet cross-checked
   against block attribution.
2. **Regional energy cost (row 13).** **AGGREGATE leg CLOSED 2026-09-16**
   (`tools/research/production_cost_ratio.py`: network energy cost vs miner
   revenue vs fee-market share; 2026 energy≈84% of revenue, fees≈0.7% of energy
   bill, grade C assumption-bound). **Regional granularity stays the D**: the
   Cambridge mining-map pool-country shares + regional electricity series are
   still not captured — that is the remaining piece for row 13 D→B.
3. **Historical node count (row 9).** **PARTIAL-CLOSED 2026-09-16**: two eras
    are now primary-anchored (2017-12-11 → N=11,891 via Wayback-archived
    bitnodes API; 2026 → N≈26,635 via btcnodes.io series). Grades row 9:
    live C → **B**, historical D → **C**. The remaining wedge is 2013-2016 /
    2018-2025 (no continuous primary source recovered; btcnodes retains only
    ~4 months, Wayback holds only the 2017-12 API capture). Still the
    historical wedge that most limits the Satoshi test.
4. **Verification Cost Index (row 7).** The THESIS.md §6 operationalization
   of the Satoshi claim. **Prototype shipped** (deterministic, scenario-limited):
   sync-time flat ~1-2 days 2013-2026; affordability 14%→30% of a month's
   income; value-relative cost collapsed ~17×. Hardening = captured IBD
   benchmark series + real UTXO set size (both currently assumptions).

---

## What moves a grade

| Action | Moves |
|---|---|
| New live capture (e.g., per-pool hashrate, IBD benchmark series) | row 11 (pool concentration): **D → C live** (done 2026-09-16); row 7: C live hardening |
| Pool-reported hashrate cross-check + historical per-pool attribution | row 11: C → B live, D → C historical |
| Historical SCCR reconstruction completes (fees+price+nodes+blocksize per era) | rows 1, 3, 4, 5: **now B** (fee/price/blocksize legs; era node-count leg stays C/D) — see `tools/research/sccr_historical_reconstruct.py` + `data/sccr_historical_series.json` |
| UTXO historical series pulled (indexer or scale-based reconstruction) | row 6: D → C — **blocked 2026-09-16**: no reachable UTXO-count source (see `utxo-series-reachability.md`); paths = synced local node `gettxoutsetinfo` or blockchair full scan |
| Node census protocol re-worked (sample > addrman cap, live inbound) | row 9: C → B — **DONE 2026-09-16** (btcnodes series replaces addrman cap; live now B) |
| Block-tag vs pool-reported hashrate cross-check | row 11: C → B live — **PARTIALLY DONE 2026-09-16**: internal coherence 7/7 + network-total 2.34% validated (`pool_attribution_validation.py`); full C→B still blocked on pool self-reported hashrate (unreachable — `pool-hashrate-reachability.md`) |
| Pruned-vs-archival probe (needs P2P egress) | row 9/5: T/N split — **DOCUMENTED READING** (no egress here; scope note filed) |
| Regional energy capture added | row 13: D → B — **aggregate leg DONE 2026-09-16 (row now C)**, regional granularity remains the open D |
| Any new reconstruction contradicts a boundary-catalog claim | update `research/boundary-catalog.md` and record the revision here |

When a grade changes, move it here with the date and the artifact that earned it (capture name, reconstruction doc, or PR).

---

## Feeding the catalog

The Boundary Catalog's per-event data grade column is derived from the
corresponding arrow rows above. A catalog event on an arrow graded D cannot be
read as calibrated — it is a documented reading with an open data door.

---

*Regeneration log: 2026-09-15 — created from live `data/*.json` captures and
`research/` documentation. 2026-09-15: historical SCCR reconstruction executed —
rows 1, 3, 4, 5 historical legs moved C/INCOMPLETE → B\* (era-fee/price/blocksize
from frozen daily aggregates; era node-count leg remains approximation). 2026-09-16:
pool concentration row 11 live leg moved D → C (mempool.space pool-list block-tag
attribution, four validated windows, raw cached; no boundary threshold crossed).
2026-09-16 (second): node census row 9 — live D→B / historical D→C. Live source =
btcnodes.io snapshot series (3,981 primary snapshots, ~26.6K reachable nodes;
addrman 32,000 recognized as a cap artifact). Historical: two era anchors (2017 → N
11,891 Wayback-archived; 2026 → N 26,635), SCCR N-table 2/14 rows primary-anchored.
2026-09-16 (third): regional energy row 13 aggregate leg D→C — network-wide production
cost instrument shipped (energy vs revenue vs fee-market share per era; 2026 energy≈84%
of revenue, fees≈0.7% of the energy bill). Efficiency table + electricity price are
documented assumptions (C); regional granularity remains D (Cambridge map not yet captured).
Next regeneration when the regional capture, a pool-reported hashrate cross-check, or a
measured network-average efficiency series lands.*