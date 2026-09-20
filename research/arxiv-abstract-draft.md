# arXiv Abstract — DRAFT (pre-submission, ready to verify)

**Target:** arXiv (cs.CR or econ.GN). arXiv abstracts should be ~1500 characters
max (the limit is generous but abstracts over ~1500 chars get truncated in some
views; keep under ~1900 to be safe).
**Current state:** the working-paper.md abstract is ~3500 chars — TOO LONG for arXiv.
This is the arXiv-length rewrite.

---

## DRAFT A — arXiv abstract (primary, ~1500 chars)

> Bitcoin's fee market allocates scarce block space among competing transactions,
> but does it also internalize the long-term resource costs of permanently
> recorded blockchain data? We define the Storage Cost Coverage Ratio (SCCR) --
> the ratio of transaction fees paid to the estimated lifetime replicated-storage
> cost borne by full nodes -- and measure it against live fee-history data using
> a measured reachable-node census (26,586; the local addrman sample counts addresses from a live Bitcoin Core
> node). Across the frozen capture of 171 blocks, fees cover approximately 22% of
> the modeled 10-year replicated storage cost (band 0.07-0.71 across the node-count
> and price range), with ~99-100% of sampled blocks below the 1x threshold. We
> reconcile two cost models that previously disagreed by 16.4x, document the
> correction transparently, and reproduce the measurement in three independent
> implementations (JavaScript, Python, C). The framework is presented as a
> reproducible first measurement of an open question: the fee market solves
> block-space allocation well, but whether it internalizes long-lived resource
> costs is an empirical question, not a settled one.

*(~1160 chars — comfortably under limits.)*

---

## DRAFT B — shorter (if the venue prefers a single-paragraph tight abstract, ~900 chars)

> We measure whether Bitcoin's fee market internalizes the long-term storage cost
> of permanently recorded blockchain data. The Storage Cost Coverage Ratio (SCCR)
> -- transaction fees over estimated lifetime replicated-storage cost -- averages
> ~0.22 on a frozen 171-block capture using a measured reachable-node census (26,586
> reachable addresses), with ~99-100% of blocks below the 1x threshold. Two cost
> models that disagreed by 16.4x are reconciled and documented; the result is
> reproduced in three independent implementations (JS/Python/C). We claim only a
> reproducible first measurement, not a verdict: whether the fee market fully
> internalizes long-lived resource costs remains an open empirical question.

*(~700 chars.)*

---

## Notes
- **Banded claims only** — no "100% below 1x" strong form (it breaks below ~49K nodes).
- **Three-implementation claim is true** (cross_check.sh verifies JS=Python=C to <1e-6).
- **"First measurement" is the honest novelty claim** (arXiv:2103.05866 already made the
  observation; we claim the measurement, not the idea).
- Final venue may impose its own limit; both drafts are safe.

## DONE vs LEFT
- **DONE:** two arXiv-length abstract drafts (A: ~1160 chars, B: ~700 chars), both banded.
- **LEFT:** Prateek picks A or B (or edits); then sync into working-paper.md Abstract +
  .tex title block + arXiv submission field.

*Bitcoin Sahi Research — arXiv abstract drafts for the SCCR paper (2026-08-04).*
