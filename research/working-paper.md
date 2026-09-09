# Storage Cost Internalization in Bitcoin's Fee Market

**The Bitcoin Block Space Problem** — BSAHI Working Paper v2.2.0 (model-spec.json v2.0.1)
*Prepared by Prateek Poswal (Independent Researcher) within the Bitcoin Sahi Research Council program · ORCID: 0009-0005-2139-1877 · 2026-08-03*

*This work is licensed under a Creative Commons Attribution 4.0 International License (CC BY 4.0). To view a copy, visit https://creativecommons.org/licenses/by/4.0/.*

---

## Abstract

Bitcoin has a market price for block space, but no explicit market price for long-lived resource consumption. This paper measures one of those resources — replicated storage — and asks how much of its modeled cost is covered by transaction fees. We define a **Storage Cost Coverage Ratio (SCCR)** — the ratio of transaction fees paid (USD) to the estimated lifetime storage cost borne by full nodes (USD) — and measure it against live fee-history data.

**The headline is a range, not a point.** Our best available measurement of the replication factor N (full-node count) is a **primary-source lower-bound census (≥32,000 known addresses via Bitcoin Core `getnodeaddresses`)** — the address-manager cap, not a complete enumeration — while independent estimates span **~10K–100K** reachable nodes. Because SCCR is exactly inverse-linear in N, the result is stated in four lines (exact figures appear in the table below and §5.1):

- **Dated baseline band (Aug 02–15): ≈0.22 coverage at N=32K**, with ~100% of sampled blocks below 1× storage cost (exact figures in the table below and §5.1).
- **Live series (Sep 07): 0.40 at N=32K, 94.37% of blocks below 1×** — the coverage ratio is **fee-market-driven and time-varying**, not a fixed point.
- **Dynamic finding:** SCCR moved **0.16 → 0.45 → 0.40** across a **22-point daily series (2026-08-02 → 2026-09-07)** measured live in `data/sccr_history.json` — dynamic measurement strengthens, not weakens, the paper.
- **Model uncertainty: depends strongly on the replication factor N** — the average spans **~0.71 at N=10K to ~0.07 at N=100K**; this N-band range (~0.07–0.71) is a *different* uncertainty from the dated/live observations above and carries the dominant risk.

A joint Monte Carlo over N, C, T, and price (current band, 10,000 draws) gives a P5–P95 interval of **0.07–0.47**, median 0.17, with **99.9% of draws below the 1× threshold**; the share of sampled blocks below 1× ranges ~79–100% depending on the true N. We reconcile two cost models that previously disagreed by 16.4× (dimensionless), document the correction transparently (model-spec.json v2.0.0), and state results to the precision the evidence licenses: **external reproduction is pending (D5)**. The framework is reproducible, falsifiable research.

**Hypothesis:** Bitcoin's fee market efficiently allocates scarce block space, but may not fully internalize every long-lived resource cost created by confirmed transactions.

**Final numbers at a glance** — the headline in four lines, exact figures (all captures dated; model-spec v2.0.1; the full derivation is §4–§5, the sensitivity and knife-edge details are §5.3–§5.4, and the falsifiers are §7.1):

| Quantity | Value |
|---|---|
| **Dated baseline band** ≈0.22 — SCCR at N=32K, Aug 02–15 (primary-source lower-bound census) | **0.2243** (2026-08-02, 153 blocks) · **0.2840** (2026-08-03) · **0.2611** (2026-08-04) · **0.2095** (2026-08-15) — see `data/sccr_history.json` |
| **Live series (Sep 07)** — SCCR at N=32K | **0.3999** (142 blocks, **94.37% below 1×**, `data/sccr.json`) · series range **0.1574 (Aug 16) → 0.4508 (Aug 21) → 0.3999 (Sep 07)** across 22 points (`data/sccr_history.json`) |
| **Model uncertainty** — depends strongly on the replication factor N (independent estimates N = 10K–100K) | **~0.07 – ~0.71** (inverse-linear in N: 0.713 at N=10K, 0.0713 at N=100K at the live baseline) |
| Monte Carlo confidence interval (current band: N ~ Tri(10K, 100K, mode 32K), 10,000 draws, live anchor) | **P5–P95: 0.07 – 0.47** · median 0.17 · **99.9% of draws below 1×** |
| Blocks below 1× | **94.37%** (live series, Sep 07, N=32K) vs ~100% (dated Aug 02–15 baseline, N=32K); ~79% at N=10K, 100% at N≥32K |
| External reproduction | **PENDING (D5)** — independent runs requested; every figure above is stated to the precision the evidence licenses |

---

## 1. Introduction: Congestion Pricing vs. Permanence Cost

The one-sentence frame (full treatment in `problem_statement.md`):

> **Bitcoin's fee market prices competition for inclusion in the next block, but it does not explicitly price the long-term resource costs of permanently recorded blockchain data.**

The fee market solves a short-term optimization problem extremely well: during congestion, higher fees win block space. This is **congestion pricing**, with a horizon of roughly one block (~10 min). Storage cost is structurally different:

- **One-time payment** (the fee, USD/block) vs. **recurring cost** (long-term replicated storage across the network, USD/(node·yr))
- **Payer chooses** to pay vs. **node operators bear** the cost involuntarily
- **~10-min horizon** (next block) vs. **indefinite horizon** (data persists in blockchain history)

**Scope:** this paper measures the **storage leg** of a broader resource-pricing question. Bandwidth, validation, and UTXO-maintenance legs are future work (see §7).

**Where storage sits — the Bitcoin Resource Map (Figure 1).** One picture of
the whole framework before the model starts, so the reader can place the storage
leg (and the five unmeasured legs) at a glance:

```
                        ┌───────────────────────────┐
                        │    BITCOIN FEE MARKET     │
                        │  one price · sat/vbyte ·  │
                        │      next block only      │
                        └─────────────┬─────────────┘
                                      │
                   ┌──────────────────┴────────────────┐
                   │                                   │
      ┌────────────▼────────────┐      ┌───────────────▼───────────────┐
      │     DIRECTLY PRICED     │      │      INDIRECTLY MEASURED      │
      │   (the market clears)   │      │    (measured, not priced)     │
      └────────────┬────────────┘      └───────────────┬───────────────┘
                   │                                   │
                   ▼                                   ▼
      ┌─────────────────────────┐     ┌────────────────┬────────────────┐
      │       BLOCK SPACE       │     │    STORAGE (SCCR) — MEASURED    │
      │congestion · the one good│     │ 0.22-0.29 @ N=32K · 99-100% <1x │
      │  the fee market prices  │     │ ──────────────────────────────  │
      │    (~10-min horizon)    │     │      UTXO (UCIR) — FUTURE       │
      │                         │     │   VALIDATION (VCIR) — FUTURE    │
      └─────────────────────────┘     │      RELAY (RCIR) — FUTURE      │
                                      │    BANDWIDTH (BCIR) — FUTURE    │
                                      └─────────────────────────────────┘
```

*Figure 1 — The Bitcoin Resource Map. The fee market **directly prices** one
good — block space (congestion, ~10-min horizon). Every other long-lived
resource is **indirectly measured** against that price: storage is the first
measured leg (SCCR, this paper); UTXO state, validation, relay, and bandwidth
are named **research hypotheses, not results** — none measured yet. The
Directly-Priced / Indirectly-Measured split is the framework's visual anchor.
(SVG version for the site: `research/resource-map.svg`; ASCII asset:
`research/resource-map.txt`.)*

**Why storage? It is not the "most important" resource — it is simply the first measurable one.** The program's discipline is: take the resource with a reproducible cost estimate and a live fee attribution, measure it, and leave the rest to the roadmap (RIR family, §7 and `roadmap.md` Phase II). Storage qualified first because its cost leg (`C`, `N`, `T`) and its fee leg (block fees, USD) are both estimable from primary sources. Every other resource is a named research hypothesis, not a measured result.

