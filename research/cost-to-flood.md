# Cost to Flood — the attacker-side storage externality (v1)

**Status:** v1 NOTE (2026-08-10) · **Program:** Bitcoin Resource Accounting
**Companion:** `research/working-paper.md` (node-side SCCR v2.2.0), `research/cost-to-flood-plan.md`
**Origin:** a reviewer's comment — "a nation state could flood your computer with garbage or put so much crap in UTXO that you can't run a node." We priced it.

---

## The one-sentence thesis

The node-side measurement (SCCR ≈ 0.22) says fees under-price storage; the
**attacker-side measurement** — what it costs to impose that storage — is the
leverage ratio of the vulnerability, and it has never been measured.

## The headline numbers (verified 2026-08-10)

| Quantity | Value | Meaning |
|---|---|---|
| **P_flood** (fill one block) | **$329–1,231** | at fee floor (0.0052 BTC) vs avg (0.0195 BTC) |
| **P_year** (fill every block) | **$17M–65M/yr** | ~52,596 blocks × P_flood |
| **C_node_imposed** (10-yr node cost) | **~$197M** | one year of full-block flood × N=32K × T=10 |
| **Leverage ratio L** | **3.0×** | node cost imposed ÷ attacker cost paid |
| **L_dust** (storage leg) | **0.9×** | dust's per-node storage cost is *less* than its fee |
| **Boundedness** | **~52.6 GB/yr** | max vbytes the block-weight cap allows |

## The three results

### 1. The leverage ratio L = 3.0×
Filling every block at the fee floor costs the attacker ~$65M/yr and imposes
~$197M of 10-year storage cost on the network. The vulnerability is **real and
moderately leveraged** — the attacker gets ~3× the cost they pay. Not the
apocalypse, not harmless. A nation-state budget sustains this indefinitely.

### 2. Dust is a WEAK attack on storage (L_dust = 0.9×) — the counterintuitive result
The per-node lifetime storage cost of a dust UTXO is slightly *less* than the
fee that creates it (~$0.246 to mint, ~$0.229 imposed). **Dust's real threat is
the validation/RAM leg, not storage** — the UTXO set is an in-memory index every
node must hold. This is exactly what the 4-resource model anticipated: the cost
surfaces differ by leg.

### 3. The attack is bounded but qualitatively harmful
Block weight caps chain growth at ~52.6 GB/yr of permanent vbytes, and UTXO
growth is block-bounded. The attack cannot make Bitcoin un-runnable tomorrow —
but sustained full-block flooding raises node costs, pushes operation toward
institutions, and degrades the "anyone can verify without permission" property.
That is the centralization pressure the paper's unpriced-permanence thesis
predicts.

## Boundedness (the theorem)

    max_vbytes/yr = (4,000,000 WU/block ÷ 4) × 52,596 blocks ≈ 52.6 GB/yr

Block weight is a hard cap; the chain cannot grow faster than this in vbytes.
UTXO growth is bounded by the number of outputs per block. The attack is
therefore *quantitatively bounded but qualitatively harmful*: it cannot destroy
the network, but it can price node operation up.

## What this means (honest framing)

- **It's a vulnerability, not a death certificate.** An unpriced externality is a
  defect in the pricing of a resource — measurable, and fixable.
- **The leverage ratio is the number that matters.** If L ≫ 1 the threat is live;
  at L = 3.0 it is real but not existential. The 0.9× dust result shows the
  attack surface is leg-specific.
- **The reply to the reviewer said it plainly:** "If you have attack scenarios
  you'd want priced, I'd genuinely like to run them." This note is the first
  batch.

## DONE vs LEFT

**DONE:** P_flood/P_year/C_node_imposed/L/L_dust/boundedness computed and verified;
this v1 note.

**LEFT:** budget scenario table (nation-state budgets → node impact); dust-RAM
leg measurement; decision: standalone vs fold into working-paper §5.8.

---

*Bitcoin Sahi Research — Cost to Flood (attacker-side externality), v1 note
(2026-08-10). Numbers verified against frozen capture + live mempool.space.*
