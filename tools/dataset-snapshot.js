#!/usr/bin/env node
// BSAHI — Dataset Snapshot Publisher (v2, synchronous build, step-logged)
// Packages EVERY captured dataset into a versioned archive and publishes it as
// a GitHub Release (free storage, no egress fees). Idempotent per day.
var fs = require('fs');
var path = require('path');
var child_process = require('child_process');

var REPO = path.resolve(__dirname, '..');
var TOKEN = process.env.GH_TOKEN;
var OWNER = 'prateekposwal';
var REPO_NAME = 'block-space-economics';
var API = 'https://api.github.com/repos/' + OWNER + '/' + REPO_NAME + '/releases';
var TMP = '/tmp/bsahi-dataset';
var TAR = '/tmp/bsahi-dataset.tar.gz';

function sh(cmd) {
  var r = child_process.execSync(cmd, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return r;
}
function run(cmd, args) {
  return new Promise(function(resolve) {
    var cp = child_process.spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    var out = '';
    cp.stdout.on('data', function(d) { out += d; });
    cp.stderr.on('data', function(d) { out += d; });
    cp.on('close', function(code) { resolve({ code: code, out: out }); });
  });
}

async function main() {
  var dateStr = new Date().toISOString().slice(0, 10);
  var tag = 'dataset-' + dateStr;
  console.log('[1/6] build bundle for ' + tag);

  // Fresh bundle dir
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  try { fs.rmSync(TAR, { force: true }); } catch (e) {}
  fs.mkdirSync(TMP, { recursive: true });

  // Copy every dataset
  var spoolDir = path.join(REPO, 'captured-data', 'spool');
  if (fs.existsSync(spoolDir)) { sh('cp -R "' + spoolDir + '" "' + TMP + '/spool"'); console.log('  spool: copied'); }
  var dbFile = path.join(REPO, 'captured-data', 'bsahi.db');
  if (fs.existsSync(dbFile)) { sh('cp "' + dbFile + '" "' + TMP + '/bsahi.db"'); console.log('  bshahi.db: copied'); }
  fs.mkdirSync(path.join(TMP, 'data'), { recursive: true });
  ['bip110.json', 'sccr.json', 'sccr_latest.json', 'sccr_history.json'].forEach(function(f) {
    var p = path.join(REPO, 'data', f);
    if (fs.existsSync(p)) sh('cp "' + p + '" "' + TMP + '/data/' + f + '"');
  });
  var repro = path.join(REPO, 'research', 'reproduce', 'input');
  if (fs.existsSync(repro)) sh('cp -R "' + repro + '" "' + TMP + '/reproduce-input"');

  // Manifest
  console.log('[2/6] manifest');
  var manifest = { generated_at: new Date().toISOString(), tag: tag, sources: {}, db_rows: {} };
  var idx = path.join(TMP, 'spool', 'index');
  if (fs.existsSync(idx)) {
    fs.readdirSync(idx).forEach(function(s) {
      var dir = path.join(idx, s);
      if (!fs.statSync(dir).isDirectory()) return;
      var files = fs.readdirSync(dir).filter(function(f) { return f.endsWith('.jsonl'); });
      var rows = 0;
      files.forEach(function(f) { rows += fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean).length; });
      manifest.sources[s] = { files: files.length, rows: rows };
    });
  }
  try {
    var db = require('./db/init.js');
    ['captures', 'block_stats', 'research_findings', 'node_geo'].forEach(function(t) {
      try { manifest.db_rows[t] = db.query('SELECT count(*) c FROM ' + t)[0].c; } catch (e) {}
    });
  } catch (e) { console.log('  db manifest err: ' + e.message.slice(0,60)); }
  fs.writeFileSync(path.join(TMP, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('  sources: ' + Object.keys(manifest.sources).length + ', db rows: ' + JSON.stringify(manifest.db_rows));

  // Tar
  console.log('[3/6] tar');
  sh('cd /tmp/bsahi-dataset && tar -czf "' + TAR + '" .');
  var size = fs.statSync(TAR).size;
  console.log('  bundle: ' + (size / 1024 / 1024).toFixed(1) + ' MB');

  // Idempotency: skip if today's release exists
  console.log('[4/6] check existing release');
  var existing = await run('curl', ['-s', '-H', 'Authorization: token ' + TOKEN, API + '/tags/' + tag]);
  if (existing.out && existing.out.indexOf('"id"') !== -1) { console.log('  release exists — done.'); cleanup(); return; }

  // Create release
  console.log('[5/6] create release');
  var createBody = JSON.stringify({ tag_name: tag, name: 'Dataset snapshot ' + dateStr, body: 'Full BSAHI dataset — all captured block/fee/mempool/governance data. ' + (size/1024/1024).toFixed(1) + ' MB.', draft: false, prerelease: false });
  var create = await run('curl', ['-s', '-X', 'POST', '-H', 'Authorization: token ' + TOKEN, '-H', 'Content-Type: application/json', '-d', createBody, API]);
  var rel;
  try { rel = JSON.parse(create.out); } catch (e) { console.log('  parse fail: ' + create.out.slice(0, 150)); cleanup(); return; }
  if (!rel.id) { console.log('  create failed: ' + create.out.slice(0, 250)); cleanup(); return; }
  console.log('  release id ' + rel.id);

  // Upload asset
  console.log('[6/6] upload asset');
  var uploadUrl = 'https://uploads.github.com/repos/' + OWNER + '/' + REPO_NAME + '/releases/' + rel.id + '/assets?name=dataset-' + dateStr + '.tar.gz';
  var up = await run('curl', ['-s', '-X', 'POST', '-H', 'Authorization: token ' + TOKEN, '-H', 'Content-Type: application/gzip', '--data-binary', '@' + TAR, uploadUrl]);
  if (up.out && up.out.indexOf('"id"') !== -1) console.log('  asset uploaded ✓');
  else console.log('  upload: ' + up.out.slice(0, 200));
  cleanup();
  console.log('DONE: ' + tag + ' published to GitHub Releases (free).');
}

function cleanup() {
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  try { fs.rmSync(TAR, { force: true }); } catch (e) {}
}

if (require.main === module) { main().then(function() { process.exit(0); }).catch(function(e) { console.error(e); process.exit(1); }); }
module.exports = { main: main };
