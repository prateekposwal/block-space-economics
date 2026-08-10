# GH_TOKEN rotation — READ ME

## Why
The token (value redacted — see `.env.local`) was hardcoded in
`tools/dataset-snapshot.js` on 2026-08-10 and pushed. GitHub's secret-scanning
push protection (GH013) now blocks ALL pushes to this repo while that token
value is recognized as a live secret — even though it's been removed from all
committed files and now lives only in the gitignored `.env.local`.

## The fix (30 seconds, do once)

1. **Revoke the old token** (it's compromised):
   GitHub → Settings → Developer settings → Personal access tokens → delete
   the token (value in `.env.local`).

2. **Create a new token**:
   Fine-grained token for `prateekposwal/block-space-economics` with
   **Contents: Read and write** (for branch pushes + releases). Or a classic
   token with `repo` + `workflow` scopes.

3. **Update `.env.local`** (gitignored — never committed):
   ```
   GH_TOKEN=<new token>
   ```
   Then:
   ```bash
   node tools/dataset-snapshot.js   # test: publishes the dataset snapshot
   git push origin main              # now works — token no longer flagged
   ```

## What's already in place
- `tools/dataset-snapshot.js` — reads `process.env.GH_TOKEN` (no hardcoded token)
- `tools/dataset-snapshot.sh` — wrapper that sources `.env.local` for the launchd daemon
- `com.bsahi.dataset-snapshot.plist` — daemon runs the wrapper daily 03:17
- `.env.local` — gitignored, holds the real token

## Verification after rotation
```bash
bash tools/dataset-snapshot.sh   # should print "published to GitHub Releases"
git push origin main             # should succeed
```
