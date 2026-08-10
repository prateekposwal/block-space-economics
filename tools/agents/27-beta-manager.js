#!/usr/bin/env node
// BSAHI — Beta Manager
// Owns data/beta-users.json — the source of truth for the beta program:
//   - first 100 users get free beta access (plan 'beta-free-6mo', expires +6 months)
//   - every registration is recorded (who, when, plan, expiry, source, product)
//   - the count + cap are served to the site (beta-status.json) for the UI
//   - after the cap, registrations go to a waitlist (still recorded)
// Operates via the de-server's /beta/register endpoint (or the CLI directly).
var fs = require('fs');
var path = require('path');

var REPO = path.resolve(__dirname, '..', '..');
var USERS_FILE = path.join(REPO, 'data', 'beta-users.json');
var STATUS_FILE = path.join(REPO, 'data', 'beta-status.json');

var BETA_CAP = 100;
var FREE_MONTHS = 6;

function loadUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
  catch (e) { return { schema: 'bsahi.beta-users/1', registered_at: null, users: [] }; }
}

function saveUsers(u) { fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2)); }

function loadStatus() {
  try { return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8')); }
  catch (e) { return { schema: 'bsahi.beta-status/1', cap: BETA_CAP, registered: 0, waitlist: 0, open: true, updated_at: null }; }
}

function saveStatus(s) { fs.writeFileSync(STATUS_FILE, JSON.stringify(s, null, 2)); }

function now() { return new Date().toISOString(); }

function addMonths(iso, months) {
  var d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

function makeKey(email, spot) {
  // Simple, deterministic access key for the beta product experience.
  // (Not crypto-grade auth — it gates the free beta UI, not sensitive data.)
  var b = Buffer.from(email + '|' + (spot || '0') + '|bsahi-beta').toString('base64');
  return b.replace(/=+$/, '');
}

function verifyKey(key) {
  try {
    var decoded = Buffer.from(String(key || ''), 'base64').toString('utf8');
    var parts = decoded.split('|');
    if (parts.length !== 3 || parts[2] !== 'bsahi-beta') return { ok: false };
    var email = parts[0], spot = parseInt(parts[1], 10);
    var users = loadUsers();
    var u = users.users.find(function(x) { return x.email === email; });
    if (!u) return { ok: false, error: 'unknown user' };
    if (!u.active) return { ok: false, error: 'account not active' };
    if (u.expiry && new Date(u.expiry) < new Date()) return { ok: false, error: 'beta expired ' + u.expiry.slice(0,10) };
    return { ok: true, user: { email: u.email, name: u.name, product: u.product, plan: u.plan, spot: u.spot, expiry: u.expiry } };
  } catch (e) { return { ok: false, error: 'invalid key' }; }
}

// ── Register a beta user ──
// Returns { ok, status: 'registered'|'waitlist'|'duplicate', spot, expiry }
function register(email, name, product, source) {
  email = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'invalid email' };
  name = String(name || '').trim().slice(0, 80);
  product = String(product || 'send-widget').slice(0, 40);
  source = String(source || 'beta.html').slice(0, 40);

  var users = loadUsers();
  // dedupe by email
  var existing = users.users.find(function(u) { return u.email === email; });
  if (existing) return { ok: false, status: 'duplicate', error: 'email already registered', spot: existing.spot };

  var registered = users.users.filter(function(u) { return u.plan === 'beta-free-6mo'; }).length;
  var isBeta = registered < BETA_CAP;

  var rec = {
    email: email,
    name: name,
    product: product,
    source: source,
    registered_at: now(),
    plan: isBeta ? 'beta-free-6mo' : 'waitlist',
    spot: isBeta ? registered + 1 : null,
    expiry: isBeta ? addMonths(now(), FREE_MONTHS) : null,
    key: isBeta ? makeKey(email, registered + 1) : null,
    active: isBeta
  };
  users.users.push(rec);
  if (!users.registered_at) users.registered_at = now();
  saveUsers(users);

  // refresh status
  refreshStatus();

  return { ok: true, status: isBeta ? 'registered' : 'waitlist', spot: rec.spot, expiry: rec.expiry, key: rec.key, cap: BETA_CAP };
}

function refreshStatus() {
  var users = loadUsers();
  var status = loadStatus();
  status.cap = BETA_CAP;
  status.registered = users.users.filter(function(u) { return u.plan === 'beta-free-6mo'; }).length;
  status.waitlist = users.users.filter(function(u) { return u.plan === 'waitlist'; }).length;
  status.open = status.registered < BETA_CAP;
  status.free_months = FREE_MONTHS;
  status.updated_at = now();
  saveStatus(status);
  return status;
}

function list() { return loadUsers().users; }

if (require.main === module) {
  var args = process.argv.slice(2);
  if (args[0] === '--register') {
    var r = register(args[1], args[2], args[3], args[4]);
    console.log(JSON.stringify(r, null, 2));
  } else if (args[0] === '--verify') {
    console.log(JSON.stringify(verifyKey(args[1]), null, 2));
  } else if (args[0] === '--status') {
    console.log(JSON.stringify(loadStatus(), null, 2));
  } else if (args[0] === '--list') {
    console.log(JSON.stringify(list(), null, 2));
  } else {
    console.log('usage: beta-manager.js --register <email> [name] [product] [source] | --verify <key> | --status | --list');
  }
}

module.exports = { register: register, verifyKey: verifyKey, makeKey: makeKey, refreshStatus: refreshStatus, list: list, BETA_CAP: BETA_CAP, FREE_MONTHS: FREE_MONTHS };
