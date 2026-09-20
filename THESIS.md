# BitcoinSahi — Thesis, Boundary Classes, and the Instrument Map

> Source of truth for *why* BitcoinSahi exists and *what it measures*. The
> README is the engineering entry point; this file is the research frame.
> Keep the single question and boundary classes in sync across both.

---

## 1. The single thesis

**BitcoinSahi is a Bitcoin "stress & boundary observatory" that measures what
Bitcoin costs to operate, verify, secure and coordinate — and studies when
increasing resource costs or concentration of power can push the system toward
a measurable boundary.**

**Single question (the question every instrument answers):**

> **How much stress can Bitcoin absorb before the cost of participating,
> verifying, producing, or coordinating becomes meaningfully asymmetric?**

Everything else — SCCR, Cost-to-Flood, Capacity, Fork-tracker, the node census,
BIP-110, Satoshi's node-burden claim, governance boundaries, forecasting — is
**evidence used to answer that one question**, never a product on its own.

**Discipline (hard rule):** don't build every box yet. Prove each relationship
with evidence before adding the next instrument. The site is a single
instrument that gradually learns an answer, not fifty dashboards.

## 2. The core loop

```
Bitcoin activity → resource burden → economic cost → power concentration
                → verification/coordination → network stress → boundary
```

Each arrow is a **claim about a measurable relationship**. An arrow has
"passed" only when we have longitudinal data showing it, not when we can
describe it plausibly. This is why the historical reconstruction is the first
priority: the arrows can only be calibrated on history before they are trusted
live.

## 3. Historical first — the TELOS decision

Reconstructing the historical SCCR series before building new instruments is
the correct sequence. Rationale:

1. Live-only measurement is a dashboard. Calibration needs the past.
2. The 2017 / 2021 / 2023 stress episodes only mean something relative to a
   reconstructed baseline.
3. Existing partial observations are **unverifiable assertions** until backed by
   source data, a derivation script, and captured inputs (see
   [`research/HISTORICAL_SCCR_RECONSTRUCTION.md`](research/HISTORICAL_SCCR_RECONSTRUCTION.md),
   the Rank-1 plan).

The reconstruction is also the first artifact worth publishing **as a dataset**,
not just as a chart: methodology + inputs + confidence grading, citable by
others. That is what turns a site into a research instrument.

## 4. Boundary classes

"Do we touch a boundary?" has to be asked per class, never as one composite
number. The historical events that are usually cited together (BIP66, 2017,
BCH/BSV, 2013) stressed **different dimensions**. Collapsing them into a single
boundary index retro-fits labels onto history.

### 4.1 Technical-viability boundary
*The system cannot technically sustain the next unit of activity.*

- Stress vector: block/state size vs. validation + propagation capacity.
- Historical anchors: block-size ceiling debates, BIP66, relay/bootstrapping stress.
- Live proxies: validation cost per block, time-to-verify, IBD time, bandwidth per block.
- Current status: **partial data** (bandwidth notes exist; historical series thin).

### 4.2 Economic-coordination boundary
*The cost of producing/coordinating the chain exceeds what participants will pay.*

- Stress vector: fee level relative to cost to mine, relay, and index.
- Historical anchors: 2017 fee spikes, fee-market dominance shifts.
- Live proxies: Cost-to-Flood, fee-history capture, SCCR.
- Current status: **best-covered class today** (live captures, working paper).

### 4.3 Governance boundary
*The system cannot reach agreement on a direction change without a split or stalemate.*

- Stress vector: contested protocol change, block-size or supply policy conflict.
- Historical anchors: 2010 rule change, BCH/BSV, BIP-110 post-lock-in.
- Live proxies: Fork-tracker, governance-boundary research page, node census.
- Current status: **documented for specific events**, not yet a live series.

### 4.4 Verification-access boundary
*Independently verifying the chain becomes a specialist activity.*

- Stress vector: time and money to fully verify vs. the value of verification.
- Historical anchor: Satoshi's node-burden prediction (Section 6).
- Live proxies: VCI prototype (chain size + era-scaled sync scenario), node census.
- Current status: the class with the clearest hypothesis; VCI prototype now gives a first reading (sync time ~1-2 days, value-relative cost collapsed ~17x) — hardening still needs a captured IBD-benchmark series.

Each class gets its own boundary diagnosis ("absorbed / reset / persisted")
per historical event. See the Boundary Catalog task (Section 8).

