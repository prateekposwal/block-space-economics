#!/usr/bin/env bash
# BSAHI D5 — create an Oracle Cloud Always-Free relay VM and open TCP 8333.
# Automates everything the OCI CLI can; run once, needs: oci configured
# (`oci setup config`) and an SSH key.
#
#   tools/net/oci-census-vm.sh [ssh_pubkey_path]
#
# Prints the public IP at the end; then:  tools/net/relay-deploy.sh ubuntu@<ip>
set -euo pipefail
PUBKEY="${1:-$HOME/.ssh/id_rsa.pub}"
NAME="${NAME:-bsahi-census-relay}"
PORT="${PORT:-8333}"
command -v oci >/dev/null || { echo "install the OCI CLI: https://docs.oracle.com/iaas/Content/API/SDKDocs/cliinstall.htm"; exit 2; }
[ -f "$PUBKEY" ] || { echo "no ssh pubkey at $PUBKEY"; exit 2; }

echo "==> resolving tenancy / compartment"
TENANCY="$(oci iam compartment list --query 'data[0]."compartment-id"' --raw-output 2>/dev/null || true)"
[ -z "$TENANCY" ] && TENANCY="$(awk -F= '/^tenancy/{print $2}' "$HOME/.oci/config" | tr -d ' ')"
COMP="${COMPARTMENT:-$TENANCY}"
echo "  tenancy=$TENANCY"

echo "==> availability domain"
AD="$(oci iam availability-domains list --compartment-id "$TENANCY" --query 'data[0].name' --raw-output)"

echo "==> latest Canonical Ubuntu image for VM.Standard.A1.Flex (Always Free ARM)"
IMAGE="$(oci compute image list --compartment-id "$TENANCY" \
  --operating-system 'Canonical Ubuntu' --shape 'VM.Standard.A1.Flex' \
  --sort-by TIMECREATED --sort-order DESC --query 'data[0].id' --raw-output)"

echo "==> default subnet"
SUBNET="$(oci network subnet list --compartment-id "$COMP" \
  --query 'data[?contains("display-name",`Default`)].id | [0]' --raw-output)"
[ -z "$SUBNET" ] || [ "$SUBNET" = "null" ] && { echo "no default subnet found — set SUBNET or create a VCN in the console"; exit 3; }
echo "  subnet=$SUBNET"

echo "==> launching VM (VM.Standard.A1.Flex, 1 OCPU / 6 GB — Always Free)"
INST="$(oci compute instance launch --compartment-id "$COMP" --availability-domain "$AD" \
  --shape 'VM.Standard.A1.Flex' --shape-config '{"ocpus":1,"memoryInGBs":6}' \
  --image-id "$IMAGE" --subnet-id "$SUBNET" --assign-public-ip true \
  --display-name "$NAME" --ssh-authorized-keys-file "$PUBKEY" \
  --wait-for-state RUNNING --query 'data.id' --raw-output)"
echo "  instance=$INST"

echo "==> opening TCP ${PORT} in the subnet's security list"
SL="$(oci network subnet get --subnet-id "$SUBNET" --query 'data."security-list-ids"[0]' --raw-output)"
oci network security-list get --security-list-id "$SL" --query 'data."ingress-security-rules"' --raw-output > /tmp/sl.json
python3 - "$SL" "$PORT" <<'PY'
import json, subprocess, sys
sl, port = sys.argv[1], int(sys.argv[2])
rules = json.load(open('/tmp/sl.json'))

def has_tcp_rule(rules, port):
    for r in rules:
        if r.get('protocol') != '6':
            continue
        dpr = (r.get('tcp-options') or {}).get('destination-port-range') or {}
        lo, hi = dpr.get('min'), dpr.get('max')
        if lo is not None and hi is not None and lo <= port <= hi:
            return True
    return False

if has_tcp_rule(rules, port):
    print("  ingress rule already present")
else:
    rules.append({"protocol": "6", "isStateless": False, "source": "0.0.0.0/0",
                  "sourceType": "CIDR_BLOCK",
                  "tcpOptions": {"destinationPortRange": {"min": port, "max": port}}})
    subprocess.run(["oci", "network", "security-list", "update",
                    "--security-list-id", sl,
                    "--ingress-security-rules", json.dumps(rules)], check=True)
    print("  ingress rule added")
PY

echo "==> waiting for a public IP"
for i in $(seq 1 30); do
  IP="$(oci compute instance list-vnics --instance-id "$INST" --query 'data[0]."public-ip"' --raw-output 2>/dev/null || true)"
  [ -n "$IP" ] && [ "$IP" != "null" ] && break
  sleep 10
done
echo
echo "  PUBLIC IP: $IP"
echo "  next:  tools/net/relay-deploy.sh ubuntu@$IP"
