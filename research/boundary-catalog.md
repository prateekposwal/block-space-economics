# Bitcoin Boundary Catalog

**BSAHI research artifact — the calibration set for the single thesis.**
*Each entry documents one historical moment when Bitcoin approached a measurable boundary: the class of boundary stressed, the stress vector, the data that survives, how the system resolved it, and the outcome. Every reading includes a falsifiable claim — the data that would overturn it.*

**Boundary classes (per THESIS.md §4):** T = technical-viability, E = economic-coordination, G = governance, V = verification-access.

**Outcome classes:** absorbed = system absorbed the stress without structural change; reset = the relevant rule/parameter was rolled back or re-established; persisted = the stress produced a structural change that remains (e.g., a fork, a persistent fee regime).

---

## Summary table

| # | Event | Date | Class | Stress vector | Resolution | Outcome | Data grade |
|---|---|---|---|---|---|---|---|
| 1 | Value-overflow incident | 2010-08-15 | T | consensus bug produced 184B BTC | reorg past block 74638 | reset | D |
| 2 | BIP16 P2SH activation | 2012-03-30 | G | first large soft fork, forced-coercion deployment | node-rule enforcement | absorbed | C |
| 3 | 0.8.0 UTXO-database fork | 2013-03-12 | T | LevelDB vs BDB chain split (~24 blocks) | rollback to 0.7 | reset | C |
| 4 | ASIC transition (mining capital) | 2012–2013 | E | hardware/opex escalation, pool concentration | difficulty recalibration | absorbed | C |
| 5 | BIP66 strict-DER activation | 2015-07-04 | V/T | enforcement race among un-upgraded miners | emergency upgrade window | absorbed | C |
| 6 | SegWit + blocksize war | 2017-08 | E/G | 1MB cap + fee crisis; BCH split | UASF/BIP-91; soft fork | absorbed (G), persisted (E) | B |
| 7 | SegWit2x cancellation | 2017-11-08 | G | attempted hard fork by majority hash power | consensus refused | absorbed | B |
| 8 | BCH/BSV split | 2018-11-15 | G | fork-of-fork, 128MB blocks, reorg attempt | hard-fork divergence | persisted | C |
| 9 | Ordinals / Runes data regime | 2023-01 → | E/T | data-bearing outputs exploit SegWit discount | absorbed into fee market | persisted (check 2026) | **B** (frozen daily aggregates cover 2023-2024) |
| 10 | BIP-110 post-lock-in | 2026-08-23 | G/V | UASF at 0% miner signaling | height-based enforcement | absorbed | A |

Grades are preliminary and follow THESIS.md §5 rules: **A** = live captures in this repo, **B** = strong primary-source archives, **C** = partial primary + secondary reconstruction, **D** = contested/thin. The catalog is the calibration set: an event whose grade improves moves the arrow's confidence accordingly.

---

## 1. Value-overflow incident (2010-08-15)

- **Class:** T (technical-viability, consensus semantics)
- **Stress vector:** A single transaction reused an output to create 184,467,440,737.0955 BTC (2^64−1 in base units). The overflow was a value-check bug, not an economic signal: the chain could not proceed while a block existed that created money the network never authorized.
- **Resolution:** The network abandoned the block and every block built on it (~53 blocks of history), restarting the chain just below block 74638. The canonical chain is the post-rollback chain; the invalid branch survives only in archives.
- **Outcome:** **reset** — the chain itself was rolled back to re-establish monetary authenticity.
- **Surviving data:** the reorg is on-chain (both sides of the split); block 74638 is the boundary. Full raw data requires archive node sync or public indexers — nothing in `data/` (2026 only).
- **What would falsify this reading:** evidence that the rollback height differs from the documented 74638 boundary, or that any economic value was created on the invalid branch and carried forward. Both are checkable against archive nodes.

## 2. BIP16 P2SH activation (2012-03-30)

- **Class:** G (governance, deployment mechanism)
- **Stress vector:** The first large-scale soft fork, and the first where enforcement preceded full deployment: upgraded nodes rejected pre-activation `OP_EVAL` constructs; the "forced coercion" argument — whether a soft fork may be enforced against un-upgraded miners — became a constitutional test for how protocol change happens.
- **Resolution:** Rules enforced by node software, not miner signaling; activation completed 2012-03-30 (block 173,805). No split.
- **Outcome:** **absorbed** — the deployment precedent (soft fork as node rule, not miner contract) is now normal.
- **Surviving data:** full on-chain history and the bitcoin-dev mailing list; no repo captures. Node-enforcement counts are not recoverable retroactively.
- **What would falsify this reading:** evidence that miner signaling, not node policy, was decisive in BIP16's timing — which would overturn the "node-enforced soft fork" precedent the catalog treats as established.

