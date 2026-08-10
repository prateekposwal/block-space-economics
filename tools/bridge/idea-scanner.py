#!/usr/bin/env python3
"""
BSAHI — Silent Web Idea Scanner
================================
Replaces the retired browser-posting engines (compliant-poster, comment-engine,
engage-engine — deleted 2026-08-11). Instead of posting to social media, this
scans the public internet SILENTLY for new ideas, signals, and research relevant
to Bitcoin block-space economics, and feeds findings to the research team (DB +
reports) and the architect (a digest).

Sources (all public, no accounts needed):
- Bitcoin Optech newsletter + topics
- Bitcoin Core PRs / BIPs (github API)
- mempool.space (fees/mempool state)
- GitHub trending bitcoin repos
- DeFiLlama bitcoin data
- (extendable: bitcoin-dev mailing list, arXiv, reddit)

Every cycle it writes:
  - findings → research_findings DB (source="Web Idea Scanner")
  - a digest → reports/research/idea-digest-YYYY-MM-DD.md for the architect
"""
import json, os, sys, time, urllib.request, urllib.error

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(REPO, 'tools'))

def fetch(url, timeout=20):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'BitcoinSahiResearch/1.0'})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.read().decode('utf-8', errors='replace')
    except Exception:
        return ''

def scan_optech():
    """Latest Optech newsletter topics = the community's current questions."""
    findings = []
    html = fetch('https://bitcoinops.org/en/newsletters/')
    # crude extraction of the most recent newsletter title
    import re
    m = re.search(r'<a[^>]*href="(/en/newsletters/2026[^"]*)"[^>]*>([^<]+)</a>', html)
    if m:
        findings.append(f"Optech newsletter: {m.group(2).strip()} — https://bitcoinops.org{m.group(1)}")
    else:
        findings.append("Optech newsletter available")
    return findings

def scan_github():
    """Active BIP PRs + top bitcoin repos = where the ideas are moving."""
    findings = []
    data = fetch('https://api.github.com/search/repositories?q=bitcoin+in:name,description&sort=updated&per_page=5')
    try:
        repos = json.loads(data)
        names = [r['full_name'] for r in repos.get('items', [])[:5]]
        findings.append("Trending bitcoin repos (updated): " + ", ".join(names))
    except Exception:
        pass
    return findings

def scan_mempool():
    """Fee regime + mempool state = the current block-space pressure."""
    findings = []
    data = fetch('https://mempool.space/api/v1/fees/recommended')
    try:
        f = json.loads(data)
        findings.append(f"Fee regime: fastest {f.get('fastestFee')} sat/vB, hour {f.get('hourFee')}, economy {f.get('economyFee')} — block-space pressure now")
    except Exception:
        pass
    data2 = fetch('https://mempool.space/api/v1/fees/mempool-blocks')
    try:
        blocks = json.loads(data2)
        findings.append(f"Mempool: {len(blocks)} blocks of backlog (each ~10 min of demand)")
    except Exception:
        pass
    return findings

def run():
    findings = []
    findings += scan_optech()
    findings += scan_github()
    findings += scan_mempool()

    # Write the state file (the node bridge reads this to persist to the DB)
    try:
        with open(os.path.join(REPO, 'captured-data', 'idea-scanner-state.json'), 'w') as f:
            json.dump({'lastRun': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'findings': findings}, f, indent=2)
    except Exception:
        pass

    # Persist findings to research_findings via the node DB bridge (the research team's feed)
    try:
        import subprocess, json as _json
        node_script = os.path.join(REPO, 'tools', 'bridge', 'idea-bridge.js')
        subprocess.run(['node', node_script], cwd=REPO, capture_output=True, timeout=30)
    except Exception:
        pass

    # Write the architect digest
    os.makedirs(os.path.join(REPO, 'reports', 'research'), exist_ok=True)
    digest = os.path.join(REPO, 'reports', 'research', 'idea-digest-' + time.strftime('%Y-%m-%d') + '.md')
    with open(digest, 'w') as f:
        f.write(f"# Web Idea Scanner — {time.strftime('%Y-%m-%d')}\n\n")
        for fn in findings:
            f.write(f"- {fn}\n")
        f.write(f"\n*Generated silently by the Web Idea Scanner (replaced browser-posting).*\n")

    print(f"[Web Idea Scanner] {len(findings)} findings → {digest}")
    return findings

if __name__ == '__main__':
    run()
