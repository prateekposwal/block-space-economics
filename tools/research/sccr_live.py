#!/usr/bin/env python3
"""
BSAHI — SCCR Live Writer (dashboard + static API).

Computes the latest SCCR from the live capture and writes three files:
  data/sccr.json            latest SCCR snapshot (dashboard source)
  data/sccr_latest.json     /data/sccr_latest.json static endpoint payload
  data/sccr_history.json    /data/sccr_history.json static endpoint payload (appends)

The static site (GitHub Pages) cannot serve a dynamic backend API; these
files ARE the API until the deferred backend decision (R5-gated). The
snapshot agent ships them with every data/*.json publish.

Usage:
  python3 tools/research/sccr_live.py            # live DB capture
  python3 tools/research/sccr_live.py --frozen   # frozen capture (CI-safe)
"""
import argparse
import json
import os
import sys
from datetime import datetime, timezone

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DATA_DIR = os.path.join(REPO, 'data')
SPEC_PATH = os.path.join(REPO, 'research', 'model-spec.json')
FROZEN = os.path.join(REPO, 'research', 'reproduce', 'input', 'fee_history_capture.json')


def load_spec():
    with open(SPEC_PATH) as f:
        spec = json.load(f)
    q = spec['quantities']
    return {
        'C': q['C']['value'], 'N': q['N']['value'], 'T': q['T']['value'],
        'B_block': q['B_block']['value'], 'version': spec['version'],
    }


def load_capture_live():
    import subprocess
    db = os.path.join(REPO, 'captured-data', 'bsahi.db')
    sql = "SELECT json_data FROM captures WHERE source='fee_history' ORDER BY captured_at DESC LIMIT 1"
    tmp = '/tmp/bsahi-sccr-live-%d.sql' % os.getpid()
    with open(tmp, 'w') as f:
        f.write('.mode json\n' + sql)
    try:
        proc = subprocess.run(['sqlite3', db], stdin=open(tmp), capture_output=True, text=True, timeout=15)
        out = proc.stdout
    finally:
        try: os.unlink(tmp)
        except OSError: pass
    rows = json.loads(out)
    return json.loads(rows[0]['json_data'])


def compute(cfg, capture):
    r_blocks = 365.25 * 24 * 6
    cb = cfg['C'] / (cfg['B_block'] * r_blocks)
    l_net = cfg['B_block'] * cb * cfg['T'] * cfg['N']
    ratios = []
    heights = []
    for e in capture:
        fee_sats = e.get('avgFees') or 0
        usd = e.get('USD') or 0
        if not fee_sats:
            continue
        fee_usd = (fee_sats / 1e8) * usd
        ratios.append(fee_usd / l_net)
        heights.append(e.get('avgHeight'))
    return ratios, heights, l_net


def load_history():
    p = os.path.join(DATA_DIR, 'sccr_history.json')
    if os.path.exists(p):
        try:
            d = json.load(open(p))
            # file is the wrapper {'endpoint','count','payload':[...]}
            if isinstance(d, list):
                return d
            if isinstance(d, dict) and isinstance(d.get('payload'), list):
                return d['payload']
        except Exception:
            pass
    return []


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--frozen', action='store_true', help='use frozen capture (CI-safe)')
    args = ap.parse_args()

    cfg = load_spec()
    capture = json.load(open(FROZEN)) if args.frozen else load_capture_live()
    ratios, heights, l_net = compute(cfg, capture)
    if not ratios:
        print('ERROR: no blocks parsed', file=sys.stderr)
        return 1

    avg = sum(ratios) / len(ratios)
    below = sum(1 for r in ratios if r < 1.0)
    now = datetime.now(timezone.utc)
    day = now.strftime('%Y-%m-%d')

    latest = {
        'date': day,
        'generated_at': now.isoformat(),
        'spec_version': cfg['version'],
        'blocks': len(ratios),
        'avg_sccr': round(avg, 6),
        'min': round(min(ratios), 6),
        'max': round(max(ratios), 6),
        'below_1x': below,
        'below_1x_pct': round(below / len(ratios) * 100, 2),
        'l_net_usd': round(l_net, 6),
        'N': cfg['N'],
        'T': cfg['T'],
        'C': cfg['C'],
        'heights': [heights[0], heights[-1]] if heights else [],
        'notes': 'SCCR = fee_USD / L_net; N=32K primary-source lower-bound census (>=32,000 known addresses via Bitcoin Core getnodeaddresses); T=10yr assumption. Static JSON endpoint: /data/sccr_latest.json',
    }

    # history: append-or-replace today's entry
    history = load_history()
    history = [h for h in history if h.get('date') != day]
    history.append({'date': day, 'avg_sccr': round(avg, 6), 'blocks': len(ratios),
                    'below_1x_pct': round(below / len(ratios) * 100, 2)})
    history.sort(key=lambda h: h['date'])

    os.makedirs(DATA_DIR, exist_ok=True)
    with open(os.path.join(DATA_DIR, 'sccr.json'), 'w') as f:
        json.dump(latest, f, indent=2)
    with open(os.path.join(DATA_DIR, 'sccr_latest.json'), 'w') as f:
        json.dump({'endpoint': '/data/sccr_latest.json', 'payload': latest}, f, indent=2)
    with open(os.path.join(DATA_DIR, 'sccr_history.json'), 'w') as f:
        json.dump({'endpoint': '/data/sccr_history.json', 'count': len(history), 'payload': history}, f, indent=2)

    print('SCCR live: %.4f (%d blocks, %d below 1x) -> data/sccr*.json' % (avg, len(ratios), below))
    print('  history points: %d' % len(history))
    return 0


if __name__ == '__main__':
    sys.exit(main())
