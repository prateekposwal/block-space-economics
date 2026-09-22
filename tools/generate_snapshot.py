#!/usr/bin/env python3
"""
BSAHI — Public Snapshot Generator (runner-safe, no local spool required).
Builds data/snapshot.json + fee_forecast.json + alerts.json + fee_history.json
from public API inputs so the GitHub Actions snapshot tier works even when the
local Mac is off. Writes only on content change (hash compare) to dedupe commits.
"""
import json, os, sys, glob, hashlib, subprocess, urllib.request
from datetime import datetime, timezone

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DATA_DIR = os.path.join(REPO, 'data')

sys.path.insert(0, os.path.join(REPO, 'tools'))
from netfetch import bounded_get  # noqa: E402

def fetch(url, timeout=15):
    # deadline also covers DNS; this runs in the GitHub Actions snapshot tier
    return bounded_get(url, timeout=timeout,
                       headers={'User-Agent': 'BSAHI-Snapshot/1.0'}).decode('utf-8')

def load_local(name, fb):
    # Priority: committed rich data/ first, then captured-data/, then tools/ stubs.
    # This stops the GH-Actions runner from overwriting live history with the
    # 1-entry tools/ stub (the pre-fix bug that made the site show empty charts).
    for base in (os.path.join(REPO, 'data'), os.path.join(REPO, 'captured-data'), os.path.join(REPO, 'tools')):
        p = os.path.join(base, name)
        if os.path.exists(p):
            try:
                with open(p) as f:
                    return json.load(f)
            except Exception:
                continue
    return fb

def write_on_change(name, data):
    os.makedirs(DATA_DIR, exist_ok=True)
    p = os.path.join(DATA_DIR, name)
    blob = json.dumps(data, indent=2) + '\n'
    changed = True
    if os.path.exists(p):
        try:
            with open(p) as f:
                changed = hashlib.md5(f.read().encode()).digest() != hashlib.md5(blob.encode()).digest()
        except Exception:
            changed = True
    if changed:
        with open(p, 'w') as f:
            f.write(blob)
        print(f"wrote {name} (changed)")
    else:
        print(f"{name} unchanged — skipped")
    return changed

