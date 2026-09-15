#!/usr/bin/env python3
"""
BSAHI — SCCR static HTML baker.

Stamps the latest SCCR values from data/sccr.json (and sccr_history.json) into
the committed static HTML pages so crawlers and no-JS clients see real numbers
instead of "loading…" / "…" / "—" placeholders. The pages' JS still re-renders
live on load; the baked values are the deterministic first paint.

Targets:
  learn.html              — SCCR cards, agent note, model-spec note
  products/sccr-index.html — SCCR ticker, note, history table

Runs from:
  tools/research/sccr_live.py   (daily local tracker, after writing sccr*.json)
  tools/generate_snapshot.py    (GH Actions tier, after shipping committed sccr.json)
and can be run standalone:  python3 tools/bake_sccr_html.py

Idempotent: writes a file only when the baked content actually changes.
"""
import json
import os
import re
import sys

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DATA_DIR = os.path.join(REPO, 'data')


def load_json(path):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return None


def fmt_ratio(v, digits=4):
    return ('%.*f' % (digits, v)) if isinstance(v, (int, float)) else '—'


def fmt_n(n):
    if not isinstance(n, (int, float)):
        return '—'
    return format(int(n), ',')


def fmt_k(n):
    if not isinstance(n, (int, float)) or n <= 0:
        return '—'
    return ('%gK' % (n / 1000.0))


def fmt_pct(v):
    if not isinstance(v, (int, float)):
        return '—'
    if float(v).is_integer():
        return str(int(v))
    return ('%.2f' % v).rstrip('0').rstrip('.')


def stamp(path, mapping):
    """Replace the textContent of each `<span id="X">...</span>` / `<div id="X">...</div>`."""
    if not os.path.exists(path):
        return False
    with open(path) as f:
        html = f.read()
    orig = html
    for elem_id, text in mapping.items():
        for tag in ('span', 'div', 'p'):
            pat = re.compile(r'(<%s[^>]*\bid="%s"[^>]*>)[^<]*(</%s>)' % (tag, re.escape(elem_id), tag))
            html, n = pat.subn(r'\g<1>%s\g<2>' % text, html)
            if n:
                break
        if not n:
            print('  warn: id not found: %s in %s' % (elem_id, os.path.basename(path)))
    if html == orig:
        return False
    with open(path, 'w') as f:
        f.write(html)
    return True


def stamp_tbody(path, tbody_id, rows_html):
    if not os.path.exists(path):
        return
    with open(path) as f:
        html = f.read()
    pat = re.compile(r'(<tbody id="%s">).*?(</tbody>)' % re.escape(tbody_id), re.S)
    if not pat.search(html):
        return
    html, n = pat.subn(r'\g<1>%s\g<2>' % rows_html, html)
    if not n:
        return
    with open(path, 'w') as f:
        f.write(html)


def bake():
    d = load_json(os.path.join(DATA_DIR, 'sccr.json')) or {}
    hist = load_json(os.path.join(DATA_DIR, 'sccr_history.json')) or {}
    hpts = hist.get('payload') if isinstance(hist, dict) else (hist if isinstance(hist, list) else [])

    avg = d.get('avg_sccr')
    pct = d.get('below_1x_pct')
    blocks = d.get('blocks')
    date = d.get('date')
    spec = d.get('spec_version')
    minv = d.get('min')
    maxv = d.get('max')
    n = d.get('N')
    t = d.get('T')
    census = d.get('census_date') or (d.get('census_captured_at') or '')[:10] or 'unknown date'
    gen = d.get('generated_at', '')
    gen_line = 'Updated ' + gen.replace('T', ' ').replace('Z', ' UTC').replace('+00:00', ' UTC')[:16] + ' (daily SCCR tracker)' if gen else '—'

    pct_txt = fmt_pct(pct)

    learn_map = {
        'sccr-live': fmt_ratio(avg),
        'sccr-pct': ('%.1f' % (avg * 100)) if isinstance(avg, (int, float)) else '…',
        'sccr-below': pct_txt,
        'sccr-n': fmt_n(n),
        'sccr-card-avg': fmt_ratio(avg),
        'sccr-card-range': (fmt_ratio(minv) + ' / ' + fmt_ratio(maxv)),
        'sccr-card-blocks': fmt_n(blocks),
        'sccr-card-below': pct_txt + '%',
        'sccr-card-n': fmt_n(n),
        'sccr-card-date': date or '—',
        'sccr-note-n': fmt_k(n),
        'sccr-note-census': census,
        'sccr-note-t': fmt_n(t),
        'sccr-note-spec': spec or '—',
        'agent-sccr-live': fmt_ratio(avg),
        'agent-sccr-pct': ('%.1f' % (avg * 100)) if isinstance(avg, (int, float)) else '…',
        'agent-sccr-n': fmt_n(n),
        'sccr-freshness': gen_line,
    }
    changed = stamp(os.path.join(REPO, 'learn.html'), learn_map)

    trend_txt = '—'
    if isinstance(hpts, list) and len(hpts) >= 2:
        latest = hpts[-1].get('avg_sccr')
        prev = hpts[-2].get('avg_sccr')
        if isinstance(latest, (int, float)) and isinstance(prev, (int, float)) and prev:
            chg = ((latest - prev) / prev) * 100
            trend_txt = ('▲ +' if chg >= 0 else '▼ ') + str(round(abs(chg) * 10) / 10.0) + '%'
    idx_map = {
        'sccr-value': fmt_ratio(avg),
        'sccr-trend': trend_txt,
        'sccr-blocks': fmt_n(blocks),
        'sccr-below': pct_txt + '%',
        'sccr-note': ('Measured %s blocks on %s (model-spec v%s). Reproduce it: research/reproduce.' % (fmt_n(blocks), date or '—', spec or '—')),
    }
    changed = stamp(os.path.join(REPO, 'products', 'sccr-index.html'), idx_map) or changed

    rows = []
    if isinstance(hpts, list):
        for x in hpts[-6:]:
            rows.append('<tr><td>%s</td><td>%s</td><td>%s</td><td>%s%%</td></tr>' % (
                x.get('date', '—'),
                fmt_ratio(x.get('avg_sccr')),
                fmt_n(x.get('blocks')),
                pct_txt if x.get('below_1x_pct') is None else str(x.get('below_1x_pct')),
            ))
    if rows:
        stamp_tbody(os.path.join(REPO, 'products', 'sccr-index.html'), 'history-rows', ''.join(rows))

    print('SCCR bake: avg=%.4f pct=%s blocks=%s date=%s' % (avg if isinstance(avg, (int, float)) else 0, pct_txt, blocks, date))
    return 0


if __name__ == '__main__':
    sys.exit(bake())