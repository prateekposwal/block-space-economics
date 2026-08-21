# Phase I Publication Plan — "Storage Cost Internalization in Bitcoin's Fee Market" (Working Paper v2.1.0)

*Paper 1 of the **Bitcoin Resource Accounting** program (renamed 2026-08-02; the
program name is the framework identity — SCCR is Metric #1 — while this paper
keeps its descriptive title).*

**Status:** DRAFT (2026-08-02) — greenlit at roadmap adoption (Prateek, "continue :)");
publication decisions recorded 2026-08-02 (Prateek's directive) — see §7 + `docs/decisions/2026-08-02-publication-decisions.md`.
**Scope:** submit `research/working-paper.md` v2.1.0 (SCCR storage paper, now titled
**"Storage Cost Internalization in Bitcoin's Fee Market"**, keeping "The Bitcoin Block
Space Problem" as the program subtitle) with the archival-vs-pruned companion note
(`research/archival-vs-pruned-note.md`), **published simultaneously** (Prateek's
decision).
**v3.0 agenda --- explicitly NOT part of the submission.** `research/future-directions-v3.md`
(the v3.0 agenda companion) is **program/agenda material, not a submission artifact**:
none of the RIR-family members it names are measured, and it is picked up **after**
the paper ships and external reproduction (D5) lands (roadmap §4). The submission
package is the measured paper + its measured robustness note (archival-vs-pruned)
only; the agenda companion carries the same status line in its header.
**Renamed 2026-08-02:** from "The Bitcoin Block Space Problem: Does the Fee Market
Internalize Long-Term Storage Costs?" — the new title is the economics-native phrasing
(see §8.3 Cost Internalization Ratio) and avoids the protocol-critique reading a Core
reviewer flagged (reviewer-simulation.md Reviewer A objection 3).
**Paper-series framing (roadmap):** this is **Paper 1** (storage). The **Bitcoin
Resource Accounting** program continues as **Paper 2 (UTXO leg, UCIR)**, **Paper 3
(validation leg, VCIR as bounded study)**, **Paper 4 (unified Resource Coverage
Matrix, incl. the DCIR indexer leg)** — each builds on Paper 1's reproducible-metric
template. Do NOT mix Paper 2–4 content into Paper 1 (roadmap §6 amendment 1).
**Evidence discipline (post-advisor review, 2026-08-03):** SCCR is the ONLY
**ESTABLISHED METRIC (validated)**; UCIR/VCIR/RCIR/BCIR/DCIR are **RESEARCH
HYPOTHESES (not yet modeled/measured/reproduced)** and must be labeled as such in
every surface — the framework never overclaims (roadmap §4 evidence-status table;
Paper 4 synthesis outline in `research/framework-paper-outline.md`).
**Target:** arXiv (cs.CR / econ.GN) + Bitcoin Optech newsletter; r/BitcoinEngineering
already engaged (v1/v2 history).

---

## 0. Positioning aspiration — the frame, not the number

*(Added 2026-08-03, after the advisor's closing prediction: five years from now,
if this succeeds, this paper is not cited for the number 0.2186 — it is cited
because readers write "Following the Bitcoin Resource Accounting framework
introduced by Poswal, we define…".)* The durable goal of this publication is to
introduce a reusable **frame** — **Bitcoin Resource Accounting**, with SCCR as its
first named metric (Metric #1) — not to publish a single measurement. A frame is
a definition others can adopt, a notation that persists, a shared vocabulary, and
enough adoption that "framework introduced by X" is the natural citation form;
the number is the evidence the frame works, and the frame is what gets cited.
This aspiration does not relax the evidence discipline anywhere: the frame is
introduced through evidence, not naming — SCCR is earned (measured, reproduced),
the framework is proposed (Paper 4, theory-first, minimal equations), every
unmeasured leg stays a research hypothesis, and every public surface leads with
the frame while the banded number evidences it.

---

## 1. Target venues

| Venue | Where | What goes in | Notes |
|---|---|---|---|
| **arXiv** | arxiv.org, submit via account | Working paper v2.1.0 (+ companion note as appendix or separate posting) | Category: **cs.CR** (cryptography & security — Bitcoin/blockchain work is routinely filed here) or **econ.GN** (general economics — the framing is an externality/economics paper). Recommend cs.CR primary with the economics framing kept prominent in the abstract. arXiv is not peer-reviewed; it is a preprint server — the paper's reproducible-measurement asset maps well to it. |
| **Bitcoin Optech newsletter** | bitcoinops.org — newsletter submission/contact | Short research summary + link to preprint | Optech regularly cites new Bitcoin research. Submission is a summary pitch, not the full paper. Value: reaches node operators and engineers — exactly the "who bears the cost" audience. |
| (follow-on) **r/BitcoinEngineering** | reddit.com/r/BitcoinEngineering | Announcement thread + link | Existing community from v1/v2; post *after* arXiv is live (link-first). |
| (follow-on, optional) **Workshop/venue** | e.g. Bitcoin Research Day / academic workshops | Full paper | Only after community feedback validates the framing. Do NOT pre-commit. |

## 2. Submission steps (arXiv)

1. **Author list & account.** ✅ **DECIDED (Prateek, 2026-08-02):**
   author line = **Prateek Poswal, Independent Researcher** (program line
   "Bitcoin Sahi Research"; Council acknowledged in the paper body, not the
   byline). Full three-option analysis, ORCID rationale, and exact signup steps
   in `research/author-identity.md`. **arXiv = real identity** (Prateek's
   decision — no pseudonym). arXiv accounts are free; a new submitter may need
   endorsement — first submissions to cs.* often require endorsement by an
   existing arXiv author. Check `arxiv.org` endorsement rules before submitting.
  *(DONE 2026-08-04 — ORCID created: `0009-0005-2139-1877` /
  https://orcid.org/0009-0005-2139-1877. LEFT: create the arXiv account with
  his real identity (D3) + check cs.* endorsement.)*
2. **License.** ✅ **RECOMMENDED (Prateek, 2026-08-02):** **MIT** for code +
   **CC BY 4.0** for the paper, matched by the CC BY 4.0 license field on arXiv.
   Exact draft texts (LICENSE file replacement + paper notice + arXiv field) in
   `research/license-draft.md`. **The repo LICENSE file remains a stub
   ("All Rights Reserved") — do NOT change it until Prateek's final ratification
   (recommended, awaiting final go).**
3. **Abstract.** Rewrite to arXiv constraints (~1 paragraph, ≤ ~1500 chars):
   state the question, the SCCR definition, the primary-source census (≥32K), the
   dated banded result (~22–29%, ~99–100% below 1×, Aug 02–15 baseline) AND the
   live series (0.4433 / 96.24% below 1× on 2026-08-21 — see
   `reports/research/regime-event-2026-08-21.md`), and the reproducibility claim.
   The current abstract (working-paper §1) is close; trim to venue style.
   Capture-dated claims only — never a frozen band without its date, never the
   strong form (100% below 1×).
4. **Source format.** ✅ **DECIDED (Prateek, 2026-08-02): submit LaTeX, not
   PDF-only.** Full LaTeX source exists at `research/working-paper.tex`
   (compilable skeleton — abstract verbatim, all sections, tables, references;
   conversion status noted in the file header). LaTeX toolchain NOT present on
   the dev machine (no pdflatex) — compile `pdflatex working-paper.tex` on any
   TeX installation before submission, and diff content against
   working-paper.md. Fallback remains the PDF export of working-paper.html.
5. **Units & notation consistency check.** The paper v2.1.0 already added units
   everywhere (dimensionless ratios, USD/block, nodes, yr). Before upload: run a
   final pass confirming (i) every table row carries units, (ii) SCCR is stated
   dimensionless, (iii) no bare "0.29" without a date+capture qualifier, (iv) the
   canonical live value is read from model-spec v2.0.1, never hardcoded
   (working-paper §5.3 discipline).
6. **Claims-within-evidence check.** Confirm every headline is a *dated*,
   capture-labeled statement ("lower bound ≥32K", "T=10 assumption") with the
   banded baseline (~22–29%, ~99–100% below 1×, Aug 02–15) clearly marked as
   dated, AND the live series (0.4433 / 96.24% below 1×, 2026-08-21) stated with
   its capture date (re-read `/data/sccr_history.json` immediately before
   submission — the ratio moves with the fee market; cross-link the regime-event
   page `reports/research/regime-event-2026-08-21.md`). Never the strong form
   (100% below 1×) — it does not survive the real census (working-paper §5.4) —
   and never a frozen band without its date.
7. **Upload** → arXiv moderation (usually 1–3 business days) → preprint URL.
8. **Register the DOI/preprint URL** in the repo (TODO-bitcoin-oracle.md R5
   publication item + site surfaces).

### 2a. The moderator pitch (canonical submission summary — distinct from the technical abstract)

*(Added 2026-08-03, post-advisor review. This is the one-paragraph answer to
the arXiv moderator's "Why is this paper interesting?" — the framing that gets
the paper past moderation. It is DIFFERENT from the technical abstract (§2 step
3): it leads with the contribution's shape, not the number.)*

> **Why is this paper interesting?** This paper does not argue that Bitcoin's
> fee market is incorrect — the market clears block space efficiently, and that
> is not in question. The contribution is narrower and more durable. First, it
> introduces a *reproducible empirical metric*: the Storage Cost Coverage Ratio
> (SCCR) — the first live-data measurement of how much of the long-lived storage
> cost of confirmed transactions the fee market actually covers, built from a
> primary-source node census (≥32,000 addresses) and reproduced by three
> independent implementations (JavaScript, Python, standalone C). Second — and
> this is the broader contribution — the paper proposes a *framework*: Bitcoin's
> single fee price is not the price of one resource, but one price charged
> against many long-lived shared resources (storage, UTXO state, validation,
> relay, bandwidth). The framework defines a family of internalization ratios —
> one per resource — of which SCCR is the first measured member; the rest are
> stated explicitly as research hypotheses with defined promotion criteria. One
> measurement today; the framework is the deliverable.

**Usage:** paste as the arXiv cover-letter / abstract-if-needed framing; keep
the technical abstract (banded ~22–29%, ~99–100% below 1×, ≥32K census, model-
spec v2.0.1, three implementations) as the submission abstract. The two frames
do not contradict — the pitch is why the paper matters, the abstract is what it
measured. Also the basis for the Optech 2–4 sentence summary (§3 step 1).


## 3. Submission steps (Bitcoin Optech)

1. Draft a **2–4 sentence research summary**: what was measured (SCCR, live data,
   ≥32K census), the headline (fees cover ~22–29% of modeled 10-yr storage cost),
   and the reproducible framework. Keep it neutral — Optech is a technical
   newsletter, not an advocacy venue.
2. Submit via the Optech website contact/newsletter-submission path (or the
   publicly listed address), linking the arXiv preprint once live.
3. Follow up with the companion note's data-gap framing as the "what's next"
   line (split measurement, agent-26 probe) — it demonstrates research hygiene.

## 4. Pre-submit checklist (both venues)

- [x] **Author list** — ✅ DECIDED (Prateek 2026-08-02): Prateek Poswal, Independent Researcher (Bitcoin Sahi Research program line); arXiv = real identity. ORCID created 2026-08-04 (`0009-0005-2139-1877`). *(LEFT: arXiv account, D3)*
- [x] **License** — ✅ RECOMMENDED (Prateek 2026-08-02): MIT code + CC BY 4.0 paper. *(LICENSE file still untouched — awaiting Prateek's final go)*
- [ ] **Abstract rewritten** to venue constraints, capture-dated claims (banded baseline dated + live series with date) only
- [ ] **Units consistency pass** (every quantity tagged; no undated headline numbers)
- [ ] **Claims-within-evidence pass** (dated banded ~22–29% / ~99–100%; live series 0.4433 / 96.24% with 2026-08-21 date; ≥32K lower bound; T=10 assumption stated)
- [ ] **Companion note final** (`archival-vs-pruned-note.md` — Prateek's simultaneous-publication decision recorded; note content review pending)
- [x] **Source format** — ✅ DECIDED (Prateek 2026-08-02): **LaTeX, not PDF-only**; LaTeX source EXISTS (`research/working-paper.tex`); needs a compile pass on a machine with pdflatex (toolchain absent locally)
- [ ] **External reproduction** — 🚨 **CRITICAL PATH** (Prateek 2026-08-02: *the only thing worth delaying submission for*); protocol + log in `research/reproduce/`; do NOT submit until an uninvolved reproducer has run it (or delay waived)
- [ ] **Reproducibility line intact**: model-spec v2.0.1 + three independent implementations (JS/Python/C) named
- [ ] **Prior-work honesty intact**: Liu et al. 2021 (arXiv:2103.05866) acknowledged as closest prior work; contribution = measurement, not the observation (working-paper §8.2)
- [ ] **Dead-claims audit**: no reference to v1/v2 oracle framing (refuted); no BIP-110 claim beyond documented DOA status
- [ ] **Falsifiability section present** — working-paper §7.1 ("What would falsify
      this framework?", added 2026-08-03 post-advisor review); every submission
      surface (abstract, paper, companion note) states a dated claim (banded
      baseline marked dated + live series with capture date) and never the strong form
- [ ] **Evidence/hypothesis separation** — SCCR labeled ESTABLISHED METRIC; all
      other RIRs labeled RESEARCH HYPOTHESES wherever named (abstract, companion
      §2 Q3 table, roadmap references); no surface implies UCIR/VCIR/RCIR/BCIR/DCIR are results

## 5. What the archival-vs-pruned note adds to the submission

- **Addresses the obvious reviewer question** ("doesn't pruning destroy your
  storage-cost premise?") before it is asked — the note states the T=10/N
  conditioning explicitly.
- **Demonstrates measurement hygiene** — the data gap is *named* (census =
  reachability only) and the closing path is *specified* (agent-26 probing,
  survey, third-party reconciliation), not hand-waved.
- **Bounds the claim** — the note shows SCCR-as-computed is an upper bound on the
  burden borne by typical nodes if the pruned share is large, and that even a 78%
  pruning rate would not flip the headline (N_archival ≈ 7K vs the 7,130 knife
  edge) — turning a limitation into a quantified robustness statement.
- **Sequencing:** ships with or immediately after the paper; the actual split
  measurement is Phase I follow-on, *not* a submission blocker.

## 6. After-arXiv builds (ready now, deploy on publication)

### 6.1 Live SCCR dashboard + static API (built 2026-08-02)

The static site (GitHub Pages) cannot serve a dynamic backend API until the
deferred backend decision (R5-gated, TODO-bitcoin-oracle.md). The honest
interim is **static JSON endpoints shipped with every snapshot**:

| Static file | Serves as | Producer |
|---|---|---|
| `data/sccr.json` | live dashboard widget (learn.html) | `tools/research/sccr_live.py` |
| `data/sccr_latest.json` | `/sccr/latest` | `tools/research/sccr_live.py` |
| `data/sccr_history.json` | `/sccr/history` | `tools/research/sccr_live.py` |

- `python3 tools/research/sccr_live.py` computes the latest SCCR from the live
  capture and writes all three files (history appends, dedup by date).
- The snapshot agent (`tools/agents/19-web-snapshot-agent.js`) invokes it on
  every run, so `sccr*.json` ship with each `data/` publish.
- GH Actions fallback (`tools/generate_snapshot.py`) carries the last committed
  `sccr*.json` (runner has no local DB — it ships committed values, honest).
- `learn.html` now has a live SCCR dashboard section reading `data/sccr.json`.
- `/sccr/block/{height}` is NOT served statically (needs the full history map);
  documented as backend-only once the R5-gated backend lands. Do not claim it.

### 6.2 Interactive paper (Phase-4 goal — spec only, do NOT build now)

**Goal (after publication):** an interactive version of the paper where every
equation traces to data → code → result: "equation → data → code → result".

**Spec (what to build later, not now):**
1. Every model quantity in the paper (C, N, T, B_block, cb, L, L_net, SCCR)
   links to its `model-spec.json` entry and its producing script.
2. Every reported number links to the exact capture it came from (frozen input
   files in `research/reproduce/input/` are the traceable unit).
3. The SCCR chart (`research/reproduce/output/sccr_chart.png`) is regenerated
   live from `data/sccr_history.json` — the dashboard widget is the first
   interactive element already built.
4. Architecture: static HTML + the `data/sccr*.json` endpoints + a small JS
   renderer (same pattern as the learn.html dashboard section). No backend.
5. Content: a `/research/paper/` page with the paper text inline and
   data-links; equations rendered as MathML or KaTeX; each table cell marked
   with its traceability breadcrumb (spec entry → script line → capture file).

**Status:** SPEC ONLY (2026-08-02). Not started. Deferred until after the
preprint is live — building it now would delay submission and duplicate the
learn.html dashboard work already shipped.

## 7. DONE vs LEFT

**DONE (2026-08-03, peer-review execution):** reviewer-prescribed fixes applied to
working-paper.md / .tex / (HTML regenerated): abstract opening rewritten
(reviewer's suggested framing); §1 scope expanded (why-storage "first measurable
resource", storage≠state, 1× descriptive-not-normative stated early); §2 new
non-normative-1× bullet; §4.1 SCCR fraction diagram + explicit-notation block
(bundled C = C_storage+C_bandwidth+C_misc → storage-and-hosting coverage ratio;
cb(t)=C(t)/B_year(t) time-dependence; L_network=ΣL_i heterogeneous nodes ↔
archival-vs-pruned note; storage≠UTXO-state); §4.2 average-vs-marginal
discussion; §5.1 point-in-time discipline tied to cb(t); §7 limitations 2 & 7
strengthened (bundled C, why-storage); §8.1 voluntary-participation line.
Roadmap §10 added: seven reviewer-prescribed directions as RESEARCH HYPOTHESES
(Resource Attribution Theory, Resource Elasticity, Market Efficiency/Price
Discovery, Resource Vector, Cross-layer Accounting/Lightning, Miner Incentive
Accounting, Bitcoin Resource Index) with 4-question-gate promotion criteria.
New deliverable: `research/audience-summaries.md` (developers/researchers/
investors/general public). D5 remains the only submission blocker.

**DONE (2026-08-03, advisor-feedback execution):** working-paper §7.1
falsifiability section (md/html/tex); roadmap §4 evidence-status table +
hypothesis labels; framework-paper outline (`research/framework-paper-outline.md`,
Paper 4 synthesis); companion §2 Q4 + roadmap §8 Q4 sharpened ("no single resource
market" — attribute/stock-vs-flow mismatch, not USD-vs-CPU denomination);
publication-decisions tracker addendum (falsifiability = pre-submission item,
D5 confirmed critical path). See commit message.

**DONE (verified, 2026-08-02 execution plan):**
- Full LaTeX source (`research/working-paper.tex`) — compilable skeleton; toolchain NOT local (flag for compile pass).
- Author identity + ORCID recommendation (`research/author-identity.md`); license drafts (`research/license-draft.md`).
- Live SCCR dashboard + static API files (`tools/research/sccr_live.py`, `data/sccr*.json`, learn.html section, snapshot-agent wiring).
- Reproduction kit (frozen input, Python + C implementations, cross-check script) — three implementations all agree (0.2186, 171 blocks).
- Literature audit (`research/literature-audit.md`), reviewer simulation (`research/reviewer-simulation.md`), community review plan (`research/community-review-plan.md`).
- Paper renamed + reviewer fixes F1–F8 applied to working-paper.md; HTML regenerated.

**DONE (verified):**
- Venue analysis (arXiv cs.CR/econ.GN, Optech, follow-ons) with rationale.
- Submission steps for both venues, pre-submit checklist (10 items), companion-note contribution.
- Checklist items that do not need new input are all marked actionable in §4.

**LEFT / TODO (verified):**
- [ ] 🚨 **External reproduction** — CRITICAL PATH (Prateek 2026-08-02; advisor
      reinforced 2026-08-03: **"this is now worth far more than another 100
      commits"** — external reproduction is THE highest-value remaining action
      and everything else is secondary). The ONLY submission-delaying item;
      protocol + log in `research/reproduce/`
- [ ] Prateek: arXiv account (real identity, D3 — ORCID D2 DONE `0009-0005-2139-1877`)
- [ ] Prateek: review `archival-vs-pruned-note.md` (data-gap framing sign-off) —
      simultaneous publication decided
- [ ] Abstract rewrite (mechanical once ORCID/endorsement known)
- [ ] LaTeX compile pass (pdflatex on any TeX machine) — format decided: LaTeX
- [ ] Actual submission (arXiv upload + Optech pitch) — after the critical path clears
- [ ] Post-publication: update TODO-bitcoin-oracle.md R5 item + site surfaces with the preprint URL

## 7. Publication decisions — Prateek's directive (2026-08-02)

All seven recorded in `docs/decisions/2026-08-02-publication-decisions.md`:

| # | Decision | Prateek's guidance | Status |
|---|---|---|---|
| D1 | Author | Prateek Poswal, Independent Researcher (Bitcoin Sahi Research) | ✅ RECOMMENDED/RESOLVED |
| D2 | ORCID | Create BEFORE submission | 🟡 ACTION (pre-submission required) |
| D3 | arXiv identity | Real identity (no pseudonym) | ✅ RECOMMENDED/RESOLVED |
| D4 | License | MIT (code) + CC BY 4.0 (paper) | ✅ RECOMMENDED — LICENSE file change awaits final go |
| D5 | External reproducer | The ONLY thing worth delaying submission for (advisor 2026-08-03: **"worth far more than another 100 commits"** — highest-value remaining action, everything else secondary) | 🚨 CRITICAL PATH |
| D6 | Source format | Submit LaTeX, not PDF-only | ✅ RECOMMENDED/RESOLVED |
| D7 | Companion note | Publish simultaneously | ✅ RECOMMENDED/RESOLVED |

The roadmap rename (2026-08-02) makes this Paper 1 of **Bitcoin Resource
Accounting**; SCCR is Metric #1 of the RIR family (companion `future-directions-v3.md` §2 Q3).

---

## 8. Submission-moment protocol (the instant one independent person reproduces)

*Added 2026-08-03 (advisor's final directives). **Trigger:** the first reply
from an uninvolved person of the form "I followed the instructions from a clean
clone and reproduced the published result" — the reproducibility milestone in
`research/reproduce/external-reproduction.md` (GO/SUBMIT TRIGGER). Record the
reply (quote + date + reproducer, anonymous ok) in the reproduction log, then
execute the sequence below in order. **No more polishing.***

**What the trigger requires (2026-08-03 refinement).** The trigger fires on
**reproduction of the number**: the reproducer confirms the published result
from a clean clone (avg 0.2186, min 0.0584, max 0.8320, 100% below 1×). It does
**not** require the reproducer to agree with the paper's framing or assumptions.
A reproducer who reproduces the number but challenges a documented modeling
choice (C = $925/yr bundling, T = 10 horizon, storage-as-first-resource, the
externality reading) has still met the milestone: the objection is recorded as
feedback in the community-feedback triage (`research/community-review-plan.md`
§4) and folded into the next revision — it does not block submission. Only a
reproducer who **cannot** reproduce the number (materially different result
from a clean clone, not reconciled) blocks submission, until reconciled; that
is falsifier 1 of working-paper §7.1.

1. **Freeze the repository.** Stop all content changes. Verify `git status`
   shows exactly the tree the reproducer ran; note the freeze in the
   reproduction log + decisions tracker. Any change needed after this point is a
   v1.0.x fix, not a pre-submission edit.
2. **Tag the release.** `git tag -a v1.0.0 -m "v1.0.0 — SCCR paper + reproduction kit (frozen)"`
   then `git push origin v1.0.0`. The tag points at the commit the external
   reproducer verified.
3. **Archive to Zenodo (or similar).** Create a Zenodo record from the v1.0.0
   tag (GitHub↔Zenodo integration, or upload the release archive manually).
   Record the DOI in this plan + README + site surfaces.
4. **Submit to arXiv.** LaTeX source (`research/working-paper.tex`, compiled
   once on a machine with pdflatex) with CC BY 4.0 license field; real-identity
   account (D2/D3 pre-conditions — ORCID iD + arXiv account must already exist);
   moderator pitch (§2a) as the cover letter; banded-claim abstract (§2 step 3).
5. **Post to Delving Bitcoin.** Link-first announcement of the preprint + the
   measurement (community-review-plan.md outreach list starts here).
6. **Share with Bitcoin Optech.** The 2–4 sentence research summary (§3 step 1)
   + arXiv link via the Optech submission path.
7. **Invite criticism — no more polishing.** The submission gate is closed.
   Feedback is collected; fixes ship as v1.0.x revisions.

**Cadence rule:** steps 1–3 happen the same day the trigger lands; steps 4–6
within one week; step 7 is permanent.

## 9. v1.0.0 release checklist (what the frozen release contains)

*Added 2026-08-03 (advisor's final directives). The v1.0.0 tag/archive is not
the release unless it contains ALL of the following:*

- [ ] **The paper, all formats** — `research/working-paper.md` v2.1.0; compiled
      PDF from `research/working-paper.tex` (LaTeX source shipped); HTML
      rendering `research/working-paper.html` — content-identical across formats
- [ ] **The model specification** — `research/model-spec.json` v2.0.1 (canonical
      source of every constant; the reproduction kit depends on it)
- [ ] **The reproduction kit** — `research/reproduce/` (frozen input
      `fee_history_capture.json`, JS/Python/C implementations, `cross_check.sh`,
      protocol README) + the external reproduction log
      (`external-reproduction.md`)
- [ ] **WHY_THIS_EXISTS.md** — the one-page plain-language framing (repo root)
- [ ] **Audience summaries** — `research/audience-summaries.md` (developers /
      researchers / investors / general public)
- [ ] **Companion note** — `research/archival-vs-pruned-note.md` (D7:
      simultaneous publication)
- **NOT INCLUDED (deliberately):** `research/future-directions-v3.md` — the v3.0
      agenda companion is post-publication program material, labeled as such in its
      header; it is NOT part of the frozen release and ships, if at all, after
      publication + external reproduction
- [ ] 🚨 **License decision APPLIED** — **PRE-FREEZE REQUIREMENT.** D4 is still
      🟡 RECOMMENDED-AWAITING-RATIFICATION (MIT code + CC BY 4.0 paper, drafts in
      `research/license-draft.md`); the `LICENSE` stub ("All Rights Reserved")
      must be replaced with the ratified pair BEFORE the freeze. A frozen release
      cannot ship with an unratified license. **This elevates D4 to a pre-freeze
      blocker — distinct from D5 (external reproduction), which remains the only
      submission blocker.**

---

*Bitcoin Sahi Research Council — Publication plan for "Storage Cost Internalization in Bitcoin's Fee Market" (working-paper v2.1.0, Phase I), 2026-08-02*
