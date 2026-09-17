#!/usr/bin/env python3
"""SCCR staleness-gated local fallback.

The cloud tier (research-data.yml) owns the SCCR by design (Mac-independent). But
if that workflow stalls, the reading freezes silently — which is exactly what
happened on 2026-09-17 (last cloud commit 11:12; the headline sat at a manual
run's value for hours).

This is the safety net: if the committed data/sccr.json is older than MAX_AGE_H (default 2h; the cloud tiers every 30 min),
produce a fresh reading from the LOCAL capture DB and let the normal chain
re-derive everything downstream. If the cloud is healthy, this does nothing — so
there is never a second writer.

Run: python3 tools/research/sccr_fallback.py          (used by com.bsahi.collectors)
"""
import datetime
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SCCR = os.path.join(ROOT, "data", "sccr.json")
MAX_AGE_H = float(os.environ.get("SCCR_FALLBACK_MAX_AGE_H", 2))


def age_hours():
    try:
        d = json.load(open(SCCR))
        gen = d.get("generated_at")
        if not gen:
            return 1e9
        t = datetime.datetime.fromisoformat(gen.replace("Z", "+00:00"))
        return (datetime.datetime.now(datetime.timezone.utc) - t).total_seconds() / 3600
    except Exception:
        return 1e9


def main():
    a = age_hours()
    if a <= MAX_AGE_H:
        print("SCCR fresh (%.1fh <= %.0fh) - cloud tier healthy, no action" % (a, MAX_AGE_H))
        return 0
    print("SCCR STALE (%.1fh > %.0fh) - producing a fresh reading from the local DB" % (a, MAX_AGE_H))
    r = subprocess.run([sys.executable, os.path.join(ROOT, "tools", "research", "sccr_live.py")],
                       cwd=ROOT)
    return r.returncode


if __name__ == "__main__":
    sys.exit(main())
