# Historical SCCR Reconstruction — Evidence Report

**BSAHI Working Paper v2.2.0 — Historical SCCR Reconstruction (Rank 1 of BSAHI plan)**
*Prepared: 2026-09-09 | Author: BSAHI Research Council*
*Model-spec: v2.1.0 (canonical)*

---

## 1. EXECUTIVE SUMMARY

**The historical SCCR series cannot be independently reconstructed from existing BSAHI assets.** The Q7 partial observations (2017≈10.0, 2021≈8.0, 2023≈5.0, 2024≈4.8) stated in working-paper §10 Q7 are **unverifiable assertions** — they have no source data, no derivation script, and no historical fee/price/node captures backing them.

| Item | Status |
|---|---|
| Canonical SCCR formula | **Verified** — model-spec.json v2.1.0, L_net = $5,627.80/block at N=32K |
| 2026 live SCCR series | **Available** — 29 points, Aug 2–Sep 9, 2026 |
| Historical fee data (pre-2026) | **NOT AVAILABLE** — zero captures in repo |
| Historical BTC price data | **NOT AVAILABLE** — zero price series in repo |
| Historical node count (N) data | **NOT AVAILABLE** — N=32K is only the 2026-08-02 census |
| Q7 historical partials | **UNVERIFIED** — claims without evidence |
| **TEST RESULT** | **C (Broken)** — structural data gaps, not model failure |
| **GO/NO-GO for Step 2** | **CONDITIONAL NO-GO** — proceed only for 2026-regime measurement |

---

## 2. THE CANONICAL FORMULA (Verified)

From `research/model-spec.json` v2.1.0:

```
SCCR = fee_USD / L_net
L_net = C × T × N / R_blocks
R_blocks = 365.25 × 24 × 6 = 52,596 blocks/year
cb = C / (B_block × R_blocks) = 1.17246e-8 USD/(byte·yr)
L = cb × B_block × T = 0.175869 USD/block/node
L_net = L × N = 5,627.80 USD/block (at N=32,000)
```

**Verified by three independent implementations** (JS, Python, C) — `research/reproduce/README.md` confirms all three produce avg SCCR = 0.2186, min 0.0584, max 0.8320, 100% below 1× (171 blocks, 2026-08-02 freeze).

The formula is **sound and reproducible**. The problem is not model coherence — it is **data availability**.

---

## 3. THE Q7 CLAIMS — What They Assert

From `research/working-paper.md` §10 Q7 (and `research/future-directions-v3.md` §1):

> *"Historically yes: SCCR averaged **above 1×** in 2017–2024 fee-peak years (2017 avg ~10.0, 2021 ~8.0, 2023 ~5.0, 2024 ~4.8, **era-adjusted node counts**); 2025–2026 is the first sustained sub-1× regime"*

**Key observations about these claims:**

1. **"Era-adjusted node counts"** — The Q7 partials were NOT computed at N=32,000. They used different N values per era, but **no historical N values are provided anywhere in the repo**.

2. **No source data** — No historical fee captures, no BTC price series, no node census data.

3. **No derivation script** — `sccr_dynamics.py` computes Q1/Q4/Q5 (future scenarios), NOT historical SCCR. `backtest.py` only covers the UTXO cost model. `sccr_monte_carlo.py` and `sccr_monte_carlo_range.py` operate on current snapshots.

4. **Not measurements** — These are model calculations using unknown parameters, presented without the parameter values needed to verify them.

### Reverse-Engineering the Q7 Partials

Using the canonical formula and the Q7 claims:

| Era | Claimed SCCR | Required fee_USD/block (at N=32K) | Implied sat/vB (at BTC=$63K) |
|---|---|---|---|
| 2017 | 10.0 | $56,278 | ~89 sat/vB |
| 2021 | 8.0 | $45,022 | ~71 sat/vB |
| 2023 | 5.0 | $28,139 | ~45 sat/vB |
| 2024 | 4.8 | $27,013 | ~43 sat/vB |

**At N=32,000**, these fee levels are implausibly high for most blocks. The "era-adjusted node counts" language implies lower N values were used:

