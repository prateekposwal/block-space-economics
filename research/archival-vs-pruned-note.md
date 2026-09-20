# Archival vs Pruned — Companion Note to the Storage Paper (Phase I)

**Companion to:** `research/working-paper.md` v2.2.0 · `research/model-spec.json`
v2.1.1 · `research/roadmap.md` (adopted 2026-08-02, §7)
**Status:** REVIEWED (2026-08-04) — approved for simultaneous publication with the
paper (D7 sign-off). The pruning-split measurement gap it identifies is Phase I
follow-on, not a submission blocker.
**Framing:** how the pruned-vs-archival node distribution conditions the T=10
storage-cost assumption and the "who bears the cost" question.

---

## 1. Why this note exists

The SCCR model assumes every full node stores every block for T=10 years:

    L_net = C × T × N          (network lifetime storage cost, USD)
    SCCR  = fee_USD / L_net    (dimensionless)

Two of those terms rest on assumptions that pruning directly conditions:

- **T (storage horizon) = 10 yr** — model-spec.json marks it `kind: input` with
  `canonicalSource: "research/verification_appendix.md Open Q3 (assumption)"`.
  Working-paper §7 limitation 3 states it plainly: *"10-year horizon is an
  assumption; pruning shortens actual retention, permanent storage extends it."*
- **N (replication) = 26,586 nodes** — measured reachable (btcnodes crawl,
  2026-09-16), a lower bound. (The local addrman sample counts gossiped
  **addresses**, not nodes, and is not capped at 32,000: `getnodeaddresses 0`
  returned 61,302 on 2026-09-20. An earlier revision of this note misread the
  32,000 truncation as an addrman cap.) N says nothing about how many of those
  nodes retain the full chain vs. prune.

If a large share of nodes prune, then **who bears the storage cost** changes: only
archival nodes carry the disk/lifetime-storage burden the SCCR denominator prices.
The measured ratio is then an *upper bound* on the cost actually borne by any
single class of node — and the economically meaningful question becomes: what
fraction of the network is archival, and does the fee market price storage for
*that* class?

## 2. What the data actually is (investigated, 2026-08-02)

### 2.1 The node census — primary-source lower-bound census (getnodeaddresses RPC), reachability only

Source: `getnodeaddresses` RPC query (agent 25-node-census script) → `captured-data/spool/index/node_census/`
(schema `capture.node_census@1.0`). Fields captured per run, verified across all
captures:

| Field | Meaning |
|---|---|
| `totalKnownAddresses` | address-manager size from `getnodeaddresses 0` — the whole address set, **not a node count and not a cap** (61,302 as of 2026-09-20; 32,000 was a truncated request) |
| `liveConnections` / `inbound` / `outbound` | current P2P connection counts (`getpeerinfo`) |
| `networkVersion` / `connections` | Core version + configured connection count |

**There is no pruning-mode field.** The census records how many nodes the observer
node knows about and is connected to — it does not, and cannot from `getpeerinfo`/
`getnodeaddresses` alone, distinguish pruned from archival nodes. A programmatic
scan of all census captures returns exactly the field set above; zero pruned/
archival indicators.

### 2.2 Ancillary data — no split either

- `captured-data/node-geo-state.json` — 205 geo-located addresses by country
  (subset of the census). Geographic distribution only; no pruning info.
- `research/pruning_externality_analysis.md` — an *analytical* breakdown of what a
  pruned node still pays (download + verify ≈ unavoidable, storage ≈ avoidable
  ~70%). This is a per-node cost decomposition, **not** a measured population
  split. It tells us what pruned nodes would save, not how many nodes prune.

### 2.3 Conclusion — measurement gap

> **The repo's primary-source lower-bound census captures N (reachable node count, a lower bound; now 26,586) but does
> NOT contain a pruned-vs-archival split. No measured split exists in the repo as
> of 2026-08-02. This note therefore identifies the split as the measurement gap
> the companion study must close — it does not fabricate one.**

## 3. Why the split matters for T=10 and "who bears the cost"

The SCCR is homogeneous: `SCCR ∝ 1/(C × T × N)`. Pruning enters through T and N
simultaneously:

