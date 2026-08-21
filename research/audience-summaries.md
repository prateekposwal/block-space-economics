# Audience Summaries — "Storage Cost Internalization in Bitcoin's Fee Market"

**Companion to:** `research/working-paper.md` v2.1.0 · `research/model-spec.json`
v2.0.1 · `research/roadmap.md` (adopted 2026-08-02)
**Status:** READY-TO-USE (2026-08-03) — four polished abstracts/explainers for
the submission and site, one per audience, written for the peer-review package.
**Numbers used (verified against the repo):** **LIVE series (2026-08-21) — SCCR
0.4433, 96.24% of blocks below 1×** (133 blocks, `/data/sccr_history.json`,
14-point record 08-02 → 08-21; see
`reports/research/regime-event-2026-08-21.md` / served
https://bitcoinsahi.com/research/regime-event-2026-08-21.html). **Dated banded
baseline (Aug 02–15):** SCCR ≈ 0.22–0.29 (dimensionless, dated captures at the
≥32K lower-bound census; **range across the true-N band: ~0.07–0.71**);
**frozen-capture reproduction 0.2186** (171 blocks, min 0.0584 / max 0.8320,
171/171 below 1×, reproduced by JS/Python/C); **08-02 rolling value 0.2151**
(169 blocks, rolling 24h window, 2026-08-02 session). SCCR is the **first member of the RIR family**
(Resource Internalization Ratios); every other member (UCIR, VCIR, RCIR, BCIR,
DCIR) is a research hypothesis, not a measured result. All surfaces must state
the banded claim — never the strong form ("100% below 1×" does not survive the
**Primary-source lower-bound census (≥32,000 known addresses via Bitcoin Core `getnodeaddresses`)** on the dated capture; working-paper §5.4).

---

## 1. For developers

**The one-liner:** Bitcoin charges per byte for the next block, but never for the
decades of storage that byte causes every full node to keep.

**The explainer.** Bitcoin's fee market prices *congestion* — who gets into the
next block (~10 minutes away). It does not price *permanence*: the data in that
block is then replicated and retained by the node network for years. We measured
how much of that permanent storage bill the fee market actually covers, using
live fee-history data from a Bitcoin Core node and a **primary-source
lower-bound census (≥32,000 known addresses via Bitcoin Core
`getnodeaddresses`)** — the RPC maximum, so a lower bound on the reachable
network.

**The number.** Fees cover roughly **22–29%** of the modeled 10-year replicated
storage cost of an average block (frozen-capture reproduction: **0.2186**;
latest live rolling value: **0.4433 (2026-08-21)**; dated 08-02 rolling: **0.2151**). The ratio moves with the fee market and
the node count — it is a distribution over time and parameters, not a constant.

**Why you can check it.** The measurement is reproducible: one frozen capture,
three independent implementations (JavaScript, Python, standalone C — no
dependencies), all agreeing per-block to 6 decimals. Every constant comes from a
single canonical spec (`research/model-spec.json` v2.0.1). No script redefines a
model constant. This is the first member of the RIR family — a measurement
template, not a verdict. The paper explicitly does not claim Bitcoin is broken;
it asks a measurable question and shows its work.

**If you take one thing:** run the reproduction kit yourself
(`research/reproduce/README.md`) and see the arithmetic agree across three
languages before you argue with the number.

## 2. For researchers

**The one-liner:** a reproducible, falsifiable first measurement of whether
Bitcoin's fee market internalizes a long-lived resource cost — and a template
for measuring the rest.

**The contribution.** The observation that fees may under-price storage is not
novel (Liu et al., 2021, arXiv:2103.05866 — the closest prior work, acknowledged
directly). The novel asset is the *measurement*: a storage-cost-internalization
ratio (SCCR) computed from live fee-history data, a primary-source lower-bound census
(≥32K via Bitcoin Core `getnodeaddresses`, a documented lower bound), and a canonical model spec, reproduced by
three independent implementations. We document our own v2.0.0 correction
transparently (a duplicated time-horizon term, fixed; the direction of the
finding survived), reconcile two cost models that disagreed by 16.4×
(dimensionless: a 164× denominator gap ÷ a 10× bug), and bound the result with a
joint Monte Carlo (99.9% of draws below 1× under the current N band; 99.8%
under the old band).

**The numbers.** **Live (2026-08-21): SCCR 0.4433, 96.24% below 1×** (see regime-event
note); dated banded estimate: **SCCR ≈ 0.22–0.29** (dimensionless) at the
≥32K census; frozen-capture reproduction **0.2186**; 08-02 rolling **0.2151**;
~98.7–100% of sampled blocks below 1× at N=32K (the strong "100%" form does not
survive the lower-bound census on the dated capture — stated honestly). 1× is a descriptive
calibration point, not a normative target; voluntary participation weakens the
welfare interpretation but not the measurement.

**The framework.** SCCR is Metric #1 of the RIR family — per-resource
internalization ratios for storage, UTXO state, validation, relay, propagation,
and indexer serving. Every other member (UCIR, VCIR, RCIR, BCIR, DCIR) is a
**research hypothesis**, gated by the 4-question gate (is the resource real? is
the cost reproducibly estimable? is the fee contribution comparable? is the
answer interesting?) and promoted only by the same evidence ladder. The paper
states its falsifiers in advance (§7.1). We invite reproduction, challenge, and
extension.

## 3. For investors

**The one-liner:** a live, auditable ratio that tracks how much of Bitcoin's
permanent storage bill the fee market covers — a new window into the network's
real resource economics.

**The explainer.** Every Bitcoin transaction pays a fee for the next block, then
imposes a decades-long storage cost on the node network. We measured the ratio
between those two numbers — the **Storage Cost Coverage Ratio (SCCR)** — live,
from real fee data and a primary-source lower-bound census (≥32,000 known
addresses via Bitcoin Core `getnodeaddresses` — the RPC cap, not a complete
enumeration). Today
fees cover roughly **22–29%** of modeled 10-year storage cost at N=32K
(**~7–71% across the true-N band**) (latest live
reading 2026-08-21: **0.4433**; frozen-capture reproduction: **0.2186**).

**Why it matters for capital allocation.** The ratio is linear in BTC price: at
today's fee levels, SCCR crosses 1× — fees fully covering modeled storage cost —
near **~$283K BTC** (a pure price effect; the storage-cost denominator is
USD-denominated and price-invariant). It falls when the node count grows
(inversely proportional to N), and it has historically exceeded 1× in the
2017–2024 fee-peak years. So this is not a static verdict on the network; it is
a *live instrument* that moves with price, fees, node count, and storage costs —
updated daily, reproducible by anyone.

**The honest scope.** The paper measures; it prescribes nothing. 1× is a
descriptive calibration point, not a target. The ratio covers the storage leg of
a broader resource economy (validation, bandwidth, relay, UTXO maintenance are
named research hypotheses — not yet measured). It is one input among many, and a
measurement, not an investment recommendation.

## 4. For the general public

**The one-liner:** Bitcoin charges for the next 10 minutes of block space — but
not for the forever-storage every transaction creates. We measured the gap.

**The explainer.** Think of Bitcoin as a public ledger. Every payment is written
into a "block" and stored forever by computers all over the world. The fee you
pay competes for space in the *next* block (~10 minutes away) — but nobody pays
for the decades of storage that follows. That storage bill is real: every full
node's disk, bandwidth, and electricity, year after year.

**The number.** We measured the gap: transaction fees currently cover roughly
**one-fifth to one-third (22–29%)** of the modeled 10-year storage cost of an
average block. The latest live measurement (2026-08-21): **about 44.3% (0.4433)**; the dated
frozen-capture reproduction anyone can run: **0.2186**. Most blocks' fees fall
below their estimated storage cost; a few high-fee blocks exceed it.

**The honest caveats.** This is not a claim that Bitcoin is broken — the fee
market solves block-space allocation well. It is a measurement with the math
shown in public: anyone can reproduce it from the published data in three
different programming languages and get the same answer. Node operators run
nodes voluntarily and can prune their data, so the storage cost is avoidable,
not forced — which weakens the "unfairness" reading but not the measurement.
This is the first member of a family of such measurements (validation, relay,
UTXO state), the rest still open questions.

**The bottom line:** Bitcoin's fee market prices *now*; this research starts
measuring what it prices *forever*.

---

*Bitcoin Sahi Research Council — Audience summaries for working-paper v2.1.0
(2026-08-03). Four audiences: developers / researchers / investors / general
public. All figures banded or capture-dated; see working-paper §5 for the full
point-in-time discipline.*
