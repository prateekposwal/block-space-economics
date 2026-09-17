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
        for tag in ('span', 'div', 'p', 'desc', 'strong', 'b', 'em'):
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


def stamp_polyline(path, line_id, points):
    """Regenerate an SVG <polyline id="..."> points attribute (e.g. the hub
    chart) from the canonical history, so the chart tracks the series."""
    if not os.path.exists(path):
        return False
    with open(path) as f:
        html = f.read()
    orig = html
    pat = re.compile(r'(<polyline\b(?=[^>]*\bid="%s")[^>]*\bpoints=")[^"]*(")' % re.escape(line_id))
    html, n = pat.subn(lambda m: m.group(1) + points + m.group(2), html)
    if not n:
        print('  warn: polyline id not found: %s in %s' % (line_id, os.path.basename(path)))
        return False
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


def _num(x, d=2):
    if x is None:
        return '\u2014'
    try:
        return format(int(round(float(x))), ',') if d == 0 else format(float(x), ',.%df' % d)
    except Exception:
        return '\u2014'


def _card(title, layer, grade, lines, link=None, link_text='evidence'):
    h = ('<div class="card"><div class="ch"><span class="ct">%s</span>'
         '<span class="badge %s">%s</span><span class="g">grade %s</span></div>'
         % (title, layer, layer, grade))
    for ln in lines:
        h += '<div class="ln">%s</div>' % ln
    if link:
        h += '<a class="more" href="%s">%s \u2192</a>' % (link, link_text)
    return h + '</div>'


def _spark(hist, key, color):
    vals = [h.get(key) for h in (hist or []) if isinstance(h.get(key), (int, float))]
    if len(vals) < 2:
        return ''
    mx, mn, W, H = max(vals), min(vals), 120, 28
    pts = ' '.join('%.1f,%.1f' % (W * i / (len(vals) - 1), H - 2 - (H - 4) * ((v - mn) / ((mx - mn) or 1)))
                   for i, v in enumerate(vals))
    return ('<svg viewBox="0 0 %d %d" width="120" height="28" aria-hidden="true">'
            '<polyline points="%s" fill="none" stroke="%s" stroke-width="2"/></svg>' % (W, H, pts, color))


def stamp_block(path, start_mark, end_mark, content):
    """Replace everything between two literal markers (used for the dashboard's
    baked card set, whose children are nested divs a regex can't balance)."""
    if not os.path.exists(path):
        return False
    with open(path) as f:
        html = f.read()
    pat = re.compile(r'(%s).*?(%s)' % (re.escape(start_mark), re.escape(end_mark)), re.S)
    if not pat.search(html):
        print('  warn: block markers not found in %s' % os.path.basename(path))
        return False
    new = pat.sub(lambda m: m.group(1) + content + m.group(2), html, count=1)
    if new == html:
        return False
    with open(path, 'w') as f:
        f.write(new)
    return True


