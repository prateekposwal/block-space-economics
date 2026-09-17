# BIP-141 Segregated Witness: Relevance to State Economics

<!-- seo-title: BIP-141 SegWit: Relevance to State Economics -->

## Source
https://github.com/bitcoin/bips/blob/master/bip-0141.mediawiki

## Key Design Decision

The witness discount (4 WU per non-witness byte, 1 WU per witness byte) was designed to:
1. **Fix transaction malleability** — separating signatures (witness) from tx data
2. **Enable protocol upgrades** — soft fork mechanism via witness structure
3. **Increase block capacity** — blocks could hold more transactions

The weight formula was NOT designed to:
- Price state growth differentially
- Create an economic disincentive for data-heavy transactions
- Replace the 1MB block size limit with a state-pricing mechanism

## Quote from BIP-141

> "The overall effect of the new rules is to allow the maximum block size to increase between 1MB and 4MB depending on how much of the block is comprised of witness data."

This confirms the intended purpose was capacity increase, not state pricing.

## The Unintended Consequence

Inscriptions use `OP_FALSE OP_IF <data> OP_ENDIF` to store arbitrary data in the witness. Because witness data gets the 4× weight discount, a 400-byte inscription:
- Weighs 400 WU (at 1 WU/byte for witness)
- Counts as 100 vbytes toward the 4M WU block limit
- Without SegWit, the same data would cost 1,600 WU (at 4 WU/byte)

This makes inscription data 75% cheaper than it would be without the SegWit discount — a pricing accident that nobody designed but everyone benefits from (or bears the cost of, depending on perspective). Note that the 4:1 discount applies to all witness data — SegWit financial transactions benefit identically; the accident is that it also subsidizes data-bearing constructions.

## Key References

- BIP-141: https://github.com/bitcoin/bips/blob/master/bip-0141.mediawiki
- BIP-119 (CTV): https://github.com/bitcoin/bips/blob/master/bip-0119.mediawiki
- BIP-347 (OP_CAT): https://github.com/bitcoin/bips/pull/1525
- Moser, Eyal, Gün Sirer (2017): "Enhancing Bitcoin Transactions with Covenants"
- Poelstra: "CAT and Schnorr Tricks" — https://blog.blockstream.com/cat-and-schnorr-tricks-i/
