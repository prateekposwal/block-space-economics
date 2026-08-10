# SCCR Index — Licensing & Press Pitch (phase 2)

**Status:** PLAN (2026-08-11) · **Product:** the SCCR as a licensed index —
Fear & Greed, but for Bitcoin's block-space storage economics.
**Companion:** `research/business-model.md`, `research/sccr-trend-note.md`,
`research/working-paper.md`.

---

## The product

A daily, reproducible index of the **Storage Cost Coverage Ratio (SCCR)** — the
share of modeled 10-year storage cost that transaction fees cover. Quoted like
Fear & Greed or a Glassnode metric, but for an unowned niche: **the economics of
permanent blockchain data.**

**What it looks like on a ticker:**
> SCCR today: **0.238** (fees cover ~24% of modeled storage cost)
> 7-day trend: falling · 90-day series: [clean daily points]
> Status: **fee market cooling → unpriced storage externality growing**

## Why it's licensable (the moat)

| Asset | What BSAHI has |
|---|---|
| **Methodology** | Published, versioned, falsifiable (`model-spec.json`, working paper) |
| **Reproducibility** | 3 independent implementations agree to the last decimal; public reproduction kit |
| **Live data** | 20+ endpoints, 26 sources, 10,000+ captures, self-hosted Core node |
| **History** | Daily UTC-dated series accumulating (sccr-tracker daemon, now corrected) |
| **Integrity** | The 10× correction is published openly — the audit is a feature |

## The 90-day path to a quotable index

| Milestone | Gate | Status |
|---|---|---|
| **Clean daily series** | sccr-tracker appends one UTC entry/day, no gaps | ✅ daemon corrected; 4 points now, gap Aug 5-9 was pre-fix |
| **D5 external reproduction** | One outside name confirms the methodology | ⏳ recruit message ready (the one human step) |
| **90 contiguous points** | ~90 days of daily entries | ⏳ time (target ~early Nov 2026) |
| **Press citation** | Pitch the trend + BIP-110 hook to crypto media NOW (news peg is live) | 🔸 can start before 90 days |
| **Index licensing** | Media/funds subscribe to the feed | 🔸 after press citation + D5 |

## The press angle (now, not after 90 days)

The **BIP-110 governance tracker** is a live news peg *this week*. Pitch:
- "A live tracker of who controls Bitcoin's rules — BIP-110 mandatory signaling,
  recorded hourly" → distribution/credibility play (not monetized, but free
  press + inbound interest)
- "The storage cost nobody prices — first daily index" → the methodology story

## Licensing tiers (once the series + D5 land)

| Tier | Customer | Price |
|---|---|---|
| **Media citation** | Crypto press (The Block, CoinDesk) | Free for attribution (distribution) |
| **Feed license** | Funds, researchers | $X/mo for the daily series + methodology |
| **Enterprise** | Exchanges, insurers | SLA feed + flood-burden risk monitor |

## What I need to execute this (honest)

1. **The D5 recruit message sent** (external co-signer — the single highest-leverage credibility unlock; everything below compounds on it)
2. **Time** for the 90-day clean series (the daemon now accumulates it automatically)
3. **One press pitch** once D5 lands — the BIP-110 peg is the entry point

---

*Bitcoin Sahi Research — SCCR index licensing + press plan, 2026-08-11. The
90-day series is now auto-accumulating; the gate is D5 + time.*
