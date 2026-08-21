# Reviewer Simulation — Adversarial Pre-Submission Review

**For:** working-paper v2.1.0 (SCCR storage paper) · model-spec v2.0.1
**Date:** 2026-08-02
**Freshness note (2026-08-21):** this review memo is a **dated historical record**
written against the Aug 02–15 banded baseline (~0.22–0.29, ~99–100% below 1×).
The live series has since moved to a new regime — **SCCR 0.4433, 96.24% below 1×
on 2026-08-21** (`/data/sccr_history.json`, 14-point record). The reviewer
objections stand as written (they target the paper's *framing*, which is
date-agnostic), but any pre-submission re-run must re-check every number against
the live series and the regime-event page
(`reports/research/regime-event-2026-08-21.md` / served
https://bitcoinsahi.com/research/regime-event-2026-08-21.html).
**Method:** four adversarial memos written from four reviewer identities, each
with the 3–5 sharpest objections and whether the paper currently answers them
(specific sections cited). Ends with a consolidated "does the paper survive?"
verdict and the specific fixes needed.

The paper's pre-emption list (from the prior review, roadmap §3g agenda) —
**pruning, cheap-storage, efficient-markets/missing-market, Liu, historical
counter-attack, node-count** — is cross-referenced throughout.

---

## Reviewer A — Bitcoin Core contributor (protocol/consensus lens)

### Objections

1. **"You compare fees to a 10-year storage cost as if the data must be stored
   for 10 years — but most nodes prune."** (PRE-EMPTION: pruning)
   - *Answered?* **Yes, in §7 (limitation 3) and the companion note
     `archival-vs-pruned-note.md`.** The note concedes the census measures
     reachability, not retention, and proves even a 78% pruning rate
     (N_archival ≈ 7K) would not flip the headline on the live capture. The
     paper is honest that SCCR-as-computed is an *upper bound* on the burden
     borne by typical nodes. **This is the paper's strongest pre-emption.**
   - *Residual gap:* the *measured* pruned-vs-archival split does not exist
     (agent-26 is future work). A Core reviewer will accept the honest framing
     but may push "so your headline N=32K is a reachability bound, not a
     storage-bearing population."

2. **"The node count is the RPC cap, not the network."** (PRE-EMPTION: node-count)
   - *Answered?* **Yes, §5.4 and model-spec N note** — "32,000 is a lower bound
     (the node knows AT LEAST 32K addresses; addrman caps at 32,000)". The
     knife-edge thresholds (N≈7.1K inversion, N≈49K break of the 100% claim)
     bound the claim. This is the correct, honest treatment.
   - *Residual gap:* an adversarial Core reviewer might demand the actual
     `getpeerinfo` connection counts as a *live* reachable set (the census has
     liveConnections but the paper headlines 32K known addresses). Worth adding
     one sentence in §5.4: "live outbound connections at census time were X".

3. **"The 4:1 SegWit discount — you imply it 'subsidizes' data-bearing
   constructions; a Core contributor will read that as an attack on a
   consensus-tested design."**
   - *Answered?* **Yes, §2 and §3 caveats** — explicitly NOT claiming the SegWit
     discount was a mistake, and noting the discount applies to all witness
     data. The framing is measurement, not criticism.
   - *Residual gap:* the paper's *name* — "Storage Cost Coverage Ratio" — sounds
     like a solvency claim. §8.3 addresses terminology, but the arXiv title
     should avoid "problem" language that reads as a protocol critique.

4. **"BIP-110 / data-cap discussions are dead; why mention them?"**
   - *Answered?* **Yes, §7 future work** lists "BIP-110 pre/post measurement
     protocol IF activation is ever signaled" — conditional and hedged. The
     prior review's "dead-claims audit" (publication-plan §4) explicitly bars
     any BIP-110 claim beyond documented DOA status.

### Verdict (Core lens): **SURVIVES** with one requested addition (live
connection counts in §5.4) and the terminology/title care. The pruning and
node-count pre-emptions are the two places this reviewer would attack, and both
are answered with quantified robustness statements, not hand-waves.

---

## Reviewer B — Economist (public economics / externalities lens)

### Objections

1. **"Pigou/Coase: node operators choose to run nodes and can prune — this is
   not a classic negative externality."** (PRE-EMPTION: efficient-markets /
   missing-market)
   - *Answered?* **Yes, §8.1** — concedes the Pigouvian case is weaker for a
     voluntary, avoidable cost; correctly reframes as "unpriced but avoidable
     cost" and explicitly says the paper *measures*, it does not claim
     welfare-relevant externality. This is the correct economics discipline.
   - *Residual gap:* an economist will want the *efficient-markets*
     counter-argument stated even more sharply: if block space is priced at the
     margin by a market that clears, then marginal cost IS internalized by
     definition in a static sense — the paper's answer (the fee is a one-time
     congestion price with a ~10-min horizon; the storage cost recurs over T
     years) is in §1 but could be elevated into §8 as a named objection
     ("efficient-markets objection") with a direct rebuttal.

