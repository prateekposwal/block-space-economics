# Bitcoin Resource Accounting — Block Space Research

> BitcoinSahi is a Bitcoin 'stress & boundary observatory' that measures what Bitcoin costs to operate, verify, secure and coordinate — and studies when increasing resource costs or concentration of power can push the system toward a measurable boundary.

**Core loop:** Bitcoin activity → resource burden → economic cost → power concentration → verification/coordination → network stress → boundary

**Single thesis:** "BitcoinSahi studies the relationship between Bitcoin's resource burden, economic incentives, verification accessibility, concentration of power, and consensus resilience — using live measurements and historical events to identify and test the boundaries of the system."

**Single question:** "How much stress can Bitcoin absorb before the cost of participating, verifying, producing, or coordinating becomes meaningfully asymmetric?"

**Research frame:** boundary-class definitions, the data-confidence matrix, and the arrow → instrument map live in [THESIS.md](THESIS.md). README is the engineering entry point; THESIS.md is the research frame.



**The research program of [Bitcoin Sahi](https://bitcoinsahi.com)** — a complete
accounting system for every long-lived resource consumed by Bitcoin, quantifying
how much of each cost the fee market internalizes. **SCCR (Storage Cost Coverage
Ratio) is Metric #1** — the first measured member of the RIR family.

**Why this exists:** [WHY_THIS_EXISTS.md](WHY_THIS_EXISTS.md) — one page,
plain language, no equations. (If you read only one thing, read that.)

**Paper 1:** [Storage Cost Internalization in Bitcoin's Fee Market — Working Paper v2.2.0](research/working-paper.md)
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

**Beyond the base layer (wrapper/bridge workstream).** The same accounting applied
to *bridged* BTC: a bridge is two ledgers pretending to be one asset, so the detector
is the ratio between measured BTC custody and token supply. It catches both failure
families — a custody drain (Liquid) and an unbacked mint (Symbiosis) — and is
deliberately **silent** when it cannot see the whole reserve, because a partial
reserve fakes exactly the shortfall it exists to detect
([bridge-reserve-monitor](research/bridge-reserve-monitor.md)). The complementary
audit establishes the *Bitcoin-leg* ground truth for off-chain incidents
([base-layer-not-compromised](research/base-layer-not-compromised.md)).

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
| Replication factor | N | nodes | 26,586 | **measured reachable nodes** (btcnodes crawl, 2026-09-16 — a lower bound; was 32,000 pre-re-base) |
| Storage horizon | T | yr | 10 | assumption (archival retention) |
| Avg block size | B_block | bytes | 1,500,000 | captured data |

The single canonical source of every constant is
[`research/model-spec.json`](research/model-spec.json) (v2.1.1). **No script
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

## Results

**Current reading** (2026-09-23, 137 blocks, model-spec v2.1.1): SCCR **0.4307**,
94.89% of blocks below 1×. Read it live from `data/sccr.json` — **never hardcode it.**

**Frozen snapshot** (2026-09-16, 155 blocks) — the dated capture the paper uses:

| Metric | Value |
|---|---|
| Avg SCCR (dimensionless) | **0.2896** |
| Min / Max | 0.0590 / 1.2948 |
| Blocks below 1× | **98.1%** (152/155) |
| L_net | $4,675.65 / block |

**What the ratio does and does not say:** SCCR is a coverage ratio for a *ten-year*
commitment (`L_net = N·C·T`) evaluated on *one* fee reading. At the current reading
that is ~30% of the modelled commitment — i.e. **fees fund roughly the first 3 of
the 10 modelled years, and node operators carry the rest.** It is not a solvency
verdict ("Bitcoin is 57% underfunded" is an over-read). Full reasoning, including a
horizon trap in the cost table, in
[fees-fund-three-of-ten-years](research/fees-fund-three-of-ten-years.md).

The ratio is a **banded, dated estimate that moves with the fee market**:
~0.29 across captures at the measured N=26,586, with ~98% of sampled
blocks below 1×. It is homogeneous in its drivers —
`SCCR ∝ (fee × price) / (C × T × N)` — and the knife-edge thresholds (computed at the
pre-re-base N=32,000 baseline: avg inverts at N≈7.1K / BTC≈$283K; the 100%-below-1× claim
breaks at N≈49K on the dated capture) are in
[working-paper §5.4](research/working-paper.md). **Never hardcode the ratio** —
read it from `research/model-spec.json` or run the tool.

## Limitations (honest, in the paper)

1. **N=26,586 is a lower bound** — it counts reachable (listening) nodes; the
   total including non-listening nodes is unknown. Independent estimates span ~10K–100K.
2. **T=10 yr is an assumption** — pruning shortens actual retention. The
   pruned-vs-archival split is now **measured on the reachable crawl**:
   `NODE_NETWORK` 4,356 vs `NODE_NETWORK_LIMITED` 1,040 (80.7% / 19.3%, see
   `data/node_crawl.json`), and inbound peers now give a service-bit sample of the
   population a crawler cannot see (`data/inbound_census.json` →
   `inbound_service_bits`). The *unreachable majority's* archival rate is still
   unknown, which is why N remains a floor.
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
                     reviewer-simulation.md, reproduce/ (kit), publication-plan.md,
                     plus the method notes: node-relay-participation,
                     verification-population, fees-fund-three-of-ten-years,
                     bridge-reserve-monitor, base-layer-not-compromised
tools/research/      storage-ratio.js (canonical SCCR), reproduce.py (1-command),
                     derive-model.js (spec verifier), runner.js,
                     bridge_reserves.py (bridge backing-ratio watchtower),
                     base_layer_audit.py (off-chain-incident Bitcoin-leg audit),
                     fee_allocation.py, inbound_census.py, node_crawler.py
tools/netfetch.py    shared bounded fetch — its deadline covers DNS too, which
                     urllib's timeout does not (a stalled resolver wedged a
                     collector job for 2,943s past its 300s limit)
tools/data-engineering/  capture → validate → spool → mirror pipeline
tools/agents/        agent-19 (web snapshot), agent-25 (node census),
                     29-local-collectors.js (the local scheduler), …
tools/rebuild_articles_itemlist.py  regenerate the articles Blog ItemList from the DOM
data/*.json          public snapshot for the static site (incl. sccr_latest.json,
                     sccr_history.json — serve as /sccr/latest, /sccr/history,
                     bridge_reserves.json + bridge_alerts.json for the watchtower)
```

**Alert path:** two alert sources merge into one outbound channel —
`tools/alerts.json` (ops-health, single writer) and `data/bridge_alerts.json` (the
bridge watchtower) are both read by `tools/webhook_sender.py`, which POSTs to the
configured webhook. `tools/validate_data_json.py` is the one canonical gate every
data-committing path calls (JSON parse + conflict markers).

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
| Collectors | `com.bsahi.collectors.plist` | 15 min | the local research scheduler — runs each due instrument, one per cycle |
| Snapshot | `com.bsahi.snapshot.plist` | 30 min | write rich `data/*.json` + commit/push |
| Block watch | `com.bsahi.blockwatch.plist` | continuous | first-party block-relay capture |
| Node crawl | `com.bsahi.nodecrawl.plist` | periodic | first-party reachable-node census |
| Dataset snapshot | `com.bsahi.dataset-snapshot.plist` | periodic | dated, hashed population snapshot |
| RT64 tunnel | `com.bsahi.rt64.plist` | watch | Route64 WireGuard tunnel for inbound reachability |
| Relay | `com.bsahi.relay.plist` | watch | IPv4 relay control plane (inert until configured) |
| Tor | `com.bsahi.tor.plist` | continuous | onion service |
| Site health | `com.bsahi.site-health.plist` | hourly | route/latency checks |
| Ops health | `com.bsahi.ops-health.plist` | hourly | agent/capture health → alerts |
| SCCR tracker | `com.bsahi.sccr-tracker.plist` | daily | automated SCCR time-series (disabled by design: the cloud tier owns it) |

Install: `cp com.bsahi.*.plist ~/Library/LaunchAgents/ && launchctl load ~/Library/LaunchAgents/<name>.plist`

### GitHub Actions

- `data-snapshot.yml` — every 30 min; regenerates `data/` from committed rich
  history. Uses the workflow `GITHUB_TOKEN` (contents: write); main has no branch
  protection/rulesets, so no PAT is needed (SNAPSHOT_PAT dropped 2026-08-30).
- `capture-data.yml`, `lighthouse.yml`, `research-monitor.yml`
- `deploy-relay.yml` — **workflow_dispatch only**; adopts/provisions the IPv4
  relay and checks external reachability. Does not touch Core or SCCR.

## Key data contract

All surfaces read SCCR from `research/model-spec.json` (v2.1.1, canonical) and the
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
