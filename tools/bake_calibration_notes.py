#!/usr/bin/env python3
"""Bake calibration note pages (current BSAHI design system, public/un-gated).

Renders research/{historical-series-note,perblock-validation-note,
utxo-series-reachability}.md -> .html using the same md renderer as
generate_research_pages.py but the CURRENT (migrated) design tokens shown by
research/utxo_cost_note.html. Kept separate because generate_research_pages.py
still emits the pre-migration palette on every page (re-running it would
clobber the migrated pages).

Run: python3 tools/bake_calibration_notes.py
"""
import os
import sys

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.join(REPO, 'tools'))
import importlib.util

_gen = os.path.join(REPO, 'tools', 'generate_research_pages.py')
spec = importlib.util.spec_from_file_location('grp', _gen)
grp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(grp)  # gives render_md()

NOTES = ['historical-series-note', 'perblock-validation-note', 'utxo-series-reachability',
         'production-cost-note', 'pool-hashrate-reachability']

DATA_FILE = {
    'historical-series-note': 'difficulty_series.json + mempool_congestion_series.json',
    'perblock-validation-note': 'perblock_validation.json',
    'utxo-series-reachability': 'utxo_series.json + verify_cost_index.json',
    'production-cost-note': 'production_cost_ratio.json',
    'pool-hashrate-reachability': 'pool_attribution_validation.json',
}

STYLE = ''':root{
  --bg:#121110; --surface:#1B1917; --surface-muted:#24211E;
  --ink:#F5F1EA; --ink-2:#A8A29E; --ink-3:#8B8580; --line:#332F2A;
  --accent:#F7931A; --accent-ink:#FBBF24;
  --ok:#4ADE80; --warn:#FBBF24; --err:#F87171; --info:#60A5FA;
  --ui:'Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;
  --disp:'Newsreader',Georgia,'Times New Roman',serif;
  --mono:'IBM Plex Mono',ui-monospace,'SF Mono',Menlo,'Fira Code','Cascadia Code',monospace;
}
body{background:var(--bg);color:var(--ink);font-family:var(--ui);margin:0;padding:0}
header{background:var(--surface);border-bottom:1px solid var(--line);padding:16px 24px}
.header-inner{max-width:960px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}
.brand{color:var(--accent);font-weight:700;text-decoration:none;font-size:1.1rem}
.nav{display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.nav-item{padding:6px 14px;font-size:.875rem;font-weight:500;color:var(--ink-2);border-radius:6px;text-decoration:none;transition:all .2s}
.nav-item:hover{color:var(--ink);background:var(--surface-muted)}
.nav-item.active{background:var(--surface-muted);color:var(--ink)}
@media(max-width:600px){.header-inner{padding:0 12px}.nav{gap:6px}.nav-item{padding:5px 9px;font-size:.78rem}}
.container{max-width:960px;margin:0 auto;padding:40px 24px 80px}
h1{font-family:var(--disp);color:var(--accent);font-size:1.9rem;margin:0 0 8px}
h2{font-family:var(--disp);color:var(--ink);font-size:1.3rem;margin:28px 0 12px}
h3{font-family:var(--disp);color:var(--ink);font-size:1.1rem;margin:20px 0 8px}
p{color:var(--ink-2);line-height:1.8;margin:0 0 14px}
a{color:var(--accent-ink)}
table{border-collapse:collapse;margin:14px 0;width:100%}
th,td{border:1px solid var(--line);padding:8px 12px;text-align:left;font-size:.9rem}
th{background:var(--surface);color:var(--ink)}
blockquote{border-left:3px solid var(--accent);margin:14px 0;padding:4px 16px;color:var(--ink-2);background:var(--surface)}
pre,code{background:var(--surface);border-radius:6px;font-family:var(--mono)}
pre{padding:14px;overflow-x:auto}
code{padding:2px 5px;font-size:.88em}
ul,ol{color:var(--ink-2);line-height:1.7;padding-left:24px}
hr{border:none;border-top:1px solid var(--line);margin:24px 0}
footer{border-top:1px solid var(--line);padding:24px;text-align:center;font-size:.85rem;color:var(--ink-3)}
footer .links{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-bottom:10px}
footer .links a{color:var(--ink-3);text-decoration:none}
footer .links a:hover{color:var(--accent-ink)}
.datacard{border:1px solid var(--line);border-radius:10px;background:var(--surface);padding:14px 16px;margin:14px 0}
.datacard b{color:var(--ink)}
.kv{color:var(--ink-2);font-size:.92rem;line-height:1.9}
.kv code{color:var(--accent-ink)}'''

NAV = '<nav class="nav"><a href="/" class="nav-item">Home</a><a href="/live" class="nav-item">Live Fees</a><a href="/learn" class="nav-item">Learn</a><a href="/capacity" class="nav-item">Capacity</a><a href="/fork-tracker" class="nav-item">Fork Tracker</a><span class="nav-item active">Research</span></nav>'


def humanize(name):
    return name.replace('-', ' ').replace('_', ' ').title()


def page(name, title, body):
    md_path = os.path.join(REPO, 'research', name + '.md')
    with open(md_path) as f:
        text = f.read()
    rendered = grp.render_md(text)
    return '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="Bitcoin Sahi calibration note — %s. Data-confidence evidence for the block space economics research program: historical series, per-block validation, and reachability findings.">
<meta property="og:title" content="%s">
<meta property="og:type" content="article">
<meta property="og:url" content="https://bitcoinsahi.com/research/%s.html">
<meta property="og:image" content="https://bitcoinsahi.com/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#121110">
<link rel="canonical" href="https://bitcoinsahi.com/research/%s.html">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://bitcoinsahi.com/"},{"@type":"ListItem","position":2,"name":"Research","item":"https://bitcoinsahi.com/research/"},{"@type":"ListItem","position":3,"name":"%s","item":"https://bitcoinsahi.com/research/%s.html"}]}
</script>
<title>%s — BSAHI Research</title>
<style>%s</style>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
</head>
<body>
<script src="/js/site-nav.js"></script>
<div class="container">
<h1>%s</h1>
%s
<div class="datacard"><div class="kv">Data source: <code>data/%s</code> — deterministic, frozen-input instrument; re-runnable offline.</div></div>
<p style="margin-top:32px;"><a href="/research">← All research</a> · <a href="/learn">← Back to Learn</a></p>
</div>
<footer><div class="links"><a href="/">Home</a><a href="/live">Decide</a><a href="/learn">Learn</a><a href="/capacity">Capacity</a><a href="/fork-tracker">Fork</a><a href="/research">Research</a></div><div>Bitcoin Sahi — research and decision platform for the Bitcoin block space economy</div></footer>
</body>
</html>
''' % tuple([title, title, name, name, title, name, title, STYLE, title, rendered, DATA_FILE.get(name, name + '.json')])


def main():
    for name in NOTES:
        title = humanize(name)
        html = page(name, title, None)
        out = os.path.join(REPO, 'research', name + '.html')
        with open(out, 'w') as f:
            f.write(html)
        print('wrote', out)


if __name__ == '__main__':
    main()