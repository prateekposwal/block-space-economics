#!/usr/bin/env bash
# BSAHI D5 — ONE-TIME unlock. Run once:  sudo tools/net/bsahi-net-unlock.sh
# Installs a NARROW sudoers rule granting passwordless execution of ONLY
# tools/net/tunnel-root.sh, so the census tunnel can be automated afterwards.
# (Deliberately NOT granting NOPASSWD to ifconfig/route/wg directly.)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
USER_NAME="${SUDO_USER:-$(id -un)}"
RULE="/etc/sudoers.d/bsahi-networking"
echo "$USER_NAME ALL=(root) NOPASSWD: $ROOT/tools/net/tunnel-root.sh" > "$RULE"
chmod 440 "$RULE"
visudo -c -f "$RULE" >/dev/null && echo "installed $RULE"
echo "  $USER_NAME may now run: sudo -n $ROOT/tools/net/tunnel-root.sh ..."
echo "  remove with: sudo rm $RULE"
