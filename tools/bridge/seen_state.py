#!/usr/bin/env python3
"""
BSAHI — seen-state wrapper (python side)
Consulted by the python engagement engines before opening any tab.
All reads/writes go through the single canonical Node owner (seen-state.js).
Also exposes shared config cooldowns (single source of truth: orchestrator-config.json).
"""
import subprocess, json, os, sys

REPO = '/Users/prateekposwal/block-space-economics'
CLI = os.path.join(REPO, 'tools/bridge/seen-state.js')
CONFIG_FILE = os.path.join(REPO, 'tools/bridge', 'orchestrator-config.json')

def _run(args):
    r = subprocess.run(['node', CLI] + args, capture_output=True, text=True, timeout=15, cwd=REPO)
    return (r.stdout or '').strip()

def cooldown_ms(key, default_ms):
    try:
        with open(CONFIG_FILE) as f:
            cfg = json.load(f)
        sec = (cfg.get('cooldowns') or {}).get(key)
        if sec is None:
            return default_ms
        return int(sec) * 1000
    except Exception:
        return default_ms

def page_fresh(kind, key, ttl_ms):
    try:
        return _run(['page-fresh', kind, key, str(ttl_ms)]) == '1'
    except Exception:
        return False

def mark_page_scanned(kind, key, meta=None):
    try:
        return _run(['page-mark', kind, key]) == 'ok'
    except Exception:
        return False

def item_seen(kind, key):
    try:
        return _run(['item-seen', kind, key]) == '1'
    except Exception:
        return False

def mark_item(kind, key, action='discovered'):
    try:
        return _run(['item-mark', kind, key, action]) == 'ok'
    except Exception:
        return False

def stats():
    try:
        return json.loads(_run(['stats']))
    except Exception:
        return {}

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'stats':
        print(json.dumps(stats(), indent=2))
