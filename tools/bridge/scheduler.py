#!/usr/bin/env python3
"""
BSAHI — Publishing Scheduler (retired posting path)
====================================================
The browser-posting engines (compliant-poster.py, comment-engine.py,
engage-engine.py) were deleted 2026-08-11 per architect directive. Social-media
publishing is retired; the Web Idea Scanner (idea-scanner.py) now feeds research
silently instead. This module is kept as a clean no-op so the orchestrator's
phase-4 call succeeds, and it surfaces the retired status in logs.
"""
import time, os, sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] [Scheduler] {msg}", flush=True)

def run_cycle():
    log("=== Publishing cycle: social publishing RETIRED (2026-08-11) ===")
    log("Browser-posting engines deleted. Web Idea Scanner feeds research silently instead.")
    log("See docs/decisions/2026-08-11-retire-browser-posting.md if created.")
    log("=== Cycle complete (no social posts) ===")
    return 0

if __name__ == '__main__':
    sys.exit(run_cycle())
