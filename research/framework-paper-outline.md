# Bitcoin Resource Accounting: A General Framework — Theory Paper Outline

*(Created 2026-08-03, post-advisor review; restructured 2026-08-03 to the
adviser's theory-first shape. This is the OUTLINE/PLAN for the foundational
synthesis paper — NOT the paper itself. Nothing here is a result; results live in
Paper 1 and future Papers 2–3. Evidence status is labeled per the roadmap §4
discipline separation.)*

**Status:** DRAFT OUTLINE — adopted as the Paper-4 plan (2026-08-03), sharpened
**Freshness note (2026-08-21):** the SCCR numbers shown in Figure 1 and §6 are the
**dated Aug 02–15 banded baseline** (~0.22–0.29, ~99–100% below 1×). The **live
series has since moved to a new regime — 0.4433 / 96.24% below 1× on 2026-08-21**
(`/data/sccr_history.json`, 14-point record). The paper, when written, must carry
the live reading with its capture date, never a frozen band: see
`reports/research/regime-event-2026-08-21.md` (served:
https://bitcoinsahi.com/research/regime-event-2026-08-21.html).
to the advisor's emphasis 2026-08-03. The program's foundational paper is a
**mostly-theory paper with minimal equations** — the framework-defining paper,
the one that could **"become the citation everyone references"** (advisor). It is
structured around five questions — *What is a resource? Which are scarce? Which
are priced? Which are shared? Which are externalized?* — with **SCCR as
Example #1, not the headline**. The storage paper remains Paper 1 of the series.
This outline matches the roadmap's Paper 1/2/3/4 framing (publication-plan
§intro): **Paper 1** = storage/SCCR (written), **Paper 2** = UTXO/UCIR,
**Paper 3** = validation/VCIR (bounded), **Paper 4** = this unified framework +
Resource Coverage Matrix (incl. DCIR). Per roadmap §6 amendment 1, the prose is
NOT written before Phase I publishes; this is the plan for what is written next
(advisor: write THIS next, not UCIR/validation).

**Evidence-status key (used throughout):**
- 🟢 **ESTABLISHED** — measured + reproduced (SCCR only)
- 🟡 **HYPOTHESIS** — named, not yet modeled/measured/reproduced (UCIR/RCIR/DCIR)
- 🔴 **HYPOTHESIS (research-hard)** — named, gate-failed or data-blocked (VCIR/BCIR)
- ⚪ **FRAMING** — conceptual/economic argument, not a measurement (no evidence claim)

**Minimal-equations discipline (advisor):** the paper carries exactly ONE
equation — the Resource Internalization Ratio definition,
`RIR_i = fee_contribution_toward_resource_i / estimated_lifetime_cost_of_resource_i` —
and it appears as a definition, not a derivation. No new arithmetic is derived
in this paper; Paper 1 owns the SCCR arithmetic, and future papers own theirs.
The theory is stated in prose and taxonomy, not in formula count.

---

## Paper title (working)

**Bitcoin Resource Accounting: A General Framework for Measuring Fee-Market
Internalization of Long-Lived Shared Resources**

## The paper's one-paragraph thesis (draft for the outline)

Bitcoin's fee market prices one good — inclusion in the next block — at one price.
But confirmed transactions create costs in *multiple* long-lived shared resources
(storage, UTXO state, validation CPU, relay bandwidth, propagation, indexer
serving), each with a different cost driver. The framework answers five questions
in order — **what counts as a resource, which resources are scarce, which are
priced, which are shared, and which are externalized** — then generalizes the
storage Cost Internalization Ratio (SCCR, Paper 1) into a per-resource family,
states which resources price can internalize and why, and provides a reproducible
construction template for each new metric. **Claimed scope: a measurement
framework, not a verdict; one established metric, six named hypotheses.** The
paper's value is that it makes the *questions* the contribution — a reader should
be able to cite this paper for "how to think about Bitcoin's resources," not for
any single number.

---

## Figure 1 — The Bitcoin Resource Map

One figure shows the entire framework at a glance. It appears in the working
paper (§1), the roadmap (§1), and this paper as **Figure 1**. The
Directly-Priced / Indirectly-Measured split is the visual anchor: the fee market
directly prices ONE good (block space); everything else is measured against that
price, with only storage measured today. Place it in the paper immediately after
the thesis paragraph, before §1.

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
      │congestion · the one good│     │ live 08-21: 0.44 · 96% < 1×    │
      │                         │     │ dated band: 0.22-0.29        │
      │  the fee market prices  │     │ ──────────────────────────────  │
      │    (~10-min horizon)    │     │      UTXO (UCIR) — FUTURE       │
      │                         │     │   VALIDATION (VCIR) — FUTURE    │
      └─────────────────────────┘     │      RELAY (RCIR) — FUTURE      │
                                      │    BANDWIDTH (BCIR) — FUTURE    │
                                      └─────────────────────────────────┘
