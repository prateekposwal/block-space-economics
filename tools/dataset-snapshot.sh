#!/bin/bash
# BSAHI dataset-snapshot wrapper — sources gitignored .env.local for GH_TOKEN,
# so the real token never lives in committed files (GitHub push protection).
set -e
cd /Users/prateekposwal/Desktop/block-space-economics
if [ -f .env.local ]; then
  set -a
  source .env.local
  set +a
fi
export GH_TOKEN="${GH_TOKEN:-}"
exec /usr/local/bin/node tools/dataset-snapshot.js "$@"
