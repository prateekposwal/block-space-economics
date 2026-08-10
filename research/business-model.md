# Bitcoin Sahi — Business Model Statement (one page)

**Status:** ACTIVE PLAN (2026-08-11) · **Purpose:** answer the investor's first
question — what are you selling, to whom, and what is the raise for?
**Companion:** `TODO-bitcoin-oracle.md` Phase R4 (the operational plan this states).

---

## The one-sentence pitch

> We measure what Bitcoin's fee market doesn't price — the permanent storage cost
> every transaction creates — and we sell that measurement, today as a data
> product, tomorrow as a licensed index.

## The lane (decided 2026-08-11)

**Primary: data/API business.** Wedge product = the embeddable "Should I send
now?" widget + API for wallets and exchanges. Phase 2 = the SCCR as a licensed
index (Fear & Greed, but for block-space economics). Phase 3 = risk-pricing
(storage-burden insurance) — conversations only, not yet product.

## What we're selling (built already)

| Product | Customer | Price (R4 plan) | Status |
|---|---|---|---|
| **"Should I send now?" widget + API** | Wallets (BlueWallet, Sparrow), exchanges | Freemium → Developer $50/mo | ~80% built (`live.html` verdict + `embed.html` skeleton) |
| **Enterprise data API** | Exchanges, custodians, L2s | $500/mo | Real-time, webhooks |
| **SCCR licensed index** | Media, funds, researchers | Feed licensing | Needs D5 + 90-day clean trendline |
| **"State of Block Space" annual report** | Institutions | $500/copy | After index |

## Who pays (and why)

- **Wallets/exchanges** pay to tell users *when to transact* — the widget saves
  them fee dollars and is embeddable in one line.
- **Media/funds** pay to cite a reproducible block-space index the way they cite
  Fear & Greed — credibility through a published methodology.
- **Insurers/miners** (phase 3) pay for a standing flood-attack / storage-burden
  risk monitor — a novel product nobody else offers.

## Why it's defensible

- **The data is live and growing**: 20+ endpoints, 26 sources, 10,000+ captures,
  a self-hosted Bitcoin Core node (resilience moat).
- **The methodology is public and reproducible**: three independent
  implementations agree; the reproduction kit is open; a correction is published
  openly. This is the moat — competitors can copy the data, not the trust.
- **The index has a niche**: "storage cost coverage" is unowned, unlike price or
  fee indices.

## The ask

**Pre-seed round** to turn a live research platform into the standard data layer
for Bitcoin's resource economics. First revenue from the widget/API inside
**90 days**. Target: **$50K–$150K/yr by month 12** (R4 plan).

## Dependencies (honest)

- **D5 external reproduction** — one outside name confirming the methodology is
  the highest-leverage credibility unlock (and the publication gate).
- **90-day clean SCCR daily series** — the trendline the index needs (the
  sccr-tracker daemon is already installed; it's time that accumulates).
- **Widget productization** — extract the verdict logic into an iframe/API
  (~1 week).

---

*Bitcoin Sahi Research — business model statement, 2026-08-11. Supersedes the
internal-only R4 plan by stating it for external/investor use.*
