#!/usr/bin/env node
// BSAHI — Engagement Orchestrator (Node wrapper) v3
// Runs the Python engagement engines through node's TCC access.
// launchd runs THIS via node (which has Desktop access); node spawns python.
//
// v3 changes:
//  - Work/rest schedule: 4h work → 2h rest, inside THIS process (launchd KeepAlive
//    would restart an exiting process, so we SKIP cycles during rest, never exit).
//  - PID lock: prevents dual orchestrator instances.
//  - Phase pre-flight: skip phases when no new work (no browser tabs opened).
//  - Tab baseline + sweep: record tabs before a phase, close only engine-owned
//    tabs after (never touches the architect's tabs).
//  - Engagement feedback: run feedback.js at cycle start to refresh topic signals.
var { exec } = require('child_process');
var path = require('path');
var fs = require('fs');

var REPO = '/Users/prateekposwal/Desktop/block-space-economics';
process.env.PATH = '/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin';
var logFile = path.join(REPO, 'captured-data', 'engagement.log');
var REST_FILE = path.join(REPO, 'captured-data', 'work-rest-state.json');
var PID_FILE = path.join(REPO, 'captured-data', 'orchestrator.pid');
var HEARTBEAT_FILE = path.join(REPO, 'captured-data', 'orchestrator-heartbeat.json');
var cycleActive = false;
var watchdog = null;
var cycleCount = 0;
var CFG = (function() { try { return JSON.parse(fs.readFileSync(path.join(REPO, 'tools/bridge/orchestrator-config.json'), 'utf8')); } catch (e) { return { cycleMinutes: 30, rest: { workHours: 4, restHours: 2 }, targets: { commentsPerCycle: 8, liPerCycle: 3, mdPerCycle: 3 } }; } })();

var WORK_MS = (CFG.rest.workHours || 4) * 3600 * 1000;
var REST_MS = (CFG.rest.restHours || 2) * 3600 * 1000;
var CYCLE_MS = (CFG.cycleMinutes || 30) * 60 * 1000;

function log(msg) {
  var line = '[' + new Date().toISOString().replace('T', ' ').slice(0, 19) + '] ' + msg;
  console.log(line);
  try { fs.appendFileSync(logFile, line + '\n'); } catch (e) {}
}

function loadRest() {
  try { return JSON.parse(fs.readFileSync(REST_FILE, 'utf8')); }
  catch (e) { return { mode: 'work', work_started_at: Date.now(), rest_started_at: null, rest_ends_at: null, cycles_skipped_during_rest: 0 }; }
}

function saveRest(s) {
  try { fs.writeFileSync(REST_FILE, JSON.stringify(s, null, 2)); } catch (e) {}
}

function acquirePid() {
  try {
    if (fs.existsSync(PID_FILE)) {
      var pid = parseInt(fs.readFileSync(PID_FILE, 'utf8'), 10);
      if (pid && !isNaN(pid)) {
        try { process.kill(pid, 0); log('Another orchestrator running (pid ' + pid + ') — exiting'); process.exit(0); } catch (e) {}
      }
    }
    fs.writeFileSync(PID_FILE, String(process.pid));
  } catch (e) {}
}

function run(script, args, cb) {
  var cmd = 'python3 ' + path.join(REPO, script) + ' ' + args.join(' ');
  log('RUN: ' + path.basename(script) + ' ' + args.join(' '));
  exec(cmd, { cwd: REPO, timeout: 240000, maxBuffer: 1024 * 1024 }, function(err, stdout, stderr) {
    if (stdout) log(stdout.trim().split('\n').pop());
    if (stderr) log('STDERR: ' + stderr.trim().slice(-200));
    cb(err);
  });
}

function feedbackRefresh() {
  // Replaced by agent 15 (topic-intelligence) — richer per-topic signal.
  try {
    exec('node ' + path.join(REPO, 'tools/agents/15-topic-intelligence.js'), { cwd: REPO, timeout: 20000 }, function() {});
  } catch (e) {}
}