**Storage ≠ state.** SCCR measures the cost of replicated **history** — the permanent record of confirmed blocks retained by full nodes. It does *not* measure the **UTXO set**, the live ledger state every node maintains in RAM and index structures. State permanence is a separate resource with its own accounting leg (UCIR, §7 / `roadmap.md` Phase II); this paper's storage leg must not be read as a state-cost measurement.

**1× is a descriptive calibration point, not a normative target.** Stated at the outset so no reader mistakes the paper for a claim that fees *should* cover 100% of modeled storage cost. The paper measures whether they do; it prescribes nothing. The thresholds in §5.4 are reference points on that measurement, not policy targets.

## 2. What We're NOT Saying

- ❌ Not proposing a fix
- ❌ Not claiming the externality is economically significant at current volumes (it may not be)
- ❌ Not claiming the SegWit discount was a mistake (it solved transaction malleability)
- ❌ **Not arguing that Bitcoin is 'broken'** — the fee market solves block-space allocation well; whether it internalizes long-lived resource costs is an empirical question
- ❌ **Not claiming fees *should* cover 100% of storage cost** — the 1× threshold is a descriptive calibration point, not a normative target (§1, §5.4)
- ✅ Just framing the question clearly and measurably

## 3. The SegWit Pricing Structure

SegWit (BIP 141, activated August 2017) introduced block weight: witness data counts **1 weight unit (WU) per byte**, non-witness data **4 WU per byte**. This **4:1 (dimensionless) discount** reduces the marginal block-space cost of witness-resident data relative to non-witness data. Years later, inscription protocols (Ordinals, BRC-20, Runes) took advantage of that pricing structure.

Two precise caveats (full treatment in `bip141_analysis.md`):
1. The discount applies to **all** witness data — SegWit financial transactions benefit identically. The "accident" is that it also subsidizes data-bearing constructions, not that SegWit was designed for them.
2. Whether the discount appropriately reflects the long-term resource costs of the data it makes cheaper is **part of the research question**, not a foregone conclusion.

## 4. The Model

### 4.1 Canonical specification

All quantities, units, and formulas live in **`research/model-spec.json` (v2.0.1)** — a single canonical source that every script imports. No script redefines a model constant.

| Quantity | Symbol | Units | Value | Source |
|---|---|---|---|---|
| Annual node cost | C | USD/yr | 925 | `utxo_cost_model` component sum (924.35) rounded |
| Replication factor | N | nodes | 32,000 | primary-source lower-bound census (≥32,000 known addresses via Bitcoin Core `getnodeaddresses`; addrman-saturated — **a lower bound**; independent estimates 10K–100K) |
| Storage horizon | T | yr | 10 | assumption (archival retention) |
| Average block size | B_block | bytes | 1,500,000 | block_stats / fee_history |
| Blocks per year | R_blocks | blocks/yr | 52,596 | 365.25 × 24 × 6 |
| Total block bytes/yr | B_all_yr | bytes/yr | 7.8894e10 | B_block × R_blocks |
| **Cost per byte per year** | **cb** | USD/(byte·yr) | **1.17246e-8** | C / B_all_yr (block-average) |
| Lifetime storage cost/node/block | L | USD/block | 0.175869 | cb × B_block × T |
| Network lifetime cost/block | L_net | USD/block | 5,628 | L × N (=32K) |
| **Storage Cost Coverage Ratio** | **SCCR** | dimensionless | **0.2228** (167 blocks, live 2026-08-02); **~0.29** (156 blocks, dated 2026-08-01); **~0.07–0.71** across the N=10K–100K band | fee_USD / L_net |

```
                    Fees Paid (USD / block)
   SCCR  =  ─────────────────────────────────────────────
            Modeled Lifetime Storage Cost (USD / block)
            = L_network = C × T × N / R_blocks
```

**Definition of "fees paid" (used once, everywhere).** Throughout this paper, *fees paid* means **total transaction fees of the block in USD**: `fee_USD(block) = avgFees(block) × USD/BTC price`, where `avgFees` is the block's total transaction fees in satoshis from the live `fee_history` capture (mempool.space 24h block-fee history, via the capture pipeline into `captured-data/bsahi.db`). It **excludes the block subsidy** — the subsidy is miner revenue, not a fee, and plays no part in the ratio. It is also **not** a fee *rate* (sat/vB); it is the block's aggregate fee bill in USD at the capture price. All three independent implementations (JS `tools/research/storage-ratio.js`, Python `tools/research/reproduce.py`/`sccr_live.py`, standalone C) compute this identically: `fee_usd = avgFees / 1e8 × USD`. The denominator it is compared against is `L_net = C × T × N / R_blocks` (USD/block, §4.1 above).

**Design principle:** `cb` is **horizon-free** (C / annual bytes). The horizon `T` enters **only** through `L = cb × B × T`. This corrects the v1.0.0 implementation, which applied `T` twice (see §6).

**Explicit notation (hidden assumptions made visible).** The canonical quantities above bundle four assumptions that the model treats as scalars. Each is stated explicitly here so readers can see exactly what is and is not modeled; none changes the arithmetic of §5:

1. **C is a bundled cost, not pure storage.** `C = C_storage + C_bandwidth + C_misc` — the $925/yr annual node cost bundles the disk/SSD component, the bandwidth bill, and electricity/hardware depreciation (component sum 166.67 + 600 + 157.68; `utxo_cost_model.py`). The current model treats C as a single bundled scalar, so the headline ratio is strictly a **storage-and-hosting coverage ratio**, not a pure storage ratio. The bandwidth-vs-storage decomposition is a documented future refinement — exactly the RCIR and BCIR legs (§7 / `roadmap.md` Phase II/III).
2. **`cb` is time-dependent, not stationary.** The canonical `cb` is a point-in-time ratio `cb(t) = C(t) / B_year(t)` — the node's annual cost at time t divided by the network's byte production in that year. `B_year(t)` itself depends on block fullness: 95%-full blocks produce ~7.5×10¹⁰ bytes/yr vs ~5.5×10¹⁰ at 70%-full blocks, moving `cb` (and SCCR) even with C, N, and T fixed. SCCR as measured is therefore a **point-in-time estimate over its capture window**, consistent with the paper's dated-snapshot discipline (§5.1); the live tracker accumulates the time series (§5.1).
3. **N is a heterogeneous vector, not a scalar.** The model writes `L_network = L·N`; the explicit forward notation is `L_network = Σᵢ Lᵢ`, where each node class i (archival full node, pruned node, exchange node, research/indexer node) carries different storage behavior and hence a different per-node lifetime cost Lᵢ. This is precisely the archival-vs-pruned measurement gap documented in the companion note (`research/archival-vs-pruned-note.md`): the census measures reachable count N (≥32K, a lower bound), not the retention distribution. SCCR-as-computed is an upper bound on the burden borne by any single node class; a measured pruned/archival split is Phase I follow-on.
4. **Storage ≠ state (UTXO).** SCCR prices replicated *history* — the permanent record of confirmed blocks — not the UTXO set, the live ledger *state* nodes maintain in RAM and index structures. State permanence is a separate resource with its own accounting leg (UCIR, §7 / `roadmap.md` Phase II). A reader must not read the storage leg as a state-cost measurement; the two resources have different cost drivers (bytes retained vs. live-set size).

### 4.2 The marginal-inscription attribution (secondary)

The inscription-externality branch uses a **marginal attribution**: `cb_insc = C / (inscription bytes/yr) = 1.92573e-6` USD/(byte·yr). This differs from `cb` by a factor of **164.4× (dimensionless)** — not an error, but two different denominators (all block bytes vs. inscription-only bytes). The paper headline uses the block-average `cb`; the marginal figure appears only in the inscription-externality analysis. The 16.4× (dimensionless) figure reported in earlier versions was this 164× (dimensionless) denominator gap **divided by** the 10× (dimensionless) bug — see §6.

**Why average, not marginal?** `cb` is an *average* (accounting) attribution: total node cost divided by total bytes. The 164× (dimensionless) marginal branch (`cb_insc`) attributes the same cost to inscription bytes only — a *marginal* (optimization) view. Both are valid; they answer different questions. Average cost is the right tool for **accounting** — "what share of the network's modeled hosting bill does the fee market cover?" — which is this paper's question. Marginal cost is the right tool for **optimization** — "what does one more byte cost the network?" — which is the inscription-externality branch's question. The paper uses the average for its headline (accounting) and documents the marginal variant explicitly (the 164× marginal-inscription branch above), rather than burying the choice. A future marginal-attribution study would be a legitimate companion, not a correction.

## 5. Findings

### 5.1 The Storage Cost Coverage Ratio

Measured from live `fee_history` captures at node count N=32,000 — the best-available **primary-source lower-bound census (≥32,000 known addresses via Bitcoin Core `getnodeaddresses`; §5.4)**. The headline, in three lines (exact numbers in the tables below):

- **Representative live measurement: ≈0.22**
- **Observed band: ≈0.22–0.29** (across captures at N=32K)
- **Model uncertainty: depends strongly on the replication factor N** — the true-N band (**~0.07–0.71**, §5.4) is a *different* uncertainty from the observed-sample band above

Two snapshots, dated explicitly:

| Metric | Dated capture (2026-08-01) | Live capture (2026-08-02) |
|---|---|---|
| Blocks sampled | 156 | 167 |
| Average SCCR (dimensionless) | **~0.293** | **0.2228** |
| Min / Max (dimensionless) | ~0.058 / ~1.537 | ~0.058 / ~0.832 |
| Blocks below 1× | **98.7%** (154/156) | **100.0%** |

**Live re-measure (canonical, 2026-08-02):** the ratio moves with the fee market. The canonical re-measure recorded in `research/model-spec.json` v2.0.1 is **0.2252** (168 blocks, 2026-08-02); the 0.2228 above is the same capture window re-read at the time of writing (167 blocks). The 0.293 figure is the dated 2026-08-01 snapshot. The single source of truth is `research/model-spec.json` (v2.0.1, canonical); all surfaces must read the live value from `node tools/research/storage-ratio.js`, never a hardcoded figure. The v2.0.0 N=60K-era values (0.1719 / 0.1535) are superseded.

**Fee-regime + node-count dependence:** the ratio tracks both the fee market and the replication factor. Under the earlier N=60K assumption the average was 0.156–0.172 (dimensionless) with 100% below 1×; at the primary-source lower-bound census N=32K it rises to ~0.22–0.29 with ~98.7–100% below 1× (a few high-fee blocks exceed coverage in the dated capture). Because N is a lower bound and independent estimates span 10K–100K, the honest headline is the **N-band range: ~0.07–0.71** (inverse-linear in N, §5.4). The headline is a *distribution over time and parameters*, not a point.

**Interpretation:** transaction fees cover, on average, roughly **22–29%** of the estimated 10-year replicated storage cost of an average block across the ≥32K observed nodes. Most sampled blocks' fees remain below their estimated storage cost. **Point-in-time discipline:** every figure in this section is a dated, capture-specific measurement — the time-series is live and growing (daily SCCR tracker, `com.bsahi.sccr-tracker.plist`), and the paper deliberately reports snapshots rather than a stationary number. This is not a convenience but a consequence of the model: `cb(t) = C(t)/B_year(t)` is itself time-dependent (§4.1), so the ratio is a snapshot over its capture window by construction — block fullness, node costs, and fee levels all move between captures.

### 5.2 The inscription externality (marginal branch)

At 100,000 inscriptions/month (~400 bytes each, in witness):

| Metric | Value |
|---|---|
| Cost per byte per year (marginal) | 1.92573e-6 USD/(byte·yr) |
| Lifetime storage cost per inscription (10 yr) | $0.00770 USD/inscription |
| New 10-yr storage liabilities created per year at 100K/mo | ~$9,240 USD/yr spread across all nodes |
| Steady-state annual externality (amortized) | ~$924 USD/yr spread across all nodes |

**Unit note (corrected):** $9,240 is the *undiscounted 10-year liability of one year's inscriptions* (USD/yr), not an annual cost. Amortized over the 10-yr horizon it is ~$924/yr. This was previously labeled "annual unpriced externality" — a T/1 conflation of the same shape as the fixed 10× bug, in label only. The per-node figure (~$0.015 USD/(node·yr)) is unchanged under either reading.

**Pruning-consistency note:** this externality is structurally real but **not economically significant at current volumes** — per-node it is well under $1/yr. The contribution of this paper is the reproducible ratio framework, not the magnitude. A future fee regime (sustained congestion, larger data-bearing volume) would change the magnitude while keeping the framework intact.

### 5.3 Sensitivity

Recomputed at the live capture (2026-08-02, 167 blocks; baseline SCCR = 0.2228 (dimensionless) at N=32K, C=$925/yr, T=10 yr) with `node tools/research/storage-ratio.js` and the canonical spec. The table's parameter ranges bracket the canonical values:

| Parameter | Value | Avg SCCR (dimensionless) |
|---|---|---|
| Node cost, C (USD/yr) | 600 / 925 / 1400 | 0.343 / 0.223 / 0.147 |
| Node count, N (nodes) | 16,000 / 32,000 / 100,000 | 0.446 / 0.223 / 0.071 |
| Storage horizon, T (yr) | 5 / 10 / 15 | 0.446 / 0.223 / 0.149 |
| Avg block size, B (MB) | 1.0 / 1.5 / 2.0 | 0.223 (invariant) |

**BTC price (the dominant omitted driver — verified in independent implementation):** the ratio is linear in price. At the live N=32K baseline (capture price ≈ $63,018 USD/BTC):

| BTC price (USD/BTC) | Avg SCCR (dimensionless, N=32K) |
|---|---|
| $30,000 | 0.106 |
| $45,000 | 0.159 |
| $62,900 | 0.222 |
| $100,000 | 0.354 |
| $200,000 | 0.707 |
| $500,000 | 1.768 |


**Caveat — price and fee level are not independent shocks.** The table above varies the BTC price holding the fee level (sat/vB) fixed, but in historical data fee levels and price co-move: bull markets raise both the price *and* on-chain fee demand (higher fee rates, fuller blocks), so a price rise is typically accompanied by a fee-level rise, compounding the ratio's increase. Conversely, a price fall in a demand crash carries fee levels down with it. The single-lever rows are therefore *ceteris-paribus* isolations for the model's arithmetic, not forecasts of how the ratio would move along a realized price path; the joint direction of price-and-fee co-movement is exactly the kind of dynamic question the v3.0 agenda (companion `future-directions-v3.md` §1) leaves open.

**Structural property:** SCCR is **invariant to block size** — `cb ∝ 1/B` while `L ∝ B`, so `B` cancels. Caveat: this invariance follows from attributing *all* node cost per byte then multiplying back by bytes — it reflects that the model is size-agnostic (contains no size-dependent economics), not that size is economically irrelevant.

### 5.4 The knife-edge: node count and the strong claim

The SCCR is homogeneous of degree 1 in its scale parameters: `SCCR ∝ (fee × price) / (C × T × N)`. Two thresholds matter (derived and verified in the independent C implementation):

- **The average SCCR crosses 1.0 at N ≈ 10,300 nodes** (or BTC ≈ $366,000 USD/BTC) — dated v2.0.0-era reference values (baseline 0.1719 at N=60K)
- **The "100% of sampled blocks below 1×" claim breaks at N ≈ 49,200 nodes** (or BTC ≈ $76,700) — the highest-fee sampled block (13.75M sats, height 960469) sits at 0.82× coverage (dimensionless) under the old N=60K

**Live recompute (2026-08-02 baseline, SCCR = 0.2228 at N=32K):** because the baseline ratio itself rose, the average now inverts at **N ≈ 7,130 nodes** or **BTC ≈ $283,000**; the "100% below 1×" break on the dated capture is unchanged at N ≈ 49,200 (the max block is 0.832× at N=32K on the live capture, still below 1×). Both the dated and live thresholds are reported; the model-spec v2.0.1 note retains the v2.0.0-era values (10.3K / $366K).

**The node census — a primary-source lower-bound census (≥32,000 known addresses via Bitcoin Core `getnodeaddresses`), not a full enumeration.** We replaced the 60K assumption with data from a live Bitcoin Core node: a **`getnodeaddresses` RPC query** returned **32,000 known addresses** — the RPC maximum, meaning the node's address manager is saturated at the cap and the true reachable set is *at least* 32K. At census time the node also reported **8 live outbound P2P connections** (2026-08-02) — the observed live reachable set is small relative to the 32K known-address lower bound, which is exactly why we report the address-manager saturation as the primary figure. **We do not call this a complete census**: 32K is an artifact of the RPC cap, not a measured enumeration, and independent estimates span ~10K–100K (BSAHI's own earlier marketing data used ~27.8K). The paper therefore reports the ratio as a **range across the true-N band**, with 32K as the best-available lower-bound estimate.

**Consequence of the lower-bound census N=32,000 (recomputed, dated 156-block capture):**

| Metric | At N=60K (old assumption) | At N=32K (primary-source lower-bound census) |
|---|---|---|
| Average SCCR (dimensionless) | 0.156–0.172 | **~0.293** |
| Max per-block ratio (dimensionless) | 0.820 | **1.537** |
| Blocks below 1× | 100.0% | **98.7%** (154/156) |

**This is a substantive finding, not a cosmetic one.** With a defensible node count, fees cover *more* of the modeled storage cost than the 60K assumption implied (~29% vs ~17%), and a handful of high-fee blocks now *exceed* 1× coverage. The direction of the headline is unchanged — most blocks are still below 1× — but the strong form ("100% below 1×") does **not** survive the lower-bound census on the dated capture. **The defensible claim is: ~22–29% average coverage at N=32K, ~98.7–100% of sampled blocks below 1×, and ~0.07–0.71 average across the true-N band (10K–100K).** (1× remains a descriptive calibration point, not a normative target — §1.)

**Joint Monte Carlo on the headline** (`research/sccr_monte_carlo.py`, 10,000 samples, N ~ Tri(10K,150K,mode 60K), C ~ Tri($500,$2000,mode $925), T ~ Tri(5,30,mode 10), P ~ Tri($30K,$120K,mode $62.9K)):

| Quantile | SCCR (dimensionless) |
|---|---|
| P5 | 0.034 |
| P25 | 0.062 |
| P50 | 0.099 |
| P75 | 0.163 |
| P95 | 0.338 |
| Share below 1× | **99.8%** |

The median is below the deterministic point estimate because the node-count distribution's right tail (median N ≈ 86K) dominates. The result is robust in distribution: under joint uncertainty about every scale parameter, the ratio remains below 1 in 99.8% of draws — the *direction* of the finding is not sensitive to the audited parameter uncertainty, though the magnitude spans ~10× (P5–P95).

**Current-N-band Monte Carlo** (`research/sccr_monte_carlo_range.py`, 10,000 draws, N ~ Tri(10K, 100K, mode 32K) — the paper's stated uncertainty band with the census as mode; C ~ Tri($600, $1400, mode $925), T ~ Tri(5, 15, mode 10), P ~ Tri($30K, $120K, mode $63,018); anchored at the live baseline and cross-checked against the frozen capture):

| Quantile | SCCR (dimensionless, live anchor) |
|---|---|
| P5 | 0.071 |
| P25 | 0.117 |
| P50 | 0.173 |
| P75 | 0.260 |
| P95 | 0.467 |
| Share below 1× | **99.9%** |

The current-band median (0.17) sits near the N=32K point estimates (0.22–0.29), and the P5–P95 interval (0.07–0.47) brackets the deterministic N-band range (~0.07–0.71): the confidence interval and the range are two views of the same N-driven uncertainty. The old-N-band result above (99.8% below 1×) remains as the historical conservative check.


### 5.5 The Bandwidth Leg (v1 analytical bound)

*(Added 2026-08-04, G-06.)* The storage leg prices *stored* bytes; the
bandwidth leg prices the **marginal propagation** of those bytes: every full
node — pruned or archival — must download every byte of every block
(`pruning_externality_analysis.md`). Quantities live in `model-spec.json`
v2.1.0 (`cost_per_gb` input; derived `bw_GB_yr`, `bw_cost_per_year_node`,
`bw_cost_per_year_net`, `bw_insc_incr_node`); the formula is
**B × replication × $/GB**:

| Quantity | Value | Meaning |
|---|---|---|
| `bw_GB_yr` = B_all_yr / 1e9 | **78.894 GB/yr** | full-chain bytes each node downloads |
| `cost_per_gb` (input) | **$0.05/GB** | retail bandwidth proxy (`pruning_externality_analysis.md`; AWS egress ~$0.09/GB, Hetzner ~$0.011/GB — mid-range) |
| `bw_cost_per_year_node` | **$3.94/yr per node** | marginal full-chain propagation, one node |
| `bw_cost_per_year_net` | **~$126K/yr** | × N=32K lower-bound census |
| `bw_insc_incr_node` | **$0.024/yr per node** | inscription-incremental share (480 MB/yr × $0.05/GB) — reconciles the earlier "~$0.02/yr" figure |

**Honest framing:** this is an **analytical bound, not a measurement.** Real
node bandwidth bills are overwhelmingly flat-rate (residential/colocation
unmetered), so $/GB is a *marginal economic proxy*, not a typical bill. The
bound's job is to bound the *marginal* propagation externality the storage leg
deliberately excludes (§7 limitation 5): the full-chain marginal cost is
**~$3.94/yr per node** (~$126K/yr network at ≥32K nodes), and the
inscription-incremental slice is **~$0.024/yr per node** — small in both
frames, in the same direction as the pruning analysis's verdict
(`pruning_externality_analysis.md`: $0.02–0.05/yr unavoidable per node).

### 5.6 The Validation Leg (v1 order-of-magnitude survey)

*(Added 2026-08-04, G-06; full survey: `research/validation-cost.md`.)*
Validation is the CPU work every node pays for every block since genesis —
PoW-header check (trivial), block rules, and **signature verification**
(the dominant term) — and it is the only leg that is strictly unavoidable at
any replication scale (storage can be pruned; validation cannot be skipped).
The v1 bound, **order-of-magnitude only** (band ≈ 0.5×–5×):

| Term | Value |
|---|---|
| Blocks/yr (R_blocks) | 52,596 |
| Sig checks per block / throughput | ~3–10K sigs per block vs ~10–30K sigs/s (modern hw, libsecp256k1) |
| Validation CPU per block | **~0.1–1 s** (cross-checked by initial-sync delta: 6–24 h / ~1M blocks) |
| Validation CPU per node per year | **~1.5–15 h** |
| **Validation cost per node per year** | **~$0.5–$5** (central ≈ $1–2/yr at $0.10–0.50/CPU-h) |
| Network-wide (N = 32K) | **~$16K–160K/yr** |

**Falsifiable claim (v1):** *validation cost per full node per year is
< $100 — bounded from above by the entire node budget C = $925/yr, central
estimate ~$1–2/yr.* Falsified by a measured benchmark showing ≥ ~200 h/yr
steady-state validation CPU, or a hardware census showing validation is a
*binding* provisioning constraint. Literature anchored on Tschorsch &
Scheuermann (2016, IEEE COMST), Delgado-Segura et al. (2018, UTXO analysis),
Bitcoin Core's `src/bench` suite; the architect-notes 3-paper fee list is
acknowledged as *not* modeling validation — the gap this leg opens.
**Verdict:** validation is cheap *per block*, so cheap per node; its network
total (~$16K–160K/yr) is ~3 orders of magnitude below the storage leg's
modeled network burden — which is itself the finding, not an assertion.

### 5.7 The UTXO Leg (v1 measurement)

*(Added 2026-08-04, G-06.)* `getblockstats → utxo_size_inc` — the net byte
delta of the UTXO set after each block — was already captured by agent-06 but
**dropped at DB write** (no `block_stats` column). Fixed end-to-end: column
added to `tools/db/schema.sql`, wired through `tools/db/init.js`
(`insertBlockStats` + idempotent `ALTER TABLE` migration), live path in
`tools/data-engineering/spool-consumer.js` (every `btc_rpc` capture now
persists per-block rows), and a backfill (`tools/db/backfill-block-stats.js`)
populated the history from the spool + raw captures. Measured v1 result
(2026-08-04, `captured-data/bsahi.db`):

| Metric | Value |
|---|---|
| block_stats rows with utxo_size_inc | **165 unique heights** (backfill: 351 writes, 119 capture files) |
| Avg net UTXO-set delta per block | **~29.9 KB/block** (range incl. genesis's 117 B artifact) |
| Max height covered | 671,460 |
| Live path | verified (handler test: height→utxo_size_inc persisted) |

**Status:** the leg is now *measured* (the resource's size per block is in the
queryable DB, growing live). What remains is the *pricing* step — attributing a
$/byte/yr cost to the UTXO delta (the UTXO set is the index that makes
validation/script lookups fast; its cost surface is the next model step, and
it stays in §7 future work until then).

## 6. Internal Validation, Correction, and Reconciliation (v2.0.0)

Internal validation identified an inconsistency in the SCCR implementation, traced it to a **duplicated time-horizon term**, corrected the implementation, regenerated all reported values, and confirmed the qualitative conclusions unchanged. We present the correction in four labeled steps: **Bug → Fix → Results → Reconciliation**.

### 6.1 The bug

methodology.json v1.0.0 and `storage-ratio.js` applied the horizon `T` twice — once dividing the denominator of `costPerBytePerYear` (`C / (B_all_yr / T)`) and again in the lifetime-cost product (`bytes × cb × T`). This inflated modeled storage cost (USD/block) — and deflated the ratio (dimensionless) — by exactly **10×**.

**The error affected the magnitude of the reported ratio, not the logical structure of the model or the interpretation of the hypothesis.** The formula's shape (fee vs. replicated lifetime storage cost) was correct; the bug was a dimensional slip in one derived quantity (`cb`), not a conceptual change to what the ratio measures.

### 6.2 The fix

`cb` is defined horizon-free (`C / bytes-per-year`); `T` enters only through `L = cb × B × T`. This is the canonical v2.0.0 definition and is pinned in `research/model-spec.json`; no script may reintroduce `T` into `cb`.

### 6.3 Results

| Quantity | Before (v1.0.0 formula, N=60K) | After (v2.0.0, N=60K) |
|---|---|---|
| Cost per byte per year (USD/(byte·yr)) | 1.17247e-7 | **1.17247e-8** |
| Lifetime storage cost/node/block (USD/block) | $1.759 | **$0.176** |
| Network lifetime cost/block (USD/block) | $105,522 | **$10,552** |
| **Average SCCR (dimensionless)** | 0.0172 | **0.1719** |
| Blocks below 1× | 100% | **100% (unchanged)** |

**Why the conclusion survived the correction.** Although the correction increased the estimated SCCR by ~10× on a same-capture basis (0.0172 → 0.1719 (dimensionless) at the then-assumed N=60K) — and by ~11.5× across the as-reported headlines (v1.0.0 **0.0149** → v2.0.0 **0.1719**, a change that also spans different capture windows) — every sampled block still remained below the modeled full-cost threshold (1×) under the then-assumed node count (N=60K). At the lower-bound census N=32K the average rose further to **~0.225 (22.5%)** on the 2026-08-02 live re-measure (168 blocks), with ~99% of sampled blocks still below the 1× threshold. The magnitude of the measurement moved by an order of magnitude; the *direction* of the finding did not.

*Note: the table above documents the 10× time-horizon correction at the then-assumed N=60K. A separate, subsequent correction replaced the node count with the primary-source lower-bound census (N=32K), which moves the average to ~0.22–0.29 and the below-1× share to ~99–100% (see §5.4). The two corrections are independent and both are documented.*

### 6.4 Reconciliation

The two cost models (`storage-ratio.js` and `utxo_cost_model.py`) disagreed by 16.4× (dimensionless). This decomposed as **164× (dimensionless) denominator gap ÷ 10× (dimensionless) bug = 16.4× (dimensionless)**. The models measure different quantities (block-average vs. marginal-inscription attribution); the gap is documented, not erased. See `verification_appendix.md → Model Reconciliation (v2.0.0)`.

### 6.5 Reproducibility

The correction increased the estimated SCCR by an order of magnitude but did not reverse the paper's qualitative conclusion. This distinction is important: the implementation error affected the estimated magnitude of the measurement, whereas the underlying hypothesis was evaluated against the corrected model and remained supported under the paper's assumptions. Every quantity in this paper is regenerated from `research/model-spec.json` (v2.0.1) by three independent implementations (JS, Python, standalone C); no script redefines a model constant, and the full capture log is retained in `captured-data/bsahi.db`.

**Independent reproduction (status).** The frozen capture and the three implementations agree (avg SCCR 0.2186, min 0.0584, max 0.8320, 171/171 blocks below 1×), and the one-command reproduction path has been verified from a fresh clone of the public repository. This is internal consistency. The paper's reproducibility claim will be stated, once external runs land, as: *"Independently reproduced by external participants following the published reproduction protocol"* — not "externally verified." One independent success is good; three is excellent. An external run is the only outstanding submission gate (D5; `research/reproduce/external-reproduction.md`).

## 7. Limitations and Future Work

**Limitations:**
1. **The node count (≥32K from the primary-source lower-bound census) is a lower bound**, not a complete enumeration — the addrman caps at 32,000 addresses, so the true reachable set is at least 32K, and independent estimates span ~10K–100K reachable nodes (pruned vs. archival). The SCCR is inversely proportional to node count: at the live baseline the average inverts above 1× only below ~7.1K nodes, and the "100% below 1×" claim breaks below ~49K nodes at the dated capture (see §5.4).
2. **Node costs are homogeneous — and bundled.** Hardware/bandwidth/electricity vary by geography and operator; the model treats them as one scalar C = $925/yr. Because C is bundled (C = C_storage + C_bandwidth + C_misc, §4.1), the headline ratio is strictly a **storage-and-hosting coverage ratio**, not a pure-storage ratio, and the bandwidth-vs-storage decomposition is a documented future refinement — the RCIR and BCIR legs (§7 future work / `roadmap.md` Phase II/III).
3. **10-year horizon is an assumption**; pruning shortens actual retention, permanent storage extends it.
4. **No discounting; constant-cost assumption.** A one-time fee (USD/block) is compared against an undiscounted 10-yr storage-cost sum (USD/block); discounting the liability at r=5%/yr (8%/yr) reduces the present value by ~27% (45%). A declining $/GB storage-cost trend would likewise lower the future liability (the T=10 constant-cost figure is conservative in the same direction as the discounting caveat). Both effects mean the ratio overstates the liability as commonly valued.
5. **Bandwidth is included in the fixed node cost (C) yet marginal bandwidth-propagation cost is excluded from the storage leg.** This is the fixed-vs-marginal distinction, not a double count: C prices the node's *average* bandwidth bill; the excluded term is the *marginal* cost of propagating one more block to one more node. **v1 status (2026-08-04):** the marginal term now has an analytical bound in model-spec v2.1.0 (§5.5) — ~$3.94/yr per node at a $0.05/GB retail proxy — still a bound, not a measured bill.
6. **Marginal vs. average attribution** changes the per-byte cost by 164× (dimensionless) — the choice is explicit and documented, not hidden.

7. **Why storage at all?** The paper does not claim storage is Bitcoin's most important resource — **it is simply the first measurable one**: the first long-lived resource with a reproducible cost estimate and a live fee attribution. Bandwidth, validation, and UTXO now carry v1 bounds or measurements (§5.5–5.7); relay and indexer serving remain named-but-unmeasured research hypotheses (`roadmap.md` §4). Storage led because it could be measured, not because it ranks first in economic importance.

**Future work (the resource-pricing program; statuses updated 2026-08-04):**
- **UTXO leg — v1 DONE (measurement):** `getblockstats → utxo_size_inc` now persisted end-to-end (schema column, live spool-consumer path, backfill of 165 heights from the spool; avg ~29.9 KB/block) — §5.7. Remaining: $/byte pricing of the UTXO delta and validation-lookup cost surface.
- **Bandwidth leg — v1 DONE (analytical bound):** model-spec v2.1.0 quantities B × replication × $/GB: $3.94/yr per node marginal full-chain propagation, ~$126K/yr network, inscription-incremental $0.024/yr/node — §5.5. Remaining: measured per-node bills (flat-rate reality) and a measured replication-weighted byte flow.
- **Validation leg — v1 STARTED (OOM survey):** `research/validation-cost.md` — validation cost per node per year < $100 (central ~$1–2/yr), literature-anchored, falsifiable — §5.6. Remaining: a pinned Core benchmark run and a hardware census.
- **Node distribution:** expand `node_geo` (currently 224 rows) for per-region cost distributions
- **BIP-110 pre/post measurement protocol** if activation is ever signaled
- **v3.0 economic-dynamics program:** the eight-question agenda and deep-question first answers now live in the companion `future-directions-v3.md` (roadmap §8/§9)

### 7.1 What would falsify this framework?

*(Added 2026-08-03, post-advisor review — see `docs/decisions/2026-08-02-publication-decisions.md`.)* A framework that cannot specify its own failure conditions is not a framework; it is a posture. We therefore state, in advance, the observations that would force us to retract or substantially revise the claims in this paper. They operate at two levels — the **measurement** (SCCR, this paper) and the **framework** (the RIR family and the "no single resource market" thesis; outline in `research/framework-paper-outline.md`).

**Two external outcomes — never conflated (added 2026-08-03, third-reviewer refinement).** An external party's run of the reproduction protocol can end in exactly two ways, and they are categorically different:

- **"Failed to reproduce"** — an independent party following the published protocol from a clean clone gets a materially different number: not the published avg 0.2186, not the 0.07–0.71 band, or a per-block mismatch that cannot be reconciled. This is a **genuine falsification of the measurement**: the number is not trustworthy as stated, and the paper's headline falls until the discrepancy is reconciled. This is the only external-outcome class that blocks submission (falsifier 1 below; D5).
- **"Reproduced the number, disagrees with framing/assumptions"** — an independent party runs the protocol, confirms the arithmetic (avg 0.2186, the band, the below-1× share), but disputes a modeling choice: the C = $925/yr bundling, the T = 10 horizon, storage-as-the-first-resource priority, or whether an unpriced-but-avoidable cost is an externality at all. This is **NOT a falsification**. It is honest scientific disagreement about documented assumptions — the paper states these choices as assumptions (§7, items 1–7) and anticipates exactly this class of challenge. It is folded into future revisions the way the Liu et al. (2021) prior work was reconciled (§8.2): acknowledged, engaged, absorbed into the next version. The measurement stands.

The two outcomes must never be conflated. A framing disagreement is **feedback, not a failed reproduction**: it is recorded in the community-feedback triage (`research/community-review-plan.md` §4 → `research/community-feedback.md`) and addressed in the next revision, while the reproduced number stands. A failed reproduction is a claim about the number itself and is handled under falsifier 1. The assumption taxonomy that makes this routing mechanical — which assumptions are **Type C** (a chosen value: challenge = feedback) and which are **Type M** (a value that might be mismeasured: challenge = falsification candidate) — is stated in advance in §7.2.

**Falsifiers of the SCCR measurement:**

1. **Independent implementations cannot reproduce the ratio.** The framework ships a frozen capture plus three independent implementations (JS/Python/C, verified agreeing per-block). If an uninvolved party running the protocol on the same inputs cannot reproduce SCCR ≈ 0.22 (or the discrepancy cannot be reconciled), the measurement is not trustworthy and the paper's headline falls. This is the D5 critical path (external reproduction; `research/reproduce/external-reproduction.md`).
2. **A better storage-cost model reverses the conclusion.** The denominator (`C·T·N / R_blocks`) rests on a homogeneous node-cost model, an assumed T=10 horizon, and the ≥32K primary-source lower-bound census. If a defensible refinement — measured pruned-vs-archival retention, regional cost heterogeneity, or corrected discounting — moves the banded result (~22–29% coverage, most blocks below 1×) to a qualitatively different conclusion, the paper's central claim is falsified in its current form.
3. **Fees consistently exceed modeled long-term costs.** If sustained fee regimes (or re-measured 2017–2024 fee-peak years) show fees *covering* modeled costs in a stationary way, the partial-internalization reading collapses into "the market internalizes storage when it matters" — a different result, and the banded headline (§5) would be wrong.

**Falsifiers of the framework (the RIR family and the "no single resource market" thesis):**

4. **Resource-cost attribution is shown economically inappropriate.** If the planned attribute-pricing regression (companion `future-directions-v3.md` §2 Q2) shows the single fee price carries *no* persistence signal, then per-resource internalization ratios are category errors, not measurements — the RIR family premise fails even though SCCR-as-computed may stand.
5. **The pruned-vs-archival census shows the storage burden is avoidable at scale.** The T=10 replicated-storage denominator assumes archival retention across the network. A measured pruning distribution showing most nodes avoid most of the burden (companion note `archival-vs-pruned-note.md`) would reframe SCCR as an upper bound on an avoidable cost — a genuine falsification of the externality reading, though not of the measurement.
6. **Measured response functions close the dynamic loop at or above 1×.** If node-entry/exit and fee-demand response functions (companion `future-directions-v3.md` §2 Q1) are measured and exhibit a stable fixed point at or above 1×, the persistent-partial-internalization equilibrium hypothesis is falsified.

We do not believe any of these falsifiers currently obtain; we list them so the reader can check, and so the framework is never mistaken for an unfalsifiable claim.

### 7.2 Assumption taxonomy --- deliberate choices (Type C) vs. empirical risks (Type M)

*(Added 2026-08-03, fourth-reviewer deliverable.)* §7.1 draws a categorical line
between two external outcomes --- a **failed reproduction** (the number is wrong)
and a **reproduced number with disagreed framing** (the number stands). That line
is only enforceable if the paper's own assumptions are pre-sorted into the same
two buckets **before** the challenge arrives --- not argued case-by-case under
time pressure when an external review lands. Every material assumption in this
paper therefore belongs to exactly one of two categories, stated here in advance:

**The crisp test.** A challenge is classified by what it does to the assumption's
current value, not by who makes it:

- **If a critic simply asserts a different value or a different modeling choice**
  (T = 20, marginal attribution, "validation matters more") --- there is no
  evidence the current value is wrong. That is **Type C territory: recorded as
  feedback** (community-feedback triage, `research/community-review-plan.md` §4),
  engaged in the next revision, and **the measurement stands**.
- **If the critic shows the current value or measurement is wrong** --- with
  evidence, a reproduction mismatch, or better data (a complete node census, a
  corrected fee capture, a measured cost decomposition) --- that is **Type M
  territory: a falsification candidate** under §7.1 falsifiers 1–3, and **the
  headline is at risk** until the discrepancy is reconciled.

**Type C --- "Assumption I chose" (deliberate modeling choice).** A selection
among defensible alternatives, made explicit and documented where it appears
(§7 items 1–7). Not falsifiable by asserting a different choice; a reviewer
preferring another selection records **feedback**, not falsification.
Reclassification to Type M requires showing the choice is internally inconsistent
with the paper's own stated method, or rests on an empirical premise that is wrong.

**Type M --- "Assumption that might be mismeasured" (empirical risk).** An
empirical quantity, measurement, or bound embedded in the model. Falsifiable: if
the measurement is wrong, the conclusion may shift. A critic who shows the
current value/measurement is wrong opens a **falsification candidate** --- handled
under §7.1 falsifiers 1–3; the headline falls until reconciled.

| # | Assumption | Type | Why it's that type | What would reclassify or falsify it |
|---|---|---|---|---|
| 1 | Storage horizon **T = 10 yr** | **C** | A selection within a defensible range (pruning shortens retention, permanent storage extends it, §7 item 3); sensitivity disclosed (§5.3: T = 5/10/15 → 0.446/0.223/0.149), direction robust | A measured network-wide retention distribution showing effective retention is an order of magnitude shorter --- that reframes the externality reading (falsifier 5); it does not make T = 10 an error |
| 2 | Replication factor **N = 32K** | **M** | An empirical bound from the primary-source census (addrman cap at 32,000 known addresses), explicitly *not* a complete enumeration (§5.4); true set estimated 10K–100K; SCCR is inversely proportional to N | A defensible complete census showing the true reachable set differs materially from 32K in a direction that moves the ~0.07–0.71 band; the "~99–100% below 1×" claim already breaks at N ≈ 49K (§5.4) |
| 3 | **C bundling** (C = C_storage + C_bandwidth + C_misc) | **M (leaning --- the blurry case)** | The bundling is presented as a simplification (Type C-like), but it embeds an implicit empirical claim that the components are as measured --- and the component sum is bandwidth-dominated (600 + 166.67 + 157.68, §4.1), so the *storage* reading of the headline is fragile if the decomposition is wrong | A measured node-cost decomposition (operator surveys, hosting bills) showing the storage share is materially different, or a double-counted component --- reframes the headline from "storage-and-hosting coverage" (§4.1) and re-bands the ratio |
| 4 | Average block size **B_block = 1.5MB** | **M (narrow surface)** | An empirical quantity from the fee-history capture --- but §5.3 shows SCCR is invariant to B (B cancels), so a wrong value changes the per-byte presentation (cb), not the headline ratio | A material mis-statement of the capture (wrong byte basis in the fee history) propagating through cb(t); a data-quality flag, not headline-moving under the current spec |
| 5 | **"Fees paid" definition** (fee_USD = avgFees × USD/BTC; subsidy excluded, §4.1) | **M** | The numerator is a measurement from the live capture (mempool.space 24h block-fee history); the definition is explicit but the value is empirical | A reproduction mismatch on the fee side, a corrected capture, or evidence the conversion/attribution is wrong --- direct falsifier 1/3 territory: the number falls until reconciled |
| 6 | **Storage-first sequencing** | **C** | A program ordering, explicitly "the first measurable one," not "the most important" (§7 item 7) | Only evidence that storage is *not* reproducibly measurable (falsifier 1) touches it; asserting validation/UTXO is more important is feedback, not falsification |
| 7 | **Average-vs-marginal attribution** | **C** | A documented choice (the 164× denominator gap is disclosed; both branches reported, §4.2); average answers the accounting question, marginal the optimization question | Showing the marginal object is the only economically correct one for the externality claim --- the paper reports both, so this is engagement, not error |
| 8 | **Homogeneous node cost structure** | **C (with an empirical seam)** | The single-scalar structure is a deliberate simplification, documented (§7 item 2); heterogeneity is a refinement direction, not an error | The *value inside* the structure (C = $925/yr) is empirical --- a defensible regional refinement that moves the band is already named falsifier 2; the structural choice itself is not falsifiable by asserting heterogeneity |
| 9 | **No discounting; constant cost** | **C** | A documented choice with disclosed sensitivity (§7 item 4): discounting at r = 5%/8% cuts the liability's present value by ~27%/45%, moving the average up (~0.30–0.53 at N=32K) --- still below the 1× average threshold; the majority-below-1× direction is robust | A corrected treatment that flips the headline's direction --- none identified under the disclosed sensitivity; a critic asserting discounting records feedback, not falsification |

**The blurry case, named honestly.** Row 3 (C bundling) is the one assumption
that sits on the line. The *decision to bundle* is a choice (Type C); the *claim
that the bundle's components are as measured* is empirical (Type M). Because the
bandwidth leg (600) is the largest component, the storage-specific reading of the
headline depends on a decomposition that is currently *assumed*, not measured. We
therefore classify C bundling **leaning Type M** --- the safe default: an external
challenge to the decomposition gets the full falsification response, not the
feedback bucket.

**Why the taxonomy is stated in advance.** Every assumption-level critique this
paper receives will be routed by this table before it is answered: Type C
critiques are engaged as feedback in the next revision (the reproduced number
stands); Type M critiques are treated as falsification candidates until the
evidence is reconciled (§7.1 falsifiers 1–3). This is the mechanism that keeps
"reproduced the number, disagrees with framing" from silently becoming "the paper
might just be wrong" --- and keeps a genuine mismeasurement from being dismissed
as a mere framing disagreement. The plan-of-record mirror of this taxonomy lives
in `roadmap.md` §12.


## 8. Economics and Related Work

### 8.1 Is this an externality?

Following standard environmental-economics usage (Pigou, 1920; Coase, 1960), a **negative externality** arises when a transaction's cost is borne by parties who did not consent to the transaction. Applied to Bitcoin: an inscription's fee is paid by its creator; the long-term storage cost is borne by node operators who neither created the transaction nor were compensated for it. In mechanism terms this is a **two-sided** structure — the payer (transaction creator) and the bearer (node operator) are different agents, and the fee is a one-time congestion payment while the cost recurs over the storage horizon. Two qualifications are stated honestly:

1. **Voluntary participation.** Node operators choose to run nodes (and may prune). The Pigouvian case is therefore weaker than for a physical externality (e.g. pollution) — the correct framing is an *unpriced but avoidable* cost, not an imposed one. Our problem statement's "arguments for no" (node operators choose; storage is cheap; pruned nodes avoid ~70–97% of the cost) are engaged directly in §5. **Voluntary participation weakens the welfare interpretation, but not the measurement** — the ratio still quantifies what the fee market covers of a real, recurring cost borne by the storage-bearing class, whatever the operator's freedom to exit.
2. **Measurement, not pricing.** This paper *measures* a ratio; it contains no price mechanism and proposes no policy. Whether the measured gap constitutes a welfare-relevant externality is left to the reader and the literature.

### 8.2 Related work and novelty

- **Aronoff, Praizner, Sabouri (2026), arXiv:2604.17183** — *"A Model and Estimation of the Bitcoin Transaction Fee."* Structural VCG fee model; treats the mempool as a market for scarce block space; does not model storage externalities. Our fee-market framing builds on this.
- **Liu, Fang, Cheung, Cai, Huang (2021), arXiv:2103.05866** — *"An Incentive Mechanism for Sustainable Blockchain Storage."* Argues storage costs have "in general not been properly compensated by the users' transaction fees" and identifies two types of negative externalities, including an "insufficient fee issue." **This is the closest prior work** and we acknowledge it directly: our contribution is not the observation that fees may under-price storage (already argued in 2021), but a *measured, reproducible, Bitcoin-live-data quantification* (the SCCR) with (i) a reconciliation of cost models, (ii) knife-edge sensitivity bounds, (iii) regime dynamics (the ratio moves with the fee market), and (iv) a multi-resource framework for the broader class of long-lived resource costs (roadmap.md, RIR program). **We do not claim the observation is novel; we claim the measurement is.**
- **Ethereum state-rent / gas-as-state-pricing literature** and **Sompolinsky–Zohar** (qualitative storage/bandwidth incentive analysis) are adjacent threads we build toward but do not model.

### 8.3 The efficient-markets objection (named rebuttal)

**Objection:** if block space is priced at the margin by a market that clears, then marginal cost is internalized by definition — the fee IS the price, so there is no externality to measure.

**Rebuttal:** this conflates two different horizons. The fee market prices *inclusion in the next block* — a static, congestion-clearing price with a ~10-min horizon. The storage cost the SCCR measures is a *recurring* cost over an indefinite horizon (the data persists in every full node's history). A market can clear for the short-horizon good (block space now) while not pricing the long-horizon good (permanent replicated storage). The paper's measurement question is precisely whether the one-time congestion price also covers the recurring storage cost; §5 shows the empirical answer (banded ~22–29% coverage at N=32K). The efficient-markets framing is therefore not contradicted — it is *scoped*: it describes the short-horizon market, and the paper measures the long-horizon gap.

**Designer-intent corroboration (primary sources).** The scoped reading is not a reinterpretation — it matches the system's own design intent. The whitepaper defines the fee solely as an incentive to create blocks: *"If the output value of a transaction is less than its input value, the difference is a transaction fee that is added to the incentive value of the block"* (§6), and storage is explicitly designed *around*, not priced: the 80-byte block-header estimate (*"80 bytes \* 6 \* 24 \* 365 = 4.2MB per year"*) is dismissed with *"storage should not be a problem"* (§7) — a claim about block headers kept in memory for SPV, not full-chain replication, which is precisely the storage this paper measures. When Satoshi later moved to protect disk space, he used quantity control, not price: the block-size threshold should be kept *"lower as a circuit breaker"*, explicitly to *"limit the amount of wasted disk space in that event"* (BitcoinTalk post 441, Sep 2010), and the cap was designed to be raised by a block-height trigger, *"if (blocknumber > 115000) maxblocksize = largerlimit"* (post 485, Oct 2010). The efficient-markets objection therefore fails on the designer's own terms: the single price was specified as an inclusion incentive; storage was handled — where it was handled at all — by quantity controls, never by price. The same intent is explicit for data-heavy applications: Satoshi directed them to separate chains that share the main chain's proof-of-work but nothing else — BitDNS users could use *"all the space you need without worrying about paying fees for expensive space in Bitcoin's chain"* (BitcoinTalk, “BitDNS and Generalizing Bitcoin,” Dec 2010) — block space was designed to be expensive, and unpriced data was routed around, never onto, the priced chain. (Full verification, exact sources, the apocryphal-quote flag, and a falsifiable-claims table derived from these primary texts: companion notes `research/satoshi-primary-source-note.md` and `research/whitepaper-patterns.md` (the 44-pattern “engineered asymmetry” lens); the "node equilibrium self-corrects" claim maps to roadmap Q1.)

### 8.4 Terminology

This paper's primary name for the metric is **Storage Cost Coverage Ratio (SCCR)** — a fee-to-modeled-cost comparison, *not* a coverage ratio in the insurance/solvency sense. The broader economics family generalizes it: **Cost Internalization Ratio** is the family name for "the share of a long-lived resource cost internalized by the one-time fee," of which SCCR (storage) is the first measured member (Metric #1 of the RIR family, §2 Q3 of `future-directions-v3.md`). We use SCCR / Storage Cost Coverage Ratio as the established name throughout; Cost Internalization Ratio appears here once to locate the family.

---

## 9. Conclusion

The fee market solves block-space allocation well — that is not in question. Whether it internalizes long-lived resource costs is an **open empirical question**, and this paper contributes the first reproducible measurement using a **primary-source lower-bound census (≥32,000 known addresses via Bitcoin Core `getnodeaddresses`)**: a storage-cost-internalization ratio of **~0.22–0.29 at N=32K** (167–156 blocks, dated captures), with **~98.7–100% of sampled blocks below the 1× threshold** at that node count.

Because the replication factor N is the dominant input and is only bounded (≥32K; independent estimates 10K–100K), the honest headline is a **range**: fees currently cover roughly **7% to 71%** of the modeled 10-year replicated storage cost depending on the true node count, with the *direction* (most blocks below 1× under any N≥~32K census) robust to every correction made in this paper's review.

**Status:** external reproduction is pending (D5, the only submission blocker); every figure above is stated to the precision the current evidence licenses, and the N-band range carries the dominant uncertainty. We invite the community to reproduce, challenge, and extend this framework. All quantities derive from `research/model-spec.json` (v2.0.1); no script redefines a model constant. The data is live-captured, the measurement is continuous, and the arithmetic has been reproduced in three independent implementations (JS, Python, standalone C). The framework is presented as exactly what it is: a reproducible first measurement of a genuinely open question — not a verdict.

## 10. Future Directions (v3.0) — the agenda, in a companion

The paper's measurement question is answered in §5; its falsifiers are §7.1. The
program's forward agenda — the v3.0 economic-dynamics questions, their first
answers, and the cross-chain generalization — **deliberately lives outside this
core paper** in the companion `research/future-directions-v3.md` (plan-of-record:
`roadmap.md` §8/§9/§11). This keeps the paper a *measurement*, not a
research-program pitch.

**The eight v3.0 questions** (headline model output at the live baseline — SCCR =
0.2228 at N=32K, T=10 yr, C=$925/yr; full derivation and method notes in the
companion §1):

| # | Question | Headline model output (live baseline) |
|---|---|---|
| 1 | Storage horizon: SCCR at T = 5, 10, 20, 30, 50 yr | 0.446 / 0.223 / 0.111 / 0.074 / 0.045 (inverse-linear in T) |
| 2 | Storage 10× cheaper: C = $92.5/yr (SSD cost collapse) | SCCR = 2.228 — the gap flips sign; fees would over-cover storage |
| 3 | BTC = $500,000 | SCCR = 1.768; average crosses 1× at ~$283K (live baseline) |
| 4 | Fees sustained at 100 sat/vB for 5 yr | fee_USD ≈ $63,018/block vs L_net ≈ $5,628 (T=10) → SCCR ≈ 11.2 (22.4 at T=5); crosses 1× at ~9 sat/vB (T=10) |
| 5 | Lightning moves 90% of payments off-chain | Two-sided: lower on-chain fee demand ↓SCCR; higher-value residual traffic ↑SCCR — net effect open |
| 6 | Nodes double / triple: N = 32K → 64K → 128K | 0.223 → 0.111 → 0.056 (inverse-linear in N) |
| 7 | Can SCCR reach 1 without protocol changes? | Historically yes: SCCR averaged **above 1×** in 2017–2024 fee-peak years (2017 avg ~10.0, 2021 ~8.0, 2023 ~5.0, 2024 ~4.8, era-adjusted node counts); 2025–2026 is the first sustained sub-1× regime |
| 8 | What is the equilibrium? Does price, fees, or demand close the loop? | **Open.** The model measures a ratio; it does not close the dynamic loop (N ↔ fees ↔ price). Framed as a dynamic system in the companion §2 Q1 |

**Where the answers live:** deep-question first answers Q1–Q5 (equilibrium,
attribute pricing, the RIR family with DCIR, price-only internalization, 2040
scenarios) are in companion §2 with exact model output from
`tools/research/sccr_dynamics.py`; the cross-chain generalization (Phase V
horizon) is in companion §3. The falsification conditions that govern the claims
above remain in the core at §7.1.

**Open-question honesty.** Nothing in this agenda claims the fee market *will*
internalize these costs, nor that it *should* — the claim is narrower: the
question is well-posed, the drivers are identified, and each driver's lever on
the ratio is measured.


---

## References

1. Pigou, A. C. *The Economics of Welfare.* Macmillan, 1920.
2. Coase, R. H. "The Problem of Social Cost." *Journal of Law and Economics* 3 (1960): 1–44.
3. Aronoff, D., Praizner, J., Sabouri, S. "A Model and Estimation of the Bitcoin Transaction Fee." arXiv:2604.17183, 2026.
4. Liu, Y., Fang, Z., Cheung, M. H., Cai, W., Huang, J. "An Incentive Mechanism for Sustainable Blockchain Storage." arXiv:2103.05866, 2021.
5. BIP 141: Segregated Witness. Bitcoin Improvement Proposal, 2015–2017.
6. Sompolinsky, Y., Zohar, A. "Secure High-Rate Transaction Processing in Bitcoin." *FC 2015.*
7. Nakamoto, S. "Bitcoin: A Peer-to-Peer Electronic Cash System." 2008. https://bitcoin.org/bitcoin.pdf (§6 fee-as-incentive; §7 "storage should not be a problem").
8. Nakamoto, S. Emails to the Cryptography Mailing List, Oct–Nov 2008. Satoshi Nakamoto Institute archive: https://satoshi.nakamotoinstitute.org/emails/cryptography/ (esp. #2 bandwidth-in-dollars, #13 fees-as-inclusion-incentive).
9. Nakamoto, S. BitcoinTalk posts 188, 287, 441, 485 (2010). Satoshi Nakamoto Institute archive: https://satoshi.nakamotoinstitute.org/posts/ (post 188: "never more than 100K nodes" + node equilibrium; post 441: block-size threshold as "circuit breaker"; post 485: phased block-size increase).
