# Bitcoin Resource Accounting — Block Space Research

**The research program of [Bitcoin Sahi](https://bitcoinsahi.com)** — a complete
accounting system for every long-lived resource consumed by Bitcoin, quantifying
how much of each cost the fee market internalizes. **SCCR (Storage Cost Coverage
Ratio) is Metric #1** — the first measured member of the RIR family.

**Why this exists:** [WHY_THIS_EXISTS.md](WHY_THIS_EXISTS.md) — one page,
plain language, no equations. (If you read only one thing, read that.)

**Paper 1:** [Storage Cost Internalization in Bitcoin's Fee Market — Working Paper v2.1.0](research/working-paper.md)
*(program subtitle: The Bitcoin Block Space Problem — the paper keeps its
descriptive title; the program name is Bitcoin Resource Accounting, adopted
2026-08-02. Roadmap: [research/roadmap.md](research/roadmap.md).)*

**Research focus:** the **Bitcoin Resource Accounting** framework — every
long-lived resource Bitcoin consumes (replicated storage, UTXO state, validation,
relay, bandwidth, indexer serving) has a measurable cost, and the single fee
price may not internalize all of it. Each resource gets its own measured ratio
(SCCR / UCIR / VCIR / RCIR / BCIR / DCIR — see
[working-paper §11 Q3](research/working-paper.md)). The framework is the
identity; each ratio is an implementation; the storage paper is one chapter.
SCCR — whether the fee market internalizes the long-term storage cost of
permanently recorded blockchain data, measured as the **Storage Cost Coverage
Ratio** — is **Metric #1**, established and reproduced.
v1 (priority oracle) and v2 (externality fee) are dead; this is the research-first
successor.

© 2026 Prateek Poswal. Code licensed under the MIT License (see `LICENSE`);
research text licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).

---



> Can we build a complete accounting system for every long-lived resource consumed
> by Bitcoin, and quantify how much of each cost is internalized by the fee
> market? — starting with storage: **does the fee market internalize long-term
> storage costs?**

This is a *measurement* question, not a policy claim. The paper measures; it does
not propose a fix, does not claim the externality is economically significant at
current volumes, and does not argue Bitcoin is "broken" (see
[working-paper §2](research/working-paper.md)). The framework generalizes to any
one-time-payment → long-lived-shared-resource system (cross-chain, Phase V —
[roadmap §9](research/roadmap.md)).

## The model (one equation)

    SCCR = fee_USD / L_net
    L_net = C × T × N × (B_block / B_all_yr)          (per block, USD)

| Quantity | Symbol | Units | Value | Source |
|---|---|---|---|---|
| Annual node cost | C | USD/yr | 925 | component sum (see model-spec) |
| Replication factor | N | nodes | 32,000 | **primary-source census** (agent-25, `getnodeaddresses`, ≥32K — a lower bound) |
| Storage horizon | T | yr | 10 | assumption (archival retention) |
| Avg block size | B_block | bytes | 1,500,000 | captured data |

The single canonical source of every constant is
[`research/model-spec.json`](research/model-spec.json) (v2.0.1). **No script
redefines a model constant.** The full derivation, the 10× time-horizon
correction, and the 16.4× model reconciliation are documented in the
[working paper §6](research/working-paper.md) and
[verification appendix](research/verification_appendix.md).

## The data

Live-captured 24/7 from 17 public Bitcoin endpoints (mempool.space, blockstream,
blockchair, …) into `captured-data/bsahi.db` and mirrored to `data/*.json`.
The SCCR uses the `fee_history` capture: per-block `avgFees` (sats) × `USD` price.
A frozen copy of the exact capture used in the paper ships in
[`research/reproduce/input/`](research/reproduce/input/) so the number can be
reproduced without any live infrastructure.

## Reproduce in 30 seconds

One command — reads the fee data, runs the model, prints the SCCR, writes the
main figure (`research/reproduce/output/sccr_chart.png`):

```bash
python3 tools/research/reproduce.py
```

That's it. Uses the frozen capture (deterministic, no DB needed). For the live
number straight from the database:

```bash
python3 tools/research/reproduce.py --live
```

The SCCR is also reproduced in **three independent implementations** — JS
(`tools/research/storage-ratio.js`, canonical), Python
(`research/reproduce/reproduce_sccr.py`), and standalone C
(`research/reproduce/reproduce_sccr.c`, `gcc -O2 -o reproduce_sccr reproduce_sccr.c -lm`)
— and a cross-check script asserts per-block agreement across all three
(it auto-compiles the C binary from source, which is gitignored):

```bash
bash research/reproduce/cross_check.sh     # prints all three + VERDICT
```

**External reproduction** (someone uninvolved, per the paper's reproducibility
claim): the 3-step protocol is in
[`research/reproduce/README.md`](research/reproduce/README.md).

## Results (as of the 2026-08-02 capture, 171 blocks, model-spec v2.0.1)

| Metric | Value |
|---|---|
| Avg SCCR (dimensionless) | **0.2186** |
| Min / Max | 0.0584 / 0.8320 |
| Blocks below 1× | **100.0%** |
| L_net | $5,627.80 / block |

The ratio is a **banded, dated estimate that moves with the fee market**:
~0.22–0.29 across captures at the real N=32K census, with ~99–100% of sampled
blocks below 1×. It is homogeneous in its drivers —
`SCCR ∝ (fee × price) / (C × T × N)` — and the knife-edge thresholds (avg
inverts at N≈7.1K / BTC≈$283K on the live baseline; the 100%-below-1× claim
breaks at N≈49K on the dated capture) are in
[working-paper §5.4](research/working-paper.md). **Never hardcode the ratio** —
read it from `research/model-spec.json` or run the tool.

## Limitations (honest, in the paper)

1. **N=32K is a lower bound** — the addrman caps at 32,000 addresses; the true
   reachable set is ≥32K. Independent estimates span ~10K–100K.
2. **T=10 yr is an assumption** — pruning shortens actual retention; the
   pruned-vs-archival split is *not yet measured* (data gap named in
   [`research/archival-vs-pruned-note.md`](research/archival-vs-pruned-note.md)).
3. **No discounting** — a one-time fee vs. an undiscounted 10-yr sum
   overstates the liability as commonly valued (r=5% → −27% PV).
4. **Node costs are homogeneous** in the model; marginal bandwidth-propagation
   cost is excluded (fixed-vs-marginal distinction, documented).
5. **Point-in-time measurement** — the time-series is live and growing (daily
   SCCR tracker); the paper reports dated snapshots by design.

The paper's own adversarial pre-submission review (4 reviewer identities) and
the literature audit (arXiv + Google Scholar, 2026-08-02) are in
[`research/reviewer-simulation.md`](research/reviewer-simulation.md) and
[`research/literature-audit.md`](research/literature-audit.md).

## Project structure

```
research/            working-paper.md, model-spec.json, literature-audit.md,
                     reviewer-simulation.md, reproduce/ (kit), publication-plan.md
tools/research/      storage-ratio.js (canonical SCCR), reproduce.py (1-command),
                     derive-model.js (spec verifier), runner.js
tools/data-engineering/  capture → validate → spool → mirror pipeline
tools/agents/        agent-19 (web snapshot), agent-25 (node census), …
data/*.json          public snapshot for the static site (incl. sccr_latest.json,
                     sccr_history.json — serve as /sccr/latest, /sccr/history)
```

## Quick start (everything else)

```bash
# Live SCCR measurement (the canonical headline number)
node tools/research/storage-ratio.js

# Derive/verify the model spec (checks L_net etc. recompute correctly)
node tools/research/derive-model.js

# Validation suite (HTML/JS syntax, exports, guards)
node tools/validate.js

# Data-engineering test suites (schema envelope, spool, capture-agent)
node tools/data-engineering/test-envelope.js
node tools/data-engineering/test-spool.js
node tools/data-engineering/test-capture-agent.js
node tools/data-engineering/test-bridge.js
```

## Architecture (as built 2026-08-02)

```
Public APIs (mempool.space, blockstream, blockchair, coinpaprika, alternative.me)
   │  17 endpoints, concurrency=4, per-endpoint timeoutMs/maxLatency, Happy Eyeballs,
   │  fallbacks on the core fees/price/mempool series
   ▼
Data-engine agents (tools/data-engineering/) — capture → validate (schemas/) → spool → mirror
   │
   ├─ captured-data/spool/  (indexed history: fees, mempool, blocks…)
   ├─ captured-data/btc-rpc/ (local Bitcoin Core node, syncing — see decisions)
   └─ data/*.json           (rich public snapshot written by tools/agents/19-web-snapshot-agent.js)
   │
   ▼
Deployment: GitHub Pages (live) + local launchd agents + GH Actions fallback
```

### launchd agents (macOS)

| Agent | plist | Schedule | Purpose |
|---|---|---|---|
| Data engine | `com.bsahi.de-server.plist` | continuous | capture/validate/spool loop |
| Snapshot | `com.bsahi.snapshot.plist` | 30 min | write rich `data/*.json` + commit/push |
| Site health | `com.bsahi.site-health.plist` | hourly | route/latency checks |
| Ops health | `com.bsahi.ops-health.plist` | hourly | agent/capture health |
| Engagement | `com.bsahi.engagement.plist` | continuous | community/content pipeline |
| SCCR tracker | `com.bsahi.sccr-tracker.plist` | daily | automated SCCR time-series |

Install: `cp com.bsahi.*.plist ~/Library/LaunchAgents/ && launchctl load ~/Library/LaunchAgents/<name>.plist`

### GitHub Actions

- `data-snapshot.yml` — every 30 min; regenerates `data/` from committed rich
  history. Uses the workflow `GITHUB_TOKEN` (contents: write); main has no branch
  protection/rulesets, so no PAT is needed (SNAPSHOT_PAT dropped 2026-08-30).
- `capture-data.yml`, `lighthouse.yml`, `research-monitor.yml`

## Key data contract

All surfaces read SCCR from `research/model-spec.json` (v2.0.1, canonical) and the
live value from `node tools/research/storage-ratio.js` or
`python3 tools/research/reproduce.py --live`. **Never hardcode the ratio.**
Historical figures (1.49% v1.0.0, ~17% v2.0.0 @N=60K, ~29% working-paper dated
snapshot) are documented provenance — superseded by the canonical live measurement.

## Known open issues

See `docs/known-issues.md`.

## Reproducibility (engineering)

- Env secrets live in `.env` / `credentials*` (git-ignored): BTC RPC creds,
  Nostr keys.
- Dead external sources are documented in `tools/data-engineering/config.js`
  (`deadSources`) — never re-add them.
- Full runbook: see AGENTS.md session handoffs (DONE/LEFT discipline).
