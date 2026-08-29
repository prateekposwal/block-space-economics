# Correction flag — Storage Cost Coverage Ratio v2.0.0 (2026-08-02)

## What changed
Internal validation found a duplicated time-horizon term in `tools/research/storage-ratio.js`
(v1.0.0): `costPerBytePerYear` divided by `yearsOfStorage` AND `computeRatio` multiplied by
`years`. cb was inflated 10x; the ratio was deflated 10x. Corrected in
`research/model-spec.json` v2.0.0 (cb is horizon-free; T enters only via L).

- Old published figure (v1.0.0 reports/posts): avg ratio 0.0149–0.0176 (~1.5–1.8%), 100% of blocks below 1x.
- Corrected figure (v2.0.0): avg ratio 0.1719 (~17.2%), 100% of blocks below 1x.
- Direction of the finding is UNCHANGED (fees do not cover the estimated storage externality).

## Action taken
- Published Nostr events from the v1.0.0 period were NOT retroactively edited (immutability +
  honest provenance). This file is the correction record.
- Any NEW published content must use the v2.0.0 figure (see `tools/bridge/story-content.js`
  and the publishing path — update applied at the time; the comment/reply engine
  files listed in the original record were removed from the repo on 2026-08-11 and 2026-08-29).
- `learn.html`, `embed.html`, and agent-15 metrics serve the corrected value.

## Backstop
The next storage-ratio run inserts a v2.0.0 row into `research_findings`; agent-15 now reads
the version from the DB row / model-spec, never a hardcoded `1.0.0`.
