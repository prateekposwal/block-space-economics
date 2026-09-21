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


def self_host_line(ncr):
    """Top countries + top hosting ASN from a first-party crawl (offline geo DB)."""
    bc = ncr.get('by_country') or []
    ba = ncr.get('by_asn_top') or []
    if not bc:
        return 'Geo: offline DB not applied'
    tot = sum(n for _, n in bc) or 1
    top_c = ' \u00b7 '.join('%s %d%%' % (c, round(100 * n / tot)) for c, n in bc[:3])
    line = 'Top country: ' + top_c
    if ba:
        line += ' \u00b7 top host %s %d%%' % (ba[0][1] or ba[0][0], round(100 * ba[0][2] / tot))
    return line


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
    ng, bp, mg = L('node_geography.json'), L('block_propagation.json'), L('mining_geography.json')
    prl, cr = L('peer_relay.json'), L('contribution_ratio.json')
    vc = L('validation_cost.json')
    ncr = L('node_crawl.json')
    pcd = L('propagation_cdf.json')
    px = L('price_index.json')
    pinf = L('pool_infrastructure.json')
    out = []

    cur = fa.get('current') or {}
    if cur:
        cl, cov = cur.get('claims_usd_per_block', {}), cur.get('coverage_pct', {})
        yr = (fa.get('crossovers') or {}).get('fees_must_cover_security_from_year')
        out.append(_card('Fee allocation (security vs storage)', 'modelled', 'C', [
            'Security claim $%s/block \u00b7 fees cover %s%% of it' % (_num(cl.get('security_energy_cost'), 0), cov.get('security_by_fees_pct', '\u2014')),
            'Subsidy covers energy until ~%s' % (yr or '\u2014')], '/research/fee-allocation', 'the analysis'))

    ppe = L('private_population_estimate.json')
    ibdn = L('ibd_cleared_notice.json')
    d5 = L('d5_status.json')
    if vp.get('quantities'):
        _q = vp['quantities']
        _b = (_q.get('B_reachable_nodes') or {}).get('value')
        _a = (_q.get('A_gossip_addresses') or {}).get('value')
        _cg = (_q.get('C_non_listening') or {}).get('grade') or 'D'
        _inb = d5.get('inbound') or {}
        _ep = d5.get('endpoint') or {}
        if d5.get('measurement_live'):
            _ep_line = ('Census endpoint: <b>LIVE</b> \u00b7 %s \u00b7 externally verified reachable'
                        % (d5.get('census_endpoint') or ''))
            _m = _inb.get('distinct_ever') or 0
            _raw = _inb.get('raw_distinct_ever') or 0
            if _m:
                _priv = ('Private / non-listening: <b>%s measured</b> (lower bound) \u00b7 grade %s'
                         % (_num(_m, 0), _cg))
            elif _raw:
                _priv = ('Private / non-listening: <b>not yet measured</b> \u2014 %s inbound so far, '
                         'all known crawlers (excluded) \u00b7 grade %s' % (_num(_raw, 0), _cg))
            else:
                _priv = ('Private / non-listening: <b>not yet measured</b> (0 inbound peers) \u00b7 grade %s' % _cg)
            _pe = ppe.get('estimate')
            if _pe:
                _ci = ppe.get('ci95') or []
                _priv += (' \u00b7 population estimate <b>%s</b>%s'
                          % (_num(_pe, 0), (' (95%% CI %s\u2013%s)' % (_num(_ci[0], 0), _num(_ci[1], 0))) if len(_ci) == 2 else ''))
            else:
                _priv += ' \u00b7 population estimate needs a 2nd vantage (capture-recapture)'
        elif _ep.get('handshake_fresh'):
            _ep_line = 'Census endpoint: up but external reachability not verified'
            _priv = 'Private / non-listening: <b>not yet measured</b> \u00b7 grade %s' % _cg
        else:
            _ep_line = 'Census endpoint: <b>down</b> \u2014 private nodes unobservable'
            _priv = 'Private / non-listening: <b>not observable</b> \u00b7 grade %s' % _cg
        out.append(_card('Node population: public vs private', 'observed', 'B / D', [
            'Public (reachable, listening): <b>%s</b> \u00b7 gossip addresses %s (not nodes)'
            % (_num(_b, 0), _num(_a, 0)),
            _priv, _ep_line],
            '/research/inbound-census-vps', 'the method'))

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
        period = dif.get('period') or []
        out.append(_card('Mining difficulty', 'observed', 'A', [
            '<b>%s</b>' % _num(dif.get('latest_difficulty') or pts[-1].get('y'), 0),
            'frozen primary \u00b7 through %s \u00b7 %s points'
            % (period[1] if len(period) > 1 else '', _num(dif.get('n_points'), 0))], '/data/difficulty_series.json', 'data'))

    if mem:
        out.append(_card('Mempool congestion', 'observed', 'B*', ['Frozen primary \u00b7 2016\u20132026', 'pre-2016 is reconstruction-only (chart starts 2016-06).'],
                         '/data/mempool_congestion_series.json', 'data'))

    if ng.get('network_class'):
        nc, gg = ng['network_class'], ng.get('geography') or {}
        out.append(_card('Node geography & network class', 'observed', 'B', [
            '<b>%s</b> reachable \u00b7 %s Tor + %s I2P = %s%% overlay (locationless)'
            % (_num(nc.get('reachable_nodes'), 0), _num(nc.get('tor'), 0), _num(nc.get('i2p'), 0), nc.get('overlay_share_pct')),
            'Clearnet spread over %s unique locations' % _num(gg.get('unique_coordinate_pairs'), 0)],
            '/data/node_geography.json', 'data'))

    bs = bp.get('summary') or {}
    if bs:
        out.append(_card('Block relay (observed announcers)', 'observed', 'C', [
            '%s blocks \u00b7 announcing peers min %s / mean %s / max %s'
            % (bs.get('blocks_in_window'), _num(bs.get('announcing_nodes_min'), 0),
               _num(bs.get('announcing_nodes_mean'), 1), _num(bs.get('announcing_nodes_max'), 0)),
            'Sample of listening peers carrying the block \u2014 not the producer.'],
            '/data/block_propagation.json', 'data'))

    pcmp = prl.get('peer_composition') or {}
    if pcmp:
        cls = pcmp.get('by_class') or {}
        line = ' \u00b7 '.join('%s %s' % (k, v) for k, v in cls.items()) or '\u2014'
        out.append(_card('First-party peer relay', 'observed', 'B', [
            '%s peers \u00b7 %s' % (_num(pcmp.get('total'), 0), line),
            '%s blocks first-seen captured%s' % (prl.get('blocks_observed', 0),
                                                 '' if prl.get('blocks_observed') else ' (node in IBD/reindex)')],
            '/data/peer_relay.json', 'data'))

    if mg.get('status') == 'OK':
        rows = mg.get('country_share') or []
        src_lbl = ('CBECI estimate (~32\u201338%% pool sample)'
                   if mg.get('source_kind') == 'cbeci_csv'
                   else 'Hashrate Index (Luxor) \u00b7 quarterly, top countries')
        out.append(_card('Mining geography', 'modelled', 'C/D', [
            'Hashrate share by country \u00b7 %s \u00b7 %s' % (mg.get('period') or '', src_lbl),
            'Top: %s \u00b7 listed covers %s%% of global' % (
                ', '.join('%s %s%%' % (r.get('country'), r.get('share_pct')) for r in rows[:3]),
                mg.get('listed_coverage_pct', '\u2014'))],
            '/data/mining_geography.json', 'data'))
    else:
        out.append(_card('Mining geography', 'modelled', 'C/D', [
            'CBECI mining map is a Firebase SPA \u2014 imported from its Download CSV.',
            'Status: %s \u2014 drop a CSV in captured-data/cbeci/.' % (mg.get('status') or 'missing')],
            '/data/mining_geography.json', 'data'))

    if px.get('median_usd'):
        out.append(_card('BTC/USD (robust median)', 'observed', 'A', [
            '<b>$%s</b> from %s independent venues \u00b7 dispersion %s%%'
            % (_num(px.get('median_usd'), 2), px.get('sources_ok'), px.get('dispersion_pct')),
            'Median + MAD outlier rejection \u00b7 single-source dependency removed'],
            '/data/price_index.json', 'data'))

    if pinf:
        out.append(_card('Pool infrastructure', 'observed', 'B', [
            '%s/%s pool addresses are CDN-fronted \u00b7 %s pools probed'
            % (_num(pinf.get('fronted_by_cdn'), 0), _num(pinf.get('addresses_geolocated'), 0),
               _num(pinf.get('pools_probed'), 0)),
            'Measured why pool-IP geolocation cannot locate mining.'],
            '/data/pool_infrastructure.json', 'data'))

    if pcd:
        if pcd.get('status') == 'OK':
            cdf = pcd.get('delta_cdf') or []
            med = next((t for t, p in cdf if p >= 50), None)
            cls = pcd.get('by_class_cdf') or {}
            _pt = pcd.get('participation') or {}
            _lines = [
                '%s blocks \u00b7 %s peer sightings \u00b7 median delta %ss'
                % (_num(pcd.get('blocks_observed'), 0), _num(pcd.get('peer_sightings'), 0), _num(med, 0)),
                'Split: %s \u00b7 BIP152 high-bandwidth tracked'
                % ' + '.join('%s %s' % (k, _num(len(v), 0)) for k, v in cls.items())]
            if _pt.get('blocks_observed'):
                _lines.append('Non-listening (inbound) peers announced %s%% of blocks '
                              '\u00b7 earliest announcer in %s%%'
                              % (_num(_pt.get('inbound_announcer_share_pct'), 1),
                                 _num(_pt.get('inbound_first_seen_share_pct'), 1)))
            out.append(_card('Relay propagation CDF', 'observed', 'A', _lines,
                             '/data/propagation_cdf.json', 'data'))
        else:
            out.append(_card('Relay propagation CDF', 'observed', 'A', [
                'Awaiting synced relay (node still reindexing)',
                'Will capture per-peer deltas, clearnet vs overlay, BIP152 high-bandwidth.'],
                '/data/propagation_cdf.json', 'data'))

    if ibdn:
        _ic, _pf = ibdn.get('ibd_cleared'), ibdn.get('participation_first')
        _lines = []
        if _ic:
            _lines.append('Sync cleared %s (height %s)'
                          % (str(_ic.get('at'))[:16].replace('T', ' '), _num(_ic.get('height'), 0)))
        else:
            _pct = (100.0 * (ibdn.get('height') or 0) / (ibdn.get('headers') or 1))
            _lines.append('Syncing \u2014 h%s / %s (%.1f%%) \u00b7 relay capture starts when IBD clears'
                          % (_num(ibdn.get('height'), 0), _num(ibdn.get('headers'), 0), _pct))
        if _pf:
            _lines.append('First measured block-relay participation: <b>%s%%</b> of observed blocks '
                          'had a non-listening (inbound) announcer'
                          % _num(_pf.get('inbound_announcer_share_pct'), 1))
        else:
            _lines.append('Block-relay participation: awaiting synced relay (0 blocks observed)')
        out.append(_card('Sync &amp; relay readiness', 'observed', 'A', _lines,
                         '/data/ibd_cleared_notice.json', 'data'))

    if ncr.get('reachable'):
        sa = ncr.get('services') or {}
        full, lim = sa.get('NODE_NETWORK', 0), sa.get('NODE_NETWORK_LIMITED', 0)
        tot = (full + lim) or 1
        bn = ncr.get('by_network') or {}
        out.append(_card('First-party node crawl', 'observed', 'A', [
            '%s reachable / %s dialed (%s%%) \u00b7 IPv4 %s / IPv6 %s'
            % (_num(ncr.get('reachable'), 0), _num(ncr.get('attempted'), 0),
               _num(ncr.get('reachable_pct'), 1), _num(bn.get('ipv4'), 0), _num(bn.get('ipv6'), 0)),
            'Full nodes %d%% \u00b7 pruned %d%% \u00b7 top client %s'
            % (round(100 * full / tot), round(100 * lim / tot),
               (ncr.get('by_user_agent_top') or [['\u2014']])[0][0]),
            self_host_line(ncr)],
            '/data/node_crawl.json', 'data'))

    vp2 = vc.get('pass') or {}
    veras = [e for e in (vc.get('by_era') or []) if e.get('ms_per_block')]
    if vp2 and veras:
        base = next((e for e in veras if e.get('cost_index_vs_base') == 1.0), veras[0])
        top = max(veras, key=lambda e: e['ms_per_block'])
        out.append(_card('Validation cost (measured)', 'observed', 'A', [
            'Reindex h%s in %sh \u00b7 %s blocks/s \u00b7 %s ms/block'
            % (_num(vp2.get('to_height'), 0), round((vp2.get('wall_seconds') or 0) / 3600, 1),
               _num(vp2.get('blocks_per_sec'), 2), _num(vp2.get('ms_per_block'), 1)),
            'Per-block cost %s\u00d7 %s\u2192%s \u00b7 per-tx roughly flat'
            % (_num(top.get('cost_index_vs_base'), 1), base.get('era'), top.get('era'))],
            '/data/validation_cost.json', 'data'))

    if cr:
        out.append(_card('Contribution axes', 'modelled', 'C', [
            'Three populations, not one: verification \u00b7 relay \u00b7 production.',
            'A single public-vs-private ratio is undefined (category error).'],
            '/data/contribution_ratio.json', 'data'))

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