## 3. Version 0.8.0 UTXO-database fork (2013-03-12)

- **Class:** T (technical-viability, state representation)
- **Stress vector:** 0.8.0 switched UTXO storage to LevelDB; the two database layouts produced different valid-main-chain views. The network diverged for ~6 hours at block 225,430 (≈24 blocks), splitting into two chains that considered each other invalid. Exchanges halted; some users saw double-spend risk.
- **Resolution:** Miners rejoined the older (0.7) chain; 0.8 nodes accepted the rollback. Not a rule change — a client-state compatibility break, fixed by downgrade and later by treating DB migration as consensus-relevant.
- **Outcome:** **reset** — the divergent branch was abandoned.
- **Surviving data:** both branches on-chain historically; the incident is documented in release notes and archives. No repo coverage.
- **What would falsify this reading:** evidence that real economic double-spends occurred on the shorter branch, or that the rollback was not accepted unilaterally by the majority.

## 4. ASIC transition / mining capital (2012-2013)

- **Class:** E (economic-coordination, production side)
- **Stress vector:** Transition from GPU to ASIC mining concentrated production in capital-intensive hardware: difficulty jumped within months, pool share consolidated, and the October 2013 difficulty-manipulation disclosure on an adjacent chain (Litecoin) showed that a re-target exploit was thinkable. For Bitcoin the stress was economic — smaller producers priced out of the marginal hash.
- **Resolution:** Difficulty recalibrated; ASIC capital became the standard. No Bitcoin consensus event followed; concentration became a permanent structural trait, not a one-off.
- **Outcome:** **absorbed** (as a one-off event); the concentration it produced **persisted**.
- **Surviving data:** hashrate series and difficulty spikes from public archives; pool share attribution is partial pre-2014 and merged mining is invisible. This is the same gap flagged in `research/mining-concentration-note.md` and THESIS.md §5 (grade C→D for historical pool share).
- **What would falsify this reading:** a historical pooled hashrate reconstruction that shows 2013-2015 pool share was materially less concentrated than the standard narrative, which would weaken the "mining capital → concentration" arrow at its origin.

## 5. BIP66 strict-DER activation (2015-07-04)

- **Class:** V/T (verification-access + technical)
- **Stress vector:** The previous relay-rule mismatch (both invalid and not-invalid transactions circulating) created an enforcement race. Activation was scheduled (block 363,725) while a material share of mining pools had not upgraded; the window between "old rules still mined" and "new rules enforced" was hours, not days.
- **Resolution:** The voting window completed at low participation; the remaining pools upgraded in an emergency window. No split, but the episode is the canonical "boundary came within an hour" case.
- **Outcome:** **absorbed** — narrowly.
- **Surviving data:** activation block and version stats from public indexers; per-pool upgrade timing has to be reconstructed. No repo data (2015).
- **What would falsify this reading:** data showing the enforcement race did not actually risk a lasting split (e.g., that a majority chain would have won immediately either way), which would downgrade the incident's boundary severity.

## 6. SegWit + the blocksize war (2017-08)

- **Class:** E/G (economic-coordination + governance)
- **Stress vector:** The 1 MB anti-DoS cap became a political economy: fee spikes of 10–50× during the activation period (peak ~400-500 sat/vB in December 2017), Bitcoin Cash splitting at block 478,558 on Aug 1, and a UASF (BIP-148) scheduled to enforce SegWit against mining signaling.
- **Resolution:** miners preemptively activated BIP-91 (July 21, 2017); SegWit (BIP-141) activated Aug 24, 2017 at block 481,824 with no split; witness data at 1/4 weight lifted effective capacity to ~4 MB without a hard fork.
- **Outcome:** **absorbed** on the governance axis (no main-chain split), **persisted** on the economic axis (BCH fork; fee-market asymmetry became the norm). Full BSAHI study: `research/boundary-event-2017.md`.
- **Surviving data:** the economic spike is on-chain (fee history, mempool archives); the signaling chronology is primary-sourced in the case study. No repo-level 2017 captures exist — numbers are archive-derived and labeled as such in `boundary-event-2017.md`.
- **What would falsify this reading:** a reconstructed on-chain fee series showing the December 2017 peak was not 10-50× above baseline, which would weaken the claim that the governance event stressed users asymmetrically.

## 7. SegWit2x cancellation (2017-11-08)

