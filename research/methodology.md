<!-- seo-title: Methodology — How BSAHI Measures Bitcoin Resource Costs -->

# Methodology

**BSAHI — Bitcoin Resource Accounting.** How every number in this program is
obtained, graded, checked, and reproduced.
*Version 1.0 · 2026-09-17 · Author: Prateek Poswal (Independent Researcher, ORCID 0009-0005-2139-1877)*

---

## 1. Principle

A number may only be presented at the strength its evidence supports. This
program therefore separates three **layers** and assigns every dataset a **grade**,
and it treats a published correction as a normal output rather than a failure.

## 2. The three layers

| Layer | Definition | How to cite |
|---|---|---|
| **Observed** | Read from a node, or from a frozen primary capture with a recorded unit and date | As a measurement, with its date |
| **Reconstructed** | Derived by a stated procedure from anchors (interpolation, era means, attribution) | As the *procedure*, not as a measurement |
| **Modelled** | Assumptions dominate; the output is a scenario | As a scenario, with assumptions |

The authoritative classification of every published number is the
[Evidence Matrix](/research/evidence-matrix). Nothing may be called Observed if it
is Reconstructed or Modelled.

## 3. Grades

- **A** — direct primary measurement (node RPC, on-chain fact), dated.
- **B** — frozen primary capture with a recorded unit and date (B\* = with a documented gap).
- **C** — model using documented assumptions; the direction is the claim, the level is not.
- **D** — reconstruction by interpolation with no continuous source.

## 4. Instruments

| Instrument | Produces | Layer |
|---|---|---|
| `tools/research/sccr_live.py` | SCCR daily reading | Observed |
| `tools/research/utxo_state_measure.py` | `gettxoutsetinfo` UTXO/state rows | Observed |
| `tools/research/perblock_validation.py` | per-block spot samples | Observed |
| `tools/research/production_cost_ratio.py` | producing-side cost scenarios | Modelled |
| `tools/research/verify_cost_index.py` | verification-burden trend | Modelled |
| `tools/research/sccr_sensitivity.py` | SCCR bands + CI + stress test | Modelled |
| `tools/research/integrity_audit.py` | the standing checks (§7) | — |
| `tools/research/datasets_manifest.py` | the versioned dataset index | — |
| `research/reproduce/` | independent reproduction (JS/Python/C + notebook) | Observed |

## 5. Data sources

- **First-party node** — a Bitcoin Core node (pruned): `gettxoutsetinfo`,
  `getblockheader`, `getblockchaininfo`.
- **Public network endpoints** — mempool.space (fees), blockstream esplora
  (block summaries), blockchain.info (historical daily series).
- **Frozen captures** — every external series is captured once, stored under
  `captured-data/`, and read from disk thereafter, so a result can be recomputed
  offline and cannot silently drift.

## 6. Units and conventions

- Hashrate series are **TH/s** unless labelled EH/s; derived EH/s = TH/s ÷ 10⁶.
- Byte quantities are **bytes**; GB is **decimal** (10⁹).
- Fees are **satoshis** in captures, **BTC** in daily series, **USD** only where a
  price is applied and stated.
- Block space is **sat/vB**; block weight is **weight units (WU)** with the 4 MWU ceiling.
- Every dataset that carries a unit records it in a `unit` field; the integrity
  audit asserts derived units agree with raw ones.

## 7. Standing integrity checks

`tools/research/integrity_audit.py` runs on every change and exits non-zero on failure:

1. **Heights/dates** — every (height, timestamp) pair is monotonic; a height's
   *chain* date is kept distinct from its *capture* time (they differ by years
   while a node is syncing).
2. **Anchor consistency** — known on-chain anchors match their heights.
3. **Units** — derived fields agree with raw ones (hashrate, power, GB decimal).
4. **Provenance** — each dataset records schema + generated_at + a source.
5. **Layers** — each research dataset is classified Observed/Reconstructed/Modelled.

## 8. Reproducibility

- **SCCR**: three independent implementations (JavaScript, Python, C) agree to
  < 1e-6 on a frozen capture; `research/reproduce/cross_check.sh` prints the
  verdict; `reproduce_sccr.ipynb` walks through it.
- **Sensitivity/CI**: `sccr_sensitivity.py` is deterministic (fixed seed).
- **Datasets**: `data/datasets.json` is the versioned index with layer and grade.

## 9. Corrections policy

When a value is wrong, we publish the correction with its cause and regenerate
every dependent value. Precedent: a **10× time-horizon error** in our own model
was found, corrected, documented, and every value regenerated — the conclusion
survived, and the correction is part of the record.

## 10. Known limitations

- UTXO/state is **Observed at one height only**; the 2013-2026 series remains
  Reconstructed (grade D) until a node reaches the tip and the series accrues.
- Electricity price, ASIC efficiency, node throughput and operator wage remain
  assumptions (grade C/D).
- Per-block samples are a **spot-check**, not a survey.
- Field Core Web Vitals and search-console data are not yet instrumented.

## 12. Population and observability

Bitcoin's node population cannot be counted. Every attempt measures a partial
view with its own bias, so this program publishes the **views and their
mechanisms**, not a single confident number.

**The role axis first.** Miners (a few dozen pools) *produce* blocks and *receive*
fees; validating nodes *bear* the storage and validation cost and receive nothing.
BSAHI's `N` is the **validating** set. The two must never be merged.

**Four quantities, never conflated:**

| # | quantity | layer | grade |
|---|---|---|---|
| A | gossip-observed **addresses** (addrman) | observed | C |
| B | reachable **nodes** (a crawler can connect) | observed | B |
| C | non-listening / private nodes | unobservable | D |
| D | total population | not observable | — |

**Four instruments (first-party):**

| instrument | measures | cadence |
|---|---|---|
| `verification_population.py` | reachable-node composition + activity partition | on capture |
| `seed_census.py` | DNS-seed visible **addresses** (third view) | 12 h |
| `addrman_churn.py` | address **persistence** over time (staleness, measured) | 12 h |
| `inbound_census.py` | distinct peers that **dial in** = evidence of non-listening nodes | 1 h |

**The direction of the error is stated, not hidden.** Non-listening nodes are
excluded from the index, so the reported network-wide storage externality
(`L_net`) is a **lower bound** and the reported SCCR an **upper bound**; the
baseline is conservative. The unpublicised-node band (N = 50K/80K/100K) is
published alongside every SCCR figure.

**Exact requests only.** `getnodeaddresses 32000` was a request *ceiling* that
truncated the set; the instruments now use `getnodeaddresses 0` (all known
addresses). The first exact measurement returned **more** addresses than the
ceiling had — which is why the ceiling figure was retired.

See [Measuring the verification population](/research/population-measurement) and
the [Evidence Matrix](/research/evidence-matrix).

## 11. Citing

Poswal, P. (2026). *Bitcoin Resource Accounting.* Bitcoin Sahi. ORCID
0009-0005-2139-1877. Data and code: CC BY 4.0.
