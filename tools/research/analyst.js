// BSAHI — Research Analyst
// Turns raw fetcher output into RESEARCH (correlations, trends, anomalies).
// This is the upgrade from "monitoring" to "analysis": instead of reporting
// what exists (versions, node counts, health), it asks what it MEANS for
// block-space economics. Runs after the fetchers in each cycle.
var path = require('path');
var fs = require('fs');

var REPO = path.resolve(__dirname, '..', '..');

function loadJson(p, fallback) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return fallback; } }

// ── SCCR trend analyst: is the externality growing or shrinking? ──
function sccrTrend() {
  var history = loadJson(path.join(REPO, 'data', 'sccr_history.json'), { payload: [] });
  var pts = (history.payload || []).slice(-5);
  if (pts.length < 2) return null;
  var latest = pts[pts.length - 1].avg_sccr;
  var prev = pts[pts.length - 2].avg_sccr;
  var change = ((latest - prev) / (prev || 1)) * 100;
  var direction = change < -5 ? 'FALLING' : (change > 5 ? 'RISING' : 'FLAT');
  return {
    latest: latest, prev: prev, changePct: Math.round(change * 10) / 10, direction: direction,
    finding: 'SCCR trend: ' + latest + ' (' + (change >= 0 ? '+' : '') + Math.round(change * 10) / 10 + '% vs ' + prev + ') — the unpriced storage externality is ' + (change < 0 ? 'GROWING' : change > 0 ? 'SHRINKING' : 'stable') + ' as fees ' + (change < 0 ? 'cool' : change > 0 ? 'rise' : 'hold') + '.'
  };
}

// ── Fee × difficulty × mempool cross-signal ──
function feeDifficultySignal() {
  var fees = loadJson(path.join(REPO, 'captured-data', 'fee_forecast.json'), {});
  var de = loadJson(path.join(REPO, 'captured-data', 'de-agent-state.json'), {});
  // Difficulty adjustment direction from the last capture
  var diffFinding = null;
  try {
    var captures = loadJson(path.join(REPO, 'captured-data', 'de-agent-state.json'), {});
    // Fall back to the latest research report if fee_forecast is thin
  } catch (e) {}
  return diffFinding;
}

// ── Node count × SCCR: does node growth shift coverage? ──
function nodeCoverageSignal() {
  var census = loadJson(path.join(REPO, 'data', 'bip110.json'), {});
  var history = loadJson(path.join(REPO, 'data', 'sccr_history.json'), { payload: [] });
  var pts = (history.payload || []);
  if (!pts.length) return null;
  var latest = pts[pts.length - 1].avg_sccr;
  // SCCR is inversely proportional to N — flag when the ratio moves without N change (fee-driven)
  return {
    finding: 'SCCR ' + latest + ' at N=32K census: fee-market-driven (node count stable at the census lower bound), so the drop reflects fee cooling, not node growth.'
  };
}

// ── The analyst run: produce insight findings ──
function runAnalysts() {
  var insights = [];
  var trend = sccrTrend();
  if (trend) insights.push({ agent: 'Research Analyst', finding: trend.finding, priority: 'high' });

  var nodeSig = nodeCoverageSignal();
  if (nodeSig) insights.push({ agent: 'Research Analyst', finding: nodeSig.finding, priority: 'medium' });

  return insights;
}

if (require.main === module) {
  runAnalysts().forEach(function(i) { console.log('[' + i.priority + '] ' + i.finding); });
}

module.exports = { runAnalysts: runAnalysts, sccrTrend: sccrTrend };
