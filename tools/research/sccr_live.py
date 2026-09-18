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
# The reproduction kit input is FROZEN (immutable by contract). The CI-safe
# frozen mode reads the live refresh that generate_research_data.js writes to
# captured-data/sccr-live/, falling back to the frozen kit input when the live
# file is absent (e.g., local runs). Never writes into research/reproduce/.
LIVE_CAPTURE = os.path.join(REPO, 'captured-data', 'sccr-live', 'fee_history_capture.json')
FROZEN = os.path.join(REPO, 'research', 'reproduce', 'input', 'fee_history_capture.json')


def load_spec():
    with open(SPEC_PATH) as f:
        spec = json.load(f)
    q = spec['quantities']
    # Census provenance: the committed, dated N constant. N has ONE surface —
    # quantities.N — which carries captured_at/census_date for self-containment.
    # (The former top-level `census` block was removed 2026-09-17: a stale
    # duplicate (N=32000) that naive parsers read instead of quantities.N.)
    captured_at = q['N'].get('captured_at')
    census_date = q['N'].get('census_date')
    return {
        'C': q['C']['value'], 'N': q['N']['value'], 'T': q['T']['value'],
        'B_block': q['B_block']['value'], 'version': spec['version'],
        'census_captured_at': captured_at,
        'census_date': census_date,
    }


def load_census_captured_at():
    """Best available capture timestamp for the canonical N.

    Preference order (the date the node count was measured):
      1. research/model-spec.json quantities.N.captured_at — the
         snapshot-of-record for the canonical N (a measured reachable-node
         count since the 2026-09-17 re-base)
      2. data/node_census_series.json generated_at — the reachable-node crawl
      3. data/node_census.json captured_at — legacy addrman ADDRESS sample
         (not a node count; last-resort date only)
    Returns an ISO-8601 string or None. GH never runs the crawler; it reads
    whichever of these is committed."""
    try:
        with open(SPEC_PATH) as f:
            spec = json.load(f)
        cap = spec.get('quantities', {}).get('N', {}).get('captured_at')
        if cap:
            return cap
    except Exception:
        pass
    series = os.path.join(DATA_DIR, 'node_census_series.json')
    try:
        if os.path.exists(series):
            d = json.load(open(series))
            if d.get('generated_at'):
                return d['generated_at']
    except Exception:
        pass
    mirror = os.path.join(DATA_DIR, 'node_census.json')
    try:
        if os.path.exists(mirror):
            d = json.load(open(mirror))
            if d.get('captured_at'):
                return d['captured_at']
    except Exception:
        pass
    return None


CENSUS_STALE_DAYS = 30
"""Staleness threshold for the N census. The metric stays VALID with a fixed N
(a lower-bound constant) — this only drives the honesty note in sccr.json, it
never blocks SCCR computation."""


def census_status():
    """Return (census_day, stale_bool). staleness is a honesty-layer flag on the
    committed N constant — it NEVER blocks SCCR computation."""
    cap = load_census_captured_at()
    day = (cap or '')[:10]
    if not cap:
        return day, False
    try:
        from datetime import datetime as _dt
        c = cap.replace('Z', '+00:00')
        if 'T' not in c and ' ' not in c:      # date-only "2026-09-16" -> midnight UTC
            c += 'T00:00:00+00:00'
        dt = _dt.fromisoformat(c)
        if dt.tzinfo is None:                  # naive -> assume UTC (never fake-fresh)
            dt = dt.replace(tzinfo=timezone.utc)
        age_days = (_dt.now(timezone.utc) - dt).days
    except Exception:
        age_days = CENSUS_STALE_DAYS + 1  # unparseable date -> surface as stale, never fake-fresh
    return day, age_days > CENSUS_STALE_DAYS


def census_note():
    """Build the dated N-provenance phrase + staleness honesty note."""
    day, stale = census_status()
    base = ('N=26,586 measured reachable validating nodes as of %s '
            '(btcnodes reachable-node crawl; addresses != nodes)' % (day if day else 'unknown date'))
    if not load_census_captured_at():
        return base + ' (N provenance date not committed)'
    if stale:
        base += ('; N measurement is stale — last measured %s; N is a lower-bound constant '
                 '(non-listening nodes are unobservable; a larger N lowers the SCCR)' % day)
    return base


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
        usd = e.get('USD')
        # Missing price -> fee leg uncomputable; SKIP (never default to 0, which
        # would understate the ratio). Unified with the reproduce kit + C.
        if not fee_sats or not usd:
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
    if args.frozen:
        capture_path = LIVE_CAPTURE if os.path.exists(LIVE_CAPTURE) else FROZEN
        with open(capture_path) as f:
            capture = json.load(f)
    else:
        capture = load_capture_live()
    ratios, heights, l_net = compute(cfg, capture)
    if not ratios:
        print('ERROR: no blocks parsed', file=sys.stderr)
        return 1

    avg = sum(ratios) / len(ratios)
    below = sum(1 for r in ratios if r < 1.0)
    now = datetime.now(timezone.utc)
    day = now.strftime('%Y-%m-%d')

    latest = {
        'schema': 'bsahi.sccr/1',
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
        'census_captured_at': cfg.get('census_captured_at'),
        'census_date': cfg.get('census_date'),
        'census_stale': census_status()[1],
        'notes': 'SCCR = fee_USD / L_net; ' + census_note() + '; T=10yr assumption. Static JSON endpoint: /data/sccr_latest.json',
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
        json.dump({'schema': 'bsahi.sccr-latest/1', 'endpoint': '/data/sccr_latest.json', 'payload': latest}, f, indent=2)
    with open(os.path.join(DATA_DIR, 'sccr_history.json'), 'w') as f:
        json.dump({'schema': 'bsahi.sccr-history/1', 'endpoint': '/data/sccr_history.json', 'count': len(history),
                   'sampling': ('one dated snapshot per DAY a run occurred. The series is NOT contiguous: '
                                'a missing date means no run that day, so gaps are real, not zero-fee days. '
                                'Do not plot as a continuous time series without labelling the gaps.'),
                   'payload': history}, f, indent=2)

    # Keep everything DERIVED from this reading in step, then re-stamp the
    # committed HTML. Order matters: the derived JSONs must be written before
    # the syncer substitutes its {{TABLE:...}} tokens, and bake runs last.
    # Each step is best-effort (a failure never blocks the reading itself).
    try:
        import subprocess
        chain = [
            ('sccr_sensitivity.py', []),          # -> data/sccr_sensitivity.json
            ('fee_allocation.py', []),            # -> data/fee_allocation.json
            ('datasets_manifest.py', []),         # -> data/datasets.json
        ]
        for script, args in chain:
            subprocess.run([sys.executable, os.path.join(REPO, 'tools', 'research', script)] + args,
                           cwd=REPO, check=False, capture_output=True)
        # {{TOKEN}} substitution for md-rendered pages, then id-stamping.
        subprocess.run([sys.executable, os.path.join(REPO, 'tools', 'sync_research_pages.py')],
                       cwd=REPO, check=False, capture_output=True)
        subprocess.run([sys.executable, os.path.join(REPO, 'tools', 'bake_sccr_html.py')],
                       cwd=REPO, check=False, capture_output=True)
    except Exception as e:
        print('derived-data / html bake failed:', e)

    print('SCCR live: %.4f (%d blocks, %d below 1x) -> data/sccr*.json' % (avg, len(ratios), below))
    print('  history points: %d' % len(history))
    return 0


if __name__ == '__main__':
    sys.exit(main())