function shouldWork() {
  var s = loadRest();
  var now = Date.now();
  if (s.mode === 'rest') {
    if (now < (s.rest_ends_at || now)) return { work: false, s: s };
    s = { mode: 'work', work_started_at: now, rest_started_at: null, rest_ends_at: null, cycles_skipped_during_rest: 0 };
    saveRest(s);
    log('Rest over — resuming work');
    return { work: true, s: s };
  }
  if (now - (s.work_started_at || now) >= WORK_MS) {
    s = { mode: 'rest', work_started_at: s.work_started_at, rest_started_at: now, rest_ends_at: now + REST_MS, cycles_skipped_during_rest: 0 };
    saveRest(s);
    log('Entering rest until ' + new Date(s.rest_ends_at).toISOString());
    return { work: false, s: s };
  }
  return { work: true, s: s };
}

function heartbeat(phase) {
  try {
    fs.writeFileSync(HEARTBEAT_FILE, JSON.stringify({ at: new Date().toISOString(), pid: process.pid, phase: phase, mode: (loadRest() || {}).mode, cycle: cycleCount }));
  } catch (e) {}
}

function cycle() {
  var gate = shouldWork();
  if (!gate.work) {
    var s = gate.s;
    s.cycles_skipped_during_rest = (s.cycles_skipped_during_rest || 0) + 1;
    saveRest(s);
    log('Rest — cycle skipped (' + s.cycles_skipped_during_rest + ' during rest)');
    heartbeat('rest-skip');
    scheduleNext();
    return;
  }

  cycleCount++;
  cycleActive = true;
  heartbeat('cycle-start');
  if (watchdog) clearTimeout(watchdog);
  watchdog = setTimeout(function() {
    if (cycleActive) {
      log('WATCHDOG: chain stalled — forcing reschedule');
      cycleActive = false;
      heartbeat('watchdog');
      scheduleNext();
    }
  }, CYCLE_MS + 10 * 60 * 1000);

  log('=== Engagement cycle ===');
  feedbackRefresh();

  // Phase 1: reply back always (only when inbox has new replies — engine guards itself)
  run('tools/bridge/reply-engine.py', [], function() {
    // Phase 2: web idea scan (replaced browser-posting comment-engine — deleted 2026-08-11).
    // Silently scans the internet for new ideas/signals; the scanner itself persists
    // findings to the research DB (via idea-bridge.js) + writes the architect digest.
    run('tools/bridge/idea-scanner.py', [], function() {
      // Phase 4: check if engagement threshold met, then publish
      var phase4 = function() {
        run('tools/bridge/scheduler.py', [], function() {
          log('=== Cycle complete ===');
          cycleActive = false;
          if (watchdog) { clearTimeout(watchdog); watchdog = null; }
          heartbeat('cycle-complete');
          scheduleNext();
        });
      };
      // Phase 3: social publishing — browser-posting engines retired (2026-08-11).
      log('SOCIAL: browser-posting retired — idea-scanner feeds research instead');
      phase4();
    });
  });
}

function scheduleNext() {
  if (cycleActive) { log('cycle already active — skipping schedule'); return; }
  if (watchdog) { clearTimeout(watchdog); watchdog = null; }
  var s = loadRest();
  var delay = CYCLE_MS;
  if (s.mode === 'rest') {
    var remaining = (s.rest_ends_at || 0) - Date.now();
    delay = Math.min(CYCLE_MS, Math.max(1000, remaining));
  }
  setTimeout(cycle, delay);
}

acquirePid();
process.on('uncaughtException', function(err) {
  log('UNCAUGHT: ' + (err && err.message));
  cycleActive = false;
  if (watchdog) { clearTimeout(watchdog); watchdog = null; }
  scheduleNext();
});
log('Engagement orchestrator v3 started (work ' + (CFG.rest.workHours || 4) + 'h / rest ' + (CFG.rest.restHours || 2) + 'h)');
cycle();
