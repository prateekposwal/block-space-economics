# Satoshi's Primary Sources — Verification Note

<!-- seo-title: What Satoshi Said About Storage, Fees & Nodes -->

**What Satoshi actually wrote about storage, fees, and node equilibrium**

*(Analysis note — NOT a submission artifact. Created 2026-08-03 by Prateek on
Prateek's request to verify an architect's finding before any fold-in. Every quote
below was re-verified against the canonical Satoshi Nakamoto Institute (SNI)
archives and bitcoin.org/bitcoin.pdf on 2026-08-03. Status labels: ✅ VERIFIED
verbatim · ⚠️ VERIFIED but context-corrected · ❌ APOCRYPHAL / NOT FOUND.)*

---

## 1. What the architect claimed

> Satoshi modeled the storage externality twice (in dollars AND bytes), dismissed
> it by design, and never priced it; fees were defined purely as an inclusion
> incentive, never a storage price; and when he needed to protect storage he used
> quantity control (block-size cap), not price.

The proposed causal chain: **2008 design (storage designed-around, not priced) → 2017 SegWit discount → 2023 Ordinals → measured externality**, as a primary-source
argument against the efficient-markets objection (working-paper §8.3).

## 2. Verification verdict — what checks out and what does not

| # | Claim | Verdict | Notes |
|---|---|---|---|
| 1 | Whitepaper §6: fee = "the difference is a transaction fee" (inclusion incentive) | ✅ **VERIFIED verbatim** | Exact text: *"If the output value of a transaction is less than its input value, the difference is a transaction fee that is added to the incentive value of the block containing the transaction."* Fees are defined as an incentive to *produce blocks* — never as a storage price. |
| 2 | Whitepaper §7: "80 bytes \* 6 \* 24 \* 365 = 4.2MB per year" + "storage should not be a problem" | ✅ **VERIFIED verbatim — context-critical** | Exact text: *"A block header with no transactions would be about 80 bytes. If we suppose blocks are generated every 10 minutes, 80 bytes \* 6 \* 24 \* 365 = 4.2MB per year. With computer systems typically selling with 2GB of RAM as of 2008, and Moore's Law predicting current growth of 1.2GB per year, storage should not be a problem even if the block headers must be kept in memory."* **⚠️ The 4.2MB/yr figure is about block HEADERS kept in MEMORY (SPV), not full-chain replication on disk.** Satoshi's "storage should not be a problem" dismisses the header/SPV load; the full-chain storage this paper measures was *not* the object of his estimate. The honest use of this quote: Satoshi's design intent scoped the node's persistent-storage burden via pruning/SPV (quantity control), never priced it. |
| 3 | Email #2 (Nov 3, 2008): modeled in dollars AND bytes | ⚠️ **VERIFIED but MISATTRIBUTED** | Exact text: *"A typical transaction would be about 400 bytes... lets say 1KB per transaction... 100 million transactions per day. That many transactions would take 100GB of bandwidth, or the size of 12 DVD or 2 HD quality movies, or about $18 worth of bandwidth at current prices."* **The dollars-and-bytes modeling is BANDWIDTH, not storage.** The architect's "storage externality twice (dollars AND bytes)" is wrong as stated — it is a bandwidth externality estimate. It still supports the general pattern (Satoshi estimated a long-lived resource cost in both units and dismissed it: *"sending 2 HD movies over the Internet would probably not seem like a big deal"*), but it must be labeled bandwidth, not storage. |
| 4 | Emails #7 and #11 | ❌ **MISATTRIBUTED** | Email #7 (Nov 9) explains the proof-of-work chain as the synchronization solution (reply to James A. Donald); email #11 (Nov 13) is the Byzantine Generals analogy. **Neither contains any storage or fee-market claim.** The architect's citation of #7/#11 for the storage-externality pattern is wrong. |
| 5 | Email #13 (Nov 15, 2008): fees → nodes include all transactions | ✅ **VERIFIED verbatim** | Exact text: *"There will be transaction fees, so nodes will have an incentive to receive and include all the transactions they can."* This is the fees-as-inclusion-incentive claim — the strongest email support, from email #13 (not #7/#11). |
| 6 | Post 188 (Jul 14, 2010): "never more than 100K nodes" + node equilibrium | ✅ **VERIFIED verbatim** | Exact text: *"I anticipate there will never be more than 100K nodes, probably less. It will reach an equilibrium where it's not worth it for more nodes to join in."* (Also: *"At equilibrium size, many nodes will be server farms with one or two network nodes that feed the rest of the farm over a LAN."*) |
| 7 | Post 287 (Jul 29, 2010): "more burden → fewer nodes" | ✅ **VERIFIED verbatim** | Exact text: *"The more burden it is to run a node, the fewer nodes there will be. Those few nodes will be big server farms."* |
| 8 | Post 441 (Sep 8, 2010): block-size threshold as "circuit breaker" protecting disk space | ✅ **VERIFIED verbatim** | Exact text: *"The threshold can easily be changed in the future... It's a good idea to keep it lower as a circuit breaker and increase it as needed... Keeping the threshold lower would help limit the amount of wasted disk space in that event."* **This is the quantity-control-not-price evidence: to protect disk, Satoshi lowered the block-size threshold — a quantity control — and explicitly tied it to "wasted disk space."** |
| 9 | Post 485 (Oct 4, 2010): phased block-size cap increase | ✅ **VERIFIED verbatim** | Exact text: *"It can be phased in, like: if (blocknumber > 115000) maxblocksize = largerlimit."* The 1MB-era cap is a changeable quantity control, not a price. |
| 10 | "Proof of work is the one invention that makes Bitcoin possible" | ❌ **APOCRYPHAL — NOT FOUND** | Searched: full whitepaper, all 15 cryptography-list emails, posts 188/287/441/485, P2P Foundation posts. **This quote appears nowhere in the SNI archive.** It circulates in secondary quote-collections with no primary source. **Do NOT use it.** |

