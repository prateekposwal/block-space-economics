#!/usr/bin/env python3
"""Self-hosted BTC/USD price index (build-ourselves: retire the single price API).

SCCR's fee leg needs a USD price. Depending on ONE exchange is a single point of
failure (and a single point of manipulation). This queries several independent
venues directly and publishes a robust reference rate — median with MAD-based
outlier rejection — plus full per-source provenance, so anyone can reproduce it.

This is the same shape as ORBI (volume-weighted median over a panel of exchanges)
and the LNbits price aggregator (per-exchange breakdown + min/median/max); we keep
it to a simple, auditable median because we do not have per-venue volume here.

NOT "no external dependency" — price is an off-chain fact and must come from
somewhere. It removes the SINGLE-SOURCE dependency: any one venue can fail or
print a bad tick and the reference rate is unaffected.

Writes data/price_index.json (+ captured-data/price/history.jsonl).
"""
import concurrent.futures as cf
import datetime
import json
import os
import statistics
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import sys
sys.path.insert(0, os.path.join(ROOT, "tools"))
from netfetch import bounded_get  # noqa: E402
OUT = os.path.join(ROOT, "data", "price_index.json")
CAP = os.path.join(ROOT, "captured-data", "price")
UA = {"User-Agent": "bitcoinsahi-research/1.0 (+https://bitcoinsahi.com)"}
MAD_K = 3.5           # drop sources further than k robust-sigmas from the median
MIN_SOURCES = 3       # refuse to publish below this many good venues


def _get(url, timeout=12):
    return bounded_get(url, timeout=timeout, json=True)   # deadline also covers DNS


def _coinbase():
    return float(_get("https://api.coinbase.com/v2/prices/BTC-USD/spot")["data"]["amount"])


def _kraken():
    r = _get("https://api.kraken.com/0/public/Ticker?pair=XBTUSD")["result"]
    return float(next(iter(r.values()))["c"][0])


def _gemini():
    return float(_get("https://api.gemini.com/v1/pubticker/btcusd")["last"])


def _binance():
    return float(_get("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT")["price"])


def _mempool():
    return float(_get("https://mempool.space/api/v1/prices")["USD"])


SOURCES = [("coinbase", _coinbase), ("kraken", _kraken), ("gemini", _gemini),
           ("binance_usdt", _binance), ("mempool.space", _mempool)]


def collect():
    prices, errors = {}, {}
    with cf.ThreadPoolExecutor(max_workers=len(SOURCES)) as ex:
        futs = {ex.submit(fn): name for name, fn in SOURCES}
        for f in cf.as_completed(futs, timeout=25):
            name = futs[f]
            try:
                v = f.result()
                if v and v > 0:
                    prices[name] = round(v, 2)
            except Exception as e:
                errors[name] = type(e).__name__
    return prices, errors


def robust(prices):
    """Median + MAD outlier rejection. Returns (median, used, rejected, mad, disp%)."""
    if not prices:
        return None, {}, {}, None, None
    vals = list(prices.values())
    med = statistics.median(vals)
    mad = statistics.median([abs(v - med) for v in vals]) if len(vals) > 2 else 0.0
    used, rejected = {}, {}
    # scale MAD to a normal-consistent sigma (1.4826); floor to avoid zero-width
    sigma = max(1.4826 * mad, med * 0.0005)
    for k, v in prices.items():
        (rejected if abs(v - med) > MAD_K * sigma else used)[k] = v
    med2 = statistics.median(list(used.values())) if used else med
    disp = round(100 * (max(used.values()) - min(used.values())) / med2, 4) if len(used) > 1 else 0.0
    return round(med2, 2), used, rejected, round(mad, 2), disp


def main():
    prices, errors = collect()
    med, used, rejected, mad, disp = robust(prices)
    ok = med is not None and len(used) >= MIN_SOURCES
    doc = {
        "schema": "bsahi.price-index/1",
        "layer": "observed",
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source": "direct queries to independent venues; robust median (MAD outlier rejection)",
        "status": "OK" if ok else "INSUFFICIENT_SOURCES",
        "median_usd": med,
        "sources_queried": len(SOURCES),
        "sources_ok": len(prices),
        "sources_used": used,
        "sources_rejected": rejected,
        "errors": errors,
        "mad_usd": mad,
        "dispersion_pct": disp,
        "min_sources_required": MIN_SOURCES,
        "note": ("Robust multi-venue BTC/USD reference rate. Price is an off-chain fact "
                 "and cannot be derived from the node; the win here is removing the "
                 "SINGLE-source dependency, not the dependency itself. Median over "
                 "independent venues with MAD-based outlier rejection; per-source "
                 "values are published so the number is reproducible."),
    }
    os.makedirs(CAP, exist_ok=True)
    with open(os.path.join(CAP, "history.jsonl"), "a") as f:
        f.write(json.dumps({"at": doc["generated_at"], "median": med, "used": used,
                            "rejected": rejected, "errors": errors}) + "\n")
    with open(OUT, "w") as f:
        json.dump(doc, f, indent=2)
    if ok:
        print("price-index: $%s (used %d/%d, dispersion %s%%) %s"
              % (med, len(used), len(prices), disp,
                 ("rejected " + ", ".join(rejected)) if rejected else ""))
    else:
        print("price-index: INSUFFICIENT_SOURCES (%d ok, need %d)" % (len(prices), MIN_SOURCES))
    print("  -> %s" % OUT)


if __name__ == "__main__":
    main()
