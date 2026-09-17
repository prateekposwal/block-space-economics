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


def seo_title(md):
    """Optional short SEO <title> from an HTML comment: <!-- seo-title: ... -->.
    Used verbatim (no brand suffix) so it can be kept under ~60 characters."""
    m = re.search(r'<!--\s*seo-title:\s*(.+?)\s*-->', md)
    return m.group(1).strip() if m else None


def _plain(title):
    """Plain-text title for <title>/og/breadcrumb (drop inline markdown)."""
    return html.unescape(re.sub(r'[*`]', '', title)).strip()


def sync(name):
    md_path = os.path.join(REPO, 'research', name + '.md')
    html_path = os.path.join(REPO, 'research', name + '.html')
    if not (os.path.exists(md_path) and os.path.exists(html_path)):
        return None
    with open(md_path) as f:
        md = f.read()
    title = grp.md_title(md)
    if not title:
        return None
    with open(html_path) as f:
        orig = f.read()
    text = orig

    # Body region: everything between the <h1> line and the back-link line.
    lines = text.split('\n')
    starts = [i for i, l in enumerate(lines) if l.startswith(H1_MARK)]
    ends = [i for i, l in enumerate(lines) if l.startswith(END_MARK)]
    if starts and ends and ends[0] > starts[0]:
        end = ends[0]
        # Keep a trailing data card (calibration notes) as chrome.
        if lines[end - 1].startswith(DATACARD_MARK):
            end -= 1
        body = grp.render_md_body(md).split('\n')
        lines = lines[:starts[0] + 1] + body + lines[end:]
        text = '\n'.join(lines)

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