**Bottom line:** the architect's *pattern* is real — (i) fees were defined purely as
an inclusion incentive (✅ §6, email #13), (ii) storage was designed *around* via
pruning/SPV and dismissed (✅ §7), (iii) when storage protection was needed Satoshi
reached for quantity control, not price (✅ posts 441/485), and (iv) he predicted a
node-count equilibrium (✅ posts 188/287). But two of the architect's specific
attributions are wrong and must not enter the paper as stated: the dollars-and-bytes
modeling in email #2 is **bandwidth**, not storage; emails #7/#11 contain **no**
storage claims; and §7's "storage should not be a problem" is about **headers in RAM**, not full-chain disk storage.

## 3. The causal chain, stated honestly

**2008 design:** fee defined as block-production incentive (§6, email #13); full-chain
storage designed around via SPV/pruning, header load dismissed (§7); a separate
bandwidth cost estimated in dollars and dismissed (email #2). Storage was never a
priced attribute of the fee.

**2010 hardening:** when disk-space protection was needed, Satoshi used quantity
control — a lower block-size threshold as a "circuit breaker" against "wasted disk
space" (post 441), later a phased-in cap (post 485).

**2017 SegWit:** BIP 141's 4:1 witness weight discount changed the *price* of
witness-resident data relative to non-witness data (working-paper §3) — a deliberate
protocol price change, made for malleability, with a storage-relevant side effect.

**2023 Ordinals:** inscriptions exploited the 4:1 discount to put data on-chain at a
subsidized marginal price (working-paper §5.2). The externality becomes measurable in
the fee market.

**Measured result:** SCCR ≈ 0.22–0.29 at the pre-re-base N=32K (≈0.27–0.35 re-based to the measured N=26,586); ~98.6–100% of blocks below 1×
(working-paper §5).

The chain supports the paper's framing: the fee market was never designed to price
storage, so finding that it does not is a measurement of the design's actual behavior,
not a claim of market failure. This is the honest, source-supported version of the
architect's argument.

## 4. The falsifiable-claims table (Satoshi's claims → our data)

The strongest use of the primary sources: Satoshi made **testable claims** about node
count, storage burden, and equilibrium. Each becomes a falsifiable specimen against
this paper's measurements.

| Satoshi's claim (source) | What it predicts | Our data (working-paper) | Status |
|---|---|---|---|
| "I anticipate there will never be more than 100K nodes, probably less" (post 188, 2010) | N < 100K, probably less | Addrman sample ≥ 32,000 gossiped *addresses* (a lower bound on addresses, **not** a node count; the measured reachable node count is 26,586); independent estimates 10K–100K | ✅ **CONSISTENT** — the paper's N-band (10K–100K) brackets his ceiling; his claim is not falsified by the measurement, and his upper bound sits at the top of our uncertainty band |
| "It will reach an equilibrium where it's not worth it for more nodes to join in" (post 188) | Node count self-limits via cost/benefit; N stabilizes | Roadmap Q1: the only endogenous negative feedback in the model is the N-margin loop; the model cannot yet close the loop | 🟡 **OPEN / NOT YET TESTED** — this is roadmap Q1 (equilibrium force); a measured N-response function would test it directly (roadmap §8 Q1) |
| "The more burden it is to run a node, the fewer nodes there will be" (post 287) | ∂N/∂burden < 0 | C = $925/yr bundled node cost; SCCR ∝ 1/N | 🟡 **TESTABLE** — burden↔N elasticity is a roadmap Phase IV dynamic question |
| "storage should not be a problem" (whitepaper §7, 2008) | Storage is negligible for node operation | SCCR ≈ 0.27–0.35 at the measured N=26,586; per-node lifetime storage liability ~$0.18/block; $925/yr node cost | ⚠️ **SCOPE-CAUTION** — his claim covers headers in RAM (SPV), NOT full-chain disk storage; against the full-chain storage this paper measures, the burden is real but small per node ($925/yr bundled, storage component ~$167/yr). The claim is not directly falsified because it was about a different object |
| "nodes will have an incentive to receive and include all the transactions they can" (email #13, 2008) | Fee incentive is sufficient to induce inclusion | Fee market clears blocks at ~2 sat/vB (live baseline); inclusion incentive works — the mechanism functions | ✅ **CONSISTENT** — the fee market does clear inclusion; it is the *storage* leg that is unpriced, which is exactly the paper's claim |
| "The threshold can easily be changed... keep it lower as a circuit breaker... limit the amount of wasted disk space" (post 441, 2010) | Storage protection via quantity control, not price | The 1MB cap persisted into the Ordinals era; SegWit's 4:1 discount changed effective capacity | ✅ **CONSISTENT** — quantity control, not price, was the design's storage-protection mechanism |

**Assessment:** the falsifiable-claims table is genuinely strong and belongs in the
framework paper (Paper 4) — it converts the "Satoshi predicted it" anecdote into
testable hypotheses. The two live specimens (N-equilibrium → roadmap Q1; node
count → census) are already the roadmap's open questions, now anchored in the
designer's own predictions.

## 5. The two insights, placed

1. **"Satoshi predicted the self-correction mechanism"** (post 188: *"It will reach
   an equilibrium where it's not worth it for more nodes to join in"*) — this is
   roadmap Q1 in the designer's own words. The roadmap's N-margin feedback loop
   (under-pricing → exit → N↓ → SCCR↑) is Satoshi's predicted equilibrium. Cross-ref:
   **roadmap.md §8 Q1** (and working-paper §7.1 falsifier 6, which requires measured
   response functions to close the loop).
2. **"Topology-deviation artifact"** — the sub-1× SCCR partly measures deviation from
   design intent: Satoshi designed for a topology of few server-farm full nodes +
   many SPV clients (posts 188/287), and the paper's measurement finds ≥26,586
   reachable nodes — a *more distributed* topology than the design assumed. Because SCCR ∝ 1/N,
   a more distributed topology *lowers* the measured coverage ratio for the same fee
   revenue: the ratio's sub-1× reading is partially an artifact of the network being
   more decentralized than Satoshi's "few server farms" intent. This is a real
   framing insight for §7.1 falsifier 5 (pruning/avoidable-cost reframe) and for
   roadmap Q6 (node-count sensitivity: N ×4 → SCCR 0.223 → 0.056).

## 6. Sources (canonical, fetched 2026-08-03)

- Whitepaper: https://nakamotoinstitute.org/bitcoin/ (and https://bitcoin.org/bitcoin.pdf)
- Emails (cryptography list, Oct–Nov 2008): https://satoshi.nakamotoinstitute.org/emails/cryptography/ (#1–#15)
- BitcoinTalk posts: https://satoshi.nakamotoinstitute.org/posts/ (post 188: Jul 14, 2010; post 287: Jul 29, 2010; post 441: Sep 8, 2010; post 485: Oct 4, 2010)
- P2P Foundation posts: https://satoshi.nakamotoinstitute.org/posts/p2pfoundation/

---

*Companion (2026-08-03): `research/whitepaper-patterns.md` — the 44-pattern “engineered asymmetry” lens with six additional verified whitepaper/forum quotes (§2/§9/§10/§11/§12 last line, BitDNS thread 532/535/537/539), including the 21M/1MB/halving-not-in-whitepaper correction and the anti-master-chain principle.*

*Verification note by Prateek, with verification by TELOS, 2026-08-03. Prepared for the Bitcoin Sahi Research
Council; feeds working-paper §8.3 (designer-intent paragraph), roadmap Q1/Q6, and
framework-paper-outline (Paper 4 falsifiable-claims table).*