- **Class:** G (governance, hash-power determinism)
- **Stress vector:** A hard fork to 2 MB blocks was announced with ~80% hash-power support (New York Agreement, May 2017). The claim under test: does majority hash power decide protocol changes?
- **Resolution:** the fork was cancelled before activation when miner support collapsed. The episode established the empirical answer: consensus is not coerced by hashrate alone.
- **Outcome:** **absorbed** — no fork; the attempted change ended in coordination failure.
- **Surviving data:** announcement/timing is news-sourced; signaling history partially recoverable. Better graded on the 2017 case-study record than on raw data.
- **What would falsify this reading:** evidence that the cancellation was driven by something other than withdrawal of miner support (e.g., fees or market pressure), which would change the "consensus is not hashrate" lesson.

## 8. BCH/BSV split (2018-11-15)

- **Class:** G (governance, fork persistence)
- **Stress vector:** a fork-of-a-fork: BSV (128 MB blocks, large-data ethos) split from BCH mid-2018 conflict; the split included a minority reorg attempt. The "bigger block = more free block space" thesis (inherited from the 2017 camp) was tested against the fee market and node cost on two live chains.
- **Resolution:** hard-fork divergence at the designated height; both chains survived with dramatically different per-byte cost economics and collapsed fee-per-byte outcomes.
- **Outcome:** **persisted** — the split is permanent; BCH and BSV are live contrasts for the block-size variable.
- **Surviving data:** both chains' on-chain data; a natural experiment for the resource-cost framework — see `research/history-of-bitcoin.md` "Fork economics as controlled experiment".
- **What would falsify this reading:** data showing BSV/BCH maintained a fee-per-byte consistent with BTC on a node-count-adjusted basis, which would refute the "bigger blocks collapse fee density" claim the catalog rests on.

## 9. Ordinals / Runes data regime (2023-01 →)

- **Class:** E/T (economic-coordination, state persistence)
- **Stress vector:** inscriptions embed data via `OP_FALSE OP_IF ... OP_ENDIF` in witness data (January 2023), exploiting the 4× SegWit weight discount that BIP66-era design (item 6) intended for scalability. BRC-20 (March 2023) and Runes (April 2024 halving) followed. Blocks filled with data-carrying outputs — the storage externality becomes measurable in the fee market, which is exactly the phenomenon the SCCR framework exists to measure.
- **Resolution:** no consensus response; the network absorbed higher data loads and fee volatility. The dependence remains and is the live subject of this repo's measurements.
- **Outcome:** **persisted** (as of 2026) — check against current storage vs fee data.
- **Surviving data:** partial public archives for 2023-2024; the repo's own live captures begin in 2026. Historical SCCR reconstruction (Rank 1) has since frozen 2009→2026 daily fee/price/block aggregates (`captured-data/historical/`) and reconstructs 2024 era-adjusted SCCR ≈ 7.9× — the storage-does-it-persist test is now measurable.
- **What would falsify this reading:** evidence that inscription demand was a transient spike rather than a persistent data regime (2025-2026 data would show it), or that the storage externality is not actually materializing in fees.

## 10. BIP-110 post-lock-in (2026-08-23)

- **Class:** G/V (governance + verification-access)
- **Stress vector:** a User Activated Soft Fork activating at a fixed height (963,648) with **0% miner signaling** — the height-based, NO_TIMEOUT mechanism that needs no miner goodwill. The full stress is captured at repo grade A.
- **Resolution:** enforcement carried by upgraded nodes, not miners; block production continued normally 18 days post-lock-in; no fee spike observed.
- **Outcome:** **absorbed** — mechanism-enforced, no disruption (per `research/bip110-post-lockin-case-study.md`).
- **Surviving data:** full primary sources in `data/bip110.json`, blockstream.info, and the case study.
- **What would falsify this reading:** a post-hoc showing that BIP-110's activation coincided with a measurable constraint on data-bearing transactions (i.e., that the soft fork DID bite economically), which would flip the outcome from "absorbed without cost" to "absorbed with a persistent tax on one construction."

---

## How to use the catalog

1. **Calibration, not narrative.** Each event's stress vector, not its drama, is the input. The grade column (A-D) is the confidence the calibration set can place on that event's data.
2. **Class must be answered per event.** The four classes are not interchangeable (THESIS.md §4). Do not average them into a single "boundary index."
3. **Falsifiable claims are the test.** Each reading states the data that would overturn it. If a reconstruction target (e.g., 2017 fees, 2013 pool share) later contradicts a claim, the catalog entry is updated and the date of revision recorded.
4. **Merge point for existing studies.** `research/boundary-event-2017.md` (item 6) and `research/bip110-post-lockin-case-study.md` (item 10) are the full studies behind their summary rows; this catalog is the index that ties them to the thesis.

---

*Produced 2026-09-15. Historical dates/heights are from primary-source archives (blockstream.info, mempool.space historical, Bitcoin Optech, bitcoin-dev archives) and the compiled `research/history-of-bitcoin.md`; repo-grade refs are A where live captures exist. This artifact is the Section 8.2 deliverable of THESIS.md.*