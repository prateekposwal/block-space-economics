<!-- seo-title: Evidence Matrix — Observed, Reconstructed, Modelled -->

# Evidence Matrix

**BSAHI — every headline number, classified by how it was actually obtained.**
*Produced: 2026-09-17 · Checked by `tools/research/integrity_audit.py`*

## The three layers

| Layer | Definition | What it means for a reader |
|---|---|---|
| **Observed** | Read from a node, or from a frozen primary capture with a recorded date | Cite as measurement. Grade A/B. |
| **Reconstructed** | Derived by a stated procedure from anchors (interpolation, era means, attribution) | Cite as *procedure*, not as a measurement. Grade C/D. |
| **Modelled** | Assumptions dominate; the output is a scenario, not an observation | Cite as a scenario. Grade C. |

Nothing in this project may be presented as Observed if it is Reconstructed or
Modelled. The matrix is the enforcement: if a number appears anywhere without a
row here, that is a defect.

## Matrix

| # | Metric | Value / reading (as published) | Layer | Source | Date | Grade |
|---|---|---|---|---|---|---|
| 1 | **SCCR (live)** | {{SCCR}} · {{SCCR_BLOCKS}} blocks · {{SCCR_BELOW}}% below 1× · **N={{N}} (reachable nodes; validating; a floor)** · T={{T}}yr · spec {{SCCR_SPEC}} | Observed fee + measured N | `data/sccr.json` | 2026-09-17 | B |
| 2 | SCCR daily history | 36 daily readings | Observed | `data/sccr_history.json` | 2026-08-02 → 2026-09-16 | B |
| 3 | SCCR historical (era reconstruction) | era-level SCCR, 2010-2026 | **Reconstructed** | `data/sccr_historical_series.json` (daily aggregates → era legs) | frozen 2026-09 | B/C |
| 4 | Chain size (bytes to verify) | 789.45 GB (2026) | Observed | cumulative frozen `avg-block-size` (unit MB) | 2026 | B |
| 5 | UTXO / chain state | 0.5 GB (2013) → 11 GB (2025/26), era table | **Reconstructed** | anchors + interpolation (no continuous source) | — | **D** |
| 6 | **UTXO / chain state (observed)** | h671,462 · 72,234,156 UTXOs · 18,633,940 BTC · UTXO DB 4.39 GB | **Observed** | `gettxoutsetinfo` from a real Bitcoin Core node (`utxo_state_measure.py`) | captured 2026-09-17 | **A** |
| 7 | Mining difficulty | 127,450,789,715,844 | Observed | `data/difficulty_series.json` (frozen primary) | 2026-09-13 | A |
| 8 | Mempool congestion | 1,498 daily points, 2016-2026 | Observed | `data/mempool_congestion_series.json` (frozen primary) | 2026 | B* |
| 9 | Per-block samples | 3 blocks/era (2026: 2) | Observed (spot) | `data/perblock_validation.json` (esplora + blockchain.info) | 2026-09-16 | B (spot-check, not a survey) |
| 10 | Network hashrate | 956 TH/s·10⁶ (≈956 EH/s) | Observed | frozen `hash-rate` series (unit **TH/s**) | 2026 | B |
| 11 | Miners' revenue | 41.4M USD/day | Observed | frozen `miners-revenue` series (unit USD) | 2026 | B |
| 12 | **Production cost ratio** | reported across $0.03–$0.15/kWh | **Modelled** (observed legs + assumed price/efficiency) | `data/production_cost_ratio.json` | 2026-09-17 | C |
| 13 | Electricity price | $0.05/kWh (scenario $0.03–$0.15) | **Modelled** (assumption) | documented assumption | — | C |
| 14 | ASIC efficiency (network avg) | 25 J/TH (2026), era table | **Modelled** (estimate) | documented table | — | C |
| 15a | **Gossip-observed addresses** (addrman) | ≥32,000 learned addresses (request ceiling, returned in full) | Observed | `getnodeaddresses 32000` (`data/node_census.json`) — **addresses, not nodes** | 2026-08-02 | C |
| 15b | **Reachable nodes** (canonical `N` since 2026-09-17) | **26,586** | Observed | btcnodes reachable-node crawl (`data/node_census_series.json`, 3,981 snapshots) | 2026-09-16 | B |
| 15c | Non-listening / private nodes | **unobservable** remotely (evidence only via inbound peers: `-netinfo`); treated as an explicit **sensitivity band** at N=50K/80K/100K (SCCR 0.18/0.12/0.09) | — | `data/sccr_sensitivity.json → unpublicised_node_sensitivity` | 2026-09-17 | D |
| 15d | Total node population | **not observable** | — | — | — | — |
| 16 | Pool attribution | 7/7 pools coherent ≤1.5σ; network-total diff 2.34% | Observed | `data/pool_attribution_validation.json` | 2026-09-15 | C/B |
| 17 | Mining concentration | HHI/Gini/N_eff per window | Observed | `data/mining_concentration.json` | 2026-09-15 | B |
| 18 | BIP-110 signaling | lock-in h963,648 (2026-08-23 00:48:47 UTC); snapshot h966,270 | Observed | `data/bip110.json` (GH Actions) + blockstream.info | 2026-09-09 | A |
| 19 | Fee history / block interval | 95-point intraday series | Observed | `data/fee_history.json`, `data/block_interval.json` | 2026-09-17 | B |
| 20 | **Verification Cost Index** | trend (headline): sync time flat, value-relative cost ~17× cheaper | **Modelled** | `data/verify_cost_index.json` | 2026-09-17 | C |
| 21 | VCI chain leg | total bytes to verify | Observed | frozen `avg-block-size` | 2026 | B |
| 22 | VCI state leg | reconstructed UTXO table | **Reconstructed** | (falls back to row 5) | — | D |
| 23 | VCI throughput | assumed commodity archive-sync | **Modelled** | documented table | — | C |
| 24 | Node operator labour | $25/h, labour share | **Modelled** | documented assumption | — | D |
| 25 | Cost-to-flood leverage | L ≈ 3.0× (dust 0.9×) | **Modelled** | `research/cost-to-flood.md` | 2026-08-10 | C |
| 26 | Bandwidth bound | 52.6 GB/yr | Modelled | `data/bandwidth_bound.json` | 2026-08-04 | C |
| 27 | Pruning externality | download+verify unavoidable | Modelled | `research/pruning_externality_analysis.md` | 2026-08-10 | C |
| 28 | **Fee allocation** — security vs storage claim | security $198,549/block; storage L_net $5,628/block; fees $1,415/block | Modelled | `data/fee_allocation.json` | 2026-09-17 | C |
| 29 | Halving schedule (subsidy) | 3.125 → 0.78 (2032) → 0.049 (2048) BTC/block | Observed | arithmetic (210,000-block epochs) | — | A |
| 30 | **Activity partition of reachable nodes** | T1 23,949 (90.1%) serving+synced · T2 2,081 (7.8%) lagging · T3 547 (2.1%) no service announced | Observed | `data/verification_population.json → activity_partition` | 2026-09-16 | B (T4 C) || 31 | **Three independent population views** | crawler 26,586 nodes · DNS seeds 264 addresses · addrman 34,599 addresses | Observed | `verification_population.json`, `seed_census.json`, `addrman_churn.json` | 2026-09-17 | B/C |
## Grades

