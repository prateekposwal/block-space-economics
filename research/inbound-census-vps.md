# Inbound Census: Why This Mac Cannot Be Reached, and the Public-IP Pattern

**BSAHI — working note (internal)**
*Produced: 2026-09-18 · Status: solution design for the clearnet distinct-node evidence.*

---

## What D5 needs

`tools/research/inbound_census.py` samples the nodes that dial *us* — an **upper
bound** on private participation (a listening node can dial us too). To count them by identity, the node must see
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

### Option 2 — PROXY-protocol relay: keep the node on the Mac, borrow only an address

Preferred when the Mac already has the chainstate (it does): the public host only
**relays**, it does not run a node, so nothing needs to sync there.

```
peers -> [entry: HAProxy :8333 send-proxy-v2] -> [ssh -R tunnel] -> [Mac demuxer :8344] -> bitcoind :8333
                     (public IP)                                    (recovers the REAL src IP)
```

- `tools/net/entrypoint-haproxy.cfg` / `entrypoint-setup.sh` — the public entry
  point (HAProxy, `send-proxy-v2`).
- `tools/net/tunnel-up.sh` — Mac side: reverse tunnel + the demuxer.
- `tools/net/proxyproto_demux.py` — parses PROXY v1/v2, records the true source
  IP, strips the header, forwards to bitcoind. Bitcoin Core cannot parse PROXY
  headers on 8333, which is exactly why this demuxer exists.

**Tested (2026-09-18), real output** — v1 and v2, IPv4 and IPv6, with the
non-Bitcoin filter working:

```
src_ip=203.0.113.5      bitcoin_peer=True     (PROXY v1)
src_ip=2001:db8::9      bitcoin_peer=True     (PROXY v2, IPv6)
src_ip=198.51.100.7     bitcoin_peer=False    (scanner, filtered by network magic)
```

The real-peer filter is cheap and stateless: a connection counts only if the
first 4 bytes it sends are the Bitcoin network magic (`f9beb4d9`), so port
scanners and health checks never pollute the count.

**Why not a plain proxy / ngrok / `ssh -R` on their own:** they SNAT, so every
peer arrives from the relay's IP — the same identity collapse as Tor, without
Tor's properties. Only the PROXY-protocol hop preserves the source address.

### One-command deploy

```bash
# 1. (optional) create an Oracle Cloud Always-Free relay VM + open 8333
tools/net/oci-census-vm.sh                 # prints ubuntu@<public-ip>

# 2. deploy everything and verify, in one shot
tools/net/relay-deploy.sh ubuntu@<public-ip>

# 3. independently confirm from outside + read the recovered IPs
tools/net/relay-verify.sh <public-ip>
```

`relay-deploy.sh` copies the entry-point config, installs HAProxy, starts the
reverse tunnel and the demuxer, then self-tests by opening a magic-prefixed
connection to the public port and confirming a new record lands in
`data/proxy_inbound.jsonl` with the real source IP.

### What to provide

To finalise the connection parameters for a given host: the **public IP / hostname**
and **SSH user** (`ubuntu@…`), plus the **OS** (the scripts assume Ubuntu/Debian
with `apt`, `haproxy`, `sshd`). Everything else — ports (`8333` public, `9000`
tunnel, `8344` demuxer) — is parameterised via `PORT`/`TUNNEL_PORT`/`DEMUX_PORT`.

### Option 2b — routed IPv6 tunnel (NO VM, NO card, NO account approval)

The cleanest path found: a free **WireGuard IPv6 tunnel broker** (e.g. Route64,
AS212895 — free, automated, no contact/card) hands out a **routed /56 delivered
over WireGuard**. Because the tunnel is *outbound*-established with persistent
keepalive, it bypasses **both the CGNAT and the carrier's IPv6 firewall**, and
because a routed prefix is not NATed, an inbound peer's own IPv6 source address
reaches bitcoind **unaltered** — real distinct identities, no collapse.

Built here with **no Homebrew and no sudo**:

- `tools/net/wireguard-build.sh` -> `~/.bsahi/bin/{wireguard-go,wg}` (Go 1.23
  tarball + wireguard-go + wireguard-tools; built and verified, v0.0.20250522).
- `tools/net/route64-wg-up.sh` -> brings the tunnel up **without `wg-quick`**
  (macOS bash is 3.2; wg-quick needs bash 4). Uses `wireguard-go` + `wg setconf`
  + `ifconfig`/`route`. Needs `sudo` (creating the interface), which is the one
  step no script can perform unattended.

Flow: register at route64.org -> create an IPv6 tunnelbroker (WireGuard) ->
download the .conf -> `sudo tools/net/route64-wg-up.sh ~/.bsahi/route64.conf
<addr-from-/56>` -> bitcoind picks up the new interface address dynamically
(**no restart, so the reindex survives**) -> IPv6 peers connect with native IPs.

