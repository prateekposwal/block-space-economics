# Bitcoin Block Space — Research TODO

*(The research program is named **Bitcoin Resource Accounting** (2026-08-02) —
a complete accounting system for every long-lived resource consumed by Bitcoin,
with SCCR as Metric #1. The Paper-1 title "Storage Cost Internalization in
Bitcoin's Fee Market" is unchanged; see `research/roadmap.md`.)*

Status as of 2026-08-02. Active project: **Bitcoin Resource Accounting** — open
research into unpriced state storage (SCCR, Metric #1), deployed as a static
research showcase at bitcoinsahi.com.
v1 (priority oracle) and v2 (externality fee) are dead — refuted on Reddit for
sound economic reasons. The three project decisions (scope, data source,
deployment) are documented in `docs/decisions/2026-08-02-project-decisions.md`
(ratified 2026-08-02 — locked; deferrals R5-gated).

## Phase R1: Reading ✅

- [x] Read BIP-141 rationale for witness discount (malleability vs state economics) → `research/bip141_analysis.md`
- [x] Read Moser, Eyal, Gün Sirer — covenant paper (FC 2017) → surveyed in bip141_analysis.md
- [x] Read Poelstra — CAT and Schnorr Tricks series → surveyed in bip141_analysis.md
- [x] Search r/BitcoinEngineering for "state expiry" threads → no active proposals since 2022
- [x] Search bitcoin-dev mailing list for UTXO growth discussions → periodic threads, no consensus

## Phase R2: UTXO Cost Function ✅

- [x] Estimate: what does it cost to run a full Bitcoin node per year? (HW + bandwidth + electricity) → `research/utxo_cost_model.py`, $925/yr
- [x] Calculate: how many bytes of UTXO data does the average inscription add? → ~400 bytes (100 vbytes)
- [x] Model: node cost / byte / year → ≈1.93e-6 $/byte/yr, ~$0.0077/inscription lifetime
- [x] Document: the SegWit weight formula's impact on inscription economics → `research/bip141_analysis.md`
- [x] Simulate: how UTXO set growth affects node operator costs → model handles 50K-300K/mo scenarios
- [x] Verification appendix with source links → `research/verification_appendix.md`
- [x] Live data fetch scripts → `research/fetch_inscription_stats.py`, `research/verify_inscription_size.py`

## Phase R3: Problem Statement ✅

- [x] Write a clear, concise problem statement (1 page max) → `research/problem_statement.md`
- [x] Publish as a research note (no solution, just the framing) → `research/problem_statement.md`
- [x] Share on r/BitcoinEngineering for feedback → https://reddit.com/r/BitcoinEngineering

## Monitoring

- [x] Subscribe to Bitcoin Optech newsletter
- [x] Follow r/BitcoinEngineering for "state expiry" discussions
- [x] Track bitcoin-dev mailing list for UTXO/state threads
- [x] Analyze BIP-110 (Reduced Data Temporary Softfork) — see bitcoin-oracle-arch.md; source API dead (documented DOA, ~0.1% signaling)
- [x] Watch covenant proposal discussions (CTV, APO, OP_VAULT, OP_CAT)
- [x] Note: BIP-110 validates our problem diagnosis. Our cost model provides the economic data BIP-110's rationale lacks.

## Phase R4: Deployment & Business (bitcoinsahi.com)

### Stage 1: Static Site ✅
- [x] Enable GitHub Pages on the repo
- [x] Add CNAME file with `bitcoinsahi.com`
- [x] Point DNS: A records to GitHub Pages IPs + CNAME www → prateekposwal.github.io
- [x] Verify site loads at https://bitcoinsahi.com
- [ ] Add Google Analytics or Plausible for visitor tracking

### Stage 2: Live Data Pipeline ✅ (repaired 2026-08-02)
- [x] Local launchd agents (data-engine, snapshot, site-health, ops-health, engagement) capture 24/7 → `captured-data/` + spool
- [x] Snapshot agent (`tools/agents/19-web-snapshot-agent.js`) writes rich `data/*.json` from local spool, commits + pushes
- [x] GH Actions fallback (`data-snapshot.yml`) regenerates snapshot when local Mac is off; reads committed rich history (stub-writer bug fixed 2026-08-02)
- [x] HTML pages read `data/*.json` via JavaScript for always-current numbers
- [x] Data-engineering monitor: 17/17 endpoints, quality 100/100 (IPv6 black-hole, timeout, concurrency fixes landed 2026-08-02)
- [ ] Add "Last updated: X hours ago" freshness timestamp to site

### Stage 3: Full Stack Backend (deferred — see Decision 3)
- [ ] Set up Flask/FastAPI backend on VPS ($6–$12/mo) — *deferred; static + launchd + GH-Actions is the chosen shape*
- [ ] API endpoints: `/api/fees`, `/api/inscriptions`, `/api/utxo-cost-model` — *deferred*
- [ ] Add interactive model UI (sliders for parameters, live recalculation in browser) — *deferred*
- [ ] Add newsletter signup (free email service: SendGrid / Mailchimp free tier) — *deferred*

### Stage 4: Monetization (Month 3+ — deferred, gated on product proof)
- [ ] Draft sponsorship deck for Bitcoin mining pools and Lightning companies
- [ ] Launch Developer API tier at $50/mo (history, projections, custom runs)
- [ ] Enterprise API tier at $500/mo (real-time, webhooks, dedicated support)
- [ ] Publish first "State of Block Space" annual report ($500/copy)
- [ ] Begin consulting outreach to ETF providers, mining companies, L2 protocols

### Revenue Target: $50K–$150K/year by Month 12 (not started — gated)

## Phase R5: Contribution (if warranted)

- [ ] Only if feedback suggests a genuine gap exists
- [ ] Only if the problem can be addressed without consensus change (v1 principle)
- [ ] Only if the proposed mechanism survives incentive analysis

## Phase R5: Storage Cost Coverage Ratio (2026-07-30)

- [x] Define metric: StorageCostCoverageRatio = TransactionFee / (Bytes × ReplicationFactor × CostPerBytePerYear × Years)
- [x] Build reproducible computation module → `tools/research/storage-ratio.js`
- [x] Generate first report: 148 blocks, avg ratio 0.0149 (1.49%) → `reports/research/storage-ratio-2026-07-30.md` *(superseded by v2.0.0 correction)*
- [x] v2.0.0 correction: duplicated time-horizon term removed (16.4× → model reconciliation) — see research/model-spec.json
- [x] v2.0.1 correction: node count reclassified to real census N=32K (agent-25, getnodeaddresses); L_net recomputed 5627.808
- [x] Live re-measure 2026-08-02: 168 blocks, avg ratio **0.2252**, 100% below 1×
- [ ] Track ratio over time as new data accumulates — **partial**: automate `storage-ratio.js` via launchd/cron (scheduled, not manual)
- [ ] Publish as research note (arXiv, Bitcoin Optech, r/BitcoinEngineering) — working paper live; arXiv/Optech not yet submitted
- [ ] Feed Bitcoin Core `getblockstats → utxo_size_inc` for per-block UTXO growth data — **deferred**: local node ~320K blocks behind tip; drop until synced

**Key finding (pre-re-base, v2.0.1):** at the then-census (N=32K), fees cover
~22.5% of the estimated 10-year storage cost (live re-measure 2026-08-02), with
100% of sampled blocks below 1×. **v3.0 deep questions (Q1–Q5) answered
2026-08-02** — `tools/research/sccr_dynamics.py` (4-way scenario overshoots at
SCCR ≈ 8.9; P* ≈ $283K for 1×; 2040: C-deflation pushes SCCR up, N×4 is the
0.056 anchor; sustained 10 sat/vB > 1×); answers in working-paper §11 + roadmap §8. The ratio moves with the fee market — all
surfaces must read the live value from `node tools/research/storage-ratio.js`,
never a hardcoded figure. Historical figures (1.49% v1.0.0, ~17% v2.0.0 at N=60K,
~29% working-paper dated snapshot) are documented provenance, superseded by the
canonical live measurement.

## Exploratory Directions

### Direction A: UTXO-Aware Relay Minimum Fee

- [ ] Write a patch for Bitcoin Core's `minrelaytxfee` to support state-density multipliers
- [ ] Define `state_density = (witness_size + output_script_size) / vsize`
- [ ] Write an economic model explaining why relay nodes would adopt this
- [ ] Simulate how the effective fee floor shifts at different adoption rates

### Direction B: BIP for State-Conscious Relay Policy

- [ ] Draft BIP defining `state_impact_score` metrics
- [ ] Engage with Bitcoin Optech, r/BitcoinEngineering, bitcoin-dev for feedback
- [ ] Provide wallet-side fee estimation guidance
- [ ] Reference implementation in Core fork or alternative node

### Direction C: Multi-Tier Relay Fee Market (Speculative)

- [ ] Explore only if A/B prove insufficient
- [ ] Requires P2P protocol changes and wallet routing logic

## Key Distinction (from Community Feedback)

The research hinges on one question that emerged from community feedback:

> **Is the "data permanence externality" a real, economically significant problem — or is the existing fee market sufficient?**

The fee market prices **congestion** (inclusion in the next block). It does not price **permanence** (lifetime storage in every full node's blockchain history). These are two different market failures.

| | Congestion pricing | Permanence cost |
|---|---|---|
| What it prices | Entry into the next block | Lifetime storage in every node |
| Who pays | Sender (once) | All future node operators (forever) |
| Time horizon | ~10 min (1 block) | Indefinite |
| Market failure | None — works well | Tragedy of the commons — no marginal cost signal |
| Handled by fee market? | ✅ Yes | ❌ No — unpriced externality |

**Open question:** Is the permanence externality significant enough to matter, or do most node operators run pruned nodes and not care about historical data?

## Open Questions

1. Does the SegWit weight formula need to be parameterized differently for data vs financial transactions?
2. Is state expiry viable for Bitcoin without soft fork?
3. Can covenant proposals reduce UTXO churn from inscriptions?
4. What would a "storage cost oracle" look like — and is it even possible without trust?
5. Is the "externality of data permanence" actually a problem with economic significance, or is the existing fee market sufficient?
6. Should the SCCR research be published to arXiv / Bitcoin Optech (the R5 publication sub-task)? — **IN FLIGHT**: Phase I greenlit 2026-08-02; pre-publication execution plan COMPLETE 2026-08-02 (reproduction kit w/ 3 verified implementations, literature audit, reviewer simulation, LaTeX source, live SCCR dashboard + static API, community review plan, paper renamed); checklist in `research/publication-plan.md`; awaiting Prateek's arXiv account + author identity + ORCID + license ratification (see `research/author-identity.md`, `research/license-draft.md`)

## Remaining Work Summary (2026-08-02)

> **Decisions RATIFIED 2026-08-02** — Prateek ratified the recommended bundle
> (scope / data source / deployment, "ratify all bundle"). Direction is now
> locked: research-first scope, fee-failover + deferred node sync, static
> deployment; all deferrals remain R5-gated. Record:
> `docs/decisions/2026-08-02-project-decisions.md`.

**Data layer (in progress to complete):**
- [x] Automate SCCR tracking via launchd (storage-ratio.js) — plist `com.bsahi.sccr-tracker.plist` exists; live writer `tools/research/sccr_live.py` additionally ships `data/sccr.json` + static API files on every snapshot
- [x] Add fee-source failover for mempool.space single point of failure — RATIFIED (Decision 2); blockstream/blockchair fallbacks live 2026-08-02
- [ ] Site freshness label + sitemap update (working-paper.html, history-of-bitcoin.html)

**Research layer:**
- [ ] arXiv / Bitcoin Optech submission of the working paper (unblocked) — submission checklist in `research/publication-plan.md`; LaTeX source `research/working-paper.tex` ready (needs pdflatex compile pass — toolchain absent locally); author/ORCID/license decisions pending from Prateek
- [x] Roadmap adoption recorded — `research/roadmap.md` §7 (ratified 2026-08-02, amendments in §6)
- [x] Archival-vs-pruned companion note DRAFTED — `research/archival-vs-pruned-note.md` (honest data-gap framing: census captures N, NOT pruned-vs-archival split; measurement gap documented) — **LEFT: Prateek review before it ships with the paper**
- [ ] v3.0 archival-vs-pruned study — node-census pruned-vs-archival distribution (working-paper §10, Q2/Q3) — companion note drafted; measurement of the split itself remains OPEN (see note)
- [x] Publish decision ratification from Prateek (scope/data-source/deployment) — RATIFIED 2026-08-02
- [x] Formally drop utxo_size_inc until Core node is synced — RATIFIED (Decision 2); node sync deferred, R5-gated

**Docs (2026-08-02):**
- [ ] README (setup, architecture, quick start) + launchd runbook + known-issues list

**Roadmap (2026-08-02):** **Bitcoin Resource Accounting** ADOPTED as the
program thesis (renamed 2026-08-02 from "Resource Internalization Framework" —
program identity; Paper-1 title unchanged) — `research/roadmap.md` (phases I–V,
unified RIR formula incl. DCIR, central question, 4-question gate, §8 deep
question answers, §9 cross-chain fit map). Prateek ratified 2026-08-02 ("continue :)") WITH the
§6 amendments: UCIR 4/5 (validation-cost carve-out scoped to RAM/lookup per
lifetime UTXO), VCIR demoted to bounded analytical sub-study, BCIR research-hard,
RCIR next model-possible leg, archival-vs-pruned as Phase I companion note.
Phase I publication path GREENLIT (see `research/publication-plan.md`); UCIR data
path deferred until Phase I ships.
