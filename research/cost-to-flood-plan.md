# Cost to Flood — Research Plan (attacker-side storage externality)

**Status:** PLANNED (2026-08-04) — the direct research extension requested by the
Vachagan comment. Next paper in the Bitcoin Resource Accounting program.
**Companion:** `research/working-paper.md` (node-side SCCR, v2.2.0),
`research/reply-vachagan.md` (the reply that spawned this), `research/model-spec.json` v2.1.0.

---

## 1. The one-sentence thesis

> The node-side measurement (SCCR ≈ 0.22) says fees under-price storage;
> the attacker-side measurement — *what it costs to impose that storage* — is the
> leverage ratio of the vulnerability, and it has never been measured.

## 2. The question

If a well-funded actor wants to impose permanent costs on every full node, what
does it cost them, and what is the resulting **leverage ratio** (node cost imposed
÷ attacker cost paid)?

## 3. The quantities to measure (all reusing existing infrastructure)

| Quantity | Definition | Inputs (verified) |
|---|---|---|
| **P_flood** | USD to fill one full block at the fee floor | frozen capture: cheapest block = 0.00522 BTC (~$329); avg = 0.0195 BTC (~$1,231) |
| **P_year** | USD/year to fill every block (~52,596 blocks) | avg ≈ **$65M/yr**; at fee floor ≈ **$17M/yr** (verified) |
| **C_node_imposed** | USD/year the flood imposes on all N nodes | SCCR model × N=32K (storage/bandwidth legs) |
| **L** | **the leverage ratio** = C_node_imposed ÷ P_year | **3.0× (verified)** — see §4 |
| **P_dust** | USD per dust UTXO minted (330-sat dust + fee) | ~$0.246/UTXO at fee floor (verified) |
| **C_dust_imposed** | lifetime node cost of one dust UTXO (T=10) | $0.229/node (verified) → **L_dust = 0.9×** |
| **Boundedness** | max chain growth (weight cap) + max UTXO growth | **~52.6 GB/yr vbytes** max (4M WU/block ÷ 4 = 1M vbytes × 52,596) — corrected from the earlier "210 GB" (that was weight-units, not vbytes) |

## 4. The three results (what makes it a paper)

1. **The leverage ratio L = 3.0×.** A full-block flood at the fee floor costs the
   attacker ~$65M/yr and imposes ~$197M of 10-year storage cost on the network.
   The vulnerability is real and *moderately* leveraged — the attacker gets 3×
   the cost they pay. Not the apocalypse the comment implies, not harmless.
2. **The dust-UTXO result: L_dust = 0.9× (storage leg).** Dust is a WEAK attack
   vector on the storage leg — the per-node storage cost of a dust UTXO is
   actually slightly LESS than its fee. The real dust threat is RAM/validation
   (the UTXO set is an in-memory index), not storage. This is a clean, novel,
   counterintuitive result: **dust hurts via the validation leg, not the storage
   leg** — which the 4-resource model already anticipated.
3. **The boundedness theorem.** Block weight caps chain growth at ~52.6 GB/yr
   vbytes and UTXO growth is block-bounded — the attack is *quantitatively
   bounded but qualitatively harmful*. A nation-state can sustain 3× leverage
   indefinitely, pushing node operation toward institutions — the centralization
   pressure the paper's "unpriced permanence" predicts.
4. **The budget scenario table.** What a nation-state budget buys: e.g. "$65M/yr
   sustained → 52.6 GB/yr permanent chain growth → N nodes priced out → centralization
   pressure." Converts the abstract threat into concrete, falsifiable numbers.

## 5. Novelty (why this is publishable)

- The repo's literature audit found NO attacker-side cost-to-impose measurement.
  SCCR (node side) is ours; the attacker-side leverage ratio is a genuinely new
  quantity.
- It directly extends the adversarial-review finding: the paper's knife-edge
  (the strong claim inverts at N≈49K or BTC≈$77K) is the *same* knife-edge seen
  from the attacker's side.
- It's falsifiable: L, P_dust, and the budget table are all computable from
  public fee data + the existing model.

## 6. Why it's strategically perfect

- **Converts the hostile comment into the program's next deliverable.** The
  reply says "if you have attack scenarios you'd want priced, I'd genuinely like
  to run them" — this paper IS the pricing of those scenarios.
- **Cheap to produce.** No new infrastructure: fee data (frozen capture +
  live), UTXO pipeline (measured leg), model-spec (existing quantities).
- **Defense-in-depth argument.** If the reply's framing is challenged, the paper
  is the evidence behind it.

## 7. Execution plan (ordered)

| # | Step | Effort | Output |
|---|---|---|---|
| 1 | Compute P_flood, P_year, P_dust from fee data | ✅ DONE | $329-1,231/block; $17-65M/yr; $0.246/dust |
| 2 | Compute C_node_imposed via SCCR model at N=32K | ✅ DONE | $197M/10yr for 1yr flood |
| 3 | Derive the leverage ratio L | ✅ DONE | **L = 3.0×** (flood), **L_dust = 0.9×** (dust, storage leg) |
| 4 | Write the boundedness theorem | 🟡 PARTIAL | ~52.6 GB/yr vbytes cap (verified); proof sketch in plan |
| 5 | Build the budget scenario table | ⬜ TODO | state budgets → node impact |
| 6 | Draft `research/cost-to-flood.md` + regenerate HTML | ⬜ TODO | the v1 note |
| 7 | Review against the SCCR paper's §7 knife-edge (consistency) | ⬜ TODO | cross-check |
| 8 | Update the gap tracker + commit/push | ⬜ TODO | shipped |

## 8. DONE vs LEFT

**DONE:** the plan; the reply (`reply-vachagan.md`); inputs verified; **the v1
results computed** (L = 3.0× flood leverage, L_dust = 0.9×, boundedness ~52.6
GB/yr) — this is already a proof-of-concept with real numbers.

**LEFT:**
- [ ] Prateek reviews + posts the reply
- [ ] The dust-RAM/validation leg (the 0.9× is storage-only; dust's real threat is RAM)
- [ ] The budget scenario table (step 5)
- [ ] The v1 note `cost-to-flood.md` + HTML (step 6)
- [ ] Decide: standalone note first, or fold into the working paper as §5.8 before submission?

---

*Bitcoin Sahi Research — Cost to Flood research plan (attacker-side externality
measurement), 2026-08-04.*
