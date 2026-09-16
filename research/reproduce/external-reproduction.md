# External Reproduction Log

**Status:** 🟡 IN PROGRESS — kit verified reproducible-by-stranger (fresh-clone
simulation 2026-08-03 PASS; **re-baselined to the 2026-09-16 frozen snapshot**
on 2026-09-16 — the original 2026-08-02 capture was never versioned into git,
and the GH Actions pipeline previously refreshed the kit input in place, making
the documented 0.2186 unreachable from a clean clone. Fixed at the root: the
pipeline no longer writes into `research/reproduce/input/`; live refreshes go to
`captured-data/sccr-live/`. Re-verified clean-clone below.); **actual external
reproducer still NOT engaged — that is the one remaining human step (Prateek
sends the recruit message).**

---

## ✅ Post-fix clean-clone verification (2026-09-16) — current baseline

Reference contract (frozen snapshot 2026-09-16, 155 blocks, model-spec v2.1.0):
**avg 0.2406, min 0.0490, max 1.0757, 153/155 below 1× (98.7%)**, L_net
5627.804 USD/block.

| Path tested | Result |
|---|---|
| `bash research/reproduce/cross_check.sh` (all three) | ✅ **PASS** — JS / Python / C all agree (avg 0.240641, min 0.049048, max 1.075697, below-1× 153), VERDICT: ALL THREE AGREE |
| `python3 tools/research/reproduce.py` (one-command) | ✅ **PASS** — exit 0, reads frozen input by default (155 blocks, heights 967138→967292), reproduces avg 0.240641 |
| `gcc -O2 -o reproduce_sccr reproduce_sccr.c -lm` (C from source) | ✅ **PASS** — compiles clean on macOS, agrees |
| Input data (155 entries, heights 967138→967292) | ✅ committed + versioned in `input/fee_history_capture.json`; `reproduce.py` **defaults to it** (no DB needed) |
| Determinism | ✅ `git status` clean after all runs (frozen input untouched by pipeline — verified) |

---

## ✅ Fresh-clone simulation (2026-08-03) — historical record (superseded baseline)

> The rows below record the ORIGINAL 171-block / avg-0.2186 freeze baseline. That
> specific input was never committed to git (the pipeline refreshed the file in
> place); the 2026-09-16 re-baseline (above) is the current, reproducible
> contract. Rows preserved for the log.

An uninvolved person was simulated exactly: fresh `git clone` of the public
repo into a clean temp dir, then **only** the published instructions
(`README.md` → "Reproduce in 30 seconds" + `research/reproduce/README.md` →
"Run all three") were followed. No insider knowledge, no extra files, no help.

| Path tested | Result |
|---|---|
| `python3 tools/research/reproduce.py` (one-command) | ✅ **PASS** — exit 0, prints avg **0.2186**, min 0.0584, max 0.8320, 171/171 below 1×, writes chart |
| `bash research/reproduce/cross_check.sh` (all three) | ✅ **PASS** — JS / Python / C all agree (avg 0.218605, min 0.058357, max 0.831961), VERDICT: ALL THREE AGREE |
| `gcc -O2 -o reproduce_sccr reproduce_sccr.c -lm` (C from source) | ✅ **PASS** — compiles clean on macOS, produces 0.2186 |
| Python 3.9 (system, no pip installs needed) | ✅ works (stdlib only for compute; chart skips gracefully if matplotlib absent) |
| Input data (171 entries, heights 960562→960732) | ✅ committed + versioned in `input/fee_history_capture.json`; `reproduce.py` **defaults to it** (no DB needed) |
| Node (JS impl) | ✅ works from clone |
| **Definitive re-test (post-push, 2026-08-03):** fresh clone of the **live GitHub repo** (`59573b0`), one-command path + `cross_check.sh`, then `git status` | ✅ **PASS** — 0.2186, all three agree, working tree **completely clean** after all runs (deterministic, zero dirty state) |

### Gaps found and fixed by the simulation (all fixed, all committed)

1. **❌→✅ C binary missing in clones.** `cross_check.sh` step 3/3 called
   `./research/reproduce/reproduce_sccr`, but the binary is gitignored — a
   stranger following "Run all three" hit `No such file or directory` and the
   script failed (exit 1). **Fix:** `cross_check.sh` now auto-compiles the C
   source when the binary is absent (with a clear message + fallback gcc
   command).
2. **❌→✅ Scary sqlite errors in JS step.** `storage-ratio.js` in frozen-input
   mode still tried DB queries (`no such table: block_stats / research_findings`
   printed to stderr) and overwrote the committed dated report file in the
   clone. **Fix:** `SCCR_INPUT_FILE` mode is now fully DB-free and
   side-effect-free — no sqlite queries, no research_findings insert, no report
   file written; output explicitly says "frozen-input reproduction — no report
   written". Canonical live-DB behavior unchanged when env var absent.
3. **❌→✅ Heights not sorted (contiguous-set but unordered).** A stranger
   checking `heights == list(range(960562, 960733))` would get `False` even
   though all 171 heights were present. **Fix:** `input/fee_history_capture.json`
   normalized to ascending height order — order-invariant computation (verified:
   all three implementations still produce identical avg/min/max, and per-block
   values unchanged), so this is a pure determinism improvement. Reference
   outputs (`output/reproduce_sccr_python.json`, `sccr_chart.png`) regenerated.

## 📦 Shareable package (for the human step)

- **Repo (the whole package):** `https://github.com/prateekposwal/block-space-economics`
  (public; live at bitcoinsahi.com)