| Era | Claimed SCCR | If N=8,000 (2017 est.) | If N=15,000 (2023 est.) |
|---|---|---|---|
| 2017 | 10.0 | L_net=$1,407/fee=$14,070 | — |
| 2023 | 5.0 | — | L_net=$2,638/fee=$13,190 |

**The problem**: These N estimates (8K, 15K) are **general knowledge approximations, not repo evidence**. They cannot be cited as BSAHI findings.

---

## 4. DATA GAP AUDIT

### 4.1 What exists in the repo

| Data Asset | Date Range | Coverage | Usable for Historical SCCR? |
|---|---|---|---|
| `fee_history.json` | 2026-08-16 to 2026-08-22 | 14 days, fastestFee (sat/vB) | **No** — too recent, no aggregate fees |
| `sccr_history.json` | 2026-08-02 to 2026-09-09 | 29 live points | **No** — future data |
| `fee_history_capture.json` | 2026-08-02 era | ~171 blocks, heights 966094–966231 | **No** — single-day capture |
| `fee_history_blocks.json` | 2026-09-09 | ~144 blocks | **No** — recent data |
| `captured-data/bsahi.db` | 2026-07-30 to 2026-08-22 | ~17 days | **No** — too recent |
| `hashrate.json` | 2026-08-17 to 2026-09-09 | ~24 days | **No** — too recent |
| `block_interval.json` | 2026-08-25 to 2026-09-09 | ~15 days | **No** — too recent |
| `fee_forecast.json` | 2026-08-16 to 2026-08-22 | 67 data points | **No** — too recent |
| `node_census.json` | 2026-08-02 | Single point, N=32,000 | **No** — single date |
| `bip110.json` | 2026-08-10 to 2026-09-09 | BIP-110 signaling | **No** — unrelated |
| `backtest.py` | 2023 scenario | UTXO cost model only | **No** — different model |
| `sccr_dynamics.py` | Future scenarios | Q1/Q4/Q5 computations | **No** — forward-looking |
| `sccr_monte_carlo.py` | Current snapshot | 10K draws on live data | **No** — current only |

### 4.2 What live APIs can provide (tested 2026-09-09)

| API | Reachable? | Historical Data Available? | Aggregate Fees per Block? |
|---|---|---|---|
| Blockstream.info | ✅ Yes | Blocks back to genesis | **No** — block headers only (size, tx_count, timestamp) |
| Mempool.space | ❌ Not reachable | N/A | N/A |
| CoinGecko | ❌ Error response | N/A | N/A |

**Critical limitation**: Blockstream's `/api/block/<hash>` endpoint returns block metadata but NOT aggregate fee data. To compute fee_USD per block, one would need to fetch every transaction in every historical block and sum fees — for a block with 2,000+ transactions, this requires thousands of API requests per year of data. **This is impractical for a multi-year reconstruction.**

### 4.3 The honest assessment

**No historical fee data, BTC price data, or node count data exists in the BSAHI repo or is reliably fetchable from live APIs in bulk.** The Q7 partials are unverifiable.

---

## 5. THE RECONSTRUCTION (What Can Be Built)

### 5.1 Framework built: `tools/research/sccr_historical.py`

This script:
1. Computes the canonical L_net = $5,627.80/block (at N=32K) ✓
2. Reverse-engineers what fee_USD would produce the Q7 partials ✓
3. Analyzes the "era-adjusted node count" implication ✓
4. Documents all data gaps ✓
5. Outputs `data/sccr_historical_series.json` ✓
6. Provides era-by-era reconstructability assessment ✓

### 5.2 Output: `data/sccr_historical_series.json`

Contains:
- All 10 eras (2013–2026) with reconstructability flags
- 9 documented data gaps
- Q7 claims verbatim with verification status
- Canonical constants and formula references
- **Every era marked `reconstructable: False` except 2026 (partial)**

---

## 6. COMPARISON AGAINST EXISTING PARTIALS

