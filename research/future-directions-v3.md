# Future Directions (v3.0) — Deep Questions, First Answers, Cross-Chain

**Companion to:**
> **Re-base note (2026-09-17):** the preview tables below use the pre-re-base baseline (N = 32,000, L_net $5,627.80, SCCR 0.2228). N is now measured at 26,586, so L_net is $4,675.65 and the baseline SCCR is 0.2228 x 1.2036 = 0.2682. Values are retained as computed.
 `research/working-paper.md` v2.2.0 (core paper) · `research/model-spec.json` v2.1.1
*Bitcoin Sahi Research Council — Bitcoin Resource Accounting program · 2026-08-03*

> **STATUS: PROGRAM / AGENDA MATERIAL — CLEARLY DISTINCT FROM THE MEASURED SCCR PAPER.**
> This document is the v3.0 research-program companion, **not part of the measured
> paper** (`research/working-paper.md` §1–§9; the paper's §10 is only a compact pointer to this
> agenda). **None of the RIR-family members named here (UCIR/VCIR/RCIR/BCIR/DCIR) are
> measured** — SCCR is the only ESTABLISHED METRIC (roadmap §4). This agenda is **picked
> up AFTER the measurement paper ships and after external reproduction (D5) lands**
> (roadmap §4): it is **not a submission artifact**, and every number here is model
> arithmetic on assumptions, not a measured claim. It does not substitute for the
> hard, slow work of getting an outside skeptical human to independently rerun the
> paper's numbers. The assumption taxonomy governing this agenda mirrors the core
> paper's (§7.2): Type C deliberate choices vs Type M empirical risks (roadmap §12).

This companion carries the forward-looking content that was **deliberately split
out of the core working paper** (second-review restructure, 2026-08-03): the v3.0
agenda (§1), the deep-question first answers (§2), and the cross-chain
generalization (§3). The core paper is a *measurement*; this document is the
*research-program* extension. The plan-of-record lives in
`research/roadmap.md` (§8 Phase IV first answers, §9 Phase V cross-chain, §11
post-publication agenda); this companion is the paper-side record with exact
model output.

---

## 1. The v3.0 Agenda: When Would the Fee Market Naturally Internalize These Costs?

**Trajectory.** v2.0 asked and answered a *measurement* question: **"Can we measure whether the fee market internalizes long-term storage costs?"** — the SCCR is that measurement. The next evolution of this program (v3.0) moves from measurement to *economic dynamics*: **"Under what economic conditions would the fee market naturally internalize these costs?"** Instead of asking how large today's gap is, v3.0 asks which parameter paths — BTC price, fee levels, node counts, storage costs, payment-layer substitution — close the gap on their own, and whether any endogenous mechanism does so.

**The v3.0 research agenda is the following eight questions.** Preliminary computations at the live fee level (canonical model-spec v2.1.1 quantities; live `fee_history` capture, 2026-08-02; baseline SCCR = 0.2228 (dimensionless) at N=32K, T=10 yr, C=$925/yr) are reported as previews; full derivations, assumptions, and sensitivity detail are in the accompanying analysis report.

| # | Question | Headline model output (live baseline) |
|---|---|---|
| 1 | Storage horizon: SCCR at T = 5, 10, 20, 30, 50 yr | 0.446 / 0.223 / 0.111 / 0.074 / 0.045 (inverse-linear in T) |
| 2 | Storage 10× cheaper: C = $92.5/yr (SSD cost collapse) | SCCR = 2.228 — the gap flips sign; fees would over-cover storage |
| 3 | BTC = $500,000 | SCCR = 1.768; average crosses 1× at ~$283K (live baseline) |
| 4 | Fees sustained at 100 sat/vB for 5 yr | fee_USD ≈ $63,018/block (1M vB) vs L_net ≈ $5,628 (T=10) → SCCR ≈ 11.2 (22.4 at T=5); crosses 1× at ~9 sat/vB (T=10) |
| 5 | Lightning moves 90% of payments off-chain | Two-sided: lower on-chain fee demand ↓SCCR; higher-value residual traffic ↑SCCR — net effect is an open empirical question |
| 6 | Nodes double / triple: N = 32K → 64K → 128K | 0.223 → 0.111 → 0.056 (inverse-linear in N) |
| 7 | Can SCCR reach 1 without protocol changes? | Historically yes: SCCR averaged **above 1×** in 2017–2024 fee-peak years (2017 avg ~10.0, 2021 ~8.0, 2023 ~5.0, 2024 ~4.8, era-adjusted node counts); 2025–2026 is the first sustained sub-1× regime |
| 8 | What is the equilibrium? Does price, fees, or demand close the loop? | **Open.** The model measures a ratio; it does not close the dynamic loop (N ↔ fees ↔ price). Framed as a dynamic system in §2 Q1 below |

