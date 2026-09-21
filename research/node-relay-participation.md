# Public vs Private Nodes, and Their Participation in Blocks

**BSAHI — literature finding**
*Produced: 2026-09-21*

## The short answer

Two different ratios get conflated, and only one of them is published.

1. **Population ratio** (public vs private nodes) — well studied. Reachable
   (listening) nodes are roughly **one third** of the network; non-listening
   ("unreachable") nodes are the other **two thirds**, i.e. about **1 : 2**.
   Estimates across independent methods cluster between **1 : 1.6 and 1 : 2**,
   with outlier claims up to 1 : 10–30.

2. **Block-participation ratio** (what share of a block's relay is public vs
   private) — **not published by anyone in the form people expect.** There is no
   per-block "X% public, Y% private" figure in the literature. What exists is
   evidence that *both* classes relay, plus the structural reason the split is
   lopsided.

## Why "participation in blocks" needs splitting three ways

| Sense | Who does it | Is public/private the right axis? |
|---|---|---|
| **Producing** a block | miners / pools | **No.** A block is produced by a miner; whether that miner's node listens is incidental. Production is measured by pool share and region, not node class. |
| **Relaying** a block (inv → getdata → block) | every node | **Yes** — and both classes relay. |
| **Serving** a block to a new peer | listening nodes only | **No** — by definition only reachable nodes can be dialled. |

The third row is the asymmetry that shapes everything else: a non-listening node
can *pull* a block and pass it on to its own outbound peers, but nobody can dial
it. So it can never be the first hop for someone else.

## What the literature establishes

**Population ratio.**

| Source | Method | Finding |
|---|---|---|
| Bitnodes, Apr 2026 | crawler + `addr` gossip | ~70,000 total; ~23,000 reachable (**~1/3**) |
| Li et al., *BNS*, Mathematics 2023 | active crawl + decision-tree classifier | 45,000–50,000 total; reachable : unreachable ≈ **1 : 1.6** |
| Wang et al., PAL, 2021 | passive `addr` observation (5 yrs) | **~31,000** unreachable peers *with useful services* active per day, end-2020; validation suggests ~50% detection |
| Franzoni & Daza, IEEE Blockchain 2020 | survey | unreachable "more than 90% of the whole network"; some estimates 10–30× reachable |
| Kiffer et al., 2025 | cross-chain crawl | prior work: unreachable ≈ **2× reachable** |
| BTC Nodes crawl, Sep 2026 | own handshake crawl | 21,837 reachable by network type: **onion 51%, IPv4 21%, I2P 19%, IPv6 8%** |

The spread is real and comes from method: an active crawler sees only listening
nodes; a passive observer watching `addr` gossip sees a *timestamped address set*,
which is polluted by dead and flooded entries. Bitnodes' own caveat is that an
unreachable count "can only provide a rough estimation".

**Do private nodes relay blocks? Yes — explicitly.**

- PAL (2021): *"While unreachable peers do not accept incoming connections, they
  open several outgoing connections to other peers and **participate in the
  propagation of transactions and blocks just as reachable peers do**."*
- Wang & Pustogarov (2017), 2M+ connections measured: **75.4%** of propagations
  were relayed by a **mix** of unreachable, unavailable and reachable IPs; only
  **5.3%** were relayed by IPs of a single type. Private nodes are in the path.
- The same paper: a *small* number of peers carry 89% of transaction
  propagations — relay is concentrated irrespective of node class.

**Why the relay split is lopsided (structural, not empirical).**

- A reachable node can hold up to **125** connections; a non-listening node keeps
  only its outbound set — **8 full-relay + 2 block-relay-only** by Core default.
- Every node's outbound connections necessarily target *reachable* nodes.
  Therefore the listening set absorbs **all** outbound connection attempts from
  the entire network and sits in the hub position.
- Result: a **hub-and-spoke** topology. Reachable nodes form the backbone that
  relays blocks onward; non-listening nodes are leaves — they receive and pass on
  to their ~10 peers, but cannot fan out.

So "how much do private nodes participate in blocks?" has a structural answer
(they relay, as leaves) but no published numeric split.

