# The Validation Leg — v1 (order-of-magnitude survey)

<!-- seo-title: Bitcoin Validation Cost: Cheap Per Node -->

**Status: STARTED (v1, 2026-08-04).** This is an analytical bound plus a
literature survey — NOT a measured benchmark. It answers the question the
storage leg deliberately left open (§7 of the working paper): what does
*validation* cost, as a distinct resource leg of the fee-internalization
framework? Confidence: **order-of-magnitude only** (uncertainty band ≈ 0.5×–5×).

## 1. What validation cost IS

Per full node, per block, validation is the CPU work of proving the block is
*legitimate* before (and while) it is stored or pruned:

1. **Proof-of-work check** — hash the 80-byte header below the target
   (trivial: one SHA256d ≈ microseconds; the expensive PoW is paid by miners,
   not validators).
2. **Block-structure rules** — size/weight limits, merkle-root consistency,
   witness commitment, timestamp/version fields.
3. **Transaction validity** — script execution and **signature verification**
   (the dominant term: ECDSA / Schnorr checks per input), UTXO-set
   availability (no double-spend), fee arithmetic, standardness.

**The structural property that makes validation special:** it is the *only*
cost that is strictly unavoidable at any replication scale — every node pays it
for every block since genesis, pruned or archival, and no node can "skip"
validation and remain a full node. Storage can be pruned; bandwidth is one
download per block; validation is CPU work *repeated N times* (once per node)
and is not amortizable below one full pass per block per node.

## 2. Rough analytical bound (order of magnitude)

| Term | Value | Basis |
|---|---|---|
| Blocks per year, R_blocks | **52,596** | model-spec.json (365.25 × 24 × 6) |
| Signature checks per block | ~3–10K | typical block: 3–4K txs × ~2 inputs; dominated by ECDSA/Schnorr verifies |
| Verify throughput (modern hw) | ~10–30K sigs/s | libsecp256k1, single-threaded, modern x86 (Bitcoin Core `src/bench` class of results) |
| Validation CPU per block | **~0.1–1 s** | sig-check-dominated; cross-checked by initial-sync delta below |
| Validation CPU per year per node | **~1.5–15 h** | 52,596 blocks × 0.1–1 s |
| Amortized compute cost | $0.10–0.50 / CPU-h | node budget C=$925/yr over ~9K h/yr, CPU share + electricity |
| **Validation cost per node per year** | **~$0.5–$5** | 1.5–15 h × $0.10–0.50; central ≈ **$1–2/yr** |
| Network-wide (N = 32K) | **~$16K–160K/yr** | × the ≥32K lower-bound census; central ~$32–64K/yr |

**Cross-check via initial sync.** Full initial validation of ~1M blocks adds on
the order of 6–24 h of CPU over an assumevalid-style sync on comparable
hardware ⇒ 0.02–0.09 s/block *averaged* (I/O-bound, so a lower bound on CPU) —
consistent with the 0.1–1 s/block estimate above for *steady-state* validation
with an in-RAM UTXO cache (steady state is CPU-bound, sync is I/O-bound; the
two brackets straddle the true value).

**Key quantities carried in the model:** R_blocks (52,596) and N (≥32K) are
canonical in `research/model-spec.json`; the validation leg adds **no new model constant** — it is a resource-budget bound on C (the bundled $925/yr node cost),
the same decomposition discipline as the bandwidth leg.

## 3. Reference literature

- **Node-cost context:** Tschorsch, F. & Scheuermann, B., *Bitcoin and Beyond:
  A Technical Survey on Decentralized Digital Currencies*, IEEE COMST 18(3),
  2016 — surveys full-node validation/storage/bandwidth cost components and
  gives the classic per-node cost decomposition this bound refines.
- **UTXO/validation work context:** Delgado-Segura, S. et al., *Analysis of the
  Bitcoin UTXO Set*, IACR ePrint 2018/569 — quantifies UTXO-set growth and
  per-transaction resource footprints that drive validation input checks.
- **Benchmark source:** Bitcoin Core benchmark suite, `src/bench/`
  (`bench_bitcoin`: script/signature, block-assembly, mempool benchmarks) —
  the official, reproducible throughput numbers this bound leans on
  qualitatively. No specific Core benchmark version is pinned; the 10–30K
  sigs/s band spans modern single-threaded hardware.
- **Fee-market prior (the architect-notes 3-paper list):** arXiv:2604.17183
  (fee model), Ledger journal (fees, block size, auctions), Management Science
  (*StableFees*). **None of the three models validation cost** — that absence
  is exactly the gap this leg opens; they price inclusion, not resource burden.

## 4. Uncertainty bands — explicit

- **Order-of-magnitude only.** The central ~$1–2/yr/node spans ~0.5×–5× on
  signature-check throughput alone (hardware generation, OpenSSL vs
  libsecp256k1, Schnorr batching); initial-sync cross-checks widen the spread,
  they do not tighten it.
- The $/CPU-h amortization is a **model artifact**, not a bill: full nodes run
  continuously and their marginal electricity for a few hours of extra CPU is
  near zero for most operators. The bound is best read as *provisioning
  pressure* (hardware class and lifetime), which is how C enters the model.
- Network-wide numbers scale linearly in N and inherit the census caveat
  (≥32K known addresses, addrman-cap; true band 10K–100K).

## 5. Falsifiable claim (v1)

> **"Validation cost per full node per year is < $100 — bounded from above by the entire node hardware+operating budget C = $925/yr (model-spec v2.1.0), with a central order-of-magnitude estimate of ~$1–2/yr per node."**

This claim is falsified if: (a) a measured benchmark shows steady-state
validation CPU ≥ ~200 h/yr per node on reference hardware (⇒ ≥ $20–100/yr at
the amortized rate — inside the $100 bound but outside the stated order of
magnitude), or (b) a defensible full node census with per-node hardware data
shows validation is a *binding* provisioning constraint (i.e., nodes are
upgraded *because of* validation load, making the marginal cost the hardware
delta, not the CPU-hours — the `C`-decomposition caveat in §7.2 row 3 of the
working paper). Both directions are checkable against Bitcoin Core benchmarks
and a hardware census; until either lands, the bound stands as the v1 value.

## 6. What this leg does NOT claim

- It does **not** measure validation on any specific hardware.
- It does **not** include **mining** PoW (that is a producer cost, priced by
  the block subsidy — a different market entirely).
- It does **not** claim validation is economically significant *today*; it
  claims the opposite order of magnitude: validation is cheap per node because
  it is *per-block cheap*, and its network total (~$16K–160K/yr at ≥32K nodes)
  is small relative to the storage leg's network totals (L_net ≈ $5.6K per
  average block × 52,596 blocks/yr ≈ $297M/yr modeled). The leg exists so the
  framework can *show* this, not assert it.
