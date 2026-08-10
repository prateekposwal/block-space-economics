#!/usr/bin/env node
// BSAHI — Distribution Report Generator
// Single source of truth: reads captured-data/post-log.json and writes the
// distribution report with live counts (no hardcoded numbers).
var path = require('path');
var fs = require('fs');

var REPO = path.resolve(__dirname, '..', '..');
var OUT = path.join(REPO, 'reports', 'marketing', 'distribution-report.md');

function loadPostLog() {
  try { return JSON.parse(fs.readFileSync(path.join(REPO, 'captured-data', 'post-log.json'), 'utf8')).posts || []; }
  catch (e) { return []; }
}

function run() {
  var posts = loadPostLog();
  var byPlatform = {};
  var byPersona = {};
  var total = 0;
  posts.forEach(function(p) {
    total++;
    var pl = p.platform || 'unknown';
    byPlatform[pl] = (byPlatform[pl] || 0) + 1;
    if (p.persona) byPersona[p.persona] = (byPersona[p.persona] || 0) + 1;
  });

  var lines = [];
  lines.push('# Distribution Report');
  lines.push('');
  lines.push('_Generated ' + new Date().toISOString() + ' from captured-data/post-log.json (single source of truth)._');
  lines.push('');
  lines.push('## Totals');
  lines.push('- **' + total + ' posts** across ' + Object.keys(byPlatform).length + ' platforms');
  lines.push('');
  lines.push('## By platform');
  Object.keys(byPlatform).sort().forEach(function(p) { lines.push('- ' + p + ': ' + byPlatform[p]); });
  lines.push('');
  lines.push('## By researcher agent');
  var personaNames = { satoshi: 'Fees Analyst', hal: 'Research Engineer', lisa: 'Data Journalist', wei: 'Protocol Researcher', nick: 'Economics Analyst' };
  var personaCount = 0;
  Object.keys(byPersona).sort().forEach(function(p) {
    personaCount += byPersona[p];
    lines.push('- ' + (personaNames[p] || p) + ': ' + byPersona[p]);
  });
  lines.push('- (unattributed/legacy): ' + (total - personaCount));
  lines.push('');
  lines.push('## Nostr identity');
  lines.push('- NIP-05: `_@bitcoinsahi.com` → `44744d037e50a4f3bc6b44b9ca7c5a3f52e68b0f70789696ccb7e28e274d2d61`');
  lines.push('');

  fs.writeFileSync(OUT, lines.join('\n'));
  if (require.main === module) console.log('distribution-report: ' + total + ' posts written to ' + OUT);
  return { total: total, byPlatform: byPlatform };
}

if (require.main === module) { run(); process.exit(0); }
module.exports = { run: run };
