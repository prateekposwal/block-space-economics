#!/usr/bin/env bash
# BSAHI D5 — deploy the seeding sentinel to a PUBLIC-IP host (one command).
#
#   tools/net/deploy_sentinel_remote.sh user@public-ip
#
# Corrections vs the draft: seed_sentinel.py REQUIRES --advertise and writes the
# JSONL log named by --log (not inbound_census.json); it is stdlib-only so no
# packages are installed; persistence is a systemd unit rather than a bare nohup
# (which dies on logout); and the pull path matches what the sentinel actually
# writes.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HOST="${1:-}"; [ -z "$HOST" ] && { echo "usage: deploy_sentinel_remote.sh user@public-ip"; exit 2; }
IP="${HOST#*@}"
SSH="ssh -o BatchMode=yes -o ConnectTimeout=15"
REMOTE=~/bsahi-sentinel

echo "==> [1/5] preflight"
$SSH "$HOST" 'python3 --version && echo ok' >/dev/null || { echo "  ssh/python3 unavailable on $HOST"; exit 3; }
$SSH "$HOST" "ss -ltn 2>/dev/null | grep -q ':8333 ' && echo BUSY || echo free" | grep -q free \
  || { echo "  port 8333 already in use on the remote host"; exit 3; }

echo "==> [2/5] copy the sentinel"
$SSH "$HOST" "mkdir -p $REMOTE/data"
scp -q "$ROOT/tools/net/seed_sentinel.py" "$ROOT/tools/net/proxyproto_demux.py" "$HOST:$REMOTE/"

echo "==> [3/5] open TCP 8333"
$SSH "$HOST" "sudo -n ufw allow 8333/tcp 2>/dev/null || sudo -n iptables -I INPUT -p tcp --dport 8333 -j ACCEPT 2>/dev/null || echo '  (open 8333 in the provider security list manually)'"

echo "==> [4/5] start the sentinel (systemd if available, else nohup)"
$SSH "$HOST" "bash -s" <<REMOTE_EOF
set -e
REMOTE=\$HOME/bsahi-sentinel
CMD="python3 \$REMOTE/seed_sentinel.py --listen 8333 --advertise $IP:8333 --log \$REMOTE/data/sentinel.jsonl --rounds 100000"
if command -v systemctl >/dev/null 2>&1; then
  sudo -n tee /etc/systemd/system/bsahi-sentinel.service >/dev/null <<UNIT
[Unit]
Description=BSAHI seeding sentinel
After=network-online.target
[Service]
ExecStart=\$CMD
Restart=always
RestartSec=15
User=\$(whoami)
[Install]
WantedBy=multi-user.target
UNIT
  sudo -n systemctl daemon-reload && sudo -n systemctl enable --now bsahi-sentinel
  echo "  started via systemd"
else
  pkill -f seed_sentinel.py 2>/dev/null || true
  nohup \$CMD > \$REMOTE/sentinel.log 2>&1 &
  echo "  started via nohup (no systemd)"
fi
REMOTE_EOF

echo "==> [5/5] verify it is advertising and listening"
sleep 6
$SSH "$HOST" "ss -ltn 2>/dev/null | grep ':8333 ' || echo '  not listening yet'"
echo
echo "  Sentinel live on $IP:8333. It connects out, completes the Bitcoin handshake,"
echo "  and advertises itself so peers add it to addrman — only then do validators dial in."
echo
echo "  Pull the evidence:  scp $HOST:$REMOTE/data/sentinel.jsonl data/sentinel_remote.jsonl"
echo "  then:               python3 tools/net/census.py   (reads node + logs)"