- **A** — direct primary measurement (node RPC, on-chain fact), dated.
- **B** — frozen primary capture with a recorded unit and date.
- **C** — model/estimate with documented assumptions; direction is the claim.
- **D** — reconstruction by interpolation with no continuous source.
- **\*** — B\* = primary series with a documented gap (e.g. pre-2016 congestion).

## Standing checks (run with the matrix)

`tools/research/integrity_audit.py` re-checks, on every run:

1. **Heights/dates monotonic** — every (height, timestamp) pair increases together.
2. **Anchors** — a height's *chain* date matches the known anchor; the *capture*
   time is recorded separately (they differ by years while the node is in IBD).
3. **Units** — derived unit fields agree with raw ones (`hashrate_ehs ==
   hashrate_ths/1e6`; power `TH/s × J/TH = W`; GB is decimal `1e9`).
4. **Provenance** — each dataset carries schema + generated_at + a source.
5. **Layers** — each dataset is classified Observed / Reconstructed / Modelled.

## Known open items (surfaced by the audit, not hidden)

- UTXO state is **Observed for one height only**; the 2013-2026 series remains
  Reconstructed (grade D) until the node reaches the tip and the series accrues.
- Several auxiliary datasets still lack an explicit `layer` field (ops/health and
  a few research files); the matrix row is the interim classification.
- Electricity price, ASIC efficiency, wage and throughput remain assumptions.

## How to use this page

Before publishing any number, find its row. If the layer is **Observed**, cite it
with its date. If it is **Reconstructed** or **Modelled**, cite the *procedure* and
the grade — never the level as if it were measured.
