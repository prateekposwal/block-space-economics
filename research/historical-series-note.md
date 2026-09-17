# Historical Series Extension: Difficulty + Mempool Congestion

<!-- seo-title: Bitcoin Difficulty & Mempool Congestion, 2009-2026 -->

**BSAHI — row 10 (mining hashrate level, historical A), row 3 (mempool pressure, historical B\*)**
*Produced: 2026-09-16 · Instrument: `tools/research/historical_series_extension.py`*

## What was frozen

Two primary series from the blockchain.info charts family (same deterministic
capture path as the existing frozen daily aggregates under
`captured-data/historical/blockchain.info/`):

| Series | Coverage | Points | Data file |
|---|---|---|---|
| **Difficulty** | 2009-01-03 → 2026-09-13 | 1,614 | `data/difficulty_series.json` |
| **Mempool count** (pending txs) | 2016-06-14 → 2026 (daily, ~4-day cadence) | 1,498 | `data/mempool_congestion_series.json` |
| **Mempool size** (bytes pending) | 2016-06-14 → 2026 | 1,498 | `data/mempool_congestion_series.json` |

Difficulty latest reading: **127,450,789,715,844** (2026-09-13).

## Grade impact

- **Row 10 (mining hashrate):** historical B → **A**. Difficulty and the frozen
  hash-rate TH/s series both now cover 2009→2026 from primary sources; the two
  sides (target vs effort) cross-check each other.
- **Row 3 (mempool pressure):** historical B → **B\***. The 2016-2026 congestion
  record is now a primary frozen series with per-era reads. Pre-2016-06 episodes
  remain reconstruction-only (the chart starts then).

## Congestion reads by era (2016-2026)

| Era | Mean pending txs | Peak | Peak date | Days >50k | Days >100k | Days >200k | Regime |
|---|---|---|---|---|---|---|---|
| 2016 | 6,995 | 63,352 | 2016-11-24 | 1.2% | 0% | 0% | LOW |
| 2017 | 35,533 | 173,688 | 2017-05-20 | 27.4% | 11.0% | 0% | MODERATE |
| 2018 | 9,116 | 87,880 | 2018-01-03 | 4.1% | 0% | 0% | LOW |
| 2019 | 10,794 | 60,198 | 2019-05-15 | 1.4% | 0% | 0% | LOW |
| 2020 | 19,173 | 131,691 | 2020-10-31 | 10.3% | 1.4% | 0% | MODERATE |
| 2021 | 23,815 | 128,533 | 2021-04-19 | 15.1% | 2.1% | 0% | MODERATE |
| 2022 | 5,763 | 46,318 | 2022-05-12 | 0% | 0% | 0% | LOW |
| **2023** | 101,147 | 283,139 | 2023-08-10 | **58.2%** | **47.3%** | **18.5%** | MODERATE |
| **2024** | 128,759 | 225,015 | 2024-10-11 | **96.6%** | **72.6%** | **6.8%** | MODERATE |
| 2025 | 18,324 | 158,384 | 2025-01-02 | 11.0% | 7.5% | 0% | MODERATE |
| 2026 | 13,880 | 96,917 | 2026-08-02 | 9.7% | 0% | 0% | LOW |

**Headline:** 2024 was the congestion peak (96.6% of days over 50K pending txs,
72.6% over 100K); 2023 the Ordinals year (58.2% over 50K, 18.5% over 200K,
peak 283,139); 2022 the empty year (0 days over 50K). Pending-mempool tx counts
stay well under the 2017-era backlogs' *share* of activity, but the *duration*
of sustained congestion in 2023-24 exceeded 2017.

Latest live read (2026-09-15): mempool count 34,687 pending txs, mempool size
~13.3 MB pending.

## Reproducibility

Deterministic: raw series frozen at `captured-data/historical/blockchain.info/
charts/{difficulty,mempool-count,mempool-size}.json`; the aggregate instrument
reads only the frozen files and writes `data/difficulty_series.json` +
`data/mempool_congestion_series.json`. Re-runnable offline after the freeze.