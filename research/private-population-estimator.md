# Estimating the Non-Listening Population from Inbound Counts

**BSAHI — working derivation (internal, NOT published)**
*Produced: 2026-09-17 · Status: PROPOSED — derivation for review before any publication.*

---

## The problem it addresses

`research/verification-population.md` names three quantities:

- **A** — gossiped *addresses* (observed, Grade C; a lower bound on addresses, not nodes)
- **B** — reachable **listening** nodes (`N = 26,586`, Grade B; the canonical `N`)
- **C** — **non-listening / private** nodes — *not observable by any crawler*

The D5 instrument (`tools/research/inbound_census.py`) can only produce a
presence signal, and only from a reachable node. This note derives a
**quantitative estimator** for C that needs one reachable node and one number
from it — its inbound connection count.

---

## The identity

Definitions:

| Symbol | Meaning | Value / range |
|---|---|---|
| `P` | listening ("public") nodes — accept inbound | **26,586** (measured, Grade B) |
| `R` | non-listening ("private") nodes — accept no inbound | unknown (this is **C**) |
| `o` | network-wide **outbound** connection degree | 8 full-relay, +2 block-relay-only |
| `i` | inbound connections observed at **our** node | measured once reachable |

Every TCP connection has exactly one outbound endpoint. An outbound connection
can only terminate at a **listening** node — a non-listening node accepts none.
Therefore, network-wide:

```
total inbound connections held  =  o · (P + R)
```

Those connections are distributed across the `P` listening nodes. If our node is
a **statistically typical** listening node, its inbound count `i` equals the mean
inbound per listening node:

```
i = o · (P + R) / P
```

Solving for the unobservable `R`:

```
R = P · (i / o − 1)                        … (★)

equivalently:   R / P = i / o − 1
```

### The inbound cap cancels — and that is the point

The 125-slot default never appears in (★). It cancels because we measure `i`
directly instead of assuming the network is saturated:

```
R = P · (f·m/o − 1)   with saturation  f = i/m   ⟹   R = P · (i/o − 1)
```

So the estimator does **not** depend on the inbound connection limit. It depends
only on `(P, i, o)`. That makes it robust to Core's `maxconnections` being
reconfigured and to the 125 → 250 proposal in the current BIP-330 discussion.

---

## What it implies across the observed-inbound range

At `P = 26,586`, `o = 8`:

| `i` (our inbound) | `R = P(i/8 − 1)` | total `P+R` | implied `R:P` | SCCR at that total\* |
|---:|---:|---:|---:|---:|
| 8 | 0 | 26,586 | 0:1 | 0.3624 |
| 20 | 39,879 | 66,465 | 1.5:1 | 0.1450 |
| 40 | 106,344 | 132,930 | 4:1 | 0.0725 |
| **80** | **239,274** | **265,860** | **9:1** | **0.0362** |
| 125 (cap) | 388,820 | 415,406 | 14.6:1 | 0.0232 |

\* SCCR is inverse-linear in `N`; the totals map onto the extended
`unpublicised_node_sensitivity` curve in `data/sccr_sensitivity.json`.

---

## Cross-check against the literature

Erlay (Naumenko et al., CCS'19 / arXiv:1905.10518, Fig. 2) states the network at
the time was **private:public ≈ 9:1** (6,000 public + 54,000 private), with
private = 0 inbound / ≤8 outbound and public = ≤125 inbound.

That ratio is not an independent input — it is a **prediction** of (★):

```
R/P = 9   ⟺   i = o · (R/P + 1) = 8 · 10 = 80
```

So the Erlay ratio implies a typical listening node currently holds **≈80
inbound connections**. That is a falsifiable, measurable claim:

- If our `i` comes back near 80, Erlay's 9:1 is **corroborated on 2026 data**.
- If `i` lands near 20–40, the current ratio is ~1.5:1–4:1 and the 2019 literature
  ratio is an **over-estimate** (the network has become more listening-heavy).
- Either way the SCCR band in `data/sccr_sensitivity.json` is bracketed by a
  measurement rather than an assumption.

---

## Assumptions, and the direction of the bias

1. **Our node is typical.** Required: default `maxconnections` (125 — satisfied by
   the current `bitcoin.conf`), good uptime, clearnet, not rate-limited or
   blacklisted. A **new, poorly-advertised node receives fewer inbound peers than
   average**, so `i` under-states the mean and (★) **under-estimates `R`**.
   The bias is therefore **conservative** — consistent with how `N` is treated
   everywhere else in this project (a lower bound).
2. **`o` is uniform and pinned.** `R = P(i/o − 1)` is sensitive to `o`:
   `o=8 → 9:1`, `o=10 → 7:1`, `o=4 → 19:1` at `i=80`. `o` must be stated and
   swept, not assumed.
3. **Outbound selection is ~uniform over reachable addresses.** Core selects
   outbound peers from the address manager, weighted by address freshness and
   observable uptime. Well-advertised nodes therefore attract *above-average*
   inbound — this again makes a new node's `i` a **lower** bound.
4. **Tor-only private nodes are under-represented.** Our node is clearnet, so
   Tor-only private nodes that connect to Tor public nodes are missed.

Every assumption pushes the estimate **down**, so (★) is best read as a
**lower bound on `R`** — exactly the epistemic posture the project uses for `N`.

---

## How to validate it (what would make it measured)

1. **Stage 1 — one node.** Reachability (port-forward 8333 or Tor), then log `i`
   continuously. One point estimate of `R`. *This is the quantitative arm of D5.*
2. **Stage 2 — a small fleet.** `n ≥ 5` listening nodes across distinct networks;
   estimate the **distribution** of `i`, hence a confidence interval on `R/P`
   rather than a single sample.
3. **Stage 3 — independent views.** Cross-check against the addrman address-pool
   (`addrman_churn.py`) and DNS-seed (`seed_census.py`) views already in
   `data/`. Agreement across the three raises the grade.

**Note on error budget.** Sampling noise is small (`i ~ Poisson(λ)`; `√80 ≈ 9`),
but **systematic atypicality dominates** and is one-directional (conservative).
Any published figure must carry the lower-bound label, not a point estimate.

---

## Falsification

The estimator is refuted if any of the following hold:

- A measured `i` combined with a *verified* network-wide `o` yields `R < 0`
  (i.e. `i < o`) — would mean our node is not a valid sample.
- The three independent views (Stage 3) disagree by more than the stated band.
- A census with first-party reachability data shows `R/P` outside the range
  spanned by the observed `i`.

---

## Relationship to existing artifacts

| Artifact | Contribution |
|---|---|
| `tools/research/inbound_census.py` | D5 instrument — produces `i` (currently 0; needs reachability) |
| `data/verification_population.json` | defines quantities A/B/C |
| `research/verification-population.md` | the population note (D1/D2) |
| `data/sccr_sensitivity.json → unpublicised_node_sensitivity` | where the `N` band lands |
| Erlay, CCS'19 (arXiv:1905.10518), Fig. 2 | the 9:1 prior and the connectivity rules |

---

## Recommendation

Publish **only after Stage 1** produces a non-zero `i` on a reachable node, and
state the result as `R ≥ P·(i/o − 1)` with `o` swept. Until then this note is
internal; the SCCR sensitivity band stays anchored to the Grade-B measured floor
and the Erlay ratio remains a cited *bracket*, not a revised `N`.
