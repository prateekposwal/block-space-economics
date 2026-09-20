# Literature Audit — Reproducible Fee-to-Resource Metrics for Bitcoin

**Audit for:** working-paper v2.2.0 (SCCR storage paper), pre-submission
**Date:** 2026-08-02
**Method:** arXiv API full-text/metadata queries (multiple keyword sets),
Google Scholar keyword search, direct arXiv ID verification of every source
cited in the paper's reference list. Everything below is either verified against
a primary source or explicitly marked **unverified**.

---

## 1. Sources searched

| Source | Query | Result |
|---|---|---|
| arXiv API | `id_list=2103.05866` (Liu et al.) | ✅ VERIFIED — exists, v3 (2021-08-22) |
| arXiv API | `id_list=2604.17183` (Aronoff et al.) | ✅ VERIFIED — exists, v1 (2026-04-19) |
| arXiv API | all:"Bitcoin" + all:"storage cost" + all:"fee" | 0 results |
| arXiv API | all:"blockchain" + all:"externality" + all:"storage" | 14 results, none proposing a reproducible metric for Bitcoin |
| arXiv API | all:"cost internalization" + all:"Bitcoin" | 0 results |
| arXiv API | all:"transaction fees" + all:"storage costs" + all:"Bitcoin" | 0 results |
| arXiv API | all:"Bitcoin" + all:"UTXO" + all:"cost" | 6 results (pruning/accumulator/smart-contract papers, none a fee-vs-cost metric) |
| arXiv API | all:"fee and waiting tax" | 1 result — Liu et al. 2103.05866 (confirms no independent follow-on) |
| arXiv API | all:"state rent" + all:"Ethereum" | 1 result — Lerner et al. 2210.13670 (EVM state-rent proposal) |
| Google Scholar | "storage cost" "Bitcoin" fee internalization metric | 16 results — none propose a Bitcoin fee-to-resource internalization metric (closest: theoretical/qualitative economics papers) |

## 2. Verified prior work

### 2.1 Liu, Fang, Cheung, Cai, Huang (2021), arXiv:2103.05866 — VERIFIED ✅

*"An Incentive Mechanism for Sustainable Blockchain Storage."* cs.GT, v3.

**Verified claims:** argues storage costs "have in general not been properly
compensated by the users' transaction fees"; identifies the "insufficient fee
issue" and two types of negative externalities; proposes a **Fee and Waiting Tax
(FWT)** mechanism modeled as a three-stage Stackelberg game; numerical results
claim 33.73% social-welfare improvement over the existing protocol.

**How it relates to the SCCR paper:** this is an *argument + proposed mechanism*,
verified as the closest prior work. It does **not**:
- measure the actual fee-to-storage-cost ratio on live Bitcoin data,
- provide a reproducible, data-driven metric,
- use a real node census for N,
- analyze regime dynamics (the ratio over time / fee regimes).

**Citation-accuracy note (fix before submission):** the working paper's reference
renders the author initials as *"Liu, J., Fang, L., Cheung, B., Cai, W., Huang,
J."* — the verified author list is **Yunshu Liu, Zhixuan Fang, Man Hon Cheung,
Wei Cai, Jianwei Huang**. Initials for Fang and Cheung are wrong. Fix to
"Liu, Y., Fang, Z., Cheung, M. H., Cai, W., Huang, J."

### 2.2 Aronoff, Praizner, Sabouri (2026), arXiv:2604.17183 — VERIFIED ✅ (with a title correction)

The arXiv record resolves to *"A Model and Estimation of the Bitcoin Transaction
Fee"* (authors Daniel Aronoff, Kristian Praizner, Armin Sabouri; categories
cs.CE, cs.LG, econ.EM; 53 pages). The abstract matches exactly what the working
paper describes: a structural VCG fee model treating the mempool as a market for
scarce block space, estimated on a high-frequency mempool panel from a self-run
node. **The working paper's cited title ("Structural Fee Markets for Blockchain
Block Space") does not match the arXiv record — fix the title to "A Model and
Estimation of the Bitcoin Transaction Fee".** The content description in §8.2 is
accurate; only the title string is wrong.

### 2.3 Lerner et al. (2022), arXiv:2210.13670 — VERIFIED ✅ (adjacent, not prior metric)

*"Simplified State Storage Rent for EVM Blockchains."* cs.DC. A state-rent
*proposal* for EVM chains — confirms the "state-rent / gas-as-state-pricing"
thread the working paper names as adjacent in §8.2. It is a mechanism proposal,
not a measured internalization ratio.

### 2.4 Sompolinsky & Zohar (2015) — VERIFIED via arXiv ✅

*"Secure High-Rate Transaction Processing in Bitcoin."* FC 2015 — qualitative
incentive analysis including bandwidth/storage tradeoffs; cited correctly in the
working paper as adjacent qualitative work.

## 3. Honest novelty assessment

**Has anyone proposed a *reproducible metric* (not just an argument) for
fee-to-resource internalization in Bitcoin before?**

**Not found in this audit.** Searches of arXiv and Google Scholar surface:
- the *observation* that fees may not cover storage (Liu et al. 2021 — argued, not measured),
- *mechanism proposals* (FWT in Liu; state rent in Lerner),
- *fee-market estimation* (Aronoff et al. 2026 — estimates fee formation, not cost coverage),
- *qualitative* treatments (Sompolinsky–Zohar; economics literature on DeFi/SPV costs).

None define a reproducible ratio of fee revenue to estimated lifetime replicated
resource cost, measured on live data, with a canonical spec, a real node census,
and multi-language independent reproduction. **Caveat on audit depth:** this is a
keyword/metadata search of arXiv + Scholar, not a full-text crawl of every venue;
absence of evidence is not proof of absence. The honest claim is "no prior
reproducible metric found in the searched sources", not "none exists anywhere".

**What is genuinely new (defensible novelty statement for the paper):**
1. **The reproducible metric itself** — SCCR with a canonical spec
   (`model-spec.json`), no redefined constants, three independent
   implementations (JS/Python/C) agreeing per-block.
2. **Regime dynamics** — the ratio measured across fee regimes and shown to move
   with the fee market (dated vs. live captures; §5, §10), including the
   knife-edge dependence on N and BTC price (§5.4).
3. **Multi-resource framing** — the RIR roadmap generalizing one measurement
   into a framework for the whole class of long-lived resources (UTXO, validation,
   relay, propagation) — roadmap.md §1–3.

**What is NOT claimed novel (keep the honesty):** the observation that fees may
under-price storage (Liu et al. 2021); the externality framing (Pigou/Coase
textbook); the fee-market-as-VCG framing (Aronoff et al. 2026).

## 4. Recommended pre-submission fixes from this audit

- [ ] Fix Liu et al. reference initials (J → Y, L → Z, B → M. H.) in working-paper.md §8.2 + references.
- [ ] Fix Aronoff et al. cited title → "A Model and Estimation of the Bitcoin Transaction Fee" (working-paper.md §8.2 + references).
- [ ] In §8.2, sharpen the novelty sentence to name the three components (reproducible metric + regime dynamics + multi-resource framework) — currently it names "measured, reproducible, Bitcoin-live-data quantification" which is good but can be more specific.
- [ ] Add the audit trail line: "literature audit (arXiv API + Google Scholar, 2026-08-02) — no prior reproducible fee-to-resource metric found; see research/literature-audit.md."

---

*Bitcoin Sahi Research — literature audit for working-paper v2.2.0 (2026-08-02).
All sources above verified against primary records except where marked.*
