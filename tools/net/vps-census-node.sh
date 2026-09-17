#!/usr/bin/env bash
# BSAHI — provision a PUBLIC-IP consensus/census node on a fresh Ubuntu VPS.
#
# WHY: the D5 inbound census needs a listening node with a public IP so Core sees
# DISTINCT source addresses. A CGNAT/mobile link (double NAT) cannot accept
# inbound at all, and IPv6 is commonly firewalled by carriers. The standard
# pattern for a node behind CGNAT is therefore a public-IP host: run the census
# node on a cheap VPS and pull its data back.
#
# Run AS ROOT on Ubuntu 22.04/24.04 (Oracle Cloud Always-Free, GCP e2-micro,
# Hetzner, etc.). Idempotent-ish; safe to re-run.
#
#   scp tools/net/vps-census-node.sh root@<vps>: && ssh root@<vps> 'bash vps-census-node.sh'
#
# After it finishes: open TCP 8333 in the provider's SECURITY LIST / firewall
# (Oracle: VCN Security List; GCP: VPC firewall rule). ufw is handled here.
set -euo pipefail

BTC_VERSION="${BTC_VERSION:-27.1}"
ARCH="$(uname -m)"; case "$ARCH" in x86_64) BARCH=x86_64;; aarch64|arm64) BARCH=aarch64;; *) echo "unsupported arch $ARCH"; exit 1;; esac
DATA=/var/lib/bsahi-bitcoin
CENSUS=/var/lib/bsahi
RPCUSER=bsahi; RPCPASS="$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)"

echo "==> packages"
apt-get update -qq && apt-get install -y -qq curl tar ufw jq >/dev/null

echo "==> bitcoind ${BTC_VERSION} (${BARCH})"
mkdir -p /opt/bitcoin "$DATA" "$CENSUS"
if [ ! -x /opt/bitcoin/bitcoin-${BTC_VERSION}/bin/bitcoind ]; then
  curl -fsSL "https://bitcoincore.org/bin/bitcoin-core-${BTC_VERSION}/bitcoin-${BTC_VERSION}-${BARCH}-linux-gnu.tar.gz" -o /tmp/btc.tgz
  tar -xzf /tmp/btc.tgz -C /opt/bitcoin
fi
ln -sf /opt/bitcoin/bitcoin-${BTC_VERSION}/bin/bitcoind /usr/local/bin/bitcoind
ln -sf /opt/bitcoin/bitcoin-${BTC_VERSION}/bin/bitcoin-cli /usr/local/bin/bitcoin-cli

echo "==> bitcoin.conf (listening, pruned so a small VPS suffices)"
cat > "$DATA/bitcoin.conf" <<EOF
datadir=$DATA
listen=1
prune=550
maxconnections=64
rpcuser=$RPCUSER
rpcpassword=$RPCPASS
rpcbind=127.0.0.1
rpcallowip=127.0.0.1
EOF

echo "==> systemd unit"
cat > /etc/systemd/system/bsahi-bitcoind.service <<EOF
[Unit]
Description=BSAHI census bitcoind (public-IP listening node)
After=network-online.target
[Service]
ExecStart=/usr/local/bin/bitcoind -conf=$DATA/bitcoin.conf
User=root
Restart=always
RestartSec=20
TimeoutStopSec=600
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload && systemctl enable --now bsahi-bitcoind

echo "==> firewall"
ufw allow 8333/tcp >/dev/null || true
ufw --force enable >/dev/null || true

echo "==> census cron (writes /var/lib/bsahi/inbound.json every 10 min)"
cat > /usr/local/bin/bsahi-census.sh <<EOF
#!/bin/bash
CLI="/usr/local/bin/bitcoin-cli -datadir=$DATA -rpcuser=$RPCUSER -rpcpassword=$RPCPASS"
now=\$(date -u +%Y-%m-%dT%H:%M:%SZ)
peers=\$(\$CLI getpeerinfo 2>/dev/null || echo '[]')
echo "\$peers" | jq --arg at "\$now" '{
  at: \$at,
  connections_in: ([.[] | select(.inbound)] | length),
  inbound_ips: ([.[] | select(.inbound) | .addr | split(":")[0]] | unique)
}' > $CENSUS/inbound.json.tmp && mv $CENSUS/inbound.json.tmp $CENSUS/inbound.json
EOF
chmod +x /usr/local/bin/bsahi-census.sh
echo '*/10 * * * * root /usr/local/bin/bsahi-census.sh' > /etc/cron.d/bsahi-census

cat <<MSG

==> done.  RPC credentials (put these in the Mac-side pull config):
    rpcuser=$RPCUSER
    rpcpassword=$RPCPASS

NEXT STEPS
  1. Open TCP 8333 in your provider's security list / firewall (Oracle VCN
     Security List, GCP VPC firewall, AWS Security Group). ufw is already set.
  2. Let it sync (pruned IBD; hours). Inbound peers arrive once it advertises.
  3. On the Mac:  tools/net/vps_census_pull.sh <user@vps>
     then add it to the collector so it runs automatically.
MSG
