var fs = require('fs');
var path = require('path');

var notes = require('./notes.js');

var fetchers = [
  require('./fetchers/bitcoin-core.js'),
  require('./fetchers/lightning.js'),
  require('./fetchers/data-sources.js'),
  require('./fetchers/general.js'),
  require('./fetchers/academic.js'),
];

var STATE = { cycleCount: 0, lastRun: null, lastResults: [] };
var STATE_FILE = path.resolve(__dirname, '..', '..', 'captured-data', 'research-state.json');
var REPORT_DIR = path.resolve(__dirname, '..', '..', 'reports', 'research');

function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) STATE = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (e) { STATE = { cycleCount: 0, lastRun: null, lastResults: [] }; }
}

function saveState() {
  try {
    ensureDir(path.dirname(STATE_FILE));
    fs.writeFileSync(STATE_FILE, JSON.stringify(STATE, null, 2));
  } catch (e) {}
}

function log(msg) {
  var ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log('[Research Runner ' + ts + '] ' + msg);
}

function generateReport(allResults) {
  var now = new Date();
  var dateStr = now.toISOString().slice(0, 10);
  var lines = [];
  lines.push('# Research Agent Report — ' + dateStr);
  lines.push('Cycle: ' + STATE.cycleCount + ' | Generated: ' + now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Agent | Findings | Status |');
  lines.push('|-------|----------|--------|');
  for (var i = 0; i < allResults.length; i++) {
    var r = allResults[i];
    lines.push('| ' + r.agent + ' | ' + r.findings.length + ' | ✅ |');
  }
  lines.push('');
  for (var i = 0; i < allResults.length; i++) {
    var r = allResults[i];
    lines.push('## ' + r.agent);
    lines.push('');
    for (var j = 0; j < r.findings.length; j++) {
      lines.push('- ' + r.findings[j]);
    }
    lines.push('');
  }
  // Include architect's notes
  var noteSummary = notes.getSummary();
  if (noteSummary && noteSummary.hasNotes) {
    lines.push('## 🧑‍🔧 Architect\'s Research Notes');
    lines.push('');
    lines.push('The following insights were provided by the architect and applied to this cycle:');
    lines.push('');
    for (var si = 0; si < noteSummary.sections.length; si++) {
      var sec = noteSummary.sections[si];
      var secNotes = notes.readNotes();
      if (secNotes && secNotes[sec]) {
        lines.push('### ' + sec);
        for (var ni = 0; ni < secNotes[sec].length; ni++) {
          lines.push('- ' + secNotes[sec][ni]);
        }
        lines.push('');
      }
    }
  }

  lines.push('---');
  lines.push('*Bitcoin Sahi Research Agent System*');

  ensureDir(REPORT_DIR);
  var filePath = path.join(REPORT_DIR, dateStr + '.md');
  fs.writeFileSync(filePath, lines.join('\n'));
  log('Report saved: ' + filePath);

  // Also save a latest symlink/copy
  var latestPath = path.join(REPORT_DIR, 'latest.md');
  fs.writeFileSync(latestPath, lines.join('\n'));

  return filePath;
}

async function runCycle() {
  var start = Date.now();
  STATE.cycleCount++;
  log('Cycle ' + STATE.cycleCount + ' started — running ' + fetchers.length + ' agents');

  var results = [];
  for (var i = 0; i < fetchers.length; i++) {
    try {
      var result = await fetchers[i].run();
      results.push(result);
      log('  ' + result.agent + ': ' + result.findings.length + ' findings');
      // Persist live findings into research_findings (agent-14's producer edge).
      var db = require('../db/init.js');
      var NOISE = ['No new findings this cycle', 'No new papers found this cycle'];
      for (var j = 0; j < (result.findings || []).length; j++) {
        var f = String(result.findings[j]);
        if (f.indexOf('Error:') === 0 || NOISE.indexOf(f) !== -1) continue;
        db.insertResearchFinding(result.agent, f.slice(0, 120), f, '', 0.7, 'research-cycle', '', STATE.cycleCount);
      }
    } catch (e) {
      log('  Agent ' + (i + 1) + ' error: ' + e.message);
      results.push({ agent: 'Agent ' + (i + 1), findings: ['Error: ' + e.message], timestamp: new Date().toISOString() });
    }
  }

  // ── Analyst layer: convert raw fetcher data into RESEARCH (trends, signals) ──
  try {
    var analyst = require('./analyst.js');
    var insights = analyst.runAnalysts();
    var db2 = require('../db/init.js');
    insights.forEach(function(ins) {
      results.push({ agent: ins.agent, findings: [ins.finding], timestamp: new Date().toISOString() });
      db2.insertResearchFinding(ins.agent, ins.finding.slice(0, 120), ins.finding, '', 0.85, 'research-analysis', '', STATE.cycleCount);
      log('  Research Analyst: ' + ins.finding.slice(0, 70));
    });
  } catch (e) { log('Analyst layer error: ' + e.message); }

  STATE.lastRun = Date.now();
  STATE.lastResults = results;
  saveState();

  var reportPath = generateReport(results);
  var elapsed = Math.round((Date.now() - start) / 1000);
  log('Cycle ' + STATE.cycleCount + ' complete in ' + elapsed + 's — report at ' + reportPath);
  return results;
}

function start(intervalMinutes) {
  intervalMinutes = intervalMinutes || 240;
  loadState();
  log('Starting — ' + fetchers.length + ' research agents, cycle every ' + intervalMinutes + ' minutes');
  ensureDir(REPORT_DIR);

  runCycle().catch(function(e) { log('Cycle error: ' + e.message); });
  setInterval(function() {
    runCycle().catch(function(e) { log('Cycle error: ' + e.message); });
  }, intervalMinutes * 60 * 1000);
}

if (require.main === module) {
  var interval = parseInt(process.argv[2], 10) || 240;
  start(interval);
}

module.exports = { start: start, runCycle: runCycle, getState: function() { return STATE; } };
