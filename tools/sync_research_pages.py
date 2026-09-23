#!/usr/bin/env python3
"""Sync served research pages from their .md sources, preserving each page's
migrated chrome.

tools/generate_research_pages.py still emits the pre-migration palette and a
slug title (humanize(name)); re-running it would clobber the migrated design.
This syncer instead rewrites, in place:

  * <h1>, <title>, og:title, and the BreadcrumbList name -> the md's '# ' title
    (previously the slug, e.g. "Working-Paper")
  * the rendered-markdown body -> fresh from the md, with the leading duplicate
    title heading removed (the page supplies <h1>)

Everything else in the file — style block, nav, footer, gate — is left
byte-identical.

Build-time tokens (so served numbers come from the canonical JSON, not a
hand-typed snapshot that drifts after a re-base):

    {{SCCR}} {{SCCR_PCT}} {{SCCR_BELOW}} {{SCCR_BLOCKS}} {{SCCR_DATE}}
    {{SCCR_MIN}} {{SCCR_MAX}} {{SCCR_SPEC}}
    {{N}} {{N_RAW}} {{N_DATE}} {{N_K}} {{L_NET}} {{L_NET_D}} {{T}} {{C}}
    {{TABLE:unpublicised_curve}}      -> markdown table from sccr_sensitivity.json
    {{TABLE:unpublicised_curve_wp}}   -> same, with the status + fee-coverage columns
    {{TABLE:fee_allocation}}          -> the per-block claims table

Scalars come from data/sccr.json + research/model-spec.json; unknown tokens are
left verbatim with a warning on stderr.

Run: python3 tools/sync_research_pages.py [page ...]
     (defaults to every research/*.md that has a served .html)
"""
import glob
import html
import importlib.util
import json
import os
import re
import sys

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
_spec = importlib.util.spec_from_file_location(
    'grp', os.path.join(REPO, 'tools', 'generate_research_pages.py'))
grp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(grp)  # render_md_body(), inline(), md_title()

TITLE_SUFFIX = ' — BSAHI Research'
H1_MARK = '<h1>'
END_MARK = '<p style="margin-top:32px;">'
DATACARD_MARK = '<div class="datacard"'


def _load_json(path):
    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return {}


def _f(v, digits=4):
    return ('%.*f' % (digits, v)) if isinstance(v, (int, float)) else '—'


def _comma(v):
    return format(int(round(v)), ',') if isinstance(v, (int, float)) else '—'


def _tokens():
    """Build-time substitutions so a served page's numbers come from the
    canonical JSON, not from a hand-typed snapshot. Use `{{TOKEN}}` in a .md.

    Source of truth: data/sccr.json (live reading) and research/model-spec.json
    (the canonical N). Table blocks are expanded to markdown and rendered by
    the normal pipeline, so they carry the same table-wrap styling."""
    s = _load_json(os.path.join(REPO, 'data', 'sccr.json'))
    spec = _load_json(os.path.join(REPO, 'research', 'model-spec.json'))
    n = (spec.get('quantities', {}).get('N', {}) or {}).get('value') or s.get('N')
    n_date = (spec.get('quantities', {}).get('N', {}) or {}).get('captured_at') or s.get('census_date')
    l_net = s.get('l_net_usd')
    avg = s.get('avg_sccr')
    t = {
        'SCCR': _f(avg),
        'SCCR_UB': ('≤ ' + _f(avg)) if isinstance(avg, (int, float)) else '—',
        'SCCR_PCT': ('%.1f' % (avg * 100)) if isinstance(avg, (int, float)) else '—',
        'SCCR_BELOW': str(s.get('below_1x_pct', '—')),
        'SCCR_BLOCKS': str(s.get('blocks', '—')),
        'SCCR_DATE': s.get('date') or '—',
        'SCCR_MIN': _f(s.get('min')),
        'SCCR_MAX': _f(s.get('max')),
        'SCCR_SPEC': s.get('spec_version') or (spec.get('version') or '—'),
        'N': _comma(n),
        'N_RAW': str(int(n)) if isinstance(n, (int, float)) else '—',
        'N_DATE': (n_date or '—')[:10],
        'N_K': ('%.1fK' % (n / 1000.0)) if isinstance(n, (int, float)) else '—',
        'L_NET': _comma(l_net),
        'L_NET_D': ('%.2f' % l_net) if isinstance(l_net, (int, float)) else '—',
        'T': str(s.get('T', '—')),
        'C': str(s.get('C', '—')),
    }
    return t


def _table_unpublicised(curve):
    rows = ['| N | L_net (USD/block) | SCCR | externality vs baseline |',
            '|---:|---:|---:|---:|']
    for i, c in enumerate(curve):
        n_ = _comma(c['N']); ln = '$' + _comma(c['l_net_usd_per_block']); s_ = _f(c['sccr'], 4)
        if i == 0:  # baseline / strict floor
            n_, ln, s_ = '**%s**' % n_, ln, '**%s**' % s_
        rows.append('| %s | %s | %s | %.2f× |' % (n_, ln, s_, c['externality_multiple_vs_baseline']))
    return '\n'.join(rows)


