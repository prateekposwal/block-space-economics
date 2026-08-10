#!/usr/bin/env python3
"""Generate crawlable /research/<name>.html pages from research/*.md.
Run: python3 tools/generate_research_pages.py"""
import os, re, html, glob

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
RESEARCH = os.path.join(REPO, 'research')
OUT = os.path.join(REPO, 'research')
EXCLUDE = {'architect-notes.md'}

NAV = '''<nav class="nav"><a href="/" class="nav-item">Home</a><a href="/live" class="nav-item">Live Fees</a><a href="/learn" class="nav-item">Learn</a><a href="/capacity" class="nav-item">Capacity</a><a href="/fork-tracker" class="nav-item">Fork Tracker</a><span class="nav-item active">Research</span></nav>'''

STYLE = '''body{background:#1A1612;color:#E8E5E0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0}
header{background:#231F19;border-bottom:1px solid #3A3228;padding:16px 24px}
.header-inner{max-width:960px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}
.brand{color:#F7931A;font-weight:700;text-decoration:none;font-size:1.1rem}
.nav{display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.nav-item{padding:6px 14px;font-size:.875rem;font-weight:500;color:#9B8B78;border-radius:6px;text-decoration:none;transition:all .2s}
.nav-item:hover{color:#EADCC8;background:#2A251E}
.nav-item.active{background:#2A251E;color:#EADCC8}
@media(max-width:600px){.header-inner{padding:0 12px}.nav{gap:6px}.nav-item{padding:5px 9px;font-size:.78rem}}
.container{max-width:960px;margin:0 auto;padding:40px 24px 80px}
h1{color:#F7931A;font-size:1.9rem;margin:0 0 8px}
h2{color:#EADCC8;font-size:1.3rem;margin:28px 0 12px}
h3{color:#EADCC8;font-size:1.1rem;margin:20px 0 8px}
p{color:#C9C2B8;line-height:1.8;margin:0 0 14px}
a{color:#D4933A}
table{border-collapse:collapse;margin:14px 0;width:100%}
th,td{border:1px solid #3A3228;padding:8px 12px;text-align:left;font-size:.9rem}
th{background:#231F19;color:#EADCC8}
blockquote{border-left:3px solid #F7931A;margin:14px 0;padding:4px 16px;color:#9B8B78;background:#1F1B16}
pre,code{background:#231F19;border-radius:6px;font-family:'SF Mono',Menlo,monospace}
pre{padding:14px;overflow-x:auto}
code{padding:2px 5px;font-size:.88em}
ul,ol{color:#C9C2B8;line-height:1.7;padding-left:24px}
hr{border:none;border-top:1px solid #3A3228;margin:24px 0}
footer{border-top:1px solid #3A3228;padding:24px;text-align:center;font-size:.85rem;color:#6A5D4E}
footer .links{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-bottom:10px}
footer .links a{color:#6A5D4E;text-decoration:none}
footer .links a:hover{color:#D4933A}'''


def inline(s):
    # F3: tokenize links on the RAW string first so html.escape doesn't break them
    tokens = []
    def link_repl(m):
        tokens.append((m.group(1), m.group(2)))
        return '\x00L%d\x00' % (len(tokens) - 1)
    s = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', link_repl, s)
    s = html.escape(s)
    s = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', s)
    s = re.sub(r'`([^`]+)`', r'<code>\1</code>', s)
    for idx, (text, url) in enumerate(tokens):
        s = s.replace('\x00L%d\x00' % idx, '<a href="' + html.escape(url) + '">' + html.escape(text) + '</a>')
    return s