| Partial | Value | Source | Reproducible from Repo? | Corroborated? |
|---|---|---|---|---|
| 2017 avg SCCR | ~10.0 | working-paper §10 Q7 | ❌ No | ❌ No |
| 2021 avg SCCR | ~8.0 | working-paper §10 Q7 | ❌ No | ❌ No |
| 2023 avg SCCR | ~5.0 | working-paper §10 Q7 | ❌ No | ❌ No |
| 2024 avg SCCR | ~4.8 | working-paper §10 Q7 | ❌ No | ❌ No |
| 2026-08-02 baseline | 0.2186 | reproduce.py (3 implementations) | ✅ Yes | ✅ Yes |
| 2026 live range | 0.157–0.451 | sccr_history.json (29 points) | ✅ Yes | ✅ Yes |

**Verdict**: The 2026 measurements are fully reproducible. The historical partials are not.

---

## 7. THE TEST RESULT

### Does SCCR survive historical reconstruction?

**RESULT: C (Broken) — structural problems**

The SCCR *formula* survives — it is mathematically sound, internally consistent, and independently reproducible for the 2026 regime. But the *historical reconstruction* is broken:

1. **No historical data exists** — Zero pre-2026 fee, price, or node-count captures in the repo.
2. **Live APIs cannot bulk-fetch historical fees** — Blockstream provides headers only; per-transaction fee aggregation is impractical at scale.
3. **Q7 partials are unverifiable assertions** — Stated as facts with "era-adjusted node counts" but no N values, no source captures, no derivation scripts.
4. **The 'era-adjusted' language is a red flag** — It implies the partials were computed with different N per era, but the N values are undocumented. Without them, the formula cannot be evaluated.
5. **No script in the repo computes historical SCCR** — `sccr_dynamics.py` does future scenarios; `backtest.py` does UTXO cost; `sccr_monte_carlo.py` does current snapshots.

**This is not a failure of the SCCR concept** — it is a failure of the evidence chain. The framework is sound; the historical data simply doesn't exist.

---

## 8. GO/NO-GO FOR STEP 2 (BIP-110 CASE STUDY)

**CONDITIONAL NO-GO**

### What CAN proceed:
- **BIP-110 measurement at current regime (2026)** — the live SCCR data, the canonical formula, and the reproduction pipeline are all ready. Step 2 can measure BIP-110's impact on SCCR using the 2026 data that exists.
- **BIP-110 pre/post protocol design** — the measurement methodology (fee_USD / L_net) is well-defined and reproducible.

### What CANNOT proceed:
- **BIP-110 historical comparison** — without historical SCCR data, there is no baseline to compare BIP-110 against. The claim that "SCCR was above 1× in 2017–2024" is unverifiable and cannot serve as a historical reference point.
- **BIP-110 regime-shift analysis** — without multi-year SCCR data, the question "does BIP-110 push SCCR back above 1×?" cannot be answered empirically.

### Recommendation:
Step 2 should be **scoped to current-regime BIP-110 measurement** using 2026 live data. The historical comparison should be deferred until a dedicated data-collection effort produces verified historical fee, price, and node-count series. The Q7 partials should be either (a) sourced and documented as model calculations with full parameter disclosure, or (b) removed from the paper until verified.

---

## 9. BSAHI_FUTURE_RESEARCH_BACKLOG.md — Concepts and Status

The following ambitious concepts from the master spec are categorized by current status:

