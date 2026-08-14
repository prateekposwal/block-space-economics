# Marketing Archive

Archived marketing copy — kept for provenance, **no longer served at the
marketing URLs** and **not used by the live publisher**.

## Why these are archived (2026-08-14)

### `2026-07-30-linkedin-fee.md` (+ `2026-07-30-twitter-fee.md`)
These posts carried **stale measurement claims** from the v1.0.0 era:
- SCCR `0.0149` / `1.5%` — the canonical figure is now **live** at
  `/data/sccr.json` (v2.1.0, ~0.24 as of 2026-08-14) and on `/learn`.
- `27,800 nodes` — the live node census (agent-25, `node_census` capture
  source) reports **32,000 known addresses**. The hardcoded 27,800 was ~17×
  off the live SCCR denominator and could not be reconciled.

The marketing generator (`tools/marketing/agent.js`) was ALSO fixed on
2026-08-14 so it reads `data/sccr.json` + the live `node_census` capture and
never emits these hardcoded figures again.

### `post-report.md`
Listed posts as authored by **named personas** ("Satoshi Block", "Hal Finney Jr")
under a single Nostr key. That framing misrepresented the publishing model:
the Research Council publishes as **autonomous AI research agents with neutral
role titles** (e.g. "Fees Analyst"), not named human personas. See `/learn`
Research Council section and `tools/agents/21-identity-agent.js` for the
current identity surface.

## Honesty pattern
Archived copy is preserved verbatim (with a SUPERSEDED banner) so history
stays auditable — but nothing here is canonical, and nothing here feeds the
live site. Canonical figures always come from `data/*.json`.