def render_md(text):
    lines = text.split('\n')
    out = []
    i = 0
    in_code = False
    code_buf = []
    table_buf = []
    in_table = False
    in_ul = False
    in_ol = False

    def flush_table():
        nonlocal table_buf, in_table
        if table_buf:
            rows = [r for r in table_buf if r and r.strip()]
            # F1: skip separator rows like |---|----| (all-dash cells)
            rows = [r for r in rows if not all(re.fullmatch(r'-{2,}', c.strip()) for c in r.strip().strip('|').split('|') if c.strip())]
            if len(rows) >= 2:
                out.append('<table>')
                for ri, r in enumerate(rows):
                    cells = [c.strip() for c in r.strip().strip('|').split('|')]
                    tag = 'th' if ri == 0 else 'td'
                    out.append('<tr>' + ''.join('<' + tag + '>' + inline(c) + '</' + tag + '>' for c in cells) + '</tr>')
                out.append('</table>')
            table_buf = []
            in_table = False

    def flush_lists():
        nonlocal in_ul, in_ol
        if in_ul: out.append('</ul>'); in_ul = False
        if in_ol: out.append('</ol>'); in_ol = False

    while i < len(lines):
        line = lines[i]
        if line.strip().startswith('```'):
            if in_code:
                out.append('<pre><code>' + html.escape('\n'.join(code_buf)) + '</code></pre>')
                code_buf = []
                in_code = False
            else:
                flush_table()
                flush_lists()
                in_code = True
            i += 1
            continue
        if in_code:
            code_buf.append(line)
            i += 1
            continue
        if line.strip().startswith('|'):
            flush_lists()
            in_table = True
            table_buf.append(line)
            i += 1
            continue
        flush_table()
        s = line.strip()
        if not s:
            i += 1
            continue
        m = re.match(r'^(#{1,3})\s+(.*)', s)
        if m:
            # F2: flush open lists before block elements
            flush_lists()
            # Demote: page title is the H1, so md #->h2, ##->h3, ###->h4
            lvl = min(len(m.group(1)) + 1, 4)
            out.append('<h' + str(lvl) + '>' + inline(m.group(2)) + '</h' + str(lvl) + '>')
        elif s == '---':
            flush_lists()
            out.append('<hr>')
        elif s.startswith('> '):
            flush_lists()
            out.append('<blockquote>' + inline(s[2:]) + '</blockquote>')
        elif re.match(r'^(-|\*)\s+', s):
            if not in_ul: out.append('<ul>')
            out.append('<li>' + inline(re.sub(r'^(-|\*)\s+', '', s)) + '</li>')
            in_ul = True
        elif re.match(r'^\d+\.\s+', s):
            if not in_ol: out.append('<ol>')
            out.append('<li>' + inline(re.sub(r'^\d+\.\s+', '', s)) + '</li>')
            in_ol = True
        else:
            flush_lists()
            out.append('<p>' + inline(s) + '</p>')
        i += 1
    flush_table()
    flush_lists()
    if in_code:
        out.append('<pre><code>' + html.escape('\n'.join(code_buf)) + '</code></pre>')
    return '\n'.join(out)


def humanize(name):
    return name.replace('_', ' ').replace('.md', '').title()


def first_para(text):
    """First meaningful paragraph: skip headings, tables, lists, bare URLs,
    hr, and front-matter lines like 'Project:'/'Date:'/'Sources:'."""
    for line in text.split('\n'):
        s = line.strip()
        if not s or s.startswith('#') or s.startswith('|') or s == '---':
            continue
        if re.match(r'^(-|\*|\d+\.)\s+', s):
            continue
        if re.match(r'^[A-Za-z]+:', s) and len(s.split(':')) == 2 and len(s) < 40:
            continue
        if re.match(r'^\*\*[A-Za-z]+:\*\*', s):  # bold front-matter: **Project:** ...
            continue
        if re.match(r'^https?://', s):
            continue
        clean = html.unescape(re.sub(r'\*\*|__|`|\[([^\]]*)\]\([^)]*\)', r'\1', s))
        if clean:
            return clean
    return ''


def truncate_words(s, n):
    words = s.split(' ')
    if len(words) <= n:
        return s
    return ' '.join(words[:n]) + '…'


def make_desc(title, first_para_text):
    d = first_para_text or title
    d = html.unescape(re.sub(r'\*\*|__|`|\[|\]', '', d))
    # Pad to 140+ chars with a research suffix if needed
    suffix = ' Bitcoin block space economics research from BSAHI — live fee, mempool, and settlement data from the autonomous research engine.'
    while len(d) < 140:
        d = d + suffix
    return d[:165]


def make_page(name, title, desc, body, breadcrumb):
    return '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="''' + html.escape(desc[:160]) + '''">
<meta property="og:title" content="''' + title + '''">
<meta property="og:type" content="article">
<meta property="og:url" content="https://bitcoinsahi.com/research/''' + name + '''.html">
<meta property="og:image" content="https://bitcoinsahi.com/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1A1612">
<link rel="canonical" href="https://bitcoinsahi.com/research/''' + name + '''.html">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://bitcoinsahi.com/"},{"@type":"ListItem","position":2,"name":"Research","item":"https://bitcoinsahi.com/research/"},{"@type":"ListItem","position":3,"name":"''' + title + '''","item":"https://bitcoinsahi.com/research/''' + name + '''.html"}]}
</script>
<title>''' + title + ''' — BSAHI Research</title>
<style>''' + STYLE + '''</style>
</head>
<body>
<header><div class="header-inner"><a href="/" class="brand">⬡ BSAHI</a>''' + NAV + '''</div></header>
<div class="container">
<h1>''' + title + '''</h1>
''' + body + '''
<p style="margin-top:32px;"><a href="/research">← All research</a> · <a href="/learn">← Back to Learn</a></p>
</div>
<footer><div class="links"><a href="/">Home</a><a href="/live">Decide</a><a href="/learn">Learn</a><a href="/capacity">Capacity</a><a href="/fork-tracker">Fork</a><a href="/research">Research</a></div><div>Bitcoin Sahi — research and decision platform for the Bitcoin block space economy</div></footer>
</body>
</html>
'''