2. **"Cheap storage: storage is getting cheaper, so the 10-year cost is
   overstated."** (PRE-EMPTION: cheap-storage)
   - *Answered?* **Yes, §10 Q2** — storage 10× cheaper (C=$92.5/yr) flips the
     gap (SCCR = 2.228). And §7 limitation 2 (homogeneous costs). The
     sensitivity table (§5.3) brackets C from $600–$1,400. The economics is
     honest: the framework survives; the magnitude is parameter-dependent.
   - *Residual gap:* "cheaper over time" (declining SSD $/GB) is not the same
     as "cheaper now" — the sensitivity varies the *level* of C, not its *trend*.
     An economist may note the 10-year undiscounted sum ignores the declining
     cost curve; §7 limitation 4 covers discounting but not the cost trend.
     Add one sentence: "a declining $/GB trend would lower the liability;
     the paper's T=10 constant-cost assumption is conservative in the other
     direction from discounting." (Actually careful: discounting lowers PV; a
     cost decline lowers the future liability — both lower it; so the paper
     overstates. State it plainly.)

3. **"No discounting overstates the liability."**
   - *Answered?* **Yes, §7 limitation 4** — quantifies: discounting at r=5%/yr
     (8%/yr) reduces PV by ~27% (45%). Rare for a working paper to pre-quantify
     this. Strong.

4. **"The ratio's denominator includes ALL node costs (bandwidth, electricity)
   but you call it a storage ratio."**
   - *Answered?* **Yes, §7 limitation 5** — fixed-vs-marginal distinction is
     explicit. C prices the node's average bill; the storage leg is the
     attribution. The name is a convention, flagged in §8.3.

### Verdict (economics lens): **SURVIVES** — the paper does the rare thing of
quantifying its own limitations. The one *must-fix* is elevating the
efficient-markets objection into §8 with a named rebuttal (marginal vs.
recurring cost), and adding the cost-trend sentence to limitation 4.

---

## Reviewer C — Distributed-systems researcher (reproducibility / data lens)

### Objections

