#!/usr/bin/env python3
"""Rebuild articles.html's Blog ItemList from the article cards themselves.

The ItemList is structured data that must agree with the visible archive. It
drifted once — positions 1..20 for 27 cards — because it was hand-edited alongside
the HTML, and a hand-added 21st entry would have preserved the gap. This derives
it from the cards, so the two cannot disagree.

Card order in the DOM is chronological (oldest first); the client-side sort only
reorders visually, so the ItemList follows DOM order.

Usage:
    python3 tools/rebuild_articles_itemlist.py           # rewrite only if stale
    python3 tools/rebuild_articles_itemlist.py --check   # exit 1 if out of sync
"""
import argparse
import html
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARTICLES = os.path.join(ROOT, "articles.html")

CARD_RE = re.compile(
    r'<div class="article">\s*'
    r'<div class="date">(?P<date>[^<]*)</div>\s*'
    r'<h2><a href="(?P<href>[^"]+)">(?P<title>.*?)</a></h2>',
    re.S)
ITEMLIST_RE = re.compile(
    r'(<script type="application/ld\+json">)'
    r'(\s*\{"@context":"https://schema\.org","@type":"ItemList".*?)'
    r'(\s*</script>)',
    re.S)


def build_itemlist(cards):
    """Compact JSON-LD ItemList matching the existing style (no spaces)."""
    items = []
    for i, c in enumerate(cards, 1):
        href = c.group("href")
        url = "https://bitcoinsahi.com" + href if href.startswith("/") else href
        items.append({"@type": "ListItem", "position": i, "url": url,
                      "name": html.unescape(c.group("title")).strip()})
    return json.dumps({"@context": "https://schema.org", "@type": "ItemList",
                       "name": "Bitcoin Sahi research archive",
                       "itemListElement": items},
                      separators=(",", ":"), ensure_ascii=True)


def rebuild(text):
    """(new_text, n_cards) or (None, reason) if the page is not in the expected shape."""
    cards = list(CARD_RE.finditer(text))
    if not cards:
        return None, "no article cards found"
    if len(ITEMLIST_RE.findall(text)) != 1:
        return None, "expected exactly 1 ItemList block, found %d" % len(ITEMLIST_RE.findall(text))
    new = build_itemlist(cards)
    return ITEMLIST_RE.sub(lambda m: m.group(1) + new + m.group(3), text, count=1), len(cards)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true",
                    help="do not write; exit 1 if the ItemList is out of sync")
    args = ap.parse_args()

    with open(ARTICLES) as f:
        text = f.read()
    out, n = rebuild(text)
    if out is None:
        print("rebuild-itemlist: %s" % n)
        return 1

    changed = out != text
    if args.check:
        print("rebuild-itemlist: %d cards, ItemList %s"
              % (n, "OUT OF SYNC" if changed else "in sync"))
        return 1 if changed else 0

    if changed:
        with open(ARTICLES, "w") as f:
            f.write(out)
        print("rebuild-itemlist: %d cards -> ItemList rebuilt" % n)
    else:
        print("rebuild-itemlist: %d cards, already in sync" % n)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
