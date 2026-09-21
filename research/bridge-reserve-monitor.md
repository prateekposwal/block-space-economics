# Catching a Bridge Hack That Never Touched Bitcoin

**BSAHI — method note**
*Produced: 2026-09-21*

## The wrong monitor, and the right one

A bitcoin-only custody monitor — watch addresses, alert on big outflows — catches
one family of bridge failure and misses the other. The September 2026 incidents
split exactly along that line:

- **Liquid Network** (~4,000 of 4,200 BTC, Sep 6): real BTC left the federation
  wallet. A Bitcoin monitor sees this.
- **Symbiosis** (46.1 billion syBTC from 330 satoshis, Sep 11): **no bitcoin ever
  moved.** A Bitcoin monitor is blind.

So I was wrong to say the base layer can't help here. It can — if you read it
*alongside* the other ledger.

## A bridge is two ledgers pretending to be one asset

```
Bitcoin chain:   BTC locked in custody        <- the RESERVE  (the say)
host chain(s):   tokens minted against it      <- the CLAIM
```

Bitcoin can only ever show you the reserve. **The exploit lives in the claim.**
The detector is not a better Bitcoin monitor; it is the ratio between the two:

```
backing_ratio = BTC_reserves / token_supply
```

Both failure families drive that ratio below 1 — from opposite sides:

| Mechanism | Reserves | Supply | Real case |
|---|---|---|---|
| **custody drain** | ↓ | flat | Liquid, 4,000 BTC out |
| **unbacked mint** | flat | ↑↑↑ | Symbiosis, Nomic |

And reading the claim side is cheap. One `eth_call` to `totalSupply()`, through
public RPCs, cross-checked across providers so a single stale or lying node
cannot move the number — the same discipline as our price index.

## It works

Run against the two incidents' reported figures (`layer: replay` — these exercise
the detector, they are not measurements):

| Incident | Mechanism | Ratio before → after | Detected |
|---|---|---|---|
| Symbiosis | unbacked mint | 1.078 → **3.25 × 10⁻¹⁰** | **yes** |
| Liquid | custody drain | 1.000 → **0.0476** | **yes** |

Symbiosis is caught **without knowing anything about the reserves at all** — a
supply that jumps by a factor of 3.3 billion detaches from any reserve. That is
the answer to "how do you catch an off-chain mint": not on Bitcoin, on the
*supply*, and you only get the supply by reading the other chain.

## Everything you need to know is public

Wrappers publish their custody addresses because custody is a *disclosure*, not a
chain-derivable fact. WBTC publishes a proof-of-reserves page with its custodian
Bitcoin addresses; each one is independently checkable. The monitor reads them,
measures the balances itself, and refuses to trust the transcription.

## The finding: the reserve page doesn't enumerate the reserve

Measured live against WBTC's own published addresses:

```
token supply (Ethereum, 5 RPCs agreeing)   116,132.18273272 WBTC
reserves measured on Bitcoin (20 addresses) 43,233.5005 BTC
custodian's claimed reserve total          116,511.9929 BTC
custody coverage                           37.1%
status                                     INCOMPLETE_CUSTODY_LIST
```

The page's address table lists 20 addresses holding **43,234 BTC** while stating
total reserves of **116,512 BTC**. Our measurement of those 20 addresses matches
the page's own per-address figures exactly, so the measurement is not the
problem — **63% of the claimed reserve is simply not enumerated on the page.**

The monitor reports `INCOMPLETE_CUSTODY_LIST` and issues **no solvency verdict**.

That refusal is the point. A partial reserve list manufactures exactly the
shortfall this tool exists to detect — naively, the ratio reads 0.37 and a
careless monitor would scream "WBTC is 63% undercollateralised," which is the
opposite of true and the kind of false alarm that destroys a monitor's
credibility. So the tool measures its own coverage against the issuer's claimed
total first, and stays silent when it is looking at a fragment.

## Two traps this hit, both worth keeping

1. **Transcription mangles addresses.** The address for `3EmKqHZ…` came out of a
   rendered page as `…Bdk91ermc4V7`; the real one is `…Bdk91erm4V7`. One bad
   character silently dropped **2,400 BTC** from the reserve and faked a
   shortfall. Every address is now checksum-validated before use, and unusable
   addresses are counted and reported, never ignored.
2. **A partial list fakes a hack.** Covered above — the completeness guard.

## The edge we have that a dashboard doesn't

This host runs a Bitcoin node with ZMQ queued after the reindex. That means
custody spends can be seen in the **mempool**, before confirmation — so a
Liquid-style drain is alertable *before* it finalises, which no
block-explorer-based dashboard can do. The supply leg is cheap to poll; the
reserve leg is where an independent node earns its place.

## What this is not

A solvency monitor, not an exploit detector. It observes the *consequence* of an
unbacked mint — supply detaching from reserves — not the contract bug. It cannot
see the mint itself, which happens on another chain, and it inherits the issuer's
custody disclosure as a trust input.

## The data

- `tools/research/bridge_reserves.py` — the monitor (reserves via Esplora,
  supply via multi-RPC `eth_call`, address checksum validation, completeness guard).
- `data/bridge_reserves.json` — measured wrapper state, per-address custody
  detail, coverage, and the incident replays.
