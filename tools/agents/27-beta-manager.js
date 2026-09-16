#!/usr/bin/env node
// BSAHI — Beta Manager
// Owns the beta program's two stores:
//   data/beta-users.json   PUBLIC, PII-FREE roster (tracked, deployed). Each
//                          entry carries only a SHA-256 hash of the access key
//                          plus non-identifying metadata. No email, no name,
//                          no raw key — safe to serve from GitHub Pages.
//   private/beta-ledger.json  PRIVATE operator ledger (gitignored, never
//                          deployed). Holds email/name/raw key so the operator
//                          can re-send a key. Never commit this.
// Access keys are RANDOM (crypto.randomBytes) — not derived from an email — so
// a leaked key reveals nothing and cannot be forged from a known address.
// Operates via the de-server's /beta/register endpoint (or the CLI directly).
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var REPO = path.resolve(__dirname, '..', '..');
var USERS_FILE = path.join(REPO, 'data', 'beta-users.json');
var LEDGER_FILE = path.join(REPO, 'private', 'beta-ledger.json');
var STATUS_FILE = path.join(REPO, 'data', 'beta-status.json');

var BETA_CAP = 100;
var FREE_MONTHS = 6;

function loadUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
  catch (e) { return { schema: 'bsahi.beta-users/2', registered_at: null, users: [] }; }
}

function saveUsers(u) { fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2) + '\n'); }

function loadLedger() {
  try { return JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8')); }
  catch (e) { return { schema: 'bsahi.beta-ledger/1', registered_at: null, users: [] }; }
}

function saveLedger(l) {
  fs.mkdirSync(path.dirname(LEDGER_FILE), { recursive: true });
  fs.writeFileSync(LEDGER_FILE, JSON.stringify(l, null, 2) + '\n');
}

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

function makeKey() {
  // Random 32-byte, base64url, unpadded. Unguessable and reveals no identity.
  return crypto.randomBytes(32).toString('base64url');
}

function keySha256(key) {
  return crypto.createHash('sha256').update(String(key), 'utf8').digest('hex');
}

function verifyKey(key) {
  try {
    var hash = keySha256(String(key || '').replace(/\s+/g, '').replace(/=+$/, ''));
    var users = loadUsers();
    var u = (users.users || []).find(function (x) { return x.key_sha256 === hash; });
    if (!u) return { ok: false, error: 'unknown key' };
    if (!u.active) return { ok: false, error: 'account not active' };
    if (u.expiry && new Date(u.expiry) < new Date()) return { ok: false, error: 'beta expired ' + u.expiry.slice(0, 10) };
    return { ok: true, user: { id: u.id, label: u.label, product: u.product, plan: u.plan, spot: u.spot, expiry: u.expiry } };
  } catch (e) { return { ok: false, error: 'invalid key' }; }
}

// ── Register a beta user ──
// Returns { ok, status: 'registered'|'waitlist'|'duplicate', spot, expiry, key }
function register(email, name, product, source) {
  email = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'invalid email' };
  name = String(name || '').trim().slice(0, 80);
  product = String(product || 'send-widget').slice(0, 40);
  source = String(source || 'beta.html').slice(0, 40);

  var ledger = loadLedger();
  var existing = ledger.users.find(function (u) { return u.email === email; });
  if (existing) return { ok: false, status: 'duplicate', error: 'email already registered', spot: existing.spot };

  var registered = ledger.users.filter(function (u) { return u.plan === 'beta-free-6mo'; }).length;
  var isBeta = registered < BETA_CAP;

  var id = 'beta-' + String(registered + 1).padStart(4, '0');
  var key = isBeta ? makeKey() : null;
  var expiry = isBeta ? addMonths(now(), FREE_MONTHS) : null;

  // Private ledger — PII + raw key (gitignored).
  ledger.users.push({
    id: id, email: email, name: name, key: key, product: product, source: source,
    registered_at: now(), plan: isBeta ? 'beta-free-6mo' : 'waitlist',
    spot: isBeta ? registered + 1 : null, expiry: expiry, active: isBeta
  });
  if (!ledger.registered_at) ledger.registered_at = now();
  saveLedger(ledger);

  // Public roster — hashed, PII-free (deployed).
  var users = loadUsers();
  users.users.push({
    id: id, label: 'Beta #' + (isBeta ? registered + 1 : registered),
    key_sha256: key ? keySha256(key) : null, product: product,
    plan: isBeta ? 'beta-free-6mo' : 'waitlist',
    spot: isBeta ? registered + 1 : null,
    registered_at: now(), expiry: expiry, active: isBeta
  });
  if (!users.registered_at) users.registered_at = now();
  saveUsers(users);

  refreshStatus();

  return { ok: true, status: isBeta ? 'registered' : 'waitlist', spot: isBeta ? registered + 1 : null, expiry: expiry, key: key, cap: BETA_CAP };
}

function refreshStatus() {
  var ledger = loadLedger();
  var status = loadStatus();
  status.cap = BETA_CAP;
  status.registered = ledger.users.filter(function (u) { return u.plan === 'beta-free-6mo'; }).length;
  status.waitlist = ledger.users.filter(function (u) { return u.plan === 'waitlist'; }).length;
  status.open = status.registered < BETA_CAP;
  status.free_months = FREE_MONTHS;
  status.updated_at = now();
  saveStatus(status);
  return status;
}

function list() { return loadLedger().users; }

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

module.exports = { register: register, verifyKey: verifyKey, makeKey: makeKey, keySha256: keySha256, refreshStatus: refreshStatus, list: list, BETA_CAP: BETA_CAP, FREE_MONTHS: FREE_MONTHS };