## 5. Data-confidence matrix (skeleton)

Every arrow is graded A (solid longitudinal data) to D (thin or contested).
This matrix is the honest front page of the instrument. Grades move when a new
capture or reconstruction lands.

| Domain | Grade | What exists | Known gap / noise |
|---|---|---|---|
| Fee market + USD price | **A** | Live per-block capture (17 endpoints, `captured-data/bsahi.db`), frozen reproduce inputs | none material |
| Block/state size (current) | **A** | Live captures, capacity page | — |
| Block/state size (historical) | **C** | Archive-derived estimates | pre-2016 series needs reconstruction |
| Node count | **B/D** | Reachable-node crawl (btcnodes) measures N=26,586; the local addrman sample counts ADDRESSES, not nodes | Listening-only; pre-2014 estimates wide error. Total population remains grade D. |
| Mining concentration | **C** | Pool share data, recent years | Pre-2013 partial; merged mining + solo miners invisible |
| UTXO set (current) | **B** | Indexer captures | full historical UTXO series thin pre-2016 |
| Verification cost (live) | **B** | Time-to-IBD hardware benchmarks, size data | to be captured continuously |
| Verification cost (historical) | **D** | Near nothing | needs reconstruction; unbundled from total node cost |
| Bandwidth/relay cost | **C** | `bandwidth-bound-note.md` | marginal propagation cost unbundled from fixed node cost |
| Regional production cost (energy) | **D** | none captured | would need mining map + electricity price series |

Rules of the matrix: a grade is attached to a **dated capture or citation**;
the matrix is regenerated, never hand-waved; any arrow whose grade is D may run
live but is labeled "measurement, not calibrated."

The full graded matrix (13 arrows, live + historical, filed sources) lives in
[`research/data-confidence.md`](research/data-confidence.md).

## 6. The Satoshi test (the strongest falsifiable claim)

Satoshi's emails predict that increasing node burden pushes verification toward
specialist infrastructure:

> "The more burden it is to run a node, the fewer nodes there will be. Those
> few nodes will be big server farms."

BitcoinSahi operationalizes this instead of asserting it:

**Hypothesis:** as the cost/time to independently verify the full chain rises,
the share of participants who can practically verify falls, and verification
concentrates toward specialist infrastructure.

**Confound to design around:** burden rose, but commodity hardware got cheap,
IBD got optimized, and pruning exists. So the naive "more burden, fewer nodes"
test is wrong. The measured quantity is:

> **What does it cost, in time and money, for one person to independently
> verify the full chain state, and is that cost growing faster or slower than
> the economic value of verification?**

That is the **Verification Cost Index (VCI)** — the natural successor to
Cost-to-Flood and the first instrument for the Verification-access class. It
is also the axis that makes "meaningfully asymmetric" measurable: when the
time value of verification diverges from the value of what is verified, access
is no longer symmetrical.

## 7. Arrow → instrument map (what ships today, what is missing)