```

*Figure 1 — The Bitcoin Resource Map. SVG version for the site:
`research/resource-map.svg`; ASCII asset: `research/resource-map.txt`.
"FUTURE" = research hypothesis, never an established metric.*

---

## Outline

### §1 What is a resource? (⚪ FRAMING — the ontology, first)

- **What this section contains:** the definitional ground, before any scarcity or
  pricing talk. A *resource* here means a **long-lived, shared, scarce input**
  that confirmed transactions consume over time: replicated history (storage),
  live ledger state (UTXO set), validation CPU, relay bandwidth, propagation
  delay, indexer serving. The section distinguishes (a) the **good the fee market
  sells** (a ledger slot in the next block), (b) the **resources transactions
  create costs in**, and (c) the **agents who bear those costs** (node operators,
  indexers, miners). Scope discipline: this paper is the framework + coverage
  matrix, not new measurements.
- **Evidence status:** ⚪ framing — the observation that fees under-price storage
  is already in the literature (Liu et al. 2021, arXiv:2103.05866 — acknowledged
  as closest prior work in Paper 1 §8.2); the framework's novelty is the
  *measurement template*, not the observation.
- **Key claims to avoid overstating:** no claim that any resource *is*
  externalized at economically significant scale; no claim about what *should*
  be priced.

### §2 Which resources are scarce? (⚪ FRAMING — the scarcity taxonomy)

- **What this section contains:** a taxonomy of *what runs out*. Block space is
  scarce per-block (hard cap, ~10-min horizon). Storage is scarce per-byte over
  an indefinite horizon (history grows forever). Validation CPU is scarce
  per-operation but elastic in hardware. State (UTXO) is scarce as a stock, not
  a flow. The section's point: **scarcity is not one thing** — each resource has
  its own constraint surface, so one price cannot clear them all.
- **Evidence status:** ⚪ framing — conceptual taxonomy; no measurements claimed.
- **Key claims to avoid overstating:** naming a scarcity is not measuring it.

### §3 Which resources are priced? (🟢 ESTABLISHED + ⚪ FRAMING — the one directly priced good)

- **What this section contains:** the direct side of Figure 1. The fee market
  **directly prices exactly one good**: block space (congestion, ~10-min
  horizon) — the short-horizon market that clears efficiently (Paper 1 §8.3).
  Everything else is *indirectly measured*, not priced: the fee is charged per
  (v)byte, and storage's per-byte attribute happens to match (Paper 1 §5, §11
  Q4: P* ≈ $283K), but the match is the exception that motivates the framework,
  not the rule.
- **Evidence status:** the "directly priced" list is ⚪ framing plus Paper 1's
  measurement; storage leg 🟢 (SCCR measured).
- **The section's central question:** what does the single sat/vB price actually
  carry signal about — one attribute (congestion) or many? (Attribute pricing;
  companion `future-directions-v3.md` §2 Q2.) Answered empirically in a later paper, framed here.

### §4 Which resources are shared? (⚪ FRAMING — the one-time-payment → long-lived-shared-resource structure)

- **What this section contains:** the structural core of the framework — the
  **one-time payment → long-lived shared resource** pattern. A transaction pays
  once; the cost it creates is borne by many, over time, involuntarily (node
  operators who neither created the transaction nor were compensated). Three
  mismatches structure the whole family (sharpened 2026-08-03 per advisor
  review; companion `future-directions-v3.md` §2 Q4):
  - **Attribute mismatch** — fee per-(v)byte vs. validation cost per
    transaction-*class* (VCIR);
  - **Stock/flow mismatch** — fee is a *flow* vs. UTXO cost is a *stock*
    (UCIR);
  - **Payer/receiver mismatch** — fee paid once by sender vs. relay cost per
    recipient node (RCIR/BCIR); indexer cost is commercial, revenue off-chain
    (DCIR).
  - Consequence: price can lift any aggregate ratio as a *unit effect*, but that
    is not internalization; **there is no single "resource market."**
- **Evidence status:** ⚪ framing — the mismatch taxonomy is an economic
  argument; no VCIR/UCIR/RCIR/DCIR measurement exists yet. Must NOT be presented
  as established result.

### §5 Which resources are externalized? (🟢 + 🟡 — the measurement question and the one equation)

- **What this section contains:** the question that makes the framework
  empirical. "Externalized" here means *not covered by the one-time fee* — the
  share of each resource's long-lived cost that the fee market does not
  internalize. This is where the paper introduces its **only equation**, as a
  definition, not a derivation:

  > **RIR_i = fee contribution toward resource i / estimated lifetime cost of resource i**

  Every quantity is tagged with units; ratios are dimensionless; captures are
  dated. The section then walks the reader through *how* the ratio operationalizes
  "externalized" for a generic resource — no numbers, no derivations.
- **Evidence status:** 🟡 the generic definition is a hypothesis until applied;
  🟢 the template is validated by SCCR (Paper 1 §6.5: three independent
  implementations agreeing per-block).

### §6 Example #1: the storage account (🟢 ESTABLISHED — summarized, not the headline, not re-derived)

- **What this section contains:** Paper 1's SCCR as the *worked example* of the
  framework — deliberately placed after the theory, and summarized, NOT the
  headline of the paper. Definition, census (≥32K, primary source), the
  dated Aug 02–15 banded result (~22–29% coverage, ~99–100% below 1×) AND the
  live series (0.4433 / 96.24% below 1× on 2026-08-21 — see regime-event note),
  knife-edge thresholds (N ≈ 7.1K / P* ≈ $283K), the v2.0.0 10× correction as
  an example of the framework self-correcting, and the reproduction kit (3
  implementations + frozen capture).
- **Evidence status:** 🟢 ESTABLISHED METRIC (validated). Point to Paper 1 for
  full derivation; do not re-derive. The reader should come away saying "the
  framework works" — not "storage is 29%."

### §7 How to construct the next ratio (🟢 template + 🟡 discipline)

- **What this section contains:** the reproducible construction template every
  metric inherits (roadmap §3): **canonical spec (model-spec.json) → live
  capture → independent implementations → cross-check**, plus the **4-question
  gate** (roadmap §4: is the resource real? is the cost estimable reproducibly?
  is the fee contribution comparable? is the answer interesting?) and the Q2
  rule (a metric that fails Q2 may appear as a "bounded analytical estimate"
  row, never a headline ratio).
- **Evidence status:** 🟢 the template is validated by SCCR; the *application*
  to each new resource is 🟡 discipline, not a result.
- **Deliverable in the paper:** the general formula + units discipline (every
  quantity tagged, dated captures only) + the promotion path from hypothesis to
  metric.

### §8 What we will measure next (🟡/🔴 HYPOTHESES with gate verdicts)

- **What this section contains:** the honest "what we will measure, not what we
  have measured" statement for each remaining resource:
  - **UCIR (Paper 2):** cost side exists (`utxo_cost_model.py`); fee-side
    attribution open; data path R5-gated (deferred until Phase I ships).
  - **VCIR (Paper 3):** demoted to bounded analytical sub-study (Q2 fail);
    pinned-benchmark bounds only, never a headline ratio.
  - **RCIR:** analytical bounds (tx size × replication × $/GB); low priority.
  - **BCIR:** research-hard (no public topology data).
  - **DCIR:** structural argument for the persistent-negative row; measurement
    open (commercial cost data).
- **Evidence status:** all 🟡/🔴 hypotheses. Discipline: **never call these
  "established metrics" — always "proposed research directions"** (advisor's
  statement, roadmap §4).

### §9 Cross-chain: methodology, not rankings (⚪ FRAMING, Phase V horizon)

- **What this section contains:** the generalization to any system with
  one-time payment → long-lived shared resource (Arweave, Celestia, Solana,
  Ethereum, Filecoin, IPFS — roadmap §9 fit map); **compare METHODOLOGY never
  rankings; no early ETH-vs-BTC comparison**; each new system must pass the
  4-question gate before a metric is named.
- **Evidence status:** ⚪ framing + research horizon (explicitly not a
  deliverable of Paper 4 beyond the methodology statement).

### §10 What would falsify this framework (⚪ FRAMING — required before submission)

- **Primary-source falsifiable-claims table (2026-08-03, Satoshi's own claims as
  testable specimens):** the designer's statements — "never more than 100K nodes"
  (post 188), "storage should not be a problem" (§7), "nodes will have an
  incentive to receive and include all the transactions they can" (email #13),
  "The more burden it is to run a node, the fewer nodes there will be" (post 287),
  block-size threshold as a "circuit breaker" against "wasted disk space"
  (post 441) — become falsifiable hypotheses against the RIR measurements. Full
  verification (what is real vs. apocryphal) + the table: companion
  `research/satoshi-primary-source-note.md` §2/§4. This is Paper-4 material
  (framework-level falsifiers, roadmap Q1/Q6), NOT Paper-1 content; working-paper
  §8.3 carries only the compact designer-intent paragraph.

- **What this section contains:** the framework-level falsifiers, expanded from
  working-paper §7.1: (1) independent implementations cannot reproduce SCCR;
  (2) a better storage-cost model reverses the conclusion; (3) fees consistently
  exceed modeled long-term costs; (4) resource-cost attribution shown
  economically inappropriate (attribute-pricing regression finds no persistence
  signal); (5) pruning census shows the storage burden is avoidable at scale;
  (6) measured response functions close the dynamic loop at or above 1×.
- **Evidence status:** ⚪ framing — this section states failure conditions; it
  is what makes the framework scientific rather than rhetorical.

### §11 Conclusion + Resource Coverage Matrix (🟢 + 🟡 consolidated)

- **What this section contains:** the consolidated matrix
  (resource × cost-exists × fee-prices × measurable × metric × evidence-status)
  from roadmap §3/§8 Q3; the one-sentence honest summary: *one established
  metric, six named hypotheses, one reproducible template, zero unfalsifiable
  claims.*

---

## Appendix A — Evidence-status master table (for the paper)

| Metric | Resource | Evidence status | Gate verdict | Phase |
|---|---|---|---|---|
| **SCCR** | Storage | 🟢 **ESTABLISHED METRIC (validated)** — measured, 3 implementations agree, MC-bounded | PASS 4/4 | Paper 1 (done) |
| **UCIR** | UTXO state | 🟡 **HYPOTHESIS** — cost leg exists, fee leg open | PASS w/ carve-out (validation leg scoped out) | Paper 2 |
| **VCIR** | Validation | 🔴 **HYPOTHESIS (demoted)** — Q2 fail | FAIL Q2 → bounded sub-study | Paper 3 |
| **RCIR** | Relay | 🟡 **HYPOTHESIS** — analytical bounds only | PASS (Phase III fill-in) | Paper 3/4 |
| **BCIR** | Propagation | 🔴 **HYPOTHESIS (research-hard)** — no topology data | FAIL Q2/Q3 | Phase III/IV |
| **DCIR** | Indexer serving | 🟡 **HYPOTHESIS** — structural argument only | PASS (persistent-negative by design) | Paper 4 |

## Appendix B — What is NOT in this paper (anti-scope)

- No new measurements beyond SCCR (Paper 1 owns those; SCCR appears only as
  Example #1 in §6).
- No UCIR/VCIR/RCIR/BCIR/DCIR numbers — they do not exist yet; presenting them
  would be the exact overclaim the advisor flagged.
- No policy proposals, no normative claims about what should be priced.
- No cross-chain rankings.
- **No equation count beyond the single RIR definition** — minimal-equations
  discipline (§header).

---

## DONE vs LEFT

**DONE (verified, 2026-08-03 restructure):** outline restructured to the
advisor's theory-first shape — five-question spine (what is a resource / scarce /
priced / shared / externalized), SCCR demoted to Example #1 (§6), minimal-
equations discipline stated (single RIR definition), "citation everyone
references" positioning in the status block; **Figure 1 (The Bitcoin Resource
Map) added** with ASCII + SVG (`research/resource-map.svg`) + placement rule
(after the thesis paragraph); §8 carries the advisor's never-"established
metrics" discipline statement; roadmap §1/§4, working-paper §1 updated with the
same figure/discipline; publication-plan moderator pitch + D5 priority
reinforcement added (2026-08-03).

**LEFT / TODO (verified):** write the paper itself (this is the outline, not the
paper — do NOT start the prose before Phase I publishes, roadmap §6 amendment 1;
the advisor's sequencing: **write THIS next** after Phase I — before UCIR/
validation papers); Paper 2 (UCIR) data-path decision (R5-gated, deferred until
Phase I ships); Paper 3 (VCIR) pinned-benchmark study; Phase III RCIR fill-in;
Phase V cross-chain methodology note (research horizon). All metric promotions
require the roadmap §4 gate + evidence template.

---

*Bitcoin Sahi Research Council — Paper 4 outline (Bitcoin Resource Accounting:
A General Framework), 2026-08-03, restructured to advisor's theory-first shape.
Companion: roadmap.md §1/§3/§4/§8, publication-plan.md, working-paper.md
§1/§7.1/§11, docs/decisions/2026-08-02-publication-decisions.md.*
