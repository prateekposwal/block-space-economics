#!/usr/bin/env bash
# BSAHI D5 — readiness doctor for the private/non-listening node census.
#
# READ-ONLY. Changes nothing. Reports, for every candidate path to a public
# endpoint, whether it is viable and the SINGLE next action required.
#
#   tools/net/d5-doctor.sh
#
# It exists because every source-IP-preserving path needs exactly one human
# action (an account, or a one-time sudo). This prints which one.

set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
say() { printf '%s\n' "$*"; }
hr()  { printf -- '─%.0s' {1..72}; printf '\n'; }

say "BSAHI D5 census — readiness doctor ($(date -u '+%Y-%m-%dT%H:%MZ'))"
hr

# ---------------------------------------------------------------- Bitcoin Core
CLI="$HOME/.local/bin/bitcoin-cli"
if [ -x "$CLI" ]; then
  INFO="$("$CLI" -rpcuser=bsahi -rpcpassword=bsahi getnetworkinfo 2>/dev/null)"
  IN="$(printf '%s' "$INFO" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("connections_in"))' 2>/dev/null)"
  say "Core       : RPC ok · connections_in=${IN:-?}"
else
  say "Core       : bitcoin-cli not found"
fi
V4="$(lsof -nP -iTCP:8333 -sTCP:LISTEN 2>/dev/null | grep -c IPv4)"
V6="$(lsof -nP -iTCP:8333 -sTCP:LISTEN 2>/dev/null | grep -c IPv6)"
say "           : listening on 8333 — IPv4 sockets=$V4 IPv6 sockets=$V6"

# ------------------------------------------------------------------- addressing
L4="$(ipconfig getifaddr en0 2>/dev/null || echo '?')"
P4="$(curl -4 -s -m 8 https://api.ipify.org 2>/dev/null || echo 'fail')"
say "IPv4       : local=$L4 public=$P4 $([ "$L4" = "$P4" ] && echo '(DIRECT)' || echo '(behind NAT)')"

HOPS="$(traceroute -n -m 6 -w 1 8.8.8.8 2>/dev/null | awk 'NR>1 && $2 ~ /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\.)/ {n++} END{print n+0}')"
[ "$HOPS" -ge 2 ] && say "           : CGNAT — $HOPS stacked private hops to the internet" \
                   || say "           : only $HOPS private hop(s) — may be a simple NAT"

G6="$(ifconfig en0 2>/dev/null | awk '/inet6 2[0-9a-f]/{print $2; exit}')"
P6="$(curl -6 -s -m 8 https://api64.ipify.org 2>/dev/null || echo 'fail')"
if [ -n "$G6" ]; then
  say "IPv6       : global=$G6"
  [ "$P6" = "$G6" ] && say "           : egress uses our OWN address (no NAT66)" || say "           : egress=$P6"
else
  say "IPv6       : no global address on en0"
fi

# ------------------------------------------------------------------- components
say ""
say "Components :"
for f in "$HOME/.bsahi/relay.conf" "$HOME/.bsahi/route64.conf" "$HOME/.bsahi/vps-census.conf"; do
  [ -s "$f" ] && say "             present  $f" || say "             absent   $f"
done
launchctl list 2>/dev/null | grep -q "com.bsahi.relay" && say "             loaded   com.bsahi.relay (Mac relay supervisor)" \
                                                      || say "             not loaded com.bsahi.relay"
if sudo -n "$ROOT/tools/net/tunnel-root.sh" down >/dev/null 2>&1; then
  say "             unlocked passwordless sudo for tunnel-root.sh"
else
  say "             LOCKED   one-time sudo not installed"
fi

# ---------------------------------------------------------------------- verdict
hr
say "PATHS (only these preserve the peer's source IP — proxies/tunnels SNAT and"
say "destroy identity, which is the entire measurement; DDNS cannot bypass CGNAT):"
say ""
say "  A) Oracle Cloud Always-Free VPS + HAProxy send-proxy-v2"
say "     viable: needs an OCI account + API key (a card is usually required to sign up)"
say "     next  : gh workflow run deploy-relay.yml -f mode=provision"
say "             then: echo 'HOST=ubuntu@<ip>' > ~/.bsahi/relay.conf"
say ""
say "  B) Routed-IPv6 WireGuard tunnel (no card, no account approval)"
say "     viable: needs the conf from https://route64.org AND the one-time sudo"
say "     next  : 1) download a WireGuard conf  ->  ~/.bsahi/route64.conf"
say "            2) sudo $ROOT/tools/net/bsahi-net-unlock.sh   (asks your password ONCE)"
say "            3) tools/net/route64-up.sh"
say ""
say "  C) Any pre-existing public host you already control"
say "     next  : tools/net/relay-deploy.sh user@public-ip"
say "             then: echo 'HOST=user@public-ip' > ~/.bsahi/relay.conf"
say ""
say "NOT viable for this measurement (do not spend time on them):"
say "  · DDNS (No-IP/DuckDNS/Dynu) — publishes the ISP's SHARED CGNAT IP; inbound stays closed"
say "  · Cloudflare Tunnel — free tier is HTTP/HTTPS only; arbitrary TCP is paid, and it SNATs"
say "  · Tailscale Funnel — TCP only on 443/8443/10000 (not 8333) and terminates the connection,"
say "    so the peer's source IP is lost — fatal for a distinct-node count"
say "  · ngrok / localhost.run / playit — all proxy and SNAT; identities collapse"
say ""
say "Until one of A/B/C is satisfied the census verdict is CONTAINED and Tier C stays null."
