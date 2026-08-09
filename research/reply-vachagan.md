# Reply to Vachagan Balayan — Draft (BIP-110 / state-spam comment)

**Status:** DRAFT (2026-08-04) — verified against repo data + BIP records before posting.
**Context:** reply to a hostile-but-technical comment on the block-space research. One public
reply, substantive, in-domain, no link-drops. Refuse the emotional frame without being rude.

---

> Vachagan — thanks for the honest read. Let me separate what I think you're right about
> from where the record needs correcting, because one of your points is the strongest thing
> anyone has said about this work.
>
> **You're right about the attack.** The "nation state floods the chain / fills the UTXO set"
> scenario is not hypothetical — it is the direct consequence of what we measure. Our Storage
> Cost Coverage Ratio says transaction fees cover roughly 20% of the modeled 10-year storage
> cost that confirmed data imposes on full nodes. An unpriced externality is an attack
> surface: if node operators bear costs the payer never paid, then a well-funded actor can
> impose those costs deliberately. That is the vulnerability you're describing — and it's the
> paper's whole point, not its refutation. The fee market prices the next block; it does not
> price permanence. You've stated the consequence more bluntly than we did. You're not wrong.
>
> **Now the record, in good faith:**
>
> BIP-110 did not fail because five organizations defied users. Its deployment is a
> UASF-modified BIP-9: a 55% signaling threshold, plus a mandatory-signaling window — blocks
> 961632–963647 — that rejects non-signaling blocks outright, with lock-in no later than
> 963648. Starting yesterday, miners signaling bit 4 wasn't a voluntary act of power; it was
> the deployment's user-enforcement clause taking effect. The "17k to 0" poll you cite isn't
> something I can verify, and it isn't a governance mechanism either way — Bitcoin has no
> binding user vote, by design. UASF itself (BIP 148, 2017) is real and it worked: SegWit
> locked in August 9, 2017, precisely because non-signaling blocks faced rejection. "URSF" as
> a standing counterpart mechanism doesn't exist in the BIPs, the mailing list, or anywhere I
> can find — the concept of user resistance is discussed informally, but it isn't a mechanism.
>
> On "nodes run defaults": you're empirically right, and it's a real weakness in anything that
> leans on voluntary relay adoption — our own notes flag exactly that as the key risk of the
> relay-policy direction. But the paper doesn't claim nodes are active participants. It claims
> nodes bear costs. That is true whether they're active or asleep. The passive majority is
> precisely why the externality is unpriced.
>
> On concentration: mining is pool-concentrated — AntPool, F2Pool, Foundry, ViaBTC and a few
> others mine a large share of blocks. But the largest single bucket of blocks is unattributed,
> hundreds of pools exist, and pools are not owners — miners switch them in minutes. "All
> comply with governments" is a claim I can't verify, and the attack surface doesn't depend on
> who mines.
>
> **What I'd actually take from your comment:** the most valuable next measurement isn't the
> node side of the externality — it's the attacker side. What does it cost, in fees, to flood
> the chain with N garbage bytes, or to mint M dust UTXOs that every node carries forever?
> That "cost-to-impose" is the leverage ratio of the vulnerability you describe. If it's cheap,
> you're right that this is a live threat. If it's expensive, the threat is bounded. Either way
> it's measurable — and your comment is the best argument I've seen for doing it.
>
> Bitcoin isn't dead. An unpriced externality is not a death certificate; it's a defect in the
> pricing of a resource, and defects in pricing are things you measure, then fix. The original
> mission — money anyone can verify without permission — survives exactly as long as node
> operation stays cheap enough for ordinary people. That is the thing we're measuring. If you
> have attack scenarios you'd want priced, I'd genuinely like to run them.

---

## Send notes
- **Post once, publicly, on the same thread.** Then let the work speak — don't engage bait.
- **No link-drops** — the reply is self-contained. (If a link is wanted, the paper URL can be
  added after the reply is accepted; do not front-load it.)
- **Attribution:** keep the byline simple — *Prateek Poswal, Independent Researcher*.
- **If asked a follow-up technical question:** answer it in-domain. If the thread turns
  hostile/repetitive, stop replying.

## DONE vs LEFT
- **DONE:** reply drafted, fact-checked against BIP-110/BIP-148 records + repo data.
- **LEFT:** Prateek reviews + posts; then the "Cost to Flood" plan (see companion doc) becomes
  the active research thread.
