# Data Platform — Developer & Lightning Operator Guide

## What Data We Collect

| Data | Source | Updates | Format |
|------|--------|---------|--------|
| BTC price | blockchain.info | Daily | `live_data.json` → `btc_price` |
| Fee estimates (5 levels) | mempool.space | Daily | `live_data.json` → `fees` |
| Mempool size | mempool.space | Daily | `live_data.json` → `mempool.unconfirmed_tx` |
| Block height | blockstream.info | Daily | `live_data.json` → `block_height` |
| Hash rate | blockchain.info | Daily | `live_data.json` → `hash_rate` |
| Mining difficulty | blockchain.info | Daily | `live_data.json` → `difficulty` |
| 24h tx count | blockchain.info | Daily | `live_data.json` → `tx_count_24h` |
| Miner revenue (24h) | mempool.space | Daily | `live_data.json` → `miners_revenue_24h` |
| BIP-110 signaling | agent-26 (mempool.space version bits) | Hourly (every DE cycle) during mandatory window 961632-963647 | spool `bip110_signal` — one-time governance natural experiment |
| Fee history (14-day) | Our rolling storage | Daily | `fee_history.json` → array |
| Fee forecast | Linear regression on history | Daily | `fee_forecast.json` → forecast array |
| Alerts | Threshold checks | Daily | `alerts.json` → alerts array |

## REST API (All Data via Public JSON)

```
GET https://bitcoinsahi.com/tools/live_data.json     → Current snapshot
GET https://bitcoinsahi.com/tools/fee_history.json    → 14-day fee history
GET https://bitcoinsahi.com/tools/fee_forecast.json   → 3-day fee forecast
GET https://bitcoinsahi.com/tools/alerts.json         → Active alerts
```

No authentication required. Data updates daily via GitHub Actions.

## How to Use (by Persona)

### Lightning Node Operators
```python
# Estimate channel open cost
import requests, json

data = requests.get('https://bitcoinsahi.com/tools/live_data.json').json()
economy_fee = data['fees']['economyFee']  # sat/vB
channel_vbytes = 1000                     # typical channel open
cost_sats = economy_fee * channel_vbytes
cost_usd = cost_sats * data['btc_price'] / 100_000_000

print(f"Channel open: ~{cost_sats} sats (${cost_usd:.2f})")
```

### Developers
```javascript
// Embed live fee data in your app
const data = await fetch('https://bitcoinsahi.com/tools/live_data.json').then(r => r.json());
console.log(`Current fees: ${data.fees.fastestFee} sat/vB`);

// Or use the embeddable widget
// <iframe src="https://bitcoinsahi.com/embed" width="300" height="120">
```

### Researchers
```bash
# Run the full model locally
git clone https://github.com/prateekposwal/block-space-economics
cd block-space-economics
python3 research/utxo_cost_model.py        # single run
python3 research/monte_carlo.py            # 10K simulations
python3 research/sensitivity.py            # sensitivity chart
```

## What's Coming

| Feature | Status | Priority |
|---------|--------|----------|
| ✅ Live fee dashboard | Live | — |
| ✅ 14-day fee history | Live (growing daily) | — |
| ✅ Fee forecast (3-day) | Live | — |
| ✅ Alert system | Live | — |
| ✅ Embeddable widget | Live | — |
| ⬜ Webhook notifications | Not started | Low |
| ⬜ Push API (notify on threshold) | Not started | Medium |
| ⬜ GraphQL endpoint | Not started | Low |
| ⬜ Historical export (CSV) | Not started | Medium |
