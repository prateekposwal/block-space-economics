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

## Quickstart: reproduce the SCCR

```bash
git clone https://github.com/prateekposwal/block-space-economics
cd block-space-economics/research/reproduce
python3 reproduce_sccr.py --input input/fee_history_capture.json
bash cross_check.sh          # JS = Python = C? prints the verdict
```

Expected: **avg SCCR 0.2406** (min 0.0490, max 1.0757, 153/155 below 1×), with the
three implementations agreeing to < 1e-6. If you do **not** get that, we want to
know — that is the useful result.

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
[Research Changelog](/research/CHANGELOG) with their cause — the project's own
10× correction is precedent that this is the intended path, not an embarrassment.

## The standard

- Every number is classified **Observed / Reconstructed / Modelled** with a grade
  in the [Evidence Matrix](/research/evidence-matrix).
- Methods are in the [Methodology](/research/methodology) paper.
- The checks that guard the data run in
  `tools/research/integrity_audit.py` and gate every change.

If a published number cannot be reproduced from the repository, that is a defect
in the repository, and we will treat it as one.
