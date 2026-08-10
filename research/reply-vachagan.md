# Reply to Vachagan — FINAL (ready to post, with direct link)

**Status:** FINAL (2026-08-10) — Prateek approved adding the direct link.
**Where to post:** the same thread the comment appeared on (public reply), once.
**Byline:** Prateek Poswal, Independent Researcher.

---

> Vachagan — thanks for the honest read. Let me separate what you're right about
> from where the record needs correcting, because one of your points is the
> strongest thing anyone has said about this work, and it isn't the point you
> think it is.
>
> **You're right about the attack.** The "nation state floods the chain / fills
> the UTXO set" scenario is not hypothetical — it is the direct consequence of
> what we measure. Our Storage Cost Coverage Ratio says transaction fees cover
> roughly 20% of the modeled 10-year storage cost that confirmed data imposes
> on every full node. An unpriced externality is an attack surface: if node
> operators bear costs the payer never paid, then a well-funded actor can impose
> those costs deliberately. That's the vulnerability you're describing — and
> it's the paper's whole point, not its refutation. The fee market prices the
> next block; it does not price permanence. You've stated the consequence more
> bluntly than we did. You're not wrong.
>
> And since you asked, we priced the attack. Filling every block at the fee
> floor costs roughly **$65M/year** and imposes roughly **$197M** of 10-year
> storage cost on the network — a leverage ratio of about **3×**. Dust is the
> counterintuitive one: the per-node lifetime storage cost of a dust UTXO is
> slightly *less* than the fee that creates it (**0.9×**) — dust's real threat
> is the validation/RAM leg, not storage. And the attack is bounded: block
> weight caps chain growth at **~52.6 GB/yr**. Real, moderately leveraged,
> quantitatively bounded. Details: https://bitcoinsahi.com/research/cost-to-flood.html
>
> **Now the record, in good faith.** BIP-110 did not fail because five
> organizations defied users. Its deployment is a modified BIP-9 with three
> unusual parameters: a **55% signaling threshold** (instead of the usual 95%),
> a **mandatory-signaling window — blocks 961632–963647, currently in effect —
> that rejects non-signaling blocks outright, with lock-in no later than
> 963648**, and a one-year expiry. Miners signaling bit 4 is not a voluntary act
> of power; it is the deployment's user-enforcement clause taking effect. The
> "17k to 0" poll isn't something I can verify, and it isn't a governance
> mechanism either way — Bitcoin has no binding user vote, by design. UASF
> itself (BIP 148, 2017) is real and it worked: SegWit activated August 2017
> precisely because non-signaling blocks faced rejection and miners pre-emptively
> complied. "URSF" as a standing mechanism doesn't exist in the BIPs, the mailing
> list, or anywhere I can find.
>
> **The real question your comment exposes** is not "is Bitcoin dead" and not
> "who's good and who's bad." It's a governance-boundary question: **who can
> change Bitcoin's valid-state transition rules, under what coordination
> threshold, and what happens when those constituencies disagree?** BIP-110 is
> a live, parameterized experiment in exactly that boundary. We're measuring
> it live — the window is open now (in-window, lock-in ~Aug 23), and the
> signaling data is being captured hourly:
> https://bitcoinsahi.com/research/governance-boundary.html
>
> We don't take the Core side or the BIP-110 side — we take the measurement
> side. The paper's number (fees cover ~20% of modeled storage cost) is evidence
> both sides need, because BIP-110's own rationale is the same externality we
> measure: "the burden of storing the data falls on all node operators, who
> never received even a part of the fee."
>
> **If you want to check the headline number yourself** — I'd genuinely value it.
> The full paper and a 3-step reproduction protocol (data file + formula + expected
> result, ~15 min, no crypto knowledge needed) are here:
> https://bitcoinsahi.com/research/working-paper.html and
> https://github.com/prateekposwal/block-space-economics/tree/main/research/reproduce
>
> Bitcoin isn't dead. An unpriced externality is not a death certificate; it's a
> defect in the pricing of a resource, and defects in pricing are things you
> measure, then fix. If you have attack scenarios you'd want priced, I'd
> genuinely like to run them.

---

## Send notes
- **Post once, publicly, on the same thread.** Then let the work speak.
- **The link is in** (Prateek approved): cost-to-flood, governance-boundary,
  working-paper, and the reproduction kit — all direct, all live.
- **Bonus:** the reproduction-kit link doubles as the D5 recruit ask — if he runs
  it, that's the submission gate cleared by a technically-literate domain expert
  (even better than a random candidate).
- If the thread turns hostile/repetitive, stop replying.