1. **"Your data is a private SQLite capture; how do I reproduce the number?"**
   (REPRODUCIBILITY — the paper's core asset)
   - *Answered?* **Yes, as of this execution plan** — the reproduction kit
     (`research/reproduce/`) now ships a frozen input capture plus Python and C
     implementations; JS is canonical. A cross-check script asserts per-block
     agreement across all three. **Before this plan, the claim "three
     independent implementations (JS/Python/C)" was NOT true — no C
     implementation existed.** That gap is now closed (verified: all three agree
     to 6 decimals).
   - *Residual gap:* the README's "reproduce in 30 seconds" one-command path
     must actually work (see Phase 2 — build + verify). External reproduction
     (someone uninvolved) is still Prateek's task.

2. **"One capture, one day, 171 blocks — thin data."**
   - *Answered?* **Partially.** §5 reports two captures (156 / 167–171 blocks)
     and §5.4 documents the movement between them; §10 Q7 adds historical
     era-level numbers. The SCCR tracker plist runs daily, so the time-series
     is now accumulating. The paper should state the time-series is *live and
     growing* — the number in the paper is a dated snapshot by design.
   - *Residual gap:* no long history chart exists yet (only daily reports).
     The Phase-4 history JSON will address this for the site; the paper itself
     is honest that it's a point-in-time measurement.

3. **"Fee history avgFees vs. per-block fee data — which did you use?"**
   - *Answered?* **Yes** — the model uses the fee_history capture's `avgFees`
     (sats/block) with the capture's `USD` price. The reproduction kit freezes
     that exact input. A distributed-systems reviewer can now check every block.

4. **"Node count 32K from getnodeaddresses is addrman's cap — the number is
   suspiciously round."**
   - *Answered?* **Yes, §5.4 + model-spec note** — the paper says the addrman is
     saturated at the cap, hence "at least 32K". This is the correct, honest
     reading of the RPC's behavior. The independent-estimates band (10K–100K)
     is given.

### Verdict (distributed-systems lens): **SURVIVES** — the reproducibility
asset is the paper's strongest defense and is now actually true (post-kit). The
one risk is over-claiming; keep "point-in-time, dated capture, growing
time-series" language.

---

## Reviewer D — Mechanism-design researcher (incentives / game theory lens)

### Objections

1. **"Liu et al. (2021) already did the mechanism — what's new?"**
   (PRE-EMPTION: Liu)
   - *Answered?* **Yes, §8.2** — the paper explicitly disclaims novelty of the
     observation and claims only the measurement. The novelty statement now has
     three components (reproducible metric + regime dynamics + multi-resource
     framework, per the literature audit). This is the correct way to handle
     the closest prior work — but the §8.2 wording should be sharpened to name
     all three components (see audit §4).
   - *Residual gap:* a mechanism designer will ask "so what?" — what does the
     measurement *imply* for mechanism design? §10 Q8 (equilibrium) is the
     honest "we don't know yet" answer, which is better than fabricating one.

2. **"Fees vs. storage cost is a weird comparison — fees are paid by users,
   storage borne by node operators; in mechanism terms these aren't the same
   agent."**
   - *Answered?* **Yes, §8.1** — the externality framing (cost borne by parties
     who didn't consent) is exactly this point. And §2 is explicit that no fix
     is proposed. A mechanism designer might still want the *two-sided* framing
     (who pays vs. who bears) stated as a named objection.

3. **"Your 'below 1×' framing implies 1× is the right target — but why should
   fees cover 100% of storage cost? Efficient pricing doesn't require it."**
   - *Answered?* **Partially.** §5.4 and §8.1 note the paper measures and does
     not prescribe. The 1× threshold is a descriptive reference point, not a
     normative target. The paper should state this explicitly in one sentence —
     "1× is a descriptive calibration point, not a policy target" — to close a
     genuine attack surface.
   - *Residual gap:* Q4 in §10 shows a hypothetical fee regime (100 sat/vB)
     where SCCR ≈ 11 — a mechanism designer will use this to say "the market
     CAN over-price storage; your ratio has no natural anchor." The answer is
     the regime-dynamics point: the ratio *moves with the fee market*, which is
     the finding.

4. **"The historical counter-attack: SCCR was above 1× in 2017–2024 — so the
   fee market DID internalize storage in those years. Your 'under-priced'
   narrative only holds in a low-fee regime."** (PRE-EMPTION: historical
   counter-attack)
   - *Answered?* **Yes, §10 Q7** — the paper states the historical numbers
     itself (2017 avg ~10.0, 2021 ~8.0, etc.) and frames 2025–2026 as "the
     first sustained sub-1× regime". This is a pre-emptive disclosure of the
     strongest counter-argument. **This is excellent and rare.**
   - *Residual gap:* the era-adjusted node counts behind Q7 should be footnoted
     with the sources (they're asserted, not yet fully derived in the repo —
     see roadmap Phase IV).

### Verdict (mechanism-design lens): **SURVIVES** — the historical
counter-attack pre-emption (§10 Q7) is the single strongest defensive move in
the paper. Two one-sentence additions close the remaining attack surface:
(1) "1× is a descriptive calibration point, not a normative target";
(2) name the two-sided payer-vs-bearer framing in §8.1.

---

## Consolidated verdict

> **The paper survives adversarial review — conditionally.** All six items on
> the prior review's pre-emption list (pruning, cheap-storage,
> efficient-markets/missing-market, Liu, historical counter-attack, node-count)
> are addressed with either quantified robustness statements (pruning,
> node-count, cheap-storage) or honest disclaimers (Liu, efficient-markets) or
> pre-emptive disclosure (historical counter-attack). The reproducibility asset
> — the paper's claim to fame — is now actually true (three independent
> implementations, frozen input, cross-check script; verified 2026-08-02).

**Must-fix before submission (specific):**

| # | Fix | Where | From |
|---|---|---|---|
| F1 | Add live outbound connection count to §5.4 (the census had `liveConnections`; headline the observed live set next to the 32K known-address lower bound) | working-paper §5.4 | Reviewer A |
| F2 | Elevate the **efficient-markets objection** to a named sub-section in §8 with a direct rebuttal (static marginal pricing vs. recurring cost) | working-paper §8 (new §8.x) | Reviewer B |
| F3 | Add cost-trend sentence to limitation 4 (declining $/GB lowers future liability; both discounting and cost decline make the T=10 constant-cost figure conservative = overstatement) | working-paper §7.4 | Reviewer B |
| F4 | Add one sentence: **"1× is a descriptive calibration point, not a normative target"** | working-paper §5.4 | Reviewer D |
| F5 | Name the two-sided payer-vs-bearer framing in §8.1 | working-paper §8.1 | Reviewer D |
| F6 | Fix Liu et al. reference initials + Aronoff et al. title (see literature-audit §4) | working-paper references | Audit |
| F7 | Sharpen novelty sentence in §8.2 to name all three components | working-paper §8.2 | Audit / Reviewer D |
| F8 | Keep "point-in-time, dated capture, time-series growing" language; never imply the number is stationary | working-paper §5 | Reviewer C |
| F9 | Ensure the README "reproduce in 30 seconds" path is literally one command and verified | README + tools | Reviewer C |

**Not blockers (documented as future work, correctly):** measured pruned-split
(agent-26), long-history chart, Q8 equilibrium answer, era-adjusted node-count
sources for Q7 (footnote).

---

*Bitcoin Sahi Research — adversarial pre-submission review simulation
(2026-08-02). Cross-references: working-paper.md §5.4, §7, §8, §10;
archival-vs-pruned-note.md; literature-audit.md; publication-plan.md §4.*
