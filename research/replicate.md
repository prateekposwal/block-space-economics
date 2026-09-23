<!-- seo-title: Replicate This Research — Invitation and Instructions -->

# Replicate this research

**An open invitation to falsify, not to agree.**

This project measures Bitcoin's long-lived resource costs and how much of them the
fee market internalizes. Its value depends entirely on whether someone *else* can
reproduce the numbers. So: please try to break them.

## What to replicate

| Target | Reproduce in | Artifact |
|---|---|---|
| **SCCR** (the headline metric) | ~15 minutes | `research/reproduce/` — JS, Python, C + notebook |
| **UTXO / chain state** | minutes, on any synced node | `gettxoutsetinfo` via `tools/research/utxo_state_measure.py` |
| **Production-cost scenarios** | minutes | `tools/research/production_cost_ratio.py` |
| **Verification-burden trend** | minutes | `tools/research/verify_cost_index.py` |
| **SCCR sensitivity / CI** | seconds | `tools/research/sccr_sensitivity.py` |
| **Node population (N)** | minutes, with a synced node | `tools/research/verification_population.py`, `seed_census.py`, `addrman_churn.py` |

## Quickstart: reproduce the SCCR

```bash
git clone https://github.com/prateekposwal/block-space-economics
cd block-space-economics/research/reproduce
python3 reproduce_sccr.py --input input/fee_history_capture.json
bash cross_check.sh          # JS = Python = C? prints the verdict
```

Expected: **avg SCCR 0.289645** (min 0.059036, max 1.294753, 152/155 below 1×), with the
three implementations agreeing to < 1e-6. If you do **not** get that, we want to
know — that is the useful result.

> The frozen-capture average is `0.240641 × (32000 / 26586)` — the whole series
> rescales by the N re-base of 2026-09-17 (see the [Changelog](/research/changelog)).
> The kit reads `N` from `research/model-spec.json`, so a clone reproduces the
> current value with no edits.

## Reproduce the node population (N)

The canonical `N` is a **measured reachable-node count**, not a census — see
[the population note](/research/population-measurement) and
[verification-population](/research/verification-population). Reproduce it:

- **Reachable count (this is `N`):** the btcnodes reachable-node crawl is the
  source of record; `data/node_census_series.json` carries the snapshots and
  `research/model-spec.json → quantities.N` the canonical value and date.
- **First-party instruments (independent views, each with its own caveat):**
  `verification_population.py` (the observed/unobservable split),
  `seed_census.py` (DNS-seed visible addresses), `addrman_churn.py` (address-pool
  persistence), `inbound_census.py` (an upper bound on *private* participation —
  requires the node to serve inbound connections).
- **What to check:** that every instrument reports a **lower bound** and states
  what it does *not* measure. Addresses ≠ nodes; a reachable crawl is silent about
  non-listening/private nodes. If a published number implies we enumerated the
  population, that is a defect — report it.

The dated, hashed state of this thread is pinned in
`data/population_snapshot.json` (rebuilt by
`tools/research/population_snapshot.py`).

## What would falsify the claims

- An SCCR materially different from the published value on the same frozen input.
- A node-count **N** outside ~10K–100K (which would move the level; the *direction*
  survives, since SCCR is inverse-linear in N).
- A measured UTXO/state size that contradicts the observed row or the
  reconstructed table by more than the stated grade allows.
- A fee-market episode in which fees cover storage at a materially higher rate
  than the published series, sustained.

## How to send a result

Open an issue at
`github.com/prateekposwal/block-space-economics` with: the artifact you ran, your
inputs, your output, and your environment. Corrections are published in the
[Research Changelog](/research/changelog) with their cause — the project's own
10× correction is precedent that this is the intended path, not an embarrassment.

## Environmental baseline (what this node ran under)

The **inbound census (D5)** depends on the node being reachable so peers can dial
it back. On the machine that produced this pre-print, that is **impossible**, and
the reason is documented here so a future reproduction audit can compare like with
like rather than treating it as a defect.

Both networks available to the host are **carrier-grade NAT (CGNAT)**:

```
# JioFiber home broadband — four stacked private hops beyond the gateway
1  192.168.29.1          (the local router)
2  10.37.32.1
3  172.16.3.136
4  192.168.161.80
5  192.168.232.132
6  192.168.232.163
# the "public" 49.43.160.42 is the shared CGNAT egress, not a forwardable address
```

```
# mobile hotspot — symmetric NAT with multiple carrier egress IPs (STUN)
local 0.0.0.0:58517 -> stun.l.google.com   : 106.67.179.93:50402
                    -> stun.cloudflare.com : 106.67.185.45:50311
```

Every alternative reachability path was tested and closed: IPv4 port-forward (no
forwardable address exists), UPnP / NAT-PMP (router advertises neither), IPv6
inbound (blocked — three independent external probers time out), STUN/ UDP
hole-punching (symmetric NAT), free no-card sandboxes (none offers public raw TCP),
Play-with-Docker (shut down, HTTP-only), ngrok TCP (card required on free plans),
zrok (TCP sharing is private-only).

**The inbound census is therefore frozen at `0`** (`max_concurrent: 0`,
`distinct clearnet IPs: 0`) — the correct, unpoisoned value, not a measurement
failure. A bare listener on 8333 would receive only port scanners, and counting
those as validators would fabricate evidence, so it is explicitly not done.

**To reproduce with a distinct-node result** you need a host on a non-CGNAT
connection. Run `python3 tools/net/census.py` — it reports **DISTINCT** (reachable
inbound, real un-SNATed peer IPs), **CONCURRENCY** (Tor/loopback identity is hidden;
a lower bound only), or **CONTAINED** (no inbound path, with the measured reason).
Full write-up: `research/cgnat-containment-finding.md`.

## The standard

- Every number is classified **Observed / Reconstructed / Modelled** with a grade
  in the [Evidence Matrix](/research/evidence-matrix).
- Methods are in the [Methodology](/research/methodology) paper.
- The checks that guard the data run in
  `tools/research/integrity_audit.py` and gate every change.

If a published number cannot be reproduced from the repository, that is a defect
in the repository, and we will treat it as one.
