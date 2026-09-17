# Measured: this environment is carrier-grade NAT (D5 freeze rationale)

**BSAHI — working note**
*Produced: 2026-09-18 · Status: explains why the clearnet census is frozen at 0.*

## The finding

D5 (`inbound_census.py`) requires the node to receive inbound connections so it can
see **distinct peer source IPs**. On both networks available to this machine, that
is impossible — not by misconfiguration, but because both are carrier-grade NAT.

**Network A — mobile hotspot (`Redmi Note 7`).** Traceroute shows two stacked
private hops; STUN shows a **symmetric** mapping with multiple egress addresses for
one socket:

```
local 0.0.0.0:58517 -> stun.l.google.com   : 106.67.179.93:50402
                    -> stun.cloudflare.com : 106.67.185.45:50311
```

**Network B — JioFiber home broadband (`JioFiber-nfDa2_5G`).** Traceroute shows
**four** private layers beyond the gateway:

```
1  192.168.29.1      (our router)
2  10.37.32.1
3  172.16.3.136
4  192.168.161.80
5  192.168.232.132
6  192.168.232.163
```

The public address `49.43.160.42` is the **shared CGNAT egress**, not a forwardable
address. Jio Centrum gateways are also TR-069-managed (the standard `admin /
Jiocentrum` default is rejected, and community reports confirm UPnP/port-forwarding
are not usable on Jio residential).

## Every software path, tested

| Path | Result |
|---|---|
| IPv4 port-forward | n/a — no public IPv4 exists to forward to |
| UPnP IGD / NAT-PMP | router advertises neither (SSDP silent on 4 search targets) |
| IPv6 inbound | router-filtered — 3 independent external fetchers time out |
| Tor inbound | works, but identity collapses to `127.0.0.1` |
| STUN / UDP hole-punch | symmetric NAT, multi-egress (measured above) |
| Bare listener / free sandbox | undiscoverable, and would log *scanners*, not validators |
| Play-with-Docker | shut down (Mar 2026) and HTTP-only by design |
| Free no-card raw-TCP host | none exists in 2026 (Fly requires a card; Deno/Render HTTP-only; Glitch dead) |

## Why 0 is the correct, publishable value

The census instrument is built and verified — `seed_sentinel.py` completes a real
version/verack handshake and Core returns a 29 KB `addr` message, so the sentinel is
accepted as a peer. `proxyproto_demux.py` recovers native source IPs from PROXY v1/v2.
`route64-wg-up.sh` + the userspace WireGuard toolchain are built. What is missing is
not code: it is **a host on a connection that is not CGNAT**.

Reporting `0` here is therefore not a failure state. It is an **unpoisoned empirical
result**: Jio residential IPv4 is a four-layer CGNAT with a non-forwardable shared
egress, and no first-party clearnet inbound is derivable from it. Fabricating
scanner traffic as "validators" would have been the only way to show a non-zero
number, which is precisely the kind of evidence this project refuses to publish.

## What would lift the freeze (no code changes needed)

1. A **public/static IPv4** from the ISP (business plan), or a non-CGNAT ISP
   (Airtel Fiber / ACT hand out public IPv4 in many areas).
2. A **VPS** (Oracle Always-Free with a virtual debit card — it never bills).
3. Any **always-on machine on a non-CGNAT link** — then:
   `sudo tools/net/route64-wg-up.sh` (IPv6 route) *or* `tools/net/seed_sentinel.py`
   behind `proxyproto_demux.py`.

The moment any of those exists, `inbound_census.py` starts collecting distinct
native-source validator IPs with zero further engineering.

## Decision (2026-09-18)

The clearnet census is **frozen at 0** and the repository tagged for pre-print.
Rationale: `0` is the measured, unpoisoned result, and a non-CGNAT host was not
available (no card, no static-IP contract, no extra machine). The instrument is
complete and reversible — `tools/net/deploy_sentinel_remote.sh user@public-ip`
deploys and verifies the seeding sentinel on any public-IP host in one command,
after which `census.py` reports DISTINCT with no further work.

The Tor layer remains active and will report a CONCURRENCY lower bound if peers
dial the onion; `census.py` grades it explicitly as a bound, never a node count.