| Concept | Status | Data Required | Next Step |
|---|---|---|---|
| **Historical SCCR series** | **IDEA → DATA REQUIRED** | Historical fee captures (sat/vB per block), BTC price history, node count estimates per era, block size history | Build data collection pipeline from Blockstream/CoinGecko APIs |
| **Consensus Distance** | IDEA | UTXO growth rate, state size, validation cost | Design measurement protocol |
| **Validation Lag** | IDEA | Per-block validation time benchmarks, hardware census | Pin Core benchmark (`src/bench`) |
| **Attack Option Value** | IDEA | Fee market data across congestion regimes, MEV extraction data | Model the option value of front-running |
| **Hashpower Mobility** | IDEA | Miner hashrate distribution over time, geographic data | Collect mining pool data |
| **Verification Frontier** | IDEA | Full node cost decomposition, bandwidth measurements | Measure per-node bandwidth costs |
| **Capability Asymmetry** | IDEA | Node software diversity metrics, relay topology | Survey node implementations |
| **Fork DNA** | IDEA | Historical fork data, miner signaling patterns | Analyze BIP-9/BIP-8 signaling history |
| **Pruned vs. Archival Split** | DATA REQUIRED | Node retention distribution survey | Design census methodology (see `research/archival-vs-pruned-note.md`) |
| **External Reproduction (D5)** | OPEN BLOCKER | Independent reproducer | Recruit external party, provide `research/reproduce/` protocol |
| **Node Count Complete Census** | DATA REQUIRED | Full addrman enumeration, independent estimates | Fund/organize a proper node census |
| **Discounting Sensitivity** | ANALYZED | Discount rate estimates | Document in model-spec (§7 item 4) |
| **BIP-110 Pre/Post Protocol** | DESIGNED | BIP-110 activation timeline, fee measurement | Build measurement harness using live data |
| **v3.0 Economic Dynamics** | PROGRAM | Dynamic model of N↔fees↔price feedback | `research/future-directions-v3.md` §2 |
| **Cross-Chain Generalization** | PROGRAM | Alternative blockchain resource data | `research/future-directions-v3.md` §3 |

### Backlog file: `BSAHI_FUTURE_RESEARCH_BACKLOG.md`

The concepts above should be written to a dedicated backlog file. The master spec's ambitious concepts (Attack Option Value, Fork DNA, etc.) are **IDEA-level** — they have not been researched, have no data, and should not be implemented until the foundational data gaps are closed.

---

## 10. BOTTOM LINE

**The BSAHI bridge to a predictive observatory is NOT yet earned for the historical dimension.** The canonical SCCR formula is sound and reproducible (verified across 3 implementations), and the 2026 live measurement is solid. But the historical claim that "SCCR averaged above 1× in 2017–2024" is an **unverifiable assertion** — it has no source data, no derivation, and no historical captures. The BIP-110 case study should proceed with current-regime measurement only, and the historical partials should be flagged as requiring data collection before they can serve as evidence.

**One sentence**: The model works; the historical evidence doesn't exist yet. Build the data pipeline first.

---

## APPENDIX: Files Created

1. `tools/research/sccr_historical.py` — Reconstruction framework
2. `data/sccr_historical_series.json` — Structured output with all eras and gaps
3. `research/HISTORICAL_SCCR_RECONSTRUCTION.md` — This report
4. `BSAHI_FUTURE_RESEARCH_BACKLOG.md` — (recommended) Backlog of concepts

## APPENDIX: Source Files Read

- `research/model-spec.json` v2.1.0 — Canonical SCCR formula and quantities
- `research/working-paper.md` v2.2.0 — §10 Q7 historical claims, §5.4 knife-edge
- `research/future-directions-v3.md` — v3.0 agenda, Q7 verbatim
- `research/backtest.py` — 2023 UTXO cost model (NOT SCCR)
- `research/sccr_dynamics.py` — Q1/Q4/Q5 future scenarios
- `research/sccr_monte_carlo.py` — Current snapshot MC
- `research/sccr_monte_carlo_range.py` — Current-N-band MC
- `research/sensitivity.py` — Inscription cost sensitivity
- `research/reproduce/reproduce_sccr.py` — 3-language reproduction
- `research/reproduce/README.md` — Reproduction protocol
- `data/fee_history.json` — 2026-08-16 to 2026-08-22 only
- `data/sccr_history.json` — 29 points, 2026-08-02 to 2026-09-09
- `data/fee_history_capture.json` — 171 blocks, 2026-08-02 era
- `data/fee_history_blocks.json` — Latest 144 blocks
- `data/node_census.json` — N=32K as of 2026-08-02
- `data/sccr.json` / `sccr_latest.json` — 2026-09-09 single point
- `data/bip110.json` — BIP-110 signaling data
- `data/hashrate.json` — 2026-08-17 to 2026-09-09
- `tools/research/reproduce.py` — One-command reproduction
- `tools/db/` — Database schema and backfill tools
- `captured-data/` — 2026-07-30 to 2026-08-22 captures only

---

*Report generated by BSAHI Historical SCCR Reconstruction. All findings are based on existing repo assets. No historical data was fabricated.*
