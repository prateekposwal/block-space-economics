# Community Review Plan — After the arXiv Preprint is Live

**For:** "Storage Cost Internalization in Bitcoin's Fee Market" (working-paper
v2.2.0) — community review phase, sequenced AFTER the arXiv upload
**Status:** PLAN (2026-08-02) — execute after the preprint URL exists
**Goal:** get the paper in front of the exact audience who can falsify it
(node operators, protocol engineers, economists), log every objection, and feed
them into the next revision (v2.2.0) — mirroring the internal adversarial review
(`research/reviewer-simulation.md`).

---

## 1. Outreach list (who, what, when)

| # | Venue / audience | What to send | When | Why them |
|---|---|---|---|---|
| 1 | **Bitcoin Optech** (bitcoinops.org) | 2–4 sentence research summary + preprint link (NOT the full paper) | 1–3 days after arXiv is live | Reaches node operators + engineers — exactly the "who bears the cost" audience. They routinely cite new Bitcoin research. |
| 2 | **Delving Bitcoin** (delvingbitcoin.org) | Full paper + reproduction kit link + a short framing post | 3–7 days after arXiv | Technical discussion forum; the paper's measurement claims will get the sharpest scrutiny here. |
| 3 | **Bitcoin-Dev mailing list** | Short announcement + preprint + kit link (protocol-adjacent framing) | ~1 week after arXiv | Protocol developers; pre-empts "is this a consensus critique?" reading (it isn't — say so explicitly). |
| 4 | **Chaincode Labs** (chaincode.com) | Full paper + kit (they run Bitcoin research seminars) | 1–2 weeks after arXiv | Research-savvy Bitcoin engineering audience; may surface node-cost data we lack. |
| 5 | **Bitcoin Core contributors** (individually, via public channels) | Full paper + kit link | 1–2 weeks after arXiv | The census + pruning + SegWit claims are Core-adjacent; individual outreach should be non-spammy, one message. |
| 6 | **r/BitcoinEngineering** | Announcement thread + link (existing v1/v2 community) | Same day as arXiv | Community feedback loop from the v1/v2 era; link-first. |
| 7 | (optional) **Academic workshops** (Bitcoin Research Day etc.) | Full paper | Only after community feedback validates the framing | Do NOT pre-commit (publication-plan §1). |

**Sequencing rule:** arXiv first (gives every pitch a link), then Optech (fast
news cycle), then the technical forums (Delving, bitcoin-dev, Chaincode), then
individual Core contributors. r/BitcoinEngineering same-day.

## 2. What to send each (pitch vs. full paper)

- **Pitch-only (summary, no PDF):** Optech, bitcoin-dev, r/BitcoinEngineering.
  A 2–4 sentence summary: what was measured (SCCR, live data, 26,586 reachable-node census),
  the headline (fees cover ~22–29% of modeled 10-yr storage cost (pre-re-base N=32,000; ~27–35% at the measured N=26,586),
  ~99–100% of sampled blocks below 1×), and the reproducible framework. Keep it
  neutral — these are technical venues, not advocacy.
- **Full paper + reproduction kit:** Delving Bitcoin, Chaincode Labs, Bitcoin
  Core contributors. The kit (`research/reproduce/`) makes the paper falsifiable
  — that IS the pitch: "here is the number, here is how to check it yourself in
  three languages, here is the frozen input."

## 3. Pitch drafts (ready to send)

**Optec/bitcoin-dev/r-BitcoinEngineering version:**

> We measure whether Bitcoin's fee market internalizes the long-term storage
> cost of permanently recorded blockchain data. Using a primary-source node
> reachable-node census (26,586; the local addrman sample counts addresses, not nodes) and live
> fee-history data, we define a Storage Cost Coverage Ratio (SCCR) — fees paid
> over estimated lifetime replicated storage cost. Across 171 sampled blocks
> (2026-08-02 capture, model-spec v2.0.1 — pre-re-base; at the measured N=26,586 the coverage is ~27%) fees cover ~22% of the modeled 10-yr
> storage cost on average; ~99–100% of sampled blocks fall below the 1×
> threshold. The ratio is reproduced in three independent implementations
> (JS/Python/C) with a frozen input capture. Preprint: [URL]. Reproduction kit:
> [repo link]. We measure; we do not claim Bitcoin is broken.

**Delving/Chaincode/Core version:** same pitch + full paper + kit + the
open-data-gap callout (pruned-vs-archival split is NOT yet measured — that's
the honest invite for collaboration, not a weakness to hide).

## 4. How to log and consume feedback

1. **Log every objection** in `research/community-feedback.md` (create on first
   response): date, source (thread/venue), objection, severity (kills-claim /
   needs-data / needs-wording), and the working-paper section it targets.
2. **Map to the internal review:** every logged objection is matched against
   the reviewer-simulation memos (A–D) — most will already have a pre-empted
   answer; anything new becomes a **F-priority fix** for v2.2.0.
3. **Weekly triage:** after the first week, batch responses: acknowledge
   publicly in-thread (never argue on first pass), fold into the next revision,
   and update the arXiv version (arXiv allows version updates — this is a
   feature, not a failure).
4. **Consumption rule:** a community objection that survives two independent
   attempts to answer it changes the paper. The paper's whole point is that the
   measurement is falsifiable — treat successful falsification as a win.
5. **Close the loop:** reply to every substantive thread with what changed in
   the next version (v2.2.0 notes in working-paper.md changelog).

## 5. DONE vs LEFT

**DONE:** outreach list, pitch vs. full-paper split, pitch drafts, feedback
logging protocol.

**LEFT (after arXiv is live):**
- [ ] Execute the outreach in the §1 sequence
- [ ] Create `research/community-feedback.md` and log responses
- [ ] Fold feedback into v2.2.0 + arXiv version bump
- [ ] Update TODO-bitcoin-oracle.md R5 item with the preprint URL + community status

---

*Bitcoin Sahi Research Council — community review plan for the SCCR paper
(2026-08-02). Execute after the arXiv preprint is live.*
