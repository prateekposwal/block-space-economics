# External Reproducer — Personalized Recruit Messages

**Purpose:** short, easy-to-say-yes-to variants of `recruit-message.md` tailored to
three candidate types from `external-reproducer-contacts.md`. Core framing (per the
advisor): *I'm not looking for agreement with the conclusions — I'm looking for
confirmation that the repository reproduces the published results from a clean
environment, and for any assumptions or implementation issues you think I've missed.*

Each variant is 4–6 sentences, ~15-minute ask, self-contained, and points to the
published protocol (`research/reproduce/README.md` → "External reproduction protocol
(3 steps)"). Repo: `https://github.com/prateekposwal/block-space-economics`
Expected result: avg **0.2406**, min **0.0490**, max **1.0757**, 153/155 below 1× (2026-09-16 frozen snapshot).

---

## Variant A — data engineer (for 0xB10C → `blog@b10c.me`)

> **Subject: Can you check a number for me? (~15 min, right in your lane)**
>
> Hi b10c,
>
> I'm submitting a paper on Bitcoin fee economics and need an independent check
> that the reproduction kit works from a clean clone. Given your work on
> transactionfee.info and mempool.observer, you're the person most likely to spot
> a data or pipeline problem in seconds. I'm not looking for agreement with the
> conclusions — I'm looking for confirmation that the repository reproduces the
> published results from a clean environment, and for any assumptions or
> implementation issues you think I've missed. The whole task is: clone
> `github.com/prateekposwal/block-space-economics`, follow
> `research/reproduce/README.md` (3 steps, ~15 min), and compare your average
> against the published 0.2406. One line back with your number — and anything that
> looked off — is all I need.
>
> Thanks, Prateek

## Variant B — academic (for Daniel Aronoff → `daronoff@mit.edu`)

> **Subject: Independent check of a Bitcoin fee/storage measurement (15 min)**
>
> Hi Dr. Aronoff,
>
> I'm measuring whether Bitcoin's average transaction fees cover the network's
> modeled storage cost (headline ratio 0.2406, dated 2026-09-16 snapshot), and your arXiv:2604.17183 model of
> the Bitcoin transaction fee is a direct reference in the paper. Before
> submission I'm asking a few uninvolved researchers to check that the reproduction
> kit, cloned from a clean environment, actually produces the published numbers.
> I'm not looking for agreement with the conclusions — I'm looking for confirmation
> that the repository reproduces the published results from a clean environment,
> and for any assumptions or implementation issues you think I've missed. Everything
> needed is at `github.com/prateekposwal/block-space-economics` →
> `research/reproduce/README.md` (3 steps, ~15 min, no node required). A one-line
> reply with the number you got — and anything that looked wrong — would help me
> submit with confidence.
>
> Thank you, Prateek

## Variant C — Bitcoin Core contributor (for Gloria Zhao → GitHub/X, no public email)

> **Subject: 15-min reproducibility check of a Bitcoin fee measurement**
>
> Hi Gloria,
>
> I'm submitting research on whether Bitcoin's average fees cover the network's
> modeled storage cost (headline ratio 0.2406, dated 2026-09-16 snapshot), and before submission I want an
> uninvolved technical person to confirm the kit works from a clean clone. Your
> mempool and fee-estimation work makes you exactly the reviewer I'd trust to catch
> a subtle formula or data issue. I'm not looking for agreement with the
> conclusions — I'm looking for confirmation that the repository reproduces the
> published results from a clean environment, and for any assumptions or
> implementation issues you think I've missed. It's ~15 minutes: clone
> `github.com/prateekposwal/block-space-economics` and follow
> `research/reproduce/README.md` (3 steps). A quick no is completely fine; otherwise
> one reply with your avg/min/max would be a huge help.
>
> Thanks, Prateek

---

## Send notes

- **De-obfuscate addresses** where the source obfuscated them (`blog[at]b10c.me` → `blog@b10c.me`).
- **Attach/link** the kit link + expected outputs (avg 0.2406, min 0.0490, max 1.0757) in every message.
- **Do not** claim the numbers are "verified" — they are the published reference; the
  point is the external run.
- If the recipient replies with their numbers, record the row in
  `external-reproduction.md` (date, reproducer (anonymous ok), environment, their
  numbers, per-block max dev, verdict) and apply the milestone rule below.

## Milestone rule (go/submit trigger)

> **Reproducibility milestone achieved** — when any external participant replies with
> the equivalent of *"I cloned it, ran one command, and got 0.2406"* — i.e., an
> uninvolved human independently confirms the published numbers from a clean clone
> following the published protocol:
> **→ milestone achieved → stop polishing → submit.**
> Until that reply lands, the submission gate stays closed.

**Phrasing rule:** say *"Independently reproduced by external participants following
the published reproduction protocol"* — **NOT** "externally verified."

---

*Bitcoin Sahi Research — personalized external-reproducer recruit messages, 2026-08-03.*
