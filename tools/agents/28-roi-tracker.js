#!/usr/bin/env node
// BSAHI — ROI Tracker
// Tracks the real economics of the beta program: costs, revenue-ready signals,
// and conversion metrics. Data lives in data/roi.json (the architect's view).
var fs = require('fs');
var path = require('path');

var REPO = path.resolve(__dirname, '..', '..');
var ROI_FILE = path.join(REPO, 'data', 'roi.json');

function load() {
  try { return JSON.parse(fs.readFileSync(ROI_FILE, 'utf8')); }
  catch (e) { return { schema: 'bsahi.roi/1', updated_at: null, costs: {}, revenue_ready: {}, beta_conversion: {}, notes: [] }; }
}

function save(d) { fs.writeFileSync(ROI_FILE, JSON.stringify(d, null, 2)); }

function refresh() {
  var d = load();

  // ── Costs (monthly, honest) ──
  // Server/hosting is free (GitHub Pages + local Core node). Track only real costs.
  var costs = d.costs || {};
  costs.hosting = 0;                 // GitHub Pages = free
  costs.bandwidth = 0;               // Pages no egress fee
  costs.tools = costs.tools || 0;    // any paid tools
  costs.labor_hours = costs.labor_hours || 0;  // architect's hours (manual)

  // ── Revenue-ready value (what the products are worth) ──
  var revenue = d.revenue_ready || {};
  revenue.widget_tier = revenue.widget_tier || 50;       // dev tier $/mo (TODO R4)
  revenue.enterprise_tier = revenue.enterprise_tier || 500; // enterprise $/mo
  revenue.index_license = revenue.index_license || 0;     // set when index licenses land
  revenue.annual_report = revenue.annual_report || 500;   // per copy (TODO R4)

  // ── Beta conversion (computed from beta-users.json) ──
  var betaUsers = [];
  try { betaUsers = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'beta-users.json'), 'utf8')).users || []; } catch (e) {}
  var conversion = d.beta_conversion || {};
  conversion.registered = betaUsers.filter(function(u) { return u.plan === 'beta-free-6mo'; }).length;
  conversion.waitlist = betaUsers.filter(function(u) { return u.plan === 'waitlist'; }).length;
  conversion.converted_to_paid = conversion.converted_to_paid || 0;  // manually updated when beta→paid

  // ── ROI derived ──
  var potentialMonthly = conversion.converted_to_paid * revenue.widget_tier;
  var lifetimeValue = conversion.registered * revenue.widget_tier * 12; // if all converted at 12mo
  d.potential_monthly_revenue = potentialMonthly;
  d.estimated_annual_value = lifetimeValue;
  d.updated_at = new Date().toISOString();
  d.notes = d.notes || [];
  save(d);
  return d;
}

if (require.main === module) {
  if (process.argv[2] === '--set-cost') {
    // --set-cost <key> <value>
    var d = load(); d.costs[process.argv[3]] = parseFloat(process.argv[4]); save(d); console.log('cost set:', process.argv[3], process.argv[4]);
  } else if (process.argv[2] === '--set-conversion') {
    var d2 = load(); d2.beta_conversion.converted_to_paid = parseInt(process.argv[3], 10); save(d2); console.log('conversion set:', process.argv[3]);
  } else {
    console.log(JSON.stringify(refresh(), null, 2));
  }
}

module.exports = { refresh: refresh, load: load };
