# Measuring the verification population

<!-- seo-title: Measuring the Bitcoin Verification Population — Three Views -->

**BSAHI — how we measure a population that cannot be counted.**
*Produced: 2026-09-17 · Instruments: `verification_population.py`, `seed_census.py`, `addrman_churn.py`, `inbound_census.py`*

## The reframe

Not *"how many Bitcoin nodes are there?"* — the total population is **not observable** — but:

> **"How large is the independently reachable verification population, what is its composition, and what can we say about the part we cannot see?"**

Four quantities are reported separately and **never conflated**:

| # | quantity | what it is | layer | grade |
|---|---|---|---|---|
| A | **gossip-observed addresses** | addresses peers have gossiped (addrman) — not nodes | observed | C |
| B | **reachable nodes** | nodes that accept a connection from a crawler | observed | B |
| C | **non-listening / private nodes** | never appear in a crawl; evidence only via inbound peers | unobservable | D |
| D | **total population** | not observable by any method | — | — |

## Three independent views (triangulation)

We now measure the same neighbourhood three different ways, from three different mechanisms. Their disagreement is the uncertainty, and it is published rather than hidden.

| view | mechanism | size | what it sees | grade |
|---|---|---|---|---|
| **Crawler** | connect to reachable nodes | **26,586** nodes | nodes that accept inbound | B |
| **DNS seeds** | resolve the bootstrap seeds | **264** addresses (8 seeds) | addresses the seeds recently served | B |
| **Our node's addrman** | `getnodeaddresses 0` | **34,599** addresses | gossip our peers sent us | C |

**What agrees:** the crawler and the subtree it can reach are stable and internally coherent; the seed and addrman views overlap the crawler's address space.

**What disagrees, and why it matters:** the three counts differ by an order of magnitude because they measure **different objects** — connectable *nodes* ({reach:,}) versus *addresses* ({seedunion:,}, {addr:,}) — and addresses accumulate stale, rotating and ephemeral entries. Reporting any one of them as "the number of Bitcoin nodes" is the error this page exists to prevent.

> **The address-manager number is a lower bound on gossip-observed addresses, not a node count.** First measurement with an *exact* request (`getnodeaddresses 0`) returned **34,599** addresses — more than the 32,000 that an earlier request ceiling reported, which is exactly why the ceiling figure was retired.

## The observable part, partitioned

Partitioning the **26,577 reachable nodes** by signals a crawl can see:

| tier | nodes | share | grade | role |
|---|---:|---:|---|---|
| **T1 serving + synced** | 23,949 | 90.1% | B | full/pruned validating validator, actively serving |
| **T2 serving + lagging** | 2,081 | 7.8% | B | intermittent / catching-up validator |
| **T3 no service announced** | 547 | 2.1% | B | reachable but announces no serving capability — consumer, not infrastructure |
| **T4 height unreported** | 0 | 0.0% | C | unclassifiable from this capture |

**Network:** clearnet 9,601 (36%) · Tor 12,745 (48%) · I2P 4,231 (16%). Tor and I2P are reachable to a crawler that speaks those transports, which is why IP geography is unresolved for ~64% of the set.

## The unobservable part — and the direction of the error

Non-listening, private and Tor-hidden validators cannot be audited. They are **excluded from the index** and reported as an explicit sensitivity band, because excluding them does not remove their cost:

| N | L_net (USD/block) | SCCR | externality vs baseline |
|---:|---:|---:|---:|
| **26,586** (measured floor) | $4,676 | **0.3624** | 1.00× |
| 50,000 | $8,793 | 0.1927 | 1.88× |
| 80,000 | $14,070 | 0.1204 | 3.01× |
| 100,000 | $17,587 | 0.0963 | 3.76× |
| 150,000 | $26,380 | 0.0642 | 5.64× |
| 200,000 | $35,174 | 0.0482 | 7.52× |
| 265,860 (Erlay 9:1) | $46,756 | 0.0362 | 10.00× |

**Literature bracket.** Erlay: Efficient Transaction Relay for Bitcoin (CCS'19 / arXiv:1905.10518) reports **private:public ≈ 9:1** for the network at the time. Applied to the measured public set (26,586) that implies a total of ~265,860. This is a **Grade D topology prior, not a measurement** — it brackets the externality and is never a revised N.

**Direction:** excluding hidden nodes makes `L_net` a **lower bound** and the SCCR an **upper bound**. The baseline is **conservative**.

## First-party measurement of the hidden set

Two instruments aim at quantity C, which no crawler can see:

- **Inbound census** (`inbound_census.py`) — a listening node counts the peers that **dial in**. Every inbound peer is, by that act, a node not serving inbound itself: first-party evidence of a non-listening node. Current: **0** inbound, **0** distinct ever. This needs reachability (port-forward or Tor) to yield data; it is the highest-value measurement available to this project.
- **Addrman churn** (`addrman_churn.py`) — sampling the address manager over time measures **address persistence** (2 samples so far (persistence rate 100.0%)), turning "zombie IPs" from an assertion into a measured rotation rate.

## What would strengthen this

1. **Reachability for the node** (port-forward or Tor) → the inbound census produces a genuine lower bound on non-listening nodes.
2. **Time** — churn and seed views need repeated samples; the "missing" numbers accrue automatically.
3. **A healthy node** — it is currently reindexing after a disk-full chainstate corruption.

## Grades

| leg | layer | grade |
|---|---|---|
| reachable nodes (crawler) | observed | B |
| gossip-observed addresses (addrman) | observed | C |
| seed-visible addresses | observed | B |
| activity partition of the reachable set | observed | B (T4 C) |
| non-listening / total population | unobservable | D / — |
| inbound census | observed | B (once reachable) |

## Why this is the honest method

A census of Bitcoin's node population does not exist. What exists is a set of partial views with different biases. BSAHI publishes the views, the mechanisms behind them, the direction of their error, and the gap — instead of collapsing them into one confident number.

Data: [`verification_population.json`](/data/verification_population.json) · [`seed_census.json`](/data/seed_census.json) · [`addrman_churn.json`](/data/addrman_churn.json) · [`inbound_census.json`](/data/inbound_census.json) · [Methodology](/research/methodology) · [Evidence Matrix](/research/evidence-matrix)
