# BSAHI Future Research Backlog

**Master spec ambitious concepts — IDEA-level, not yet researched, NOT for implementation.**
*These concepts are future research vision/backlog. The deliverable is evidence + go/no-go for Step 2, NOT new dashboard or code.*

*Created: 2026-09-09 | Status: IDEA for all entries unless otherwise noted*

---

## STATUS KEY

- **IDEA** — Concept identified, no research done
- **RESEARCH QUESTION** — Formalized question, no data
- **DATA REQUIRED** — Data needed to answer
- **TEST** — Hypothesis to test
- **VALIDATED** — Evidence supports the claim
- **PRODUCTION** — Ready for operational use

---

## 1. HISTORICAL SCCR SERIES

**Status**: IDEA → DATA REQUIRED
**Source**: working-paper §10 Q7 (claims: 2017≈10.0, 2021≈8.0, 2023≈5.0, 2024≈4.8, "era-adjusted node counts")
**Problem**: Unverifiable — no historical fee data, BTC price data, or node count data exists in repo.
**Data Required**: 
- Historical fee data (sat/vB per block) for 2017, 2019, 2021, 2023, 2024, 2025
- Historical BTC price series (daily or per-block)
- Historical node count estimates per era
- Historical average block size per era
**Next Step**: Build data collection pipeline from Blockstream/CoinGecko/mempool.space APIs. See `research/HISTORICAL_SCCR_RECONSTRUCTION.md`.

---

## 2. CONSENSUS DISTANCE

**Status**: IDEA
**Problem**: No formal measurement of how far the UTXO state is from consensus across nodes.
**Data Required**: UTXO growth rate, state size per node, relay timing data.
**Next Step**: Design measurement protocol. Related: `research/utxo_cost_model.py`.

---

## 3. VALIDATION LAG

**Status**: IDEA (v1 OOM survey done: `research/validation-cost.md`)
**Problem**: How long does it take a node to validate a block? No pinned benchmark exists.
**Data Required**: Per-block validation time benchmarks, hardware census, Core `src/bench` results.
**Next Step**: Pin a Core benchmark run, collect hardware diversity data.

---

## 4. ATTACK OPTION VALUE

**Status**: IDEA
**Problem**: What is the economic value of the option to attack the network via fee manipulation?
**Data Required**: Fee market data across congestion regimes, MEV extraction data, block subsidy schedule.
**Next Step**: Model the option value of front-running or fee sniping under various fee regimes.

---

## 5. HASHPOWER MOBILITY

**Status**: IDEA
**Problem**: How easily can miners switch between chains? What is the economic cost?
**Data Required**: Miner hashrate distribution over time, geographic data, ASIC inventory data.
**Next Step**: Collect mining pool data, analyze hashrate migration patterns.

---

## 6. VERIFICATION FRONTIER

**Status**: IDEA
**Problem**: What is the cost boundary for a node to fully verify the chain?
**Data Required**: Full node cost decomposition (hardware, bandwidth, storage), per-node bandwidth measurements.
**Next Step**: Measure per-node bandwidth costs (see `model-spec.json` bandwidth leg v1 as starting point).

---

## 7. CAPABILITY ASYMMETRY

**Status**: IDEA
**Problem**: Do different node implementations have different validation capabilities or speeds?
**Data Required**: Node software diversity metrics, relay topology data, validation speed benchmarks.
**Next Step**: Survey node implementations, benchmark Core vs. alternatives.

---

## 8. FORK DNA

**Status**: IDEA
**Problem**: Can we characterize forks by their "DNA" — miner signaling patterns, economic context, social dynamics?
**Data Required**: Historical fork data, BIP-9/BIP-8 signaling history, miner behavior patterns.
**Next Step**: Analyze historical fork data (SegWit, Taproot, BIP-110 signaling).

---

## 9. PRUNED VS. ARCHIVAL SPLIT

**Status**: DATA REQUIRED
**Source**: `research/archival-vs-pruned-note.md`
**Problem**: The T=10 assumption assumes archival retention. The actual pruned/archival distribution is unknown.
**Data Required**: Node retention distribution survey, pruned vs. archival node counts.
**Next Step**: Design census methodology. See `research/archival-vs-pruned-note.md`.

---

## 10. EXTERNAL REPRODUCTION (D5 — OPEN BLOCKER)

**Status**: OPEN BLOCKER
**Source**: working-paper §7.1 falsifier 1, `research/reproduce/external-reproduction.md`
**Problem**: No independent external reproduction of the SCCR measurement exists.
**Data Required**: A willing external reproducer with the `research/reproduce/` protocol.
**Next Step**: Recruit external reproducer, provide clean protocol, verify the 0.2186/0.0584/0.8320 numbers independently.

---

## 11. NODE COUNT COMPLETE CENSUS

**Status**: DATA REQUIRED
**Source**: `model-spec.json` — N=32K is a primary-source lower-bound census, not a complete enumeration
**Problem**: Independent estimates span 10K–100K reachable nodes. SCCR is inversely proportional to N.
**Data Required**: Full addrman enumeration, independent census, regional node distribution.
**Next Step**: Fund/organize a proper node census (see `model-spec.json` §5.4 knife-edge).

