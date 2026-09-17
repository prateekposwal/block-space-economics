<!-- seo-title: UTXO State: Observed, Reconstructed, and Current -->

# UTXO State Measurement — Observed vs Reconstructed

**Program:** Bitcoin Resource Accounting (BSAHI) · **Priority #1: UTXO/chain state**
**Instrument:** `tools/research/utxo_state_measure.py` (Bitcoin Core RPC)

---

## Why this note exists

The UTXO set is part of the real verification burden every full node carries. Until
now the project published an **era estimate table** (0.5 GB → 11 GB across
2013–2026) derived from anchors and interpolation — honest, but still a
reconstruction. This note separates three things that must not be mixed, and adds
the first **observed** measurements from a real Bitcoin Core node.

## The three layers (do not mix them)

| Layer | What it is | Source | Grade |
|---|---|---|---|
| **Observed** | `gettxoutsetinfo` from a real node, at a specific height | Bitcoin Core RPC | **A** (where measured) |
| **Reconstructed** | The 2013–2026 era estimate table used by the VCI | anchors + interpolation | **D** |
| **Current / live** | The newest observed row | latest measurement | **A** (dated) |

The reconstructed table is not wrong — it is *unverified*. The observed layer does
not replace it; it grades it where measurements exist, and it is the only layer
that can ever be cited as a measurement.

## The instrument

`tools/research/utxo_state_measure.py` reads RPC credentials from `bitcoin.conf`,
calls `getblockchaininfo` + `gettxoutsetinfo`, and appends one row per height to an
**append-only** store:

```
Bitcoin Core node (gettxoutsetinfo)
        ↓
data/utxo_state_series.jsonl     (append-only, one row per height; corrections are new rows)
data/utxo_state_latest.json      (most recent observed row)
data/utxo_state_series.json      (site-readable array + summary)
captured-data/utxo-state/        (raw RPC responses, for audit)
```

Each row records: `height`, `bestblock`, `utxo_count`, `total_amount_btc`,
`disk_size_bytes` (the node's own UTXO DB size), `chainstate_disk_bytes`,
`bogosize_bytes`, `utxo_hash` (muhash), `verificationprogress`,
`initialblockdownload`, and `measured_at`. It is idempotent by height, so it can be
run by hand, by cron, or by launchd without duplicating rows.

## First observed measurement

| Height | UTXOs | Total BTC | UTXO DB size | Node state |
|---|---|---|---|---|
| 671,462 | 72,234,156 | 18,633,940 | 4.39 GB | IBD (progress 0.41) |

This is a genuine `gettxoutsetinfo` result from a real node — the first
**observed** UTXO/state datum in the project. It is recorded at its height, not
presented as "current": the node was still in initial block download when it was
captured.

## The blocker (stated plainly)

The node cannot currently reach the chain tip: **the volume is out of disk**
(`No space left on device`, 604 MiB free), and Bitcoin Core shut down mid-sync
while flushing its chainstate. The last complete session had reached height
672,083 (2021-02-25). Reaching the tip — and therefore a *current* measurement —
requires free disk space for the chainstate (~4.4 GB at 2021, growing) plus the
pruned block store.

The pipeline is finished and proven; what it needs is disk.

## Reproduce / operate

```
python3 tools/research/utxo_state_measure.py            # measure now (skips a known height)
python3 tools/research/utxo_state_measure.py --force    # re-record the current height
python3 tools/research/utxo_state_measure.py --hash none # fastest (no muhash commitment)
```

To build the series automatically, run it on a timer (launchd/cron) while the node
is up; each run appends at most one row, and the series grows as the node advances.

## Roadmap

1. Free disk space; let the node reach the tip → first **current** measurement.
2. Capture daily at a fixed hour → a true observed **time series** whose growth is
   the state burden, measured rather than modeled.
3. Grade the reconstructed era table against observed rows as they accumulate, and
   narrow the D as evidence arrives.
4. Add regional/state-size detail (per-output-type) once the series is stable.

## Grades

- **Observed UTXO/state:** A (direct measurement; single row today).
- **Reconstructed era table:** D — unchanged, and now explicitly labelled as
  reconstruction rather than measurement.
- **Cross-check:** the VCI chain-size leg remains validated to 2.7% against
  blockchair's direct `blockchain_size` (see the reachability note).
