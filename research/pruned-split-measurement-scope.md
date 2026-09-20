# Pruned-vs-Archival Split — Measurement Scope (build-or-document resolution)

**BSAHI — census companion**
*Produced: 2026-09-16*

## Verdict

**The pruned-vs-archival split is NOT remotely observable from the current
pipeline, and the recommended P2P probe cannot execute from this environment.
Resolution: DOCUMENTED READING, open data door** — no split is fabricated; the
measurement path is specified and blocked on one concrete dependency (P2P
egress), not on research design.

## Why it is not observable

The Bitcoin P2P protocol does not advertise pruning state in `getnodeaddresses`,
`version`, or `getaddr` messages. Bitcoin Core's `getpeerinfo`/`getnodeaddresses`
carry no pruning field (verified: all census captures, `research/archival-vs-
pruned-note.md §2`). A reachable-node scan reports connectivity + self-declared
`user_agent`/version only.

## The only viable measurement path (unchanged from companion note §4, option 1)

Probe reachable peers with `getdata` for a deep block (older than the ~550-block
default prune window). Archival nodes serve the bytes; pruned nodes return
"not found". Classify only "served-deep-block = archival-proven"; everything else
is "not proven archival (pruned OR uncooperative OR filter-blocked)". Sample-size
and error bounds must be stated, and reputation for re-probes handled.

## Why it could not run here (evidence)

P2P egress test 2026-09-16: sampled 12 current reachable nodes from btcnodes.io
`/api/v1/nodes/`. 2/12 completed TCP connect; both returned **zero** application
bytes after a full Bitcoin `version` handshake was sent (expected: node replies
`version`+`verack`). Remaining 10 timed out or failed DNS. Conclusion:
SYN connectivity exists to a minority of hosts but **no P2P application traffic
flows from this environment** — the handshake never completes. The probe requires
an environment with working 8333 egress (e.g., the local Mac where `bitcoind`
ran, or a small cloud worker). Until then the split stays unmeasured.

## What IS observable instead (captured 2026-09-16)

`tools/research/node_version_distribution.py` + `data/node_version_distribution.json`:
- 26,577 reachable nodes scanned via btcnodes.io `/api/v1/nodes/`.
- **97.7% self-declared Bitcoin Core**; top exact versions: 31.1.0 (6,226),
  29.3.0 (3,991), 31.0.0 (2,268); 38.8% on Core 30/31.
- Caveat: `user_agent` is self-declared (does not verify binary provenance).
This is the software/version distribution proxy the stale census note asks for —
NOT a pruning split. It feeds the governance/upgrade-readiness class (row 12), not
the storage class (row 4/5).

## SCCR sensitivity (unchanged from companion note)

If a large pruned share f exists, the SCCR denominator over-states the
storage-bearing population; SCCR is then an upper bound on the burden borne by
the archival class. The knife-edge: at live baseline SCCR≈0.29 (N=26,586), the cross
happens only below N_archival≈7,130 nodes — so even ~78% pruning does not flip the
headline, though it concentrates the unpriced burden on the archival minority.
Row 5 grading and THESIS §9 absorb this as a stated upper-bound reading.

## Status flags

- Data door: **OPEN** (documented, blocked on environment egress).
- No fabrication: no split number exists in the repo.
- Next concrete step when P2P egress is available: agent-26 probe (deep-block
  `getdata` against a sampled subset of the 26.5K reachable addresses).