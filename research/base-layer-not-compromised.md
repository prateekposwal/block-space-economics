# Bitcoin Was Not Hacked — Here's What the Blocks Show

**BSAHI — base-layer audit**
*Produced: 2026-09-21*

## The short answer

When the September 2026 bridge incidents made headlines — *"a hacker turned 25
cents of bitcoin into 46 billion fake BTC"* — one fact went missing from almost
every write-up:

**Bitcoin was not hacked. Not once. In any of them.**

The exploit ran in a **smart contract on BNB Chain**. The token that was minted
(`syBTC`) was a number in that contract. It was not, and could not be, bitcoin.
Bitcoin's supply is fixed by consensus at 21 million; no bridge, however broken,
can mint a single satoshi that Bitcoin's nodes will accept.

## The incident, precisely

Symbiosis operates a cross-chain bridge that issues `syBTC`, a synthetic token
meant to track bitcoin 1:1 on other chains. On **2026-09-11 at ~04:28 UTC**, two
bugs chained:

1. **Privilege escalation.** The bridge "looked at the wrong part of a bitcoin
   transaction" to decide who sent the money, so the attacker was treated as
   both an approved depositor **and** the bridge administrator.
2. **No bounds check on the fee.** As admin, the attacker set the minimum fee
   **negative**. A second bug subtracted that negative fee from the deposit —
   which *added* to it. The deposit became worth whatever number he supplied.

```
330 sats (~$0.25)   →   12 bogus deposits in ~4 minutes
                    →   ~46.1 billion syBTC  (2^62 raw units)
                    =   >2,000× Bitcoin's entire 21M supply
realized cash-out   →   4.39 WBTC via Uniswap V4 on Ethereum → ~$336,000
```

The root cause is a **trust-boundary failure**: the contract accepted a *signed
message* as proof of deposit, without ever tying the mint to BTC actually locked.

## It was the same trick, four times in a month

| Incident | Chain where the bug lived | Reported loss |
|---|---|---|
| Allbridge | cross-chain message handler (CCTP) | ~$190k |
| Verus–Ethereum | cross-chain validation | ~$11M |
| **Liquid Network** | Liquid sidechain (Elements range-proof cache) | ~$320M (4,000 of 4,200 BTC) |
| Nomic (nBTC) | wrapper backing logic | unbacked, unnoticed for months |
| **Symbiosis** | BNB Chain (BridgeV2) | ~$336k realized |

Every one is the same failure: **software that claims to hold BTC printed more
claims than it held Bitcoin.** Not one was a Bitcoin consensus failure.

## What the blocks actually show

We audited the Bitcoin base layer in the window of each incident. Method: find
the Bitcoin block at the reported time, report the surrounding blocks, and derive
the BTC issued from the consensus subsidy schedule. Block hashes are the primary
source and re-checkable against any node.

| Incident | Anchor block | Block time (UTC) | BTC issued in window | Claimed notional | Ratio |
|---|---|---|---|---|---|
| Symbiosis | 966,454 | 2026-09-11T04:27:54Z | 40.625 | 46,100,000,000 syBTC | **1,134,769,231 : 1** |
| Liquid | 965,687 | 2026-09-05T23:48:43Z | 40.625 | (L-BTC; sidechain) | — |
| Allbridge | 963,111 | 2026-08-18T23:57:12Z | 40.625 | — | — |

Over a 13-block window (about two hours) the Bitcoin network issued **40.625 BTC**
— exactly `3.125 × 13`, the consensus subsidy and nothing more. The Symbiosis
incident alone claimed a notional supply **1.13 billion times** larger than the
BTC the base layer created in the same window.

That gap is the whole story. Bitcoin's issuance is consensus-enforced; a
contract balance is not.

## Two different "unbacked liability" problems

This is where the incident touches our research — as a mirror image, not an
overlap.

1. **On Bitcoin (what BSAHI measures).** The Storage Cost Coverage Ratio asks
   whether fees pay for the permanent state that Bitcoin nodes must actually
   carry. This is real, measurable, and lands on real machines.

2. **Off Bitcoin (what this incident was).** `syBTC` consumed **no** Bitcoin
   storage, no node bandwidth, no UTXO space. It cost Bitcoin nothing — and
   wrecked the credibility of anything calling itself "BTC". A liability nobody
   can measure because it lives on someone else's chain.

The 21M cap protects Bitcoin. It protects **nothing** that merely borrows the
ticker.

## The data is here

The audit is generated from a reproducible tool and published as data:

- `tools/research/base_layer_audit.py` — the audit, run against Esplora
  (`blockstream.info`, `mempool.space` fallback).
- `data/base_layer_audit.json` — every block in each window (height, hash,
  timestamp, tx count), the subsidy, the issued total, and the ratio.

## What BSAHI can and cannot do here

**Cannot.** We cannot detect these exploits. The mint happened on BNB Chain,
Ethereum and Rootstock; the Liquid mint happened inside the Elements sidechain.
None of it is in a Bitcoin block. Detection came from contract-level monitors
(Blockaid) and chain explorers. A Bitcoin node has no visibility there.

**Can.** We can state, with a verifiable timestamp and ledger, that the base
layer was untouched — and quantify the gap between a claimed token supply and
the BTC the network actually issued. That is the honest, reproducible
contribution: **the correction, not the alarm.**
