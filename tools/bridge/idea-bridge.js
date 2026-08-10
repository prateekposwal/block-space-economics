#!/usr/bin/env node
// BSAHI — Web Idea Scanner → research DB bridge
// Reads the idea-scanner's findings (captured-data/idea-scanner-state.json) and
// persists them to research_findings so the RESEARCH TEAM and architect see them.
// Runs after idea-scanner.py in the orchestrator phase-2 chain.
var fs = require('fs');
var path = require('path');

var REPO = path.resolve(__dirname, '..', '..');

function main() {
  var stateFile = path.join(REPO, 'captured-data', 'idea-scanner-state.json');
  var state;
  try { state = JSON.parse(fs.readFileSync(stateFile, 'utf8')); }
  catch (e) { console.log('idea-bridge: no state file yet'); return; }

  var findings = state.findings || [];
  if (!findings.length) { console.log('idea-bridge: no findings to persist'); return; }

  try {
    var db = require('../db/init.js');
    var inserted = 0;
    findings.forEach(function(f) {
      // dedupe: skip if this exact finding already exists
      var existing = db.query("SELECT id FROM research_findings WHERE source='Web Idea Scanner' AND title='" + String(f).slice(0,120).replace(/'/g,"''") + "'");
      if (existing && existing.length) return;
      db.insertResearchFinding('Web Idea Scanner', String(f).slice(0,120), f, '', 0.8, 'research-idea', '', 0);
      inserted++;
    });
    console.log('idea-bridge: ' + inserted + ' findings persisted to research DB');
  } catch (e) { console.log('idea-bridge error: ' + e.message); }
}

if (require.main === module) { main(); }
module.exports = { main: main };