def build_snapshot():
    fees = {}
    btc = 0
    height = 0
    mempool_tx = 0
    lightning = None
    now_iso = datetime.now(timezone.utc).isoformat()
    fees_ts = price_ts = height_ts = mempool_ts = lightning_ts = None
    try:
        d = json.loads(fetch('https://mempool.space/api/v1/fees/recommended'))
        for k in ['fastestFee', 'halfHourFee', 'hourFee', 'economyFee', 'minimumFee']:
            if k in d:
                fees[k] = d[k]
        fees_ts = now_iso
    except Exception as e:
        print('fees fetch failed:', e)
    # Per-tier mirror: a partial live fees payload must not drop a tier — fill
    # missing tiers from the previously committed snapshot.
    prev = load_local('snapshot.json', None)
    if prev and isinstance(prev.get('fees'), dict):
        for k in ['fastestFee', 'halfHourFee', 'hourFee', 'economyFee', 'minimumFee']:
            if k not in fees and k in prev['fees']:
                fees[k] = prev['fees'][k]
    try:
        p = json.loads(fetch('https://mempool.space/api/v1/prices'))
        btc = p.get('USD', 0)
        price_ts = now_iso
    except Exception as e:
        print('price fetch failed:', e)
    try:
        height = int(fetch('https://blockstream.info/api/blocks/tip/height'))
        height_ts = now_iso
    except Exception:
        try:
            height = int(fetch('https://mempool.space/api/blocks/tip/height'))
            height_ts = now_iso
        except Exception as e:
            print('height fetch failed:', e)
    try:
        m = json.loads(fetch('https://mempool.space/api/mempool'))
        mempool_tx = m.get('count', 0)
        mempool_ts = now_iso
    except Exception as e:
        print('mempool fetch failed:', e)
    try:
        lightning = json.loads(fetch('https://mempool.space/api/v1/lightning/statistics/latest'))
        lightning_ts = now_iso
    except Exception as e:
        print('lightning fetch failed:', e)
    if not lightning:
        lhist = load_local('lightning_history.json', None)
        if lhist and lhist.get('latest'):
            lightning = lhist['latest']
            lightning_ts = lhist.get('generated_at')

    # Forecast from history fallback (runner-safe)
    forecast = []
    try:
        sys.path.insert(0, os.path.join(REPO, 'tools'))
        import fee_forecast as fc
        hist = fc.load_history_fallback()
        fees_series = [v for _, v in hist]
        model = fc.exponential_smoothing(fees_series) if len(fees_series) >= 2 else None
        if model:
            for i, pred in enumerate(model['forecast']):
                forecast.append({"day_offset": i + 1, "predicted_fastest_fee": pred,
                                 "trend": "rising" if model['trend'] > 0.1 else ("falling" if model['trend'] < -0.1 else "stable")})
    except Exception as e:
        print('forecast failed:', e)

    # lightning_ts intentionally not gating payload_ts: the Lightning stats mirror
    # is a slow daily series, not a live feed — a stale daily row must not mark
    # the whole payload stale while fees/price/height/mempool are fresh.
    field_ts = [ts for ts in (fees_ts, price_ts, height_ts, mempool_ts) if ts]
    payload_ts = min(field_ts) if field_ts else None
    # freshness_min = age of the OLDEST payload field, in minutes (was hardcoded 0,
    # which falsely claimed everything was fresh).
    try:
        freshness_min = int((datetime.now(timezone.utc) - datetime.fromisoformat(
            payload_ts.replace('Z', '+00:00'))).total_seconds() / 60) if payload_ts else None
    except Exception:
        freshness_min = None

    snapshot = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "freshness_min": freshness_min,
        "payload_ts": payload_ts,
        "fees_ts": fees_ts,
        "price_ts": price_ts,
        "height_ts": height_ts,
        "mempool_ts": mempool_ts,
        "lightning_ts": lightning_ts,
        "fees": fees,
        "btc_price": btc,
        "block_height": height,
        "mempool_tx": mempool_tx,
        "lightning": lightning,
        "forecast": forecast,
        "alerts": [],
        "history": [{"date": h.get('date'), "fastestFee": h.get('fastestFee')} for h in load_local('fee_history.json', []) if h.get('date')],
        "totalPosts": len(load_local('post-log.json', {'posts': []}).get('posts', []))
    }
    return snapshot

def main():
    snapshot = build_snapshot()
    write_on_change('snapshot.json', snapshot)
    write_on_change('latest.json', {"latest": "/data/snapshot.json", "generated_at": snapshot['generated_at']})
    # Mirror committed local forecast/alerts if present
    fc = load_local('fee_forecast.json', None)
    if fc:
        write_on_change('fee_forecast.json', fc)
    al = load_local('alerts.json', {"alerts": []})
    if al:
        write_on_change('alerts.json', al)
    fh = load_local('fee_history.json', [])
    if fh:
        write_on_change('fee_history.json', fh)
    # Static SCCR API files: carried from committed data/ (computed locally by
    # sccr_live.py). The GH runner has no local DB, so it ships the last
    # committed values rather than recomputing.
    for f in ('sccr.json', 'sccr_latest.json', 'sccr_history.json'):
        d = load_local(f, None)
        if d:
            write_on_change(f, d)
    # Bake the shipped SCCR values into the committed static HTML so crawlers
    # and no-JS clients see real numbers instead of "loading…" placeholders.
    try:
        subprocess.run([sys.executable, os.path.join(REPO, 'tools', 'bake_sccr_html.py')],
                       cwd=REPO, check=False, capture_output=True)
    except Exception as e:
        print('html bake failed:', e)
    print("snapshot complete")

if __name__ == '__main__':
    main()