def dashboard_cards():
    """Static, crawlable fallback for research/dashboard.html #cards — a snapshot
    of every card the JS renders, so a no-JS client / crawler sees the full set.
    The page's own JS clears #cards and re-renders live on load."""
    def L(n):
        return load_json(os.path.join(DATA_DIR, n)) or {}
    s, fa, vp = L('sccr.json'), L('fee_allocation.json'), L('verification_population.json')
    sc, ac, ic = L('seed_census.json'), L('addrman_churn.json'), L('inbound_census.json')
    u, pb, pc = L('utxo_state_series.json'), L('perblock_validation.json'), L('production_cost_ratio.json')
    vci, dif, mem = L('verify_cost_index.json'), L('difficulty_series.json'), L('mempool_congestion_series.json')
    out = []

    cur = fa.get('current') or {}
    if cur:
        cl, cov = cur.get('claims_usd_per_block', {}), cur.get('coverage_pct', {})
        yr = (fa.get('crossovers') or {}).get('fees_must_cover_security_from_year')
        out.append(_card('Fee allocation (security vs storage)', 'modelled', 'C', [
            'Security claim $%s/block \u00b7 fees cover %s%% of it' % (_num(cl.get('security_energy_cost'), 0), cov.get('security_by_fees_pct', '\u2014')),
            'Subsidy covers energy until ~%s' % (yr or '\u2014')], '/research/fee-allocation', 'the analysis'))

    if vp.get('quantities'):
        q, comp = vp['quantities'], vp.get('composition') or {}
        tor = '\u2014'
        if (comp.get('network') or {}).get('tor') and comp.get('nodes_in_capture'):
            tor = str(round(comp['network']['tor'] / comp['nodes_in_capture'] * 100))
        out.append(_card('Verification population', 'observed', 'B', [
            '<b>%s</b> reachable nodes measured' % _num((q.get('B_reachable_nodes') or {}).get('value'), 0),
            'gossip-observed addresses \u2265%s (not a node count) \u00b7 %s%% Tor/I2P' % (_num((q.get('A_gossip_addresses') or {}).get('value'), 0), tor)],
            '/research/verification-population', 'the observatory'))

    if sc or ac:
        vl = []
        if vp.get('quantities'):
            vl.append('Crawler (reachable nodes): <b>%s</b>' % _num((vp['quantities'].get('B_reachable_nodes') or {}).get('value'), 0))
        if sc:
            vl.append('DNS seeds: <b>%s</b> addresses' % _num((sc.get('latest') or {}).get('union_size'), 0))
        if ac:
            al = 'Our addrman: <b>%s</b> addresses' % _num(ac.get('latest_count'), 0)
            pr = (ac.get('churn') or {}).get('persistence_rate_pct')
            if pr is not None:
                al += ' \u00b7 persistence %s percent' % pr
            vl.append(al)
        if ic:
            vl.append('Inbound (non-listening peers): <b>%s</b> now \u00b7 %s ever'
                      % (_num((ic.get('latest') or {}).get('inbound_count'), 0), _num(ic.get('distinct_inbound_addresses_ever'), 0)))
        out.append(_card('Three views of the node population', 'observed', 'B', vl, '/research/population-measurement', 'the method'))

    if sc or ac or ic:
        lines = []
        if sc:
            lines.append('DNS seeds: <b>%s</b> addresses %s' % (_num((sc.get('latest') or {}).get('union_size'), 0), _spark(sc.get('history'), 'union_size', '#60A5FA')))
        if ac:
            lines.append('Addrman: <b>%s</b> addresses %s' % (_num(ac.get('latest_count'), 0), _spark(ac.get('history'), 'count', '#F7931A')))
        if ic:
            lines.append('Inbound peers: <b>%s</b> now \u00b7 %s ever %s'
                         % (_num((ic.get('latest') or {}).get('inbound_count'), 0), _num(ic.get('distinct_inbound_addresses_ever'), 0), _spark(ic.get('history'), 'inbound_count', '#4ADE80')))
        out.append(_card('Population series', 'observed', 'B', lines, '/research/population-measurement', 'the method'))

    ap = vp.get('activity_partition') or {}
    if ap.get('tiers'):
        nn = (vp.get('composition') or {}).get('nodes_in_capture') or 1
        lines = ['%s: <b>%s</b> (%s%%)' % (t.get('tier'), _num(t.get('count'), 0), round(100 * (t.get('count') or 0) / nn))
                 for t in ap['tiers'] if (t.get('count') or 0) > 0]
        lines.append('Silent about non-listening nodes; NODE_NETWORK/LIMITED split unvalidated.')
        out.append(_card('Activity partition (observed reachable set)', 'observed', 'B', lines, '/research/verification-population', 'the partition'))

    if s.get('avg_sccr') is not None:
        out.append(_card('Storage Cost Coverage Ratio (SCCR)', 'observed', 'B', [
            '\u2264 <b>%s</b> (upper bound) \u00b7 %s blocks \u00b7 %s%% below 1\u00d7' % (fmt_ratio(s.get('avg_sccr')), s.get('blocks'), s.get('below_1x_pct')),
            'N=%s observed reachable \u00b7 non-listening nodes unobservable \u2192 true ratio lower \u00b7 spec v%s \u00b7 %s'
            % (fmt_n(s.get('N')), s.get('spec_version'), s.get('date'))], '/research/sccr-sensitivity', 'sensitivity & CIs'))

    rows = u.get('rows') or []
    if rows:
        r = rows[-1]
        out.append(_card('UTXO / chain state', 'observed', 'A', [
            'h%s \u00b7 <b>%s</b> UTXOs \u00b7 %s BTC' % (_num(r.get('height'), 0), _num(r.get('utxo_count'), 0), _num(r.get('total_amount_btc'), 0)),
            'UTXO DB %.2f GB \u00b7 captured %s' % ((r.get('disk_size_bytes') or 0) / 1e9, (r.get('measured_at') or '')[:10])],
            '/research/utxo-state-measurement', 'the pipeline'))
    else:
        out.append(_card('UTXO / chain state', 'reconstructed', 'D',
                         ['Era table 0.5\u201311 GB; observed layer accruing.', 'Continuous series blocked (node sync).'],
                         '/research/utxo-state-measurement', 'the finding'))

    pbr = pb.get('_rows') or []
    if pbr:
        ns = [len(x.get('samples') or []) for x in pbr]
        out.append(_card('Per-block SPOT validation', 'observed', 'B (spot)',
                         ['%d eras \u00b7 ~%d samples/era' % (len(pbr), round(sum(ns) / len(ns)) if ns else 0),
                          'A spot-check, not a survey.'], '/research/perblock-validation-note', 'the caveat'))

    tbl = ((pc.get('electricity_scenarios') or {}).get('table') or [])
    if tbl:
        out.append(_card('Production cost', 'modelled', 'C', [
            'Published across $0.03\u2013$0.15/kWh (scenario, not a point)',
            'At $0.15: %d years network-wide money-losing' % len(tbl[-1].get('eras_money_losing_network_wide') or [])],
            '/research/production-cost-note', 'the scenarios'))

    if vci.get('components'):
        tl = (vci.get('headline') or {}).get('top_line') or 'Trend metric'
        out.append(_card('Verification Cost Index', 'modelled', 'C',
                         [tl[:110] + ('\u2026' if len(tl) > 110 else ''), '7 components graded individually.'],
                         '/research/verification-cost-index', 'the note'))

    pts = dif.get('points') or []
    if pts:
        out.append(_card('Mining difficulty', 'observed', 'A', [
            '<b>%s</b>' % _num(dif.get('latest_difficulty') or pts[-1].get('y'), 0),
            'latest difficulty \u00b7 %s points' % _num(dif.get('n_points'), 0)], '/data/difficulty_series.json', 'data'))

    if mem:
        out.append(_card('Mempool congestion', 'observed', 'B*', ['2016\u20132026 frozen series', 'Early series; pre-2016 is reconstruction-only.'],
                         '/data/mempool_congestion_series.json', 'data'))

    return ''.join(out)


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
    l_net = d.get('l_net_usd')
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
        'sccr-note': ('Measured %s blocks on %s (model-spec v%s). Upper bound — only listening nodes are observable; see research/sccr-sensitivity. Reproduce it: research/reproduce.' % (fmt_n(blocks), date or '—', spec or '—')),
    }
    changed = stamp(os.path.join(REPO, 'products', 'sccr-index.html'), idx_map) or changed

    # Research hub (research/index.html) — hand-written; its SCCR numbers and the
    # chart polyline drift unless re-stamped, so they are baked here too.
    hub_map = {
        'sccr-hub-latest': fmt_ratio(avg),
        'sccr-hub-date': date or '—',
        'sccr-hub-n': fmt_n(n),
        'sccr-hub-n2': fmt_n(n),
        'sccr-hub-lnet': ('$' + format(l_net, ',.2f')) if isinstance(l_net, (int, float)) else '—',
        'sccr-hub-spec': spec or '—',
        'sccr-hub-desc-latest': fmt_ratio(avg),
        'sccr-hub-desc-date': date or '—',
    }
    changed = stamp(os.path.join(REPO, 'research', 'index.html'), hub_map) or changed

    # Dashboard (research/dashboard.html): bake the FULL static card set between
    # the BAKE:CARDS markers. The page's JS clears #cards and re-renders the live
    # set on load, so this is the no-JS / crawler first paint (was "Loading…").
    changed = stamp_block(os.path.join(REPO, 'research', 'dashboard.html'),
                          '<!-- BAKE:CARDS:START -->', '<!-- BAKE:CARDS:END -->',
                          dashboard_cards()) or changed
    if isinstance(hpts, list) and len(hpts) >= 2:
        x0, x1, y0, y1 = 46.0, 744.0, 204.0, 42.3  # matches the hub viewBox 0 0 760 240
        pts = ' '.join('%.1f,%.1f' % (x0 + i * (x1 - x0) / (len(hpts) - 1),
                                      y0 - (y0 - y1) * h['avg_sccr'])
                       for i, h in enumerate(hpts))
        changed = stamp_polyline(os.path.join(REPO, 'research', 'index.html'),
                                 'sccr-hub-line', pts) or changed

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