---

## 12. DISCOUNTING SENSITIVITY

**Status**: ANALYZED (documented in §7 item 4)
**Source**: working-paper §7 item 4 — discounting at r=5%/8% cuts liability PV by ~27%/45%
**Problem**: The T=10 horizon uses no discounting. This is a conservative choice but should be documented.
**Data Required**: Discount rate estimates, storage cost deflation trends.
**Next Step**: Document in model-spec, add discounting sensitivity to the MC range.

---

## 13. BIP-110 PRE/POST PROTOCOL

**Status**: DESIGNED (protocol exists, no BIP-110 activation)
**Source**: `data/bip110.json` — BIP-110 signaling at 0% as of 2026-09-09
**Problem**: BIP-110 has not activated, so no pre/post comparison is possible yet.
**Data Required**: BIP-110 activation timeline (if ever), fee measurement before/after activation.
**Next Step**: Build measurement harness using 2026 live data. If BIP-110 activates, measure SCCR shift.

---

## 14. v3.0 ECONOMIC DYNAMICS

**Status**: PROGRAM (agenda documented)
**Source**: `research/future-directions-v3.md` — 8 questions, first answers in §2
**Problem**: The model measures a ratio but does not close the dynamic loop (N↔fees↔price).
**Data Required**: Dynamic model of node entry/exit vs. fee demand, feedback function measurements.
**Next Step**: `research/future-directions-v3.md` §2 Q1 — measure response functions.

---

## 15. CROSS-CHAIN GENERALIZATION

**Status**: PROGRAM (Phase V)
**Source**: `research/future-directions-v3.md` §3
**Problem**: The SCCR framework is Bitcoin-specific. Does it generalize to other chains?
**Data Required**: Alternative blockchain resource data (Ethereum state, Solana storage, etc.).
**Next Step**: `research/future-directions-v3.md` §3 — design cross-chain comparison.

---

## 16. BANDWIDTH LEG MEASUREMENT

**Status**: v1 ANALYTICAL BOUND (not measurement)
**Source**: `model-spec.json` v2.1.0, `research/verification_appendix.md`, `research/pruning_externality_analysis.md`
**Problem**: The bandwidth leg ($3.94/yr/node) is an analytical bound using a $0.05/GB retail proxy, not a measurement.
**Data Required**: Measured per-node bandwidth bills (flat-rate reality), measured replication-weighted byte flow.
**Next Step**: Collect operator bandwidth cost data, measure actual propagation.

---

## 17. VALIDATION LEG MEASUREMENT

**Status**: v1 STARTED (OOM survey in `research/validation-cost.md`)
**Source**: `research/validation-cost.md` — validation cost per node per year < $100 (central ~$1–2/yr)
**Problem**: Literature-anchored, no pinned Core benchmark run.
**Data Required**: Pinned Core benchmark, hardware census.
**Next Step**: Run Core `src/bench`, collect hardware diversity data.

---

## 18. UTXO LEG PRICING

**Status**: MEASURED (v1 — size per block), NOT PRICED
**Source**: `research/working-paper.md` §5.7 — `getblockstats → utxo_size_inc` persisted, avg ~29.9 KB/block
**Problem**: The UTXO delta is measured but not yet attributed a $/byte/yr cost.
**Data Required**: $/byte pricing of the UTXO delta, validation-lookup cost surface.
**Next Step**: Attribute cost to UTXO delta, complete the UTXO leg pricing.

---

## 19. RELAY COST (RCIR)

**Status**: IDEA
**Problem**: The relay cost of propagating blocks across the network is unmeasured.
**Data Required**: Relay topology, propagation time measurements, relay node costs.
**Next Step**: Design relay measurement protocol.

---

## 20. INDEXER SERVING COST

**Status**: IDEA
**Problem**: Indexers (block explorers, Lightning watchtowers) bear storage costs not captured by full nodes.
**Data Required**: Indexer cost breakdown, storage/retention policies.
**Next Step**: Survey indexer operators, measure their cost structure.

---

## NOTES ON THE MASTER SPEC'S AMBITIOUS CONCEPTS

The master spec contains ambitious concepts (Attack Option Value, Fork DNA, Hashpower Mobility, Verification Frontier, Capability Asymmetry) that are **IDEA-level** — they have not been researched, have no data, and should NOT be implemented. They belong in this backlog until:
1. The foundational data gaps (historical SCCR, node census, fee history) are closed
2. The external reproduction (D5) is completed
3. The v3.0 economic dynamics program produces actionable results

**Implementation order**: Historical data → External reproduction → Node census → v3.0 dynamics → Ambitious concepts

---

*This backlog is the single source of truth for BSAHI future research priorities. Items move from IDEA → RESEARCH QUESTION → DATA REQUIRED → TEST → VALIDATED → PRODUCTION as evidence accumulates.*
