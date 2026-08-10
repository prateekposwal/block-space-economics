# BSAHI — "Should I Send Now?" Widget (product)

**Status:** LIVE (2026-08-11) · **Product:** the freemium wedge of the data/API business
**Widget URL:** `https://bitcoinsahi.com/widget-send.html`
**Data API:** `https://bitcoinsahi.com/tools/live_data.json` (public, refresh every 60s)

---

## What it is

A self-contained, iframe-embeddable widget that tells a user **whether to send
Bitcoin now** — based on live mempool conditions from our Bitcoin Core node.
It computes a fee-weather verdict (Sunny → Storm) and shows the cost of a
typical transaction.

## Embed it (one line)

```html
<iframe src="https://bitcoinsahi.com/widget-send.html"
        width="360" height="280" style="border:1px solid #30363D;border-radius:12px"
        loading="lazy" title="Should I send Bitcoin now? — BSAHI"></iframe>
```

Dark theme by default; auto-refreshes every 60s; no dependencies.

## The data API (freemium — free today)

`GET https://bitcoinsahi.com/tools/live_data.json`

```json
{
  "timestamp": "...",
  "fees": { "fastestFee": 3, "halfHourFee": 3, "hourFee": 1, "economyFee": 1 },
  "btc_price": 64827.66,
  "mempool": { "...": "..." },
  "block_height": 962000,
  "bip110_signaling": { "...": "..." },
  "utxo_set": { "...": "..." }
}
```

Free tier: the current snapshot, refreshed hourly.
Developer tier ($50/mo, planned): history, projections, custom verdict rules.
Enterprise tier ($500/mo, planned): real-time webhooks, dedicated support.

## Why wallets/exchanges want it

- **Tells users *when* to transact** — saves them fee dollars, which is the
  #1 UX ask of any wallet.
- **One-line embed** — no SDK, no auth on the free tier.
- **Data is real**: from a self-hosted Bitcoin Core node + mempool.space, not a
  scraped feed. 20+ endpoints, 26 sources, 10,000+ captures.
- **Whitelabel-ready**: the verdict logic is pure CSS/JS — recolor to any brand.

## Freemium → paid path

| Tier | Price | What you get |
|---|---|---|
| Free (public) | $0 | Live widget + current data snapshot |
| Developer | $50/mo | History, projections, custom verdict thresholds, API key |
| Enterprise | $500/mo | Real-time webhooks, SLA, dedicated support, white-label |

## Next (productization follow-ups)
- [x] Widget page live + verdict logic extracted from live.html
- [ ] Iframe embed docs on the site (learn.html or a /developers page)
- [ ] API key auth for the developer tier (when paid tier launches)

---

*Bitcoin Sahi Research — widget product doc, 2026-08-11. Part of the data/API
business model (see research/business-model.md).*
