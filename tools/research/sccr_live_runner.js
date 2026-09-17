#!/usr/bin/env node
// BSAHI — sccr_live.py launchd runner (2026-08-14)
//
// STATUS (2026-09-17): the com.bsahi.sccr-tracker job that invokes this is
// DISABLED by design. The SCCR is owned by GitHub Actions
// (.github/workflows/research-data.yml, every 30 min: public 24h fee endpoint
// -> sccr_live.py --frozen), which is Mac-independent. This runner would be a
// SECOND writer of data/sccr.json. Do not re-enable without retiring the cloud
// writer first. Kept for local/manual use.
//
// WHY THIS WRAPPER EXISTS (U2 fix):
//   The com.bsahi.sccr-tracker plist originally spawned /usr/bin/python3
//   directly. In the launchd context that is TCC-denied (Errno 1 Operation
//   not permitted) when the script carries the com.apple.provenance xattr
//   that macOS Sequoia manages system-wide (it is re-stamped on every file
//   touch, so clearing it is not durable). Every OTHER working BSAHI plist
//   uses /usr/local/bin/node, and node-spawned python3 has been proven to
//   run sccr_live.py successfully under launchd (the 30-min snapshot agent
//   does exactly this with zero failures). This wrapper mirrors that
//   proven-working pattern so the job runs under launchd.
var cp = require('child_process');
var path = require('path');
var REPO = path.resolve(__dirname, '..', '..');
cp.execFile('/usr/bin/python3', [path.join(REPO, 'tools', 'research', 'sccr_live.py')], { cwd: REPO, timeout: 60000 }, function (err, stdout, stderr) {
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  if (err) {
    process.stderr.write('sccr_live_runner: ' + (err.message || '') + '\n');
    process.exit(typeof err.code === 'number' ? err.code : 1);
  }
  process.exit(0);
});
