# The Two Questions — Answered

**Published:** 2026-08-10 · **Program:** Bitcoin Resource Accounting · **Author:** Prateek Poswal


## Question 1: Do pruned nodes eliminate the externality?

**Short answer:** No. Pruned nodes must still download and verify every block before pruning. The bandwidth + CPU cost of processing inscription data is unavoidable regardless of pruning mode.

**The breakdown per node type:**

| Node Type | HW/yr | BW/yr | Elec/yr | Total/yr | 10yr/insc cost | Paid voluntarily? |
|-----------|-------|-------|---------|----------|----------------|-------------------|
| Hobbyist (RPi, pruned) | $40 | $360 | $16 | **$416** | $0.0035 | Partially (download+verify cannot be avoided) |
| Hobbyist (RPi, archival) | $40 | $360 | $16 | **$416** | $0.0035 | Yes — chooses to store full chain |
| Mini PC (pruned) | $56 | $600 | $63 | **$719** | $0.0060 | Partially |
| Desktop (archival) | $160 | $600 | $158 | **$918** | $0.0076 | Yes |

**Key finding:** Pruning avoids ~70% of storage overhead (disk I/O, space), but the node still pays 100% of bandwidth + CPU to download and validate every inscription before deciding to keep or discard it. At a hobbyist scale ($416/yr), the unavoidable inscription burden is ~**$0.18/yr per node**.

## Question 2: Does download+verify before pruning create an unavoidable cost?

**Short answer:** Yes. Every Bitcoin full node — pruned or archival — must download every byte of every block and verify every signature. Inscription data cannot be skipped during validation.

**The math:**
- 400 bytes per inscription × 100K/month = 40 MB/month of inscription data
- Every node downloads this at their bandwidth cost
- Every node CPU-verifies it (signature checks, script execution)
- Pruned nodes then discard the historical data beyond their prune window
- But the download + CPU cost has already been paid

**The unavoidable cost (per node, per year):**
- Bandwidth: 40 MB/month × 12 = 480 MB/yr. At typical bandwidth costs (~$0.05/GB), that's **~$0.02/yr** in incremental bandwidth
- CPU: negligible for 400-byte inscriptions (fractions of a cent)
- **Total unavoidable: ~$0.02–$0.05/yr per node** — truly negligible

## Verdict

The externality exists **theoretically** but is **not economically significant** at current volumes.

| Argument | Our Finding |
|----------|------------|
| "Pruned nodes avoid the cost" | Only partially — 70% avoided, 30% unavoidable (download+verify) |
| "The unavoidable cost is real" | Yes, but **$0.02–$0.05/yr per node** is negligible |
| "At scale it matters" | At 50K reachable nodes: **$1K–$2.5K/yr aggregate**. Still negligible |
| "At 50x volume it matters" | At 5M inscriptions/mo: **$50–$125K/yr aggregate**. Possibly significant |

**The honest answer:** At current inscription volumes (~100K/mo), the externality is too small to matter for any individual node operator. The SegWit discount question is structurally interesting but practically irrelevant today. If inscription volume increases 50–100x, it becomes a real consideration — but by then, the fee market would also adjust (congestion pricing would rise).

**Where the research still adds value:**
1. The structural gap (congestion vs permanence) is real even if the dollar amount is small
2. The model provides a framework for re-evaluating as volumes change
3. The BIP-110 debate needs this data to calibrate proportional responses
