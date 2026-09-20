# External Reproduction Log

**Status: in progress.** The kit reproduces from a clean clone — that has been
verified twice, most recently against the 2026-09-16 frozen snapshot. An actual
external reproducer has not run it yet. Sending that one message is the last
human step, and it is Prateek's to take.

## Read this first: the re-base

Every SCCR figure in the historical rows below was produced *before* the Phase-C
node-count re-base on 2026-09-17 (N 32,000 → 26,586). SCCR is inverse-linear in
N, so the same runs now read **1.2036×** higher: the frozen capture that logged
0.240641 now returns 0.289645.

The rows are left exactly as they were written — they are the record of what
those runs produced at the time. The numbers to reproduce *today* are in the
"Reference result" section below.

---

## Reference result (the current contract)

From the frozen snapshot of 2026-09-16 — 155 blocks, heights 967,138→967,292,
model-spec v2.1.1, N = 26,586, L_net $4,675.65/block:

**avg 0.2896 · min 0.0590 · max 1.2948 · 152 of 155 below 1× (98.1%)**

| Path tested | Result |
|---|---|
| `bash research/reproduce/cross_check.sh` | Pass — JS, Python and C agree to 1e-6 |
| `python3 tools/research/reproduce.py` | Pass — exit 0, reads the frozen input by default, prints avg 0.2896 |
| `gcc -O2 -o reproduce_sccr reproduce_sccr.c -lm` | Pass — compiles clean on macOS, agrees |
| Input | Committed and versioned in `input/fee_history_capture.json`; no database needed |
| Determinism | `git status` stays clean after every run |

The kit reads N from `model-spec.json`, so a fresh clone reproduces this value
with no edits. The SCCR on the live dashboard is a different, daily-refreshed
reading — see `/data/sccr.json`.

---

## Clean-clone verification, 2026-09-16

The 2026-08-02 capture was never committed, and the GitHub Actions pipeline used
to refresh the kit input in place — so the documented 0.2186 could not be reached
from a clean clone. Fixed at the root: the pipeline no longer writes into
`research/reproduce/input/`; live refreshes go to `captured-data/sccr-live/`.
After that change, a fresh clone reproduces the current numbers (table above).

---

## Historical record: the 2026-08-03 fresh-clone simulation

This was the first run, against the original 171-block snapshot
(heights 960,562→960,732). It logged **avg 0.2186**, which is the pre-re-base
value for that input. That specific input file was later superseded; the rows are
kept as the log of what the simulation found.

The method was a plain fresh clone into a clean temp directory, following only the
published instructions — `README.md` ("Reproduce in 30 seconds") and
`research/reproduce/README.md` ("Run all three"). No insider knowledge, no extra
files.

| Path tested | Result |
|---|---|
| `python3 tools/research/reproduce.py` | Pass — avg 0.2186, min 0.0584, max 0.8320, 171/171 below 1× |
| `bash research/reproduce/cross_check.sh` | Pass — JS, Python and C agree (avg 0.218605), verdict: all three agree |
| `gcc -O2 -o reproduce_sccr reproduce_sccr.c -lm` | Pass — compiles clean on macOS |
| Python 3.9 (system, no pip) | Works — stdlib only for the compute; the chart is skipped if matplotlib is absent |
| Input | 171 entries, committed to `input/fee_history_capture.json` |
| Node | Works from a clone |
| Re-test against the live repo at `59573b0` | Pass — all three agree, working tree clean afterwards |

### What the simulation caught

Three defects that a stranger would have hit, all fixed and committed:

1. **The C binary was missing from clones.** `cross_check.sh` called
   `./research/reproduce/reproduce_sccr`, but the binary is gitignored, so anyone
   following "Run all three" got `No such file or directory` and an exit code of 1.
   The script now compiles the C source when the binary is absent.
2. **Scary sqlite errors in the JS step.** In frozen-input mode, `storage-ratio.js`
   still ran database queries (`no such table: block_stats / research_findings`)
   and overwrote the committed report file. Frozen-input mode is now fully
   database-free and writes no files; the live-database behaviour is unchanged.