- **Protocol:** `research/reproduce/README.md` → *External reproduction protocol (3 steps)*
- **Input:** `research/reproduce/input/fee_history_capture.json` (155 entries, committed)
- **Expected output:** avg **0.2406**, min **0.0490**, max **1.0757**, 153/155 below 1× (98.7%)
- **Recruit message (copy-paste ready):** `research/reproduce/recruit-message.md`

## ⏳ The one remaining human step (requires Prateek)

External reproduction is **Prateek's task**: an *uninvolved* person must run the
3-step protocol. TELOS cannot recruit a real human, and autonomous posting is
blocked on two gates:

1. **arXiv is NOT yet live** (`TODO-bitcoin-oracle.md` R5: arXiv/Optech not
   submitted; awaiting Prateek's arXiv account/ORCID/license). The community
   review plan's outreach list is explicitly sequenced *after* the preprint
   URL exists, so those venues (Optech, Delving, bitcoin-dev, Chaincode,
   r/BitcoinEngineering) are not ready.
2. **The Nostr publisher uses Prateek's key** (`captured-data/nostr-key.json`,
   gitignored). Posting through `tools/marketing/publisher.js` would use his
   account — **not** something TELOS does without his explicit say-so.

**What Prateek does (≈5 min):** open `research/reproduce/recruit-message.md`,
copy the message into an email/DM to one person (friend, colleague, any
technically-literate non-crypto person), and send. Then record the result
below.

## Result table (ready to fill)

| Reproducer | Environment | Result | Notes |
|---|---|---|---|
| **You (Prateek)** | macOS (darwin); Python 3.9 + Node + gcc | **0.2406** (Reference) | Reference run — the published numbers (avg 0.2406, min 0.0490, max 1.0757, 153/155 below 1×); confirmed by clean-clone verification 2026-09-16 |
| External #1 | *(pending)* | *(pending)* | |
| External #2 | *(pending)* | *(pending)* | |
| External #3 | *(pending)* | *(pending)* | |

## Outcome categories — three, not two

An external run is recorded under exactly one of three outcomes. Never collapse
the middle one into either neighbor — **"reproduced the number but disagrees
with the framing" is not a failed reproduction**; it is honest scientific
disagreement about documented assumptions (working-paper §7.1).

| Outcome | What it means | Effect on the D5 milestone | Where it is recorded |
|---|---|---|---|
| ✅ **Reproduced** | Number matches from a clean clone (avg 0.2406, min 0.0490, max 1.0757, 153/155 below 1×) | **Milestone MET** — GO/SUBMIT trigger fires | Detail row below (Verdict = Reproduced) |
| 🟡 **Reproduced number, disagrees with framing** | Number matches, but the reproducer challenges a documented assumption (C = $925/yr bundling, T = 10 horizon, storage-as-first-resource, externality reading) | **Milestone MET** — the number was reproduced; the disagreement is feedback, not failure | Detail row below (Verdict = "Reproduced + framing objection") **and** logged in the community-feedback triage (`research/community-review-plan.md` §4 → `research/community-feedback.md`) |
| ❌ **Failed to reproduce** | Materially different number from a clean clone (different avg/band or per-block mismatch), not reconciled | **Milestone NOT met** — submission BLOCKED until reconciled | Detail row below (Verdict = Failed); investigated as falsifier 1 of working-paper §7.1 |

**Recording rule:** the number reproduced correctly = milestone met even if the
reproducer challenges assumptions; the disagreement goes to community feedback,
never into the Fail column.

## Phrasing rule

Use **"Independently reproduced by external participants following the published
reproduction protocol"** — **NOT** "externally verified."

## When a result lands, also record the detail row here:

| Date | Reproducer | Language/Env | Avg SCCR | Min | Max | Below 1× | Per-block max dev | Verdict (Reproduced / Reproduced + framing objection / Failed) |
|---|---|---|---|---|---|---|---|---|
| *(pending)* | | | | | | | | |

## ✅ GO / SUBMIT TRIGGER — "reproducibility milestone achieved" (advisor rule)

> **Milestone achieved** when any external participant replies with the equivalent
> of: **"I cloned it, ran one command, and got 0.2406"** — i.e., an uninvolved human
> independently confirms the published numbers from a clean clone, following the
> published protocol.
>
> **→ milestone achieved → stop polishing → submit.**
>
> **The trigger fires on reproduction of the number — regardless of framing
> objections.** A reproducer who confirms the numbers but disputes a documented
> assumption (C bundling, T = 10, storage-first, externality reading) has still met
> the milestone: record the objection in the community-feedback triage
> (`research/community-review-plan.md` §4 → `research/community-feedback.md`) and
> fold it into the next revision — it does not block submission. Conversely, a
> reproducer who **cannot** reproduce the number (materially different result from
> a clean clone, not reconciled) **blocks submission** until the discrepancy is
> reconciled; that is falsifier 1 of working-paper §7.1.
>
> Until a reproduction-of-the-number reply lands, the submission gate stays
> closed. When it lands: record the reply (quote + date + reproducer, anonymous
> ok) in this log, then submit.

**Recruit assets (2026-08-03):** copy-paste message `recruit-message.md` ·
personalized variants `recruit-message-personalized.md` · verified contact list
`external-reproducer-contacts.md` (8 verified channels; no fabricated emails).

---

*Bitcoin Sahi Research — external reproduction log (working-paper v2.1.0,
model-spec v2.0.1). Simulation + fixes 2026-08-03.*
