# Architect's Research Notes

Write your insights, findings, and directions here.
These are read by the Research Agents on every cycle and included in their reports.

## How to use

Add notes under any of the agent headings below.
The agents will read these and reference them in their next cycle.

## Bitcoin Core & Protocol

<!-- Add notes about protocol developments, BIPs, Core releases -->

- BIP-110 directly relates to our thesis — it restricts data at consensus level. Track its impact on storage externalities. If BIP-110 activates, measure whether data-bearing constructions decrease and whether fee-per-byte for remaining transactions changes.
- **UPDATE (2026-09-08):** BIP-110 did **NOT** activate — the lock-in window passed with `signalingSharePct = 0%` (`data/bip110.json`). No activation; no storage-externality behavior to track from it. Drop it from active-track.
## Lightning Network

<!-- Add notes about LN developments, channel trends, routing insights -->

## APIs & Data Sources

<!-- Add notes about new data sources, API changes, integration ideas -->

## Blockchain General

<!-- Add notes about market trends, ecosystem developments -->

## Academic Research

<!-- Add notes about papers, theories, research directions -->

- Key papers to track: 1) arXiv:2604.17183 — A Model and Estimation of the Bitcoin Transaction Fee 2) Ledger journal — Transaction Fees, Block Size Limit, and Auctions in Bitcoin 3) Management Science — StableFees: A Predictable Fee Market for Cryptocurrencies. Gap: No paper models storage externality priced by fees.
## General Directions

<!-- Add overarching research directions, questions to explore -->

- Core thesis: Bitcoin's fee market prices short-term block inclusion competition. It does NOT price lifetime storage costs across all full nodes. Storage Cost Coverage Ratio = TransactionFee / EstimatedLifetimeStorageCost. This is our novel research contribution — a reproducible model to measure the gap between one-time fees and cumulative network storage burden.
- **UPDATE (2026-09-08):** SCCR is **fee-market-driven and time-varying**, not a static point. Live daily series (`data/sccr_history.json`, `data/sccr.json`): **22 points, 2026-08-02 → 2026-09-07**; current **0.3999 @ N=32K** (142 blocks, **94.37% below 1×**); range **0.16 (Aug 16) – 0.45 (Aug 21) – 0.40 (Sep 07)**. Regime event: `reports/research/regime-event-2026-08-21.md`. Node census: **32K is the addrman-cap lower-bound census (2026-08-02)**; **60K is an assumption mid-band, not a census**. This is the empirical evidence for the unpriced externality thesis.