def _table_unpublicised_wp(curve):
    rows = ['| N | status | L_net (USD/block) | SCCR | fee coverage | externality vs baseline |',
            '|---:|---|---:|---:|---:|---:|']
    for c in curve:
        rows.append('| %s | %s · %s | $%s | %s | %s%% | %.2f× |' % (
            _comma(c['N']), c['layer'], c['label'], _comma(c['l_net_usd_per_block']),
            _f(c['sccr'], 4), c['fee_coverage_pct'], c['externality_multiple_vs_baseline']))
    return '\n'.join(rows)


def _table_fee_allocation(fa):
    c = fa.get('current', {})
    cl = c.get('claims_usd_per_block', {})
    cov = c.get('coverage_pct', {})
    rev = c.get('revenue_usd_per_block', {})
    n = _tokens()['N']
    sec = cl.get('security_energy_cost', 0)
    stor = cl.get('storage_externality_L_net', 0)
    opex = cl.get('network_node_opex_1yr_per_block', 0)
    return '\n'.join([
        '| claim on fees (2026, per block) | USD/block | covered by fees today |',
        '|---|---:|---:|',
        '| **Security / production** (network energy cost to produce a block) | **$%s** | **%s%%** (subsidy pays %s%%) |'
        % (_comma(sec), cov.get('security_by_fees_pct', '—'), cov.get('security_by_subsidy_pct', '—')),
        '| **Storage externality** (`L_net` = N·C·T, N=%s, T=%syr horizon) | **$%s** | **%s%%** |'
        % (n, c.get('storage_horizon_years', 10), _comma(stor), cov.get('storage_by_fees_pct', '—')),
        '| Node operating cost (network-wide, **1-year** horizon) | $%s | %s%% |'
        % (_comma(opex), cov.get('network_node_opex_1yr_by_fees_pct', '—')),
        '',
        '*Rows 2 and 3 are the SAME cost at different horizons: `L_net` = N·C·T, so row 2 is '
        'row 3 multiplied by T. Their coverage percentages therefore differ by exactly T '
        '(%s%% x %s = %s%%) — they are one fact, not two. Reading the pair as "node operation '
        'is covered but permanence is not" is an error: the model has no separate permanence '
        'term, permanence IS the multi-year node cost. What the pair actually says is that '
        'fees fund roughly the first %s of the %s-year commitment.*'
        % (cov.get('storage_by_fees_pct', '—'), c.get('storage_horizon_years', 10),
           cov.get('network_node_opex_1yr_by_fees_pct', '—'),
           round((c.get('storage_horizon_years', 10) or 10) * (cov.get('storage_by_fees_pct') or 0) / 100.0, 1),
           c.get('storage_horizon_years', 10)),
        '',
        '*All rows share ONE fee basis — the measured 30-day mean ($%s/block). The SCCR is a '
        'separate reading on its own live block window; quoting the two together without '
        'naming the window is a category error.*' % _comma(rev.get('fees_measured', 0)),
    ])


def _table_scenarios(curve):
    """Population scenarios: an evidence-status table, deliberately framed so a
    derived scenario is never read as a measured node count."""
    meta = {
        26586: ('Grade B — observed reachable (crawler)', 'Primary measured scenario',
                'a larger independent crawl, or the first-party inbound measurement'),
        32000: ('Grade C — deprecated addrman *address* sample', 'Historical correction',
                'retired — addresses, not nodes'),
        50000: ('Grade D — modelled', 'Sensitivity scenario', 'an independent reachable-node estimate'),
        80000: ('Grade D — modelled', 'Sensitivity scenario', 'an independent reachable-node estimate'),
        100000: ('Grade D — modelled', 'Sensitivity scenario', 'an independent reachable-node estimate'),
        150000: ('Grade D — scenario (private:public ≈ 4.6:1)', 'Sensitivity scenario',
                 'the R = P·(i/o − 1) estimator'),
        200000: ('Grade D — scenario (private:public ≈ 6.5:1)', 'Sensitivity scenario',
                 'the R = P·(i/o − 1) estimator'),
        265860: ('Grade D — 2019-derived 9:1 assumption', 'Sensitivity scenario, **not a measurement**',
                 're-measure the private:public ratio; the estimator\'s i-test below'),
    }
    rows = ['| Population | Evidence status | Role | What would move it |',
            '|---:|---|---|---|']
    for c in curve:
        m = meta.get(c['N'], ('Grade D — scenario', 'Sensitivity scenario', '—'))
        rows.append('| %s | %s | %s | %s |' % (_comma(c['N']), m[0], m[1], m[2]))
    return '\n'.join(rows)


def _tables():
    sens = _load_json(os.path.join(REPO, 'data', 'sccr_sensitivity.json'))
    curve = (sens.get('unpublicised_node_sensitivity', {}) or {}).get('curve', [])
    fa = _load_json(os.path.join(REPO, 'data', 'fee_allocation.json'))
    return {
        'unpublicised_curve': lambda: _table_unpublicised(curve),
        'unpublicised_curve_wp': lambda: _table_unpublicised_wp(curve),
        'population_scenarios': lambda: _table_scenarios(curve),
        'fee_allocation': lambda: _table_fee_allocation(fa),
    }


