# The Governance Boundary — BIP-110 as a live natural experiment (v1)

**Status:** v1 NOTE (2026-08-10) · **Program:** Bitcoin Resource Accounting
**Companion:** `research/working-paper.md`, `research/cost-to-flood.md`,
`research/reply-vachagan.md`
**Origin:** the observation that Bitcoin's governance is not "who wins" but
*who can change the valid-state transition rules, under what coordination
threshold, and what happens when constituencies disagree.*

---

## The frame

Four common claims are each half-right:

| Claim | Verdict |
|---|---|
| Hashrate concentration = protocol control | ❌ Miners can fork; they can't change rules others run |
| Node count = economic majority | ❌ Nodes enforce rules; markets ratify chains |
| Developer influence = consensus | ❌ A BIP is a proposal; adoption is voluntary |
| UASF = automatic legitimacy | ❌ Enforcement binds only if people actually run it |

The real question is **measurable**, not philosophical: who can change Bitcoin's
valid-state transition rules, under what coordination threshold, and what
happens when constituencies disagree? BIP-110 is a live, parameterized
experiment in exactly this boundary.

## BIP-110 — the parameterization (verified from BIP text)

| Parameter | Value | What it means for the boundary |
|---|---|---|
| Activation threshold | **55%** (1109/2016) vs the usual 95% | urgency lowers the coordination bar |
| Timeout | **NO_TIMEOUT** + height-based max | the boundary is a *height*, not miner goodwill |
| Mandatory-signaling window | **blocks 961632–963647** | user-enforcement: non-signaling blocks are invalid |
| Lock-in | **≤ 963648** | guaranteed by height even with zero miner support |
| Active duration | ~1 year | reversible pressure, not permanent capture |
| Terminal state | **EXPIRED** (no FAILED) | no dead-end |

Every parameter is a falsifiable claim about *who decides*. That is a natural
experiment with its entire parameterization public in advance — a first for
Bitcoin.

## LIVE observation (2026-08-10, agent-26 capture)

| Metric | Value |
|---|---|
| Current height | 961,792 |
| In mandatory window? | **YES** (961632–963647) |
| Blocks until lock-in | ~1,856 (~12.9 days → lock-in ≈ Aug 23) |
| Signaling bit 4 (last 10 blocks) | **0%** |

**First data point:** inside the mandatory window, miners are **not** signaling
bit 4 — yet the deployment is designed to lock in regardless at height 963648,
because the enforcement clause is carried by node software, not pools. Whether
this holds, and what happens at the disagreement point, is the observation the
window captures.

## The three measurable components (the GBI)

1. **Threshold parameters per deployment** — documented, comparable (55% vs 95%
   vs BIP-8 LOT). The parameterization *is* the boundary's public specification.
2. **Enforcement behavior** — signaling compliance during windows, blocks
   rejected, client-version adoption. Partially observable; BIP-110 capture
   records the signaling side.
3. **Disagreement outcomes** — split / compliance / failure. Observable after
   the fact; one is live now.

**Data-gap (honest):** the *economic majority* constituency (exchanges,
custodians, merchants, Lightning hubs) — whose acceptance ratifies a chain — is
**not measured**. This is the one undefined quantity in the frame, and a
necessary future data source for a full governance-boundary index.

## Calibration: the 2017 precedent

BIP-148 (SegWit UASF) is the historical case: a 95%-threshold soft fork that
was set to enforce via flag-day, miners pre-emptively complied (BIP-91), and
SegWit activated August 2017 without a split. The *threat of enforcement*
changed miner behavior — which is exactly what BIP-110's mandatory window is
testing again.

## DONE vs LEFT

**DONE:** the frame; BIP-110 parameterization verified; live capture recording
(in-window, 0% signaling, lock-in ~Aug 23); 2017 calibration identified.

**LEFT:** post-window analysis (after lock-in ~Aug 23 — what happened at the
disagreement point?); economic-majority data source; full GBI index.

---

*Bitcoin Sahi Research — The Governance Boundary (BIP-110 natural experiment),
v1 note (2026-08-10). Window data from agent-26 live capture; parameters from BIP
text.*
