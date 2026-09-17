#!/usr/bin/env node
// BSAHI — Tor runner for a launchd-managed onion service.
//
// WHY A NODE WRAPPER: the Tor Expert Bundle binary carries the
// com.apple.provenance xattr, which macOS Sequoia uses to TCC-deny direct
// exec; the same pattern as tools/research/sccr_live_runner.js exists for.
// It also must be ad-hoc codesigned (the bundle ships unsigned).
//
// Publishes an onion HiddenService that forwards to 127.0.0.1:8333, giving the
// node inbound peers with NO router port-forward (verified: Core accepts
// loopback inbound). Tor runs in the foreground; launchd KeepAlive supervises.
var cp = require('child_process');
var TOR = '/Users/prateekposwal/.bsahi/tor/tor/tor';
var CONF = '/Users/prateekposwal/.bsahi/tor/torrc';
var c = cp.spawn(TOR, ['-f', CONF], { stdio: 'inherit' });
c.on('exit', function (code, sig) { process.exit(code == null ? 0 : code); });
c.on('error', function (e) { console.error('tor_runner: ' + e.message); process.exit(1); });