3. **Heights were present but unsorted.** A stranger checking the contiguous set
   got `False` even though all 171 heights were there. The capture file is now in
   ascending order. The computation is order-invariant, so the values did not
   change.

---

## What to send

- **Repository:** https://github.com/prateekposwal/block-space-economics (public;
  live at bitcoinsahi.com)
- **Protocol:** `research/reproduce/README.md` → *External reproduction protocol (3 steps)*
- **Input:** `research/reproduce/input/fee_history_capture.json`
- **Expected output:** avg **0.2896**, min 0.0590, max 1.2948, 152 of 155 below 1×
- **Message to send:** `research/reproduce/recruit-message.md` (copy-paste ready)

## The remaining step

An uninvolved person has to run the three-step protocol. Two gates sit in front of
the outreach, and both are Prateek's:

1. **The preprint is not live yet.** The community venues on the outreach list
   (Optech, Delving, bitcoin-dev, Chaincode, r/BitcoinEngineering) are sequenced
   after a preprint URL exists, and arXiv is waiting on Prateek's account,
   ORCID and licence.
2. **The publisher uses Prateek's Nostr key.** Posting through
   `tools/marketing/publisher.js` would speak in his name, which is not something
   to do automatically.

**What Prateek does (about 5 minutes):** open `research/reproduce/recruit-message.md`,
copy it into an email or DM to one person — a friend, a colleague, anyone
technically literate — and send it. Then record the reply below.

## Result table

| Reproducer | Environment | Result | Notes |
|---|---|---|---|
| Prateek (reference run) | macOS; Python 3.9 + Node + gcc | 0.2896 | The published numbers; confirmed by the 2026-09-16 clean-clone verification |
| External #1 | pending | pending | |
| External #2 | pending | pending | |
| External #3 | pending | pending | |

## Three outcomes, not two

An external run lands in exactly one of these. The middle one matters: reproducing
the number while disagreeing with the framing is a successful reproduction, not a
failed one. The disagreement is scientific feedback about a documented assumption
(working-paper §7.1).

| Outcome | Meaning | Effect on the milestone |
|---|---|---|
| Reproduced | Number matches from a clean clone | Milestone met |
| Reproduced, with a framing objection | Number matches, but the reproducer disputes a documented assumption (C = $925/yr bundling, T = 10 years, storage-as-first-resource, the externality reading) | Milestone met — the objection goes to the community-feedback triage, not the failure column |
| Failed to reproduce | Materially different number from a clean clone, not reconciled | Milestone not met — submission stays blocked until the discrepancy is explained |

**Recording rule:** a correctly reproduced number meets the milestone even if the
reproducer challenges the assumptions. The objection is logged as feedback.

## Wording

Say "independently reproduced by external participants following the published
reproduction protocol". Do not say "externally verified".

## Detail row (fill when a result lands)

| Date | Reproducer | Language/Env | Avg SCCR | Min | Max | Below 1× | Per-block max dev | Verdict |
|---|---|---|---|---|---|---|---|---|
| pending | | | | | | | | |

## When to stop polishing and submit

The milestone is met when an external participant replies with the equivalent of
"I cloned it, ran one command, and got 0.2896" — an uninvolved human confirming
the published numbers from a clean clone.

When that reply arrives, the submission gate opens: stop polishing and submit.
Record the reply here (quote, date, reproducer — anonymous is fine), then submit.

Two clarifications:

- A reproducer who confirms the number but disputes a documented assumption has
  still met the milestone. Log the objection in the community-feedback triage
  (`research/community-review-plan.md` §4 → `research/community-feedback.md`) and
  fold it into the next revision. It does not block submission.
- A reproducer who cannot reproduce the number — materially different result,
  unreconciled — blocks submission until it is explained. That is falsifier 1 of
  working-paper §7.1.

Until a reproduction-of-the-number reply lands, the gate stays closed.

**Recruit assets (2026-08-03):** `recruit-message.md` · personalized variants
`recruit-message-personalized.md` · verified contact list
`external-reproducer-contacts.md` (8 verified channels; no fabricated emails).

---

*Bitcoin Sahi Research — external reproduction log. Working paper v2.1.0,
model-spec v2.1.1. Simulation and fixes 2026-08-03; re-based 2026-09-17.*
