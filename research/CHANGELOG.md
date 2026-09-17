<!-- seo-title: Research Changelog — BSAHI -->

# Research Changelog

Dated changes to BSAHI's measurements, grades, and methods. Corrections are
recorded here with their cause. Newest first.

## 2026-09-17

- **Integrity audit added** (`tools/research/integrity_audit.py`): heights/dates
  monotonicity, anchor consistency, unit agreement, provenance, layer
  classification. Runs as a gate.
- **Units correction (Observed→corrected):** `production_cost_ratio.py` stored
  the hash-rate series (unit **TH/s**) under the field `hashrate_ehs` — a 10⁶
  mislabel. The power calculation was correct; the label was not. Now stores
  `hashrate_ths` and a derived `hashrate_ehs`, and the audit asserts the relation.
- **Evidence Matrix published** (`/research/evidence-matrix`): 27 headline numbers
  classified Observed / Reconstructed / Modelled with source, date and grade.
- **UTXO measurement pipeline added** (`utxo_state_measure.py`) and a first
  **Observed** `gettxoutsetinfo` row captured (h671,462 · 72,234,156 UTXOs ·
  4.39 GB). The 2013-2026 UTXO table remains Reconstructed (grade **D**).
- **SCCR hardening:** exact sensitivity bands over N×T×C (below 1.0 in 22/27
  combinations; **N dominates** the uncertainty at 10×), a bootstrap 95% CI for
  the mean of 155 real blocks (0.2131–0.2707), and a named-archetype electricity
  scenario table. Published at `/research/sccr-sensitivity`.
- **Reproduction verified:** JS = Python = C on the frozen capture (155/155
  heights, max |diff| 4.9e-7); recorded in `data/reproduction_verification.json`.
- **Per-block strip renamed** to **per-block SPOT validation** with an explicit
  sample-size caveat; sample size increased from 3 to 12 blocks per era.
- **Methodology paper v1.0 published** (`/research/methodology`); versioned
  **dataset index** (`/data/datasets.json`) and **replication invite**
  (`/research/replicate`) added.

## 2026-09-16

- **Historical series frozen:** difficulty 2009→2026 (1,614 points) and mempool
  congestion 2016→2026 (1,498 points) from primary sources; row 10 (hashrate)
  B→A, row 3 (congestion) B→B\*.
- **Production-cost scenarios:** the single assumed electricity price replaced by
  a scenario table across $0.03–$0.15/kWh.
- **Per-block spot validation** strip published for 2010–2026.

## 2026-09-15

- **UTXO series reachability** documented (no continuous public source found;
  grade D recorded rather than estimated); VCI chain leg cross-checked to 2.7%.
- **Pool hashrate reachability** documented; attribution validated internally 7/7.

## 2026-09-10

- **BIP-110 Post-Lock-In Case Study** published (1,862 words, primary-source
  chronology); author byline corrected to the Independent Researcher (not a council).

## 2026-09-09

- **UTXO cost ratio** (reconstructed era table) published; grade **D** recorded.

## 2026-08-21

- **Regime event** observed: SCCR rose ~0.16 → ~0.44 in ~five days, measured live.

## 2026-08-11

- **SCCR trend note**: the ratio fell from ~0.28 to ~0.238 across the first
  measured week (early series; uncertainty stated).

## 2026-08-02

- **SCCR measurement begins.** First live readings; the daily tracker installed.

## Earlier

- **Model correction (pre-launch):** a **10× time-horizon error** in our own
  storage-cost model was found and fixed; every dependent value was regenerated
  and the conclusion survived. This precedent is why corrections are published here.
