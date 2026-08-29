# Decision 2026-07-31 — Retire LinkedIn/Medium Engagement Leg

**Status:** ACCEPTED (Kintsugi — recorded as a lesson, not hidden)

## What was tried
- `tools/bridge/engage-engine.py` (LinkedIn + Medium) in orchestrator Phase 3, targets 3+3/cycle
- Comment templates with live data, discovery TTLs (2h feed / 4h tag), Chrome TCC/OSA automation
- Fresh-tab batches + trusted-paste posting technique

## What the data showed
- `captured-data/engage-state.json`: `li_today=0, md_today=0` every cycle (evidence: `day="2026-08-01"`, `done=[]`)
- `engagement.log`: browser-automation friction (LinkedIn security challenge on fresh tabs, TOS surface) consumed cycle compute for zero signal
- The 0/3 landing held across the observation window despite multiple technique attempts

## Why retired
- 0/3 landing = platform-policy problem, not a cadence or content problem. Each cycle burned compute/time with zero signal.
- LinkedIn's fresh-tab security challenge and Medium's login wall made automation fragile and low-yield.

## Archived for
- **Syndication-only reuse**: the discovery + content half of `engage-engine.py` may be salvaged for posting BSAHI's own content; the engagement half (commenting on others' content) is retired.

## How to re-enable
1. Re-scope to syndication-only first (don't re-enable the comment loop as-is).
2. `tools/bridge/orchestrator-config.json` → `"engage": {"enabled": true, ...}`.
3. Reset `captured-data/engage-state.json` day field.
4. Restart orchestrator (config is read once at boot).

## Evidence
- `captured-data/engage-state.json` (0/0 trail)
- `captured-data/engagement.log`
- Orchestrator Phase 3 (config-gated, fails closed)

## Unaffected (historical — engines since removed)
- Reddit comment engine — retired 2026-08-11 (engine removed from repo)
- Reddit reply engine — retired 2026-08-29 (engine removed from repo)
