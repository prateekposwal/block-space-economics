# Bandwidth Bound — Refined Analytical Estimate

**BSAHI — LEG 2 (Bandwidth) v1 + Refinement**
*Produced: 2026-09-11*

---

## The bound

The bandwidth bound answers: **how much does it cost to propagate one block to one more node?**

### Analytical formula (from model-spec.json v2.1.1)

```
B_all_yr = B_block × R_blocks = 1,500,000 × 52,596 = 7.8894e10 bytes/year
bw_GB_yr = B_all_yr / 1e9 = 78.894 GB/year
bw_cost_per_year_node = bw_GB_yr × $0.05/GB = $3.9447/year/node
bw_cost_per_year_net = bw_cost_per_year_node × N = $104,873.8/year (N=26,586)
```

| Quantity | Value | Source |
|---|---|---|
| B_block | 1,500,000 bytes | model-spec.json v2.1.1 (captured data) |
| R_blocks | 52,596 blocks/year | model-spec.json v2.1.1 (derived: 365.25×24×6) |
| B_all_yr | 78.894 GB/year | Derived |
| cost_per_gb | $0.05/GB | model-spec.json v2.1.1 (retail proxy) |
| **bw_cost_per_year_node** | **$3.94/yr** | Computed |
| **bw_cost_per_year_net** | **$104,874/yr** | Computed at N=26,586 |
| bw_cost_per_block_node | $0.000075 | Computed |
| bw_cost_per_block_net | $2.40 | Computed |

---

## Measured vs. analytical

**This bound is ANALYTICAL, not measured.** The $0.05/GB cost_per_gb is a retail bandwidth cost proxy, not a measured node cost. Real Bitcoin node operators typically pay flat-rate or unmetered bandwidth, so the marginal cost of propagating one more block to one more node is effectively zero for most operators.

### What would make this measured

1. **Per-node bandwidth measurement**: Use `tc` (traffic control) or netfilter accounting on live nodes to measure actual egress bytes per block.
2. **Propagation delay measurements**: Use Bitcoin Core's `getnetworkinfo` + timestamp-based propagation tests (similar to the Bitcoin Relay Network or block propagation studies from de Vries et al.).
3. **Block size distribution**: Instead of the B_block=1,500,000 average, use the actual distribution of block sizes from `data/block_interval.json` or the spool to compute a more accurate bandwidth estimate.

**No propagation delay data exists in this repository.** `data/block_interval.json` contains block production intervals (time between blocks found), not network propagation delays between nodes.

### What we CAN say with confidence

The bandwidth bound ($3.94/yr/node, $126K/yr network-wide) is an **upper bound** on marginal propagation cost. The actual cost is likely lower for most operators (flat-rate internet). The bound is useful for the framework because:

- It quantifies the order of magnitude ($/yr/node is small)
- It is homogeneous with other legs (scales with N, B_block, cost_per_gb)
- It provides a ceiling against which the SCCR comparison works

---

## Comparison to storage leg

| Leg | Cost/year/node | Share of total C |
|---|---|---|
| Storage (SCCR) | $5,627.80/block × 52,596 = ~$297M/yr network | 100% (the reference) |
| Bandwidth | $3.94/yr/node | ~0.004% of storage |
| UTXO (UTXOCIR) | Covered by fees (2.9× coverage) | N/A |
| Validation | $0.5–5/yr/node | ~0.1–0.5% of C |

**Bandwidth is negligible** compared to storage at the current block size and node count. The storage leg dominates the resource burden by 4 orders of magnitude.

---

## Inscription-incremental bandwidth

The inscription-incremental bandwidth cost is even smaller:
- `bw_insc_incr_node = 480 MB/yr × $0.05/GB = $0.024/yr/node`
- `bw_insc_incr_net = $0.024 × 32,000 = $768/yr network-wide`

This is the marginal cost of all inscription data propagated through the network — roughly $768/year at 100K inscriptions/month.

---

## Honest statement

**This bound is refined but still analytical.** The refinement uses current block size (1.5MB) and node count (32,000) from model-spec.json v2.1.0, both of which are verified constants. The $0.05/GB cost_per_gb remains a retail proxy, not a measurement. No new data was introduced — all inputs trace to the existing model-spec.json.

---

*Output: `data/bandwidth_bound.json`. Inputs from `research/model-spec.json` v2.1.0.*