## What this project adds

No one publishes the per-block public/private relay split, and BSAHI does not
either. What the Phase 5 instrument measures is the closest *first-party* proxy:

> Of blocks observed, what share had an inbound peer among the announcers — and
> among the earliest announcers?

Mechanics: `getpeerinfo` records, per block, which of our peers announced it,
their `network` and `connection_type`, and whether they were `inbound` (the peer
dialled *us*) or outbound, with second-granular timing. Aggregated into
`data/propagation_cdf.json` → `participation`, and surfaced on the dashboard.

**This is an upper bound, not the split.** `inbound` means the peer dialled *us*,
and a listening node can dial us too. So the inbound set is
`{private diallers} ∪ {public diallers}`, and the share it produces overstates
private participation. Separating the two needs a reachability test — dialling the
peer back to see if it accepts — which this instrument does not do.

Status: wired and unit-tested, **awaiting synced relay**. The node was reindexing,
and during reindex blocks come from disk, not from peers, so `blocks_observed` is
still `0` and no share is published. Nothing is fabricated to fill the gap.

## The axis that actually touches cost: archival, not relay

Relay ≠ storage. A node announcing a block proves it passed a message on; it
proves nothing about whether it keeps the chain. So relay participation cannot
move the storage-cost estimate — but **the archival rate can**, and that is a
different measurement entirely: the service bits.

`NODE_NETWORK` means the node serves the full chain; `NODE_NETWORK_LIMITED` means
it is pruned. Measured on the reachable crawl:

```
NODE_NETWORK          4,356
NODE_NETWORK_LIMITED  1,040      -> 80.7% full-chain, 19.3% pruned
```

That is the replication factor, and it is the number a "cost per node" model
divides by. Its blind spot is structural: it only covers the **visible third**.
The archival status of the non-listening majority is unknown to any crawler.

The one window into it is the nodes that dial *us*: they send their service bits
in the version handshake, and that set includes non-listening nodes. So
`inbound_census.py` now records `services` / `servicesnames` per inbound peer and
aggregates the archival share (`inbound_service_bits`). It samples the
replication factor of the population the reachable crawl cannot see — which is a
quantity that can change the model, unlike relay share.

Early and tiny by construction (bounded by our inbound slots and uptime): the
first peer with usable bits set **both** `NETWORK` and `NETWORK_LIMITED`, which is
contradictory (BIP-159 treats them as exclusive), so it is reported in its own
`both_bits_ambiguous` bucket rather than counted as archival.

## Caveats that must travel with any number here

- **One vantage point.** Our split describes *our* peer set, not the network.
- **`inbound` ≠ private.** An inbound peer is one that dialled us; it may itself
  be a listening node that chose us, a mobile wallet, or a known measurement
  crawler. `inbound_census.py` excludes known crawlers (e.g. `/dsn.tm.kit.edu/`)
  for exactly this reason.
- **Addresses ≠ nodes.** NAT and CGNAT put many nodes behind one IP; a distinct-IP
  count is a floor, never a census.
- **Unreachable estimates are rough.** Bitnodes says so itself; the `addr`-gossip
  method cannot distinguish a live non-listening node from a stale address.

## Sources

- Wang, L., Pustogarov, I. *Towards Better Understanding of Bitcoin Unreachable
  Peers.* arXiv:1709.06837 (2017).
- Mödinger, D. et al. *Unobtrusive monitoring: statistical dissemination latency
  estimation in Bitcoin's P2P network.* PLOS ONE (2020) — PAL method.
- Li, R. et al. *BNS: A Detection System to Find Nodes in the Bitcoin Network.*
  Mathematics 11(24):4885 (2023).
- Franzoni, F., Daza, V. *Improving Bitcoin Transaction Propagation by Leveraging
  Unreachable Nodes.* IEEE Blockchain (2020).
- Kiffer, L. et al. *Multiple Sides of 36 Coins: Measuring P2P Infrastructure.*
  ACM POMACS (2025).
- Bitnodes / BTC Nodes crawler (2026); Bitcoin Network Operations Collective,
  *Unreachable addresses in Bitcoin GETADDR responses* (2026).