def main():
    files = sorted(glob.glob(os.path.join(RESEARCH, '*.md')))
    manifest = {}
    try:
        import json as _json
        with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'research_manifest.json')) as _mf:
            manifest = _json.load(_mf)
    except Exception:
        manifest = {}
    internal = set(manifest.get('internal', []))
    # INTERNAL docs: do NOT generate public HTML at all (they hold plans, personal
    # names, review drafts). They remain .md sources only — never served as pages.
    exclude = EXCLUDE | internal
    files = [f for f in files if os.path.basename(f) not in exclude]
    summaries = []
    for f in files:
        name = os.path.splitext(os.path.basename(f))[0]
        with open(f) as fh:
            text = fh.read()
        title = humanize(name)
        desc = make_desc(title, first_para(text))
        body = render_md(text)
        page = make_page(name, title, desc, body, None)
        with open(os.path.join(OUT, name + '.html'), 'w') as fh:
            fh.write(page)
        summaries.append((name, title, first_para(text)))
        print('wrote', name + '.html')

    # index page — manifest-driven, grouped, curated (internal/working docs excluded)
    def _item_html(it):
        return '<li><a href="/research/%s.html">%s</a><div class="rd">%s</div></li>' % (
            it['file'].replace('.md', ''), html.escape(it['title']), html.escape(it['desc']))

    groups_html = ''
    for grp in manifest.get('groups', []):
        items = [_item_html(it) for it in grp.get('items', [])]
        groups_html += '<h2>%s</h2><p class="rg">%s</p><ul class="rlist">%s</ul>' % (
            html.escape(grp['name']), html.escape(grp.get('description', '')), ''.join(items))

    index = '''<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="The BSAHI open research library on Bitcoin block space economics — Bitcoin Resource Accounting: measuring how much of every long-lived resource cost the fee market internalizes. Live Bitcoin network data, updated continuously.">
<meta property="og:title" content="BSAHI Research — Bitcoin Resource Accounting">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://bitcoinsahi.com/"},{"@type":"ListItem","position":2,"name":"Research","item":"https://bitcoinsahi.com/research/"}]}
</script>
<meta property="og:url" content="https://bitcoinsahi.com/research/">
<meta property="og:image" content="https://bitcoinsahi.com/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="https://bitcoinsahi.com/research/">
<title>BSAHI Research — Bitcoin Resource Accounting</title>
<style>''' + STYLE + '''
.rlist{list-style:none;padding:0;margin:0 0 32px}
.rlist li{background:#1F1B16;border:1px solid #3A3228;border-radius:10px;padding:14px 18px;margin:0 0 12px;transition:all .2s}
.rlist li:hover{border-color:#F7931A;transform:translateX(4px)}
.rlist a{color:#EADCC8;font-weight:600;text-decoration:none;font-size:1.05rem}
.rlist a:hover{color:#F7931A}
.rd{color:#9B8B78;font-size:.9rem;margin-top:4px;line-height:1.6}
.rg{color:#9B8B78;font-size:.95rem;margin-bottom:16px}
</style></head>
<body>
<header><div class="header-inner"><a href="/" class="brand">⬡ BSAHI</a>''' + NAV + '''</div></header>
<div class="container">
<h1>BSAHI Research</h1>
<p><strong>Bitcoin Resource Accounting</strong> — the research program of Bitcoin
Sahi: a complete accounting system for every long-lived resource Bitcoin consumes
(replicated storage, UTXO state, validation, relay, bandwidth), quantifying how
much of each cost the fee market internalizes. <strong>SCCR (storage) is Metric
#1</strong> — the first measured member of the RIR family; the rest are research
hypotheses. Open research on block space economics — the fee market, mempool
dynamics, and the permanent cost of data storage.</p>
''' + groups_html + '''
<p style="margin-top:32px;"><a href="/learn">← Back to Learn</a></p>
</div>
<footer><div class="links"><a href="/">Home</a><a href="/live">Decide</a><a href="/learn">Learn</a><a href="/capacity">Capacity</a><a href="/fork-tracker">Fork</a><a href="/research">Research</a></div><div>Bitcoin Sahi — research and decision platform for the Bitcoin block space economy</div></footer>
</body>
</html>
'''
    with open(os.path.join(OUT, 'index.html'), 'w') as fh:
        fh.write(index)
    print('wrote index.html')


if __name__ == '__main__':
    main()
