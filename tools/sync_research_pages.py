#!/usr/bin/env python3
"""Re-render the body of served research pages in place from their .md sources,
preserving each page's migrated chrome (style block, site-nav, footer, <h1>).

tools/generate_research_pages.py still emits the pre-migration palette and a
<header> block, so re-running it would clobber the migrated design. This syncer
replaces ONLY the rendered-markdown region — everything between the page's
<h1>...</h1> and its '<p style="margin-top:32px;">' back-link — and leaves the
head/body chrome byte-identical.

Use when an .md source has been edited and its served .html is stale.

Run: python3 tools/sync_research_pages.py [page ...]
     (defaults to the known-drifted pages)
"""
import importlib.util
import os
import sys

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
_spec = importlib.util.spec_from_file_location(
    'grp', os.path.join(REPO, 'tools', 'generate_research_pages.py'))
grp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(grp)  # gives render_md()

START_MARK = '<h1>'
END_MARK = '<p style="margin-top:32px;">'

DEFAULT = ['working-paper', 'satoshi-primary-source-note',
           'whitepaper-patterns', 'widget-product']


def sync(name):
    md_path = os.path.join(REPO, 'research', name + '.md')
    html_path = os.path.join(REPO, 'research', name + '.html')
    with open(md_path) as f:
        md = f.read()
    with open(html_path) as f:
        lines = f.read().split('\n')

    starts = [i for i, l in enumerate(lines) if l.startswith(START_MARK)]
    ends = [i for i, l in enumerate(lines) if l.startswith(END_MARK)]
    if not starts or not ends:
        raise SystemExit(f'{name}: markers not found (h1={starts} end={ends})')
    start, end = starts[0], ends[0]
    if end <= start:
        raise SystemExit(f'{name}: end marker precedes h1')

    rendered = grp.render_md(md).split('\n')
    out = lines[:start + 1] + rendered + lines[end:]
    with open(html_path, 'w') as f:
        f.write('\n'.join(out))
    return len(lines), len(out)


if __name__ == '__main__':
    names = sys.argv[1:] or DEFAULT
    for n in names:
        before, after = sync(n)
        print(f'{n}: {before} -> {after} lines')
