#!/usr/bin/env bash
# BSAHI D5 — set up the public entry point (run AS ROOT on a host with a public IP).
#   scp tools/net/entrypoint-haproxy.cfg tools/net/entrypoint-setup.sh root@<host>:
#   ssh root@<host> 'bash entrypoint-setup.sh'
set -euo pipefail
PORT="${PORT:-8333}"
TUNNEL_PORT="${TUNNEL_PORT:-9000}"
apt-get update -qq && apt-get install -y -qq haproxy >/dev/null
cat > /etc/haproxy/haproxy.cfg <<CFG
global
    log stdout local0
    maxconn 8192
defaults
    mode tcp
    timeout connect 10s
    timeout client  1h
    timeout server  1h
frontend btc_in
    bind *:${PORT}
    default_backend mac_node
backend mac_node
    server mac 127.0.0.1:${TUNNEL_PORT} send-proxy-v2
CFG
# Allow the Mac's reverse tunnel to bind the tunnel port on loopback only.
grep -q "GatewayPorts" /etc/ssh/sshd_config || echo "GatewayPorts no" >> /etc/ssh/sshd_config
systemctl restart ssh 2>/dev/null || systemctl restart sshd 2>/dev/null || true
systemctl enable --now haproxy && systemctl restart haproxy
if command -v ufw >/dev/null; then ufw allow "${PORT}"/tcp >/dev/null || true; fi
echo "entry point ready: peers -> :${PORT} --send-proxy-v2--> 127.0.0.1:${TUNNEL_PORT}"
echo "  (also open TCP ${PORT} in the provider's security list)"