**Irreducible steps (honest accounting).** Exactly two things cannot be
automated, both one-time:

1. **Route64 signup** — needs *your* email; no script can receive the
   confirmation mail. ~2 min, no card.
2. **One-time sudoers unlock** — creating a network interface requires root on
   macOS (the OS refuses otherwise). Run **once**, ever:
   `sudo tools/net/bshai-net-unlock.sh`. It installs a rule scoped to *one*
   auditable script (`tools/net/tunnel-root.sh`), NOT to `ifconfig`/`route`/`wg`.

After those, it is a single unattended command forever:
`tools/net/route64-up.sh ~/.bsahi/route64.conf <addr-from-/56>`.

**Rejected pattern:** piping a stored password via `sudo -S` (env-var token).
The credential leaks through the environment/process table/history, and on macOS
it wouldn't work anyway (no `ip`; `wg-quick` needs bash 4, system has 3.2).

### Why a bare listener is NOT an option (measured 2026-09-18)

The tempting "serverless sentinel" — a Python script listening on 8333 on a free
sandbox — **cannot work, and would actively corrupt the census**:

1. **No such platform exists.** Fly.io retired its free tier and now requires a
   card on *every* org; Deno Deploy and Render are HTTP-only; Replit's TCP is
   paid; Glitch shut down in 2025. There is no free, no-card, public raw-TCP host.
2. **A listener is undiscoverable.** Bitcoin nodes only dial addresses learned via
   `addr` gossip or the hardcoded DNS seeds. Measured: a real node advertising an
   onion for ~1.5 h still had `connections_in=0`; a bare listener received nothing.
   What *would* arrive is **port scanners** — not non-listening validators. Counting
   them would be fabricated evidence.

**The correct design is a *seeding* node, not a listener** —
`tools/net/seed_sentinel.py`: connect out to DNS-seeded peers, complete the
version/verack handshake, then advertise our own public address so peers add us to
addrman. Only then does inbound appear, and every inbound peer is a node that
dialled us (an upper bound on private participation, not a non-listening count). **Verified against the live node**: handshake completes and Core returns
a 29 KB `addr` message, i.e. it accepts the sentinel as a peer.

The seeding sentinel still needs one thing a script cannot conjure: **a host whose
public IP is reachable.** No-card routes to that: the home LAN port-forward, a
GitHub Student Pack cloud credit, a virtual debit card for Oracle Always-Free (it
never bills), or any always-on box on a non-CGNAT network.

### Why STUN / UDP hole-punching cannot work here (measured 2026-09-18)

Ran a correct RFC-5389 STUN probe (`tools/net/stun_probe.py`) from behind this
link. The same local UDP socket mapped to **different external endpoints per
destination**:

```
local 0.0.0.0:58517  ->  stun.l.google.com   : 106.67.179.93:50402
                     ->  stun.cloudflare.com : 106.67.185.45:50311
```

Different **IP** *and* different **port** for the same socket = a **symmetric NAT
with multiple carrier egress addresses**. Consequences:

1. **An advertised external endpoint is a dead end.** A Bitcoin peer dialling the
   address we learned from STUN arrives as a *new flow* to a *different* mapping
   (or a different egress IP) and is dropped by the carrier NAT. This is exactly
   why WebRTC falls back to **TURN relays** on symmetric NAT — and a relay SNATs,
   which destroys peer identity.
2. **Hole-punching needs both ends to coordinate.** It works when two peers
   exchange mappings through a rendezvous and fire simultaneously. Bitcoin nodes
   do not participate in any rendezvous; they simply dial an address from addrman.
3. **STUN is UDP; Bitcoin P2P is TCP.** The UDP mapping STUN reports is unrelated
   to the TCP path bitcoind needs.

So STUN/hole-punching is not a route to the census — the carrier NAT is symmetric,
the protocol is wrong, and there is no coordinating peer. Only a **real public
host** (or a SNAT relay, which loses identity) works.

### Option 3 — port-forward on a non-CGNAT network

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

- `distinct_inbound_ips_ever` becomes a first-party, clearnet, identity-preserving
  count of nodes that dialled us — an **upper bound on private participation**.
- It remains a **lower bound**, never a population count: bounded by the VPS's
  slots, uptime, and who happens to dial it.
- Combine with the existing views (crawler, DNS seeds, addrman) as the fourth
  independent instrument.

## Status

- Scripts written and syntax-checked; **untested** (no VPS available).
- Not provisioned. Once a VPS exists: run the script, open 8333 in the provider's
  security list, let it sync, then `vps_census_pull.sh` — and add the pull to
  `com.bsahi.collectors`.