1. **Effective N shrinks for the storage leg.** If a fraction `f` of nodes prune,
   the storage-bearing population is `N_archival = N × (1 − f)`. At the live
   baseline (SCCR ≈ 0.223 at the pre-re-base N=32K), the average crosses 1× only below
   N ≈ 7,130 nodes — so even a 78% pruning rate (N_archival ≈ 7K) would *not* flip
   the headline on the live capture, but it would raise the ratio for archival
   nodes substantially. The knife-edge is documented in working-paper §5.4.
2. **Effective T shortens for pruned nodes** (retention = prune window, e.g. ~550
   blocks ≈ 3.8 days default vs 10 yr), but lengthens for archival nodes (indefinite).
   The model's single T=10 therefore sits *between* the two classes; the split
   determines whether the assumption over- or under-states the storage burden for
   the class that actually bears it.
3. **"Who bears the cost" is a two-class statement.** The paper's externality
   framing (working-paper §8.1) already concedes node operators choose to run
   nodes and may prune. The companion split quantifies how many choose storage —
   and therefore how concentrated the unpriced burden is. A mostly-pruned network
   makes the externality an *archival-node-only* burden; a mostly-archival network
   makes it network-wide.

**Direction of bias (honest statement):** if the pruned share is large, the model's
N over-states the storage-bearing population and the T=10 horizon over-states
retention for the majority — the SCCR as computed is an **upper bound** on the
storage burden actually borne by typical nodes, and the externality is concentrated
on a smaller archival class than the headline N implies. If the pruned share is
small, the assumption is close to the storage-bearing population and the headline
stands.

## 4. How the split would be measured (outline — the gap to close)

The split is not exposed by the current census. Candidate measurement paths, in
order of increasing effort:

1. **Extended census probing pruning behavior (recommended first step).** The
   Bitcoin P2P protocol does not advertise pruning state in `getnodeaddresses`;
   however a connected node's *behavior* is observable. An extension of the census
   would: (a) attempt historical-block requests (`getdata` for old heights) against
   a sample of reachable peers and record who serves them — archival nodes serve,
   pruned nodes refuse (an established technique in the literature); (b) correlate
   with `getpeerinfo` connection age and version. This turns the existing census
   into a pruned-vs-archival probe with **no new infrastructure**, only a new
   agent (agent-26) sampling a subset of the known addresses.
2. **Voluntary operator survey.** A short questionnaire (node software, prune
   setting, disk allocated) distributed via r/BitcoinEngineering, bitcoin-dev, and
   the Optech newsletter — cheap, but self-selection biased.
3. **Third-party/community datasets.** Published node surveys and academic
   measurements of pruning adoption (where they exist) would be cited and
   reconciled with the local census, not re-derived.
4. **Full-network enumeration** (e.g., a Bitnodes-style crawl probing all reachable
   addresses) — the most complete but highest-effort path; feasible only if the
   Phase II/III budget justifies it.

**What this note adds to the paper (pre-submission):** a stated limitation with a
defined measurement path, so reviewers see the T=10 / N assumptions as *bounded
and scheduled for measurement*, not silent. Publication sequencing: the companion
note ships with (or immediately after) the working paper; the actual split
measurement is Phase I follow-on work, not a blocker for v2.1.0 submission.

## 5. DONE vs LEFT

**DONE (verified):**
- Census data investigated (getnodeaddresses source, all spool captures, node-geo,
  pruning_externality_analysis) — confirmed: reachability-only, no split.
- Data gap stated honestly; no fabricated split.
- Bias direction derived from the model (upper-bound framing).
- Measurement path outlined (4 options, cheapest first).

**LEFT / TODO (verified):**
- [x] Prateek review of this note before it ships with the paper. **DONE (2026-08-04).**
- [ ] Actual split measurement (agent-26 probing, survey, or third-party
      reconciliation) — Phase I follow-on, not a submission blocker.
- [ ] If/when a split is measured: recompute SCCR at N_archival and report the
      archival-only ratio as the concentration-adjusted figure.

**2026-09-16 status update:** split remains unmeasured. P2P egress test from the
build environment shows the deep-block probe cannot run here (SYN completes on a
minority of hosts; zero application bytes after `version` handshake). Resolution
filed as a DOCUMENTED READING in `research/pruned-split-measurement-scope.md`
(build-or-document). The reachable population's self-declared software/version
distribution IS captured (97.7% Core, 38.8% Core 30/31) — a governance proxy, not
a pruning split.

---

*Bitcoin Sahi Research Council — Companion note to working-paper v2.2.0 (Phase I), 2026-08-02*
