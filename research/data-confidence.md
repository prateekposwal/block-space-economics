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
| 1 | Fee market (fees sat/vB, per block) | **A** | **C** | Per-block history `fee_history_blocks.json`, `fee_history.json`; capture continuity Jul 31–Aug 22 + Sep 15 2026 | Pre-2026 archive reconstruction needed; 2017 spike (~400–500 sat/vB peak Dec 2017) from primary archives only | `data/fee_history*.json`, `research/boundary-event-2017.md` |
| 2 | USD price | **A** | **A** | `btc_price` in every `data/snapshot.json` capture; continuous daily series available back to 2010 from public APIs | — | `data/snapshot.json`, CoinGecko/archive APIs |
| 3 | Mempool pressure | **A** | **C** | `mempool_fee_histogram.json`, `mempool_tx` per snapshot; `block_interval.json` | Pre-2026 congestion episodes need archive reconstruction | `data/` |
| 4 | Block/state size | **A** | **C** | Block size/weight captured per block (Jul-Aug 2026 captures); `adoption.json` | Historical block-size series reconstructable from archives but not yet captured | `data/adoption.json`, captured spool |
| 5 | Storage cost coverage (SCCR) | **A** | **INCOMPLETE** | `sccr.json`, `sccr_latest.json`, `sccr_history.json`, model-spec v2.0.1, 3 independent implementations repro | `sccr_historical_series.json` status is **INCOMPLETE — data gaps prevent full reconstruction**; Q7-era claims are unverifiable | `data/sccr*.json`, `research/HISTORICAL_SCCR_RECONSTRUCTION.md` |
| 6 | UTXO cost (state persistence as externality) | **B** | **D** | `utxo_cost_ratio.json`: 144 blocks (966127–966270), avg UCIR 2.87, 84% of blocks above 1× | Pre-2016 UTXO series thin; earlier reconstruction only | `data/utxo_cost_ratio.json` |
| 7 | Validation/verification cost (VCI target) | **C** | **D** | `bandwidth_bound.json` (bounds), validation metrics in working paper; sync/IBD benchmarks not yet captured continuously | IBD time-vs-hardware series not captured; historical near-nothing | `research/bandwidth-bound-note.md`, `research/validation-cost.md` |
| 8 | Bandwidth/relay (propagation) | **C** | **D** | `bandwidth_bound.json` bounds (block + batch model) | Marginal propagation leg unbundled from fixed node cost; no topology data | `research/bandwidth-bound-note.md` |
| 9 | Node count / distribution | **C** | **D** | `node_census.json`: totalKnownAddresses **32,000 (exact addrman cap)**, liveConnections 8, lower_bound=true, 2026-08-02 | Denominator capped by addrman; live sample tiny; pre-2014 census estimates wide-error; counting methods changed over time. **The weakest pillar.** | `data/node_census.json`, `research/node-census-staleness-note.md` |
| 10 | Mining hashrate level | **B** | **B** | `hashrate.json`: 240 points from 2026-08-19 (~934 EH/s) | Historical difficulty/hashrate series recoverable from public archives (not yet pulled into repo) | `data/hashrate.json` |
| 11 | Mining pool concentration | **D** | **D** | `mining_concentration.json`: **all concentration metrics are None** — "per-pool hashrate data does not exist" | Pool share attribution partial; merged mining + solo invisible; nothing captured. **Critical gap.** | `data/mining_concentration.json`, `research/mining-concentration-note.md` |
| 12 | Governance signaling (BIP-110) | **A** | **B** | `bip110.json` + `bip110_daily.json` (full signaling series, 0% at lock-in, height 963648); 2017 signaling in primary archives | Pre-BIP-110 signaling requires archive reconstruction | `data/bip110*.json`, `research/bip110-post-lockin-case-study.md` |
| 13 | Regional production cost (energy) | **D** | **D** | Nothing captured | Would need mining-map power mix + regional electricity series. **Critical gap.** | — |

---

## Critical gaps (grade D, named as build-or-document decisions)

1. **Mining pool concentration (row 11).** The surviving dataset that would
   calibrate every power-concentration claim is not being captured. The
   existence of a publicly documented alternative (Cambridge Bitcoin Mining
   Map's pool attribution, or coinbase-tag-based attribution from
   `txtoolbox`-style indexers) means this is *retrievable* but **unmeasured today**.
   Until built, every concentration statement in the catalog must be flagged
   "measurement, not calibrated."
2. **Regional energy cost (row 13).** The "producing" side of the asymmetry
   question has no instrument. Energy prices + hashrate mix by region exist
   as public series but are not captured. D until then.
3. **Historical node count (row 9).** Pre-2014 node estimates are the
   historical D that most limits the Satoshi-test (THESIS.md §6) — add to the
   reconstruction backlog with the 2017 fee/spike work.
4. **Verification Cost Index (row 7).** The THESIS.md §6 operationalization
   of the Satoshi claim. Live D→C is achievable with IBD benchmarks + chain
   size captures; the historical leg stays D until reconstruction data lands.

---

## What moves a grade

| Action | Moves |
|---|---|
| New live capture (e.g., per-pool hashrate, IBD benchmark series) | row 11, 7: D → C/B census live captures |
| Historical SCCR reconstruction completes (fees+price+nodes+blocksize per era) | rows 1, 3, 4, 5: C/C/C/INCOMPLETE → B |
| UTXO historical series pulled (indexer or scale-based reconstruction) | row 6: D → C |
| Node census protocol re-worked (sample > addrman cap, live inbound) | row 9: C → B |
| Regional energy capture added | row 13: D → B (public series) |
| Any new reconstruction contradicts a boundary-catalog claim | update `research/boundary-catalog.md` and record the revision here |

When a grade changes, move it here with the date and the artifact that earned it (capture name, reconstruction doc, or PR).

---

## Feeding the catalog

The Boundary Catalog's per-event data grade column is derived from the
corresponding arrow rows above. A catalog event on an arrow graded D cannot be
read as calibrated — it is a documented reading with an open data door.

---

*Regeneration log: 2026-09-15 — created from live `data/*.json` captures and
`research/` documentation. Next regeneration scheduled when historical SCCR
reconstruction or a pool-concentration capture lands.*