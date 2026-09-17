# D5 inbound census — why the Mac can't do it, and the public-IP pattern

**BSAHI — working note (internal)**
*Produced: 2026-09-18 · Status: solution design for the clearnet distinct-node evidence.*

---

## What D5 needs

`tools/research/inbound_census.py` wants a lower bound on **non-listening / private
nodes**: nodes that dial *us*. To count them by identity, the node must see
**distinct source IPs** of inbound peers.

## What blocks it (measured, 2026-09-18)

| Path | Result |
|---|---|
| **IPv4 inbound** | ❌ **impossible** — the Mac is on a CGNAT link (traceroute shows two stacked private hops `10.57.222.34` → `10.191.76.201`; public IP shared). No port-forward exists to configure. |
| **IPv6 inbound** | ❌ **blocked** — IPv6 egress works, but two independent external fetchers (r.jina.ai, allorigins) resolved our global IPv6 and **timed out**. Carriers firewall inbound v6 by default. |
| **Tor inbound** | ✅ works (proved: a separate Tor client and a real bitcoind both dialled in) — but Tor's HS forwarding makes every peer appear as **`127.0.0.1`**, so identity is lost. Only a *concurrency* bound survives. |
| **Home LAN** | the earlier port-forward target (`192.168.29.1 → .211`) is a *different* network the Mac is not currently on. |

**Conclusion: distinct-IP clearnet inbound cannot be produced from a CGNAT/mobile
host.** This is a property of the network, not a configuration gap. A router rule,
UPnP, or NAT-PMP cannot change it (both were also tested — the router supported
neither).

## The pattern (what node operators do behind CGNAT)

A node behind CGNAT has no inbound path; the standard answer is **run the reachable
node on a host that has a public IP**. For a *measurement* node whose only job is to
observe who dials in, the node does not have to be the research machine.

Two deployable options, in order of preference:

### Option 1 — census node on a public-IP VPS (recommended)

`tools/net/vps-census-node.sh` provisions a pruned, listening bitcoind on a fresh
Ubuntu VPS (Oracle Cloud Always-Free, GCP e2-micro, Hetzner, …), opens 8333, and
installs a cron that writes `/var/lib/bsahi/inbound.json` every 10 min.

The Mac pulls it with `tools/net/vps_census_pull.sh <user@vps>` →
`data/vps_inbound_census.json`. **This produces distinct clearnet IPs** — the real
D5 evidence — and is stable across the Mac changing networks.

Cost: a free-tier VM is sufficient; a pruned node needs ~2 GB.

### Option 2 — port-forward on a non-CGNAT network

If the Mac is ever on the home LAN (`192.168.29.1`), forward TCP 8333 →
`192.168.29.211` there. (The hour-long bash against CGNAT above is why this only
works on that network.)

### Not a substitute

- **Tor** — proves the plumbing and gives a concurrency bound, but not identity.
- **ngrok / Cloudflare Tunnel / SSH -R** — these SNAT, so every peer would appear
  from the relay's IP: the same identity collapse, without the security of Tor.
  Only a **source-preserving** relay (VPS + WireGuard + DNAT, no MASQUERADE) keeps
  original IPs — more fragile than Option 1 and no cheaper.

## How the data flows

```
peers ──dial──▶ VPS bitcoind (public IP) ──getpeerinfo──▶ /var/lib/bsahi/inbound.json
                                                              │  ssh
                                                              ▼
                                       Mac: tools/net/vps_census_pull.sh
                                                              │
                                                              ▼
                                        data/vps_inbound_census.json  (distinct IPs)
```

## What it buys (and what it still isn't)

- `distinct_inbound_ips_ever` becomes a genuine **lower bound on non-listening
  nodes** — first-party, clearnet, identity-preserving.
- It remains a **lower bound**, never a population count: bounded by the VPS's
  slots, uptime, and who happens to dial it.
- Combine with the existing views (crawler, DNS seeds, addrman) as the fourth
  independent instrument.

## Status

- Scripts written and syntax-checked; **untested** (no VPS available).
- Not provisioned. Once a VPS exists: run the script, open 8333 in the provider's
  security list, let it sync, then `vps_census_pull.sh` — and add the pull to
  `com.bsahi.collectors`.