| Loop step | Shipped | File / page | Gap |
|---|---|---|---|
| Resource burden (storage/state) | SCCR (Metric #1, RIR family) | `research/working-paper.md`, `/sccr` captures, capacity page | historical SCCR (Rank 1, TELOS) |
| Resource burden (bandwidth) | note only | `research/bandwidth-bound-note.md` | live bandwidth-per-block capture |
| Economic cost | Cost-to-Flood | `research/cost-to-flood.html` | generalize to Cost-to-Verify / Cost-to-Use |
| Power concentration | Fork-tracker (BIP-110), governance boundary | `/fork-tracker`, `research/governance-boundary.html` | marginal-concentration series (new hashrate/UTXOs/fees) |
| Verification/coordination | Node census (N=26,586), bip110 case study | `data/node_census_series.json`, `research/bip110-post-lockin-case-study.md` | VCI index (build) |
| Network stress | Live dashboard | `/live` | historical stress reconstruction |
| Boundary | boundary catalog (10 events) | [`research/boundary-catalog.md`](research/boundary-catalog.md), `research/boundary-event-2017.md` | add events as data-grade improves |
| Production cost (energy/regional) | none | — | mining map + electricity series (build) |

## 8. Immediate scope (do these next, in order)

1. **Full data-confidence matrix** — DONE. 13 arrows, dual live/historical grades, filed against current `data/*.json` captures. Critical gaps named: mining pool concentration (D, uncaptured), regional energy (D, uncaptured), historical node count (D), VCI (D). See [`research/data-confidence.md`](research/data-confidence.md).
2. **Boundary Catalog** — DONE: 10 events, each with boundary class, stress vector, surviving data, resolution, outcome, and a falsifiable claim; cross-referenced to the full 2017 and BIP-110 studies. See [`research/boundary-catalog.md`](research/boundary-catalog.md). This is the calibration set for every future index.
3. **Historical SCCR reconstruction** — DONE (reconstruction-estimate, not measurement). 14 eras computed deterministically from frozen daily aggregates (`tools/research/sccr_historical_reconstruct.py`, `data/sccr_historical_series.json`, addendum in `research/HISTORICAL_SCCR_RECONSTRUCTION.md`). Q7 verdict: 2021/2023 reproduce within 50%; 2017 and 2024 do not. Era node-count leg remains an approximation (grade C/D) until a primary historical census lands.
4. **VCI prototype** — DONE (scenario-limited). `tools/research/verify_cost_index.py` + `data/verify_cost_index.json`: per-era chain/state size → sync days, cost, affordability, and cost-as-ppm-of-annual-value. Reading: sync time stayed ~1-2 days 2013-2026; affordability rose 14%→30% of a month's income; value-relative cost collapsed ~17×. Hardening = captured IBD benchmarks + real UTXO size (now assumptions). Grade C live / D historical.

5. **Tier-1 calibration gaps (data-confidence §"Critical gaps")** — **IN PROGRESS** (items 1–3 of the matrix's critical gaps are now being closed, the gate in §8.6 having opened once items 1–3 above shipped):
   - Pool concentration (row 11) — **live gap CLOSED 2026-09-16**: measured, no threshold crossed, grade D→C live. 2026-09-16 (validation): 7/7 pools coherent ≤1.5σ, network-total blockchair↔mempool 2.34% — **C→B blocked on pool self-reported hashrate (unreachable; documented)**.
   - Primary historical node census (row 9) — **PARTIAL-CLOSED 2026-09-16**: btcnodes.io series (3,981 snapshots, ~26.6K reachable, live grade D→B); two era anchors (2017→11,891, 2026→26,635); grading row 9 historical D→C. Deep 2013-2016 / 2018-2025 remains open.
   - Pruned-vs-archival split (row 9 companion) — **DOCUMENTED READING 2026-09-16**: not remotely observable; P2P egress blocked here; scope note filed, no split fabricated.
   - Regional energy (row 13) — **aggregate leg DONE 2026-09-16** (production-cost instrument: 2026 energy ≈ 84% of miner revenue, fees ≈ 0.7% of the energy bill; grade C assumption-bound). Regional granularity stays D (Cambridge map capture pending).
   - UTXO series / VCI hardening (rows 6+7) — **reachability filed 2026-09-16** (`utxo-series-reachability.md`): continuous historical UTXO count not obtainable from this environment (CoinMetrics no metric, blockchair rate-limited, others unreachable). VCI chain leg cross-checked 2.7% vs blockchair. D holds until a synced local node (`gettxoutsetinfo`) or blockchair full scan.
   - Difficulty + mempool-congestion (rows 10, 3) — **historical legs DONE 2026-09-16**: difficulty frozen 2009→2026 (row 10 hist B→A); mempool-count/size frozen 2016-06→2026 with per-era congestion reads (row 3 hist B→B\*). Peak-congestion era = 2024 (96.6% days >50K txs).

The §8.5 gate is upstream: nothing past item 5 gets scheduled until the Tier-1
gaps are measured or explicitly documented as deferred. (Gate satisfied for
items 1–3 of §8: matrix, catalog, and SCCR reconstruction all shipped. Tier-1
calibration gaps as of 2026-09-16: pool concentration **measured**; node census
**measured**; pruned-vs-archival **documented reading**; regional energy
**aggregate measured**, regional granularity **deferred-open**.)

## 9. What this is not

- Not a "decentralization score" — concentration matter only as a vector
  toward a boundary class, not as a beauty contest.
- Not a prediction engine — boundary is diagnosed post-hoc until the
  calibration set (items 1–3) earns a predictive claim.
- Not fifty boxes — one instrument, one question.

© 2026 Prateek Poswal. Research text licensed under CC BY 4.0.