**Method notes for the agenda.** Q1–Q4, Q6, and Q7 are directly computable from the canonical model because SCCR is a simple homogeneous function of its drivers: `SCCR = fee_USD / L_net = fee_BTC × P × R_blocks / (C × T × N)` (dimensionless). Q5 requires a demand-side model of what moves off-chain and at what value per byte — outside the current model, and therefore flagged as reasoning-plus-assumption rather than computation. Q8 is the deep question: whether Bitcoin's fee market has a self-correcting mechanism (e.g., node attrition raising the per-node burden, or scarcity rents raising fees) that internalizes storage costs endogenously. That is the v3.0 centerpiece, and we state honestly that the current framework cannot settle it — it can only bound the parameter space in which the answer would flip.

**First answers (2026-08-02 addendum):** five deeper questions extending this
agenda — the equilibrium force (Q1), attribute pricing (Q2), the RIR family with
DCIR (Q3), the price-only internalization path (Q4), and the 2040 scenarios
(Q5) — are answered in **§2** below with exact model output from
`tools/research/sccr_dynamics.py`. The cross-chain generalization of the
framework (Phase V) is sketched in **§3**.

**Open-question honesty.** Nothing in this section claims the fee market *will* internalize these costs, nor that it *should*. The claim is narrower: the question is now well-posed, the drivers are identified, and each driver's lever on the ratio is measured. Whether any economic force actually pulls the system toward internalization is the v3.0 research question.

## 2. Deep Questions — First Answers (v3.0)

*Addendum 2026-08-02, within the **Bitcoin Resource Accounting** program (see
`research/roadmap.md`; SCCR is Metric #1 of the RIR family). This section answers
the five deeper questions extending the §1 agenda. All computations use the
canonical model-spec v2.1.1 quantities and the §1 live baseline
(SCCR = 0.2228 at N=32K, C=$925/yr, T=10 yr, P≈$63K, ~2 sat/vB), are regenerated
by `tools/research/sccr_dynamics.py` (JSON: `tools/research/sccr_dynamics_output.json`),
and are cross-checked against the frozen-capture reproduction (SCCR = 0.2186,
171 blocks, `tools/research/reproduce.py`). Where a result is judgment rather
than model output, it is labeled **JUDGMENT**.*

### Q1 — What economic force pushes SCCR toward equilibrium?

**Model output (the static map).** SCCR is homogeneous in its drivers, so each
lever's direction is exact:

| Scenario (one lever at a time) | P (USD) | Fee level | N (nodes) | C (USD/yr) | fee_USD/block | L_net USD | **SCCR** |
|---|---|---|---|---|---|---|---|
| Baseline (today) | 63,000 | ~2 sat/vB | 32,000 | 925 | $1,253.87 | $5,627.80 | **0.2228** |
| Price only: BTC = $1M | 1,000,000 | ~2 sat/vB | 32,000 | 925 | $19,902.77 | $5,627.80 | **3.5365** |
| Fees only: 5 sat/vB | 63,000 | 5 sat/vB | 32,000 | 925 | $3,150.44 | $5,627.80 | **0.5598** |
| Nodes only: N = 64K | 63,000 | ~2 sat/vB | 64,000 | 925 | $1,253.87 | $11,255.61 | **0.1114** |
| Storage only: C ÷ 2 | 63,000 | ~2 sat/vB | 32,000 | 462.50 | $1,253.87 | $2,813.90 | **0.4456** |

**Model output (the joint 4-way scenario: BTC $1M, fees up, nodes up, storage
cheaper):**

| Scenario | P (USD) | Fee level | N | C | fee_USD/block | L_net USD | **SCCR** |
|---|---|---|---|---|---|---|---|
| 4-WAY: $1M, 5 sat/vB, N=64K, C/2 | 1,000,000 | 5 sat/vB | 64,000 | 462.50 | $50,006.97 | $5,627.80 | **8.8857** |
| 4-WAY alt: $1M, 10 sat/vB, N=64K, C/2 | 1,000,000 | 10 sat/vB | 64,000 | 462.50 | $100,013.94 | $5,627.80 | **17.7714** |
| 3-way (no N): $1M, 5 sat/vB, C/2 | 1,000,000 | 5 sat/vB | 32,000 | 462.50 | $50,006.97 | $2,813.90 | **17.7714** |

**Verdict (model output):** the stated 4-way scenario **overshoots** — SCCR ≈
**8.9** (coverage, not gap), i.e. fees would over-cover modeled storage cost by
~8.9× at 5 sat/vB, ~17.8× at 10 sat/vB. The price lever alone ($1M, everything
else fixed) gives **3.54×** — it crosses 1× by itself. It does **not** converge
toward 1 in any of the computed paths; every path that includes the price move
overshoots.

**Why the directions are what they are (model output + one honest correction to
the naive intuition):** three of the four levers push SCCR **up** (price, fee
level, cheaper storage — the last because `L_net ∝ C`, so a smaller cost
denominator is over-covered by the same fees; the *absolute* externality
shrinks even as the ratio rises). **Only node growth pushes SCCR down**
(`L_net ∝ N`). So "cheap storage" is *not* a counter-force to internalization in
ratio terms — it is a *co-force*; the true counter-force is node growth. This
matters for the dynamic reading: the ratio and the absolute externality can move
in opposite directions under C.

**The dynamic-system framing (JUDGMENT — not computable from the static model).**
The only *endogenous* negative feedback in the model's structure is at the N
margin: under-pricing → node operators prune or exit → N↓ → L_net↓ → SCCR↑ →
under-pricing eases. With a linear-response assumption `dN/dt = α·(SCCR − 1)`
(node exit proportional to under-pricing) and `SCCR = K/N`, this loop is locally
stabilizing at SCCR = 1. But two forces break it: (i) exogenous node entry
(cost-deflation + hobbyist adoption) adds a positive `γ` to `dN/dt`, which moves
the fixed point to `SCCR* = 1 − γ/α` — **structurally below 1**, a persistent
partial-internalization equilibrium, not full coverage; (ii) the model contains
**no measured response functions** for N(·) or for fee-demand as a function of
price, so whether a stable fixed point exists in reality is **not settled by
this model** — the model can only show the conditions under which one would
exist. **Honest answer: no stable fixed point is established in the model**; the
4-way overshoot shows the price lever alone would blow past 1× long before the
slow N-margin loop could equilibrate it.

### Q2 — Is Bitcoin optimizing one resource, or many, with one price?

**Framing (no new computation — the paper's central mechanism question).** The
fee market sells **one bundled good** — a ledger slot in the next block — at
**one price** (sat/vbyte, modulated by SegWit weight). The question is whether
that single price is informative about **one attribute** (congestion) or whether
it carries signal about **many** (persistence, state, validation). This is the
attribute-pricing question: a price can clear a market for a composite good
while being informative about only the dominant marginal attribute.

The **planned empirical answer** is the attribute-pricing regression (the "ONE
experiment"): regress per-block fee density (USD/byte, sat/vbyte) on attribute
descriptors — data-bearing vs financial payloads, witness vs non-witness
residency, script class, output/UTXO contribution — over the captured block
history. If attribute descriptors load significantly, the single price carries
multi-attribute signal; if only congestion loads, it is single-attribute. This
regression is a Phase IV deliverable (roadmap §8 Q2), not yet run.

The **SegWit natural experiment** is the discriminator: BIP 141 (Aug 2017)
imposed a *protocol-level attribute price* — witness data at 1 weight unit per
byte vs 4 for non-witness. The market's response (the inscription regime from
2023, and SegWit financial adoption before it) demonstrates the price is *not*
single-attribute: the protocol itself priced an attribute, and demand moved
along it. SegWit therefore validates that attribute pricing is both feasible and
behaviorally real in Bitcoin's fee market — which is precisely why the SCCR
family (Q3) is well-posed: if the fee price can carry attribute signal, then
per-resource internalization ratios are measurable objects, not category errors.

### Q3 — Can every Bitcoin resource have its own internalization ratio?

**Yes, by construction — the RIR family.** The unified family formalizes the
core paper §8.4's Cost Internalization Ratio (family name) into a per-resource
family:

> **RIR_i = fee_contribution_toward_resource_i / estimated_lifetime_cost_of_resource_i**

| # | Metric | Resource | Cost leg (denominator) | Fee leg (numerator) | Status |
|---|---|---|---|---|---|
| **1** | **SCCR** | Storage (permanent replication) | `C·T·N / R_blocks` (USD/block) | block fee (USD) | **MEASURED — this paper** (0.2228 live baseline; §5) |
| 2 | **UCIR** | UTXO set / state permanence | RAM/lookup per lifetime UTXO | per-tx fee allocation | Phase II — cost side exists (`utxo_cost_model.py`); fee-side attribution open |
| 3 | **VCIR** | Validation (script-class CPU) | CPU per tx class (pinned-benchmark bound only) | per-tx fee | Phase II — demoted to bounded analytical sub-study (4-question gate, roadmap §4) |
| 4 | **RCIR** | Relay (marginal bandwidth) | tx size × replication × $/GB | per-tx fee | Phase III fill-in (analytical bounds) |
| 5 | **BCIR** | Propagation (witness size vs delay) | topology-dependent delay cost | per-tx fee | Phase III/IV — research-hard |
| 6 | **DCIR** | Indexer / API serving | index storage + serving cost (commercial) | indexer/API fees (off-chain) | Phase III — fee-market numerator structurally near-zero; likely persistent-negative row |

**DCIR (the indexer leg, added in the prior review — verified absent from
`roadmap.md` as of 2026-08-02 and now added):** indexers (block explorers, API
providers) maintain searchable copies of the same ledger. Their cost is real and
commercial, but their revenue is **off-chain** (subscriptions, API pricing) — the
on-chain fee-market numerator is structurally near-zero. DCIR is therefore the
family's likely *persistent-negative* row: near-zero internalization **by
design**, not by accident. It is still a legitimate RIR — the framework's value
is making the "the fee market does not pay indexers" fact *measured*, not
asserted.

**SCCR is Metric #1** — the only measured member of the family, and the
template (canonical spec → live capture → three implementations → cross-check)
every other metric inherits. Roadmap updated: DCIR added to Phase III + the
coverage matrix.

### Q4 — Could Bitcoin eventually price everything without protocol changes?

**Model output (storage leg):** SCCR crosses 1× at **P* ≈ $282,765 ≈ $283K**
at the live baseline (frozen-capture cross-check: **$288,296 ≈ $288K**). If BTC
reaches that price with today's fee level, storage is **fully internalized with
zero protocol change** — a pure price effect, because the storage-cost
denominator is USD-denominated and price-invariant while the fee numerator
scales linearly with price. Target table: 0.5× at $141K, 1.0× at $283K, 2.0× at
$566K, 3.5× at $990K.

**Extension method (JUDGMENT — the numerator/denominator structure, not a
computed number; sharpened 2026-08-03 post-advisor review):** formally, the same
price lever applies to any RIR whose denominator is a price-invariant cost and
whose numerator is a USD fee (`P*_i = P₀ × target/RIR_i,₀`). For every resource
except storage that lever is **economically hollow**, and the reason must be
stated precisely. The common shorthand — "storage is USD-denominated;
validation/UTXO are CPU/RAM-denominated; so price solves one and not the other"
— is only half right: validation hardware and operator time have USD opportunity
costs, so in the *aggregate* a price rise would mechanically lift any resource
ratio, storage or not. The sharper distinction is that **the fee's charging
attribute does not match the other cost drivers**:

- **Storage — matched in attribute, mismatched in time.** Storage cost is a
  homogeneous per-byte USD liability (`cb` USD/(byte·yr)) incurred *after* the
  fee; the fee is charged per (v)byte. The per-byte attribute matches, so a
  price rise raises USD fee revenue against a fixed USD cost stream — price
  genuinely closes the per-byte intertemporal gap (P* ≈ $283K).
- **Validation — mismatched in attribute.** The fee is per-transaction (sat/vB);
  the validation cost is per-transaction-*class* (script complexity, signature
  count). One price cannot distinguish classes, so price appreciation inflates
  every transaction's fee uniformly without reallocating toward — or signaling
  anything about — the costly classes. The ratio would move; the move is a unit
  effect, not internalization.
- **UTXO — mismatched in stock vs. flow.** The UTXO cost is a *stock*
  (RAM/lookup driven by live-set size, per lifetime UTXO); fees are a *flow*
  (per transaction). Price appreciation inflates the flow without touching the
  stock driver.
- **Relay/bandwidth — mismatched in payer/receiver structure.** Marginal
  propagation cost is incurred per recipient node; the fee is paid once by the
  sender. Price does not change the replication topology that sets the burden.

**Honest answer, sharpened:** price can lift the aggregate ratio for *any*
USD-priced resource — that is arithmetic. What it cannot do is repair a mismatch
between the fee's charging attribute and the resource's cost driver. Storage's
per-byte attribute matches, so price genuinely internalizes it; validation
(per-class), UTXO (stock), and relay (per-recipient) do not match, so for them
the price lever is a unit effect. **There is no single "resource market":** there
is one block-space market (congestion) whose single price carries a genuine
per-byte signal and only accidental signal about the other resources. Those need
state-management or fee-structure levers — which is why UCIR's data path and
VCIR's benchmark path are the actual Phase II work.

### Q5 — What happens in 2040?

**Model output** (all 2040 rows at P = $63K unless noted; C ÷ 10 = SSD
deflation, N × 2 = 32K → 64K):

| 2040 scenario | P (USD) | Fee level | N | C | fee_USD/block | L_net USD | **SCCR** |
|---|---|---|---|---|---|---|---|
| Cost collapse + node growth, fees flat | 63,000 | ~2 sat/vB | 64,000 | 92.50 | $1,253.87 | $1,125.56 | **1.1140** |
| Cost collapse + node growth, fees 10 sat/vB | 63,000 | 10 sat/vB | 64,000 | 92.50 | $6,300.88 | $1,125.56 | **5.5980** |
| Fees 10 sat/vB, C & N today | 63,000 | 10 sat/vB | 32,000 | 925 | $6,300.88 | $5,627.80 | **1.1196** |
| Node growth dominant: N ×4 (128K), C flat, fees flat | 63,000 | ~2 sat/vB | 128,000 | 925 | $1,253.87 | $22,511.22 | **0.0557** |
| Moderate: C ÷ 2, N × 2, fees flat | 63,000 | ~2 sat/vB | 64,000 | 462.50 | $1,253.87 | $5,627.80 | **0.2228** |

**Two honest corrections to the common intuition.** (i) **SSD deflation does NOT
push SCCR down — it pushes it up.** `L_net ∝ C`, so C ÷ 10 shrinks the cost
denominator 10× and the same fees over-cover it: SCCR = 1.114 even at today's
flat fee level, and 5.6 at 10 sat/vB. The *absolute* externality collapses
toward ~free, but the *ratio* explodes. (ii) The **0.056 anchor belongs to the
node-growth-only branch** (N × 4 → 128K, C flat, fees flat), reproduced exactly
(0.0557 — same as §1 Q6). Node growth is the only lever that
deepens the ratio gap; deflation and fees both close it.

**The two genuinely divergent futures are therefore:** (a) *cost-deflation
world* — storage approaches free, SCCR ≥ 1.11, the externality evaporates by
deflation of the denominator (nothing to internalize); (b) *node-growth-dominant
world* — replication spreads the same cost over 2–4× more nodes, SCCR falls to
0.056–0.11, the gap deepens. A sustained 10 sat/vB regime pushes SCCR past 1 in
either world (1.12 at today's C/N; 5.6 with deflation).

**Honest tension, not a prediction:** the 2040 question is really *which lever
dominates over a decade* — C-deflation (ratio ↑) vs N-growth (ratio ↓) vs
fee/price demand (ratio ↑). The model maps every lever's direction and magnitude
exactly; it **cannot** predict their relative rates, and no claim is made about
which future obtains. If BTC price also appreciates (Q4), the price lever
dominates both branches and SCCR crosses 1 regardless.

## 3. Cross-Chain: Distributed-Systems Economics (Phase V horizon)

**Framing (no new computation — research horizon, not a near-term
deliverable).** The framework's core structure — **one-time payment → long-lived
shared resource** — is not Bitcoin-specific. Any distributed system with a
one-time fee and a persistent replicated resource admits an RIR question. The
generalization turns this paper into *distributed-systems economics*. Full
treatment in `roadmap.md` §9 (Phase V); the honest fit map:

| System | Long-lived shared resource | One-time payment | RIR well-defined? | Fit |
|---|---|---|---|---|
| **Bitcoin** | permanent replicated history | tx fee | ✅ | This paper (SCCR = Metric #1) |
| **Celestia** | data-availability (blob space, sampled) | blob fee | ✅ **clean** | High — DA is exactly a long-lived shared resource paid per blob |
| **Arweave** | permanent storage (endowment) | one-time permaweb fee | ✅ **clean** | High — native one-time-payment→permanent-storage structure |
| **Solana** | state + history (high per-slot growth) | tx fee + **rent** | ⚠️ partial | Medium-high — rent already prices state, so the RIR measures whether rent *internalizes* |
| **Ethereum** | state (accounts/contracts) + history | gas (incl. SSTORE state-cost) | ⚠️ partial | Medium — gas has state-cost components; state rent historically failed (EIP-3521 etc.) |
| **Filecoin** | storage deals (time-bound) | deal payments | ⚠️ different | Medium — fee and cost live in the *same* storage market, so internalization is near-total by construction; the real question is replication/retrieval coverage |
| **IPFS** | content-addressed storage (voluntary replication) | storage payments (Filecoin) | ⚠️ weak | Low-medium — no consensus-level fee market for storage; RIR degenerates |

**Honest caution (unchanged from roadmap §9 / Phase V):** compare **METHODOLOGY**,
never rankings; do **not** compare BTC-ETH early — different cost structures
(rent vs no-rent, history size, node economics) make raw ratio comparisons
meaningless before the method is cross-validated. Some systems (Arweave,
Celestia) are cleaner fits than others (Ethereum state rent is a different
mechanism; IPFS has no fee market to measure). This is the research horizon for
Phase V, explicitly not a near-term deliverable.


---

*Bitcoin Sahi Research Council — The Bitcoin Block Space Problem (core paper v2.2.0; this companion carries the v3.0 agenda)*

*Component docs: problem_statement · bip141_analysis · pruning_externality_analysis · utxo_cost_note · verification_appendix · history-of-bitcoin*

---

*Bitcoin Sahi Research Council — Companion to the working paper v2.2.0 (storage
leg, Metric #1 of the RIR family). Cross-references: core paper `working-paper.md`
§5 (findings), §7.1 (falsifiers), §8.4 (terminology); plan-of-record
`research/roadmap.md` §8/§9/§11.*