def apply_tokens(md):
    """`{{SCALAR}}` -> value; `{{TABLE:name}}` -> generated markdown table."""
    t = _tokens()
    tables = _tables()

    def sub(m):
        key = m.group(1).strip()
        if key.startswith('TABLE:'):
            fn = tables.get(key[6:].strip())
            if fn is None:
                print('  warn: unknown table token: %s' % key, file=sys.stderr)
                return m.group(0)
            return fn()
        if key not in t:
            print('  warn: unknown token: %s' % key, file=sys.stderr)
            return m.group(0)
        return t[key]

    return re.sub(r'\{\{\s*(.+?)\s*\}\}', sub, md)


def seo_title(md):
    """Optional short SEO <title> from an HTML comment: <!-- seo-title: ... -->.
    Used verbatim (no brand suffix) so it can be kept under ~60 characters."""
    m = re.search(r'<!--\s*seo-title:\s*(.+?)\s*-->', md)
    return m.group(1).strip() if m else None


def _plain(title):
    """Plain-text title for <title>/og/breadcrumb (drop inline markdown)."""
    return html.unescape(re.sub(r'[*`]', '', title)).strip()


def _body_bounds(text):
    """(start, end) of the replaceable body region, or None if not locatable.

    start = first char after the <h1> line's terminating newline.
    end   = start of the last trailing datacard before the back-link (kept as
            chrome), else the back-link paragraph itself.

    Both markers are located by offset, never by line-start, so a body that ends
    flush against the back-link (e.g. "...</ul><p style=...>") is still found.
    """
    m = re.search(r'<h1[^>]*>.*?</h1>', text, re.S)
    if not m:
        return None
    nl = text.find('\n', m.end())
    if nl == -1:
        return None
    start = nl + 1
    back = text.find(END_MARK, start)
    if back == -1:
        return None
    dc = text.rfind(DATACARD_MARK, start, back)
    return start, (dc if dc != -1 else back)


def sync(name):
    md_path = os.path.join(REPO, 'research', name + '.md')
    html_path = os.path.join(REPO, 'research', name + '.html')
    if not (os.path.exists(md_path) and os.path.exists(html_path)):
        return None
    with open(md_path) as f:
        md = f.read()
    md = apply_tokens(md)
    title = grp.md_title(md)
    if not title:
        return None
    with open(html_path) as f:
        orig = f.read()
    text = orig

    # Body region: from the end of the <h1> to the back-link paragraph.
    #
    # This must be position-based, not line-based. The back-link <p> is glued to
    # whatever the body ends with, so on a page whose markdown ends in a list the
    # line reads "</ul><p style=...>" and never startswith(END_MARK) — the old
    # line-start test silently skipped the body, updating the title while keeping
    # the previous page's content. Anchor on the marker's offset instead.
    bounds = _body_bounds(text)
    if bounds:
        body_start, body_end = bounds
        rendered = grp.render_md_body(md).strip('\n')
        text = text[:body_start] + rendered + '\n' + text[body_end:]
    else:
        print('%s: WARNING body region not found (h1 or back-link missing) — '
              'only the title was refreshed' % name, file=sys.stderr)

    # <h1>, <title>, og:title, breadcrumb name -> the md title.
    h1 = grp.inline(title)
    plain = _plain(title)
    seo = seo_title(md)
    text = re.sub(r'<h1>.*?</h1>',
                  lambda m: '<h1>' + h1 + '</h1>', text, count=1)
    text = re.sub(r'<title>.*?</title>',
                  (lambda m: '<title>' + html.escape(seo) + '</title>') if seo else
                  (lambda m: '<title>' + html.escape(plain) + TITLE_SUFFIX + '</title>'),
                  text, count=1)
    text = re.sub(r'(<meta property="og:title" content=")[^"]*(")',
                  lambda m: m.group(1) + html.escape(plain, quote=True) + m.group(2),
                  text, count=1)
    text = re.sub(
        r'"name":"[^"]*","item":"https://bitcoinsahi\.com/research/'
        + re.escape(name) + r'\.html"',
        lambda m: ('"name":' + json.dumps(plain)
                   + ',"item":"https://bitcoinsahi.com/research/' + name + '.html"'),
        text, count=1)

    changed = text != orig
    if changed:
        with open(html_path, 'w') as f:
            f.write(text)
    return changed


if __name__ == '__main__':
    if len(sys.argv) > 1:
        names = sys.argv[1:]
    else:
        names = sorted(
            os.path.basename(p)[:-3]
            for p in glob.glob(os.path.join(REPO, 'research', '*.md'))
            if os.path.exists(os.path.join(REPO, 'research',
                                           os.path.basename(p)[:-3] + '.html')))
    n = 0
    for nm in names:
        r = sync(nm)
        if r is None:
            print(f'{nm}: skipped (no md title or html)')
        elif r:
            n += 1
            print(f'{nm}: synced')
    print(f'{n} page(s) updated')
