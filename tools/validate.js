var fs = require('fs');
var path = require('path');
var child_process = require('child_process');

var ROOT = path.resolve(__dirname, '..');
var ALL_HTML = ['index.html', 'live.html', 'learn.html', 'capacity.html', 'fork-tracker.html', 'story.html'];
 var ALL_JS = ['tools/data-engine.js', 'tools/viz-core.js', 'tools/viz-send.js', 'tools/viz-lightning.js',
   'tools/viz-exchange.js', 'tools/viz-node.js', 'tools/viz-miner.js', 'tools/viz-research.js', 'tools/viz-developer.js',
   'js/beta-gate.js', 'js/beta-nav.js', 'js/data-health.js', 'sw.js',
   'tools/viz-bip110.js', 'tools/viz-block-interval.js', 'tools/viz-hashrate.js',
   'tools/viz-fee-heatmap.js', 'tools/viz-mempool-hist.js', 'tools/generate_viz_data.js',
   'tools/data-engineering/capture-agent.js', 'tools/data-engineering/config.js',
   'tools/data-engineering/block-adoption-collect.js', 'tools/data-engineering/schemas/block_adoption.js'];
var ALL_ViZ = ['tools/viz-send.js', 'tools/viz-lightning.js', 'tools/viz-exchange.js', 'tools/viz-node.js',
  'tools/viz-miner.js', 'tools/viz-research.js', 'tools/viz-developer.js'];

var errors = [];
var warnings = [];

function assert(condition, msg) {
  if (!condition) errors.push(msg);
}

function warn(condition, msg) {
  if (!condition) warnings.push(msg);
}

// 1. Syntax check: all JS files
function checkSyntaxJS(filePath) {
  try {
    var content = fs.readFileSync(filePath, 'utf8').replace(/^#!.*\n/, '');
    new Function(content);
    return true;
  } catch (e) {
    errors.push('SYNTAX ' + filePath + ': ' + e.message);
    return false;
  }
}

// 2. Syntax check: all HTML files (extract inline scripts)
function checkSyntaxHTML(filePath) {
  var content = fs.readFileSync(filePath, 'utf8');
  var scripts = content.match(/<script>([\s\S]*?)<\/script>/g);
  if (!scripts) return true;
  var ok = true;
  for (var i = 0; i < scripts.length; i++) {
    var js = scripts[i].replace(/<\/?script>/g, '');
    try {
      new Function(js);
    } catch (e) {
      errors.push('SYNTAX ' + filePath + ' (script ' + (i+1) + '): ' + e.message);
      ok = false;
    }
  }
  return ok;
}

// 3. Brace balance check (all HTML + JS files)
function checkBraceBalance(filePath) {
  var content = fs.readFileSync(filePath, 'utf8');
  // For HTML, only check <script> sections
  if (filePath.endsWith('.html')) {
    var scripts = content.match(/<script>([\s\S]*?)<\/script>/g) || [];
    for (var i = 0; i < scripts.length; i++) {
      var js = scripts[i].replace(/<\/?script>/g, '');
      var opens = js.count('{');
      var closes = js.count('}');
      if (opens !== closes) {
        errors.push('BRACE ' + filePath + ' (script ' + (i+1) + '): ' + opens + ' { vs ' + closes + ' }');
      }
    }
  } else {
    var opens = content.count('{');
    var closes = content.count('}');
    if (opens !== closes) {
      errors.push('BRACE ' + filePath + ': ' + opens + ' { vs ' + closes + ' }');
    }
  }
}

// 4. Check all viz files for resize export
function checkResizeExports() {
  for (var i = 0; i < ALL_ViZ.length; i++) {
    var content = fs.readFileSync(path.resolve(ROOT, ALL_ViZ[i]), 'utf8');
    var hasResize = content.indexOf('resize') > -1;
    var hasReturn = content.indexOf('return {') > -1;
    if (!hasResize && hasReturn) {
      errors.push('EXPORT ' + ALL_ViZ[i] + ': missing resize in return object');
    }
  }
}

// 5. Check DATA_ENGINE guards
function checkDataEngineGuards() {
  for (var i = 0; i < ALL_ViZ.length; i++) {
    var content = fs.readFileSync(path.resolve(ROOT, ALL_ViZ[i]), 'utf8');
    var hasRef = content.indexOf('DATA_ENGINE') > -1;
    var hasGuard = content.indexOf('typeof DATA_ENGINE') > -1;
    if (hasRef && !hasGuard) {
      errors.push('GUARD ' + ALL_ViZ[i] + ': DATA_ENGINE used without typeof guard');
    }
  }
}

// 6. Check for orphaned var declarations outside their scope
function checkVarScopes() {
  var htmlFiles = ALL_HTML.map(function(f) { return path.resolve(ROOT, f); });
  for (var fi = 0; fi < htmlFiles.length; fi++) {
    var content = fs.readFileSync(htmlFiles[fi], 'utf8');
    // Extract inline scripts
    var scripts = content.match(/<script>([\s\S]*?)<\/script>/g) || [];
    for (var si = 0; si < scripts.length; si++) {
      var js = scripts[si].replace(/<\/?script>/g, '');
      // Find all var declarations inside function() { ... } that should be outside
      var funcVars = js.match(/function\s*\([^)]*\)\s*\{[^}]*\bvar\s+(\w+)\s*=/g);
      // This is overly simplistic but catches common patterns
    }
  }
}

// 7. Check try-catch balance (crude)
function checkTryCatch(filePath) {
  var content = fs.readFileSync(filePath, 'utf8');
  var scripts = filePath.endsWith('.html') ? 
    (content.match(/<script>([\s\S]*?)<\/script>/g) || []).map(function(s) { return s.replace(/<\/?script>/g, ''); }) :
    [content];
  for (var si = 0; si < scripts.length; si++) {
    var js = scripts[si];
    var tryCount = (js.match(/\btry\b/g) || []).length;
    var catchCount = (js.match(/\bcatch\b/g) || []).length;
    // Remove inline try-catch (same line) from counts
    var inlineTC = (js.match(/try\s*\{[^}]*\}\s*catch\s*\([^)]*\)\s*\{[^}]*\}/g) || []).length;
    tryCount -= inlineTC;
    catchCount -= inlineTC;
    if (tryCount !== catchCount) {
      warn('TRY-CATCH ' + filePath + ' (script ' + (si+1) + '): ' + tryCount + ' try vs ' + catchCount + ' catch (may be false positive)');
    }
  }
}

// 8. Check for hardcoded API field names that might mismatch
function checkAPIFields(filePath) {
  var content = fs.readFileSync(filePath, 'utf8');
  var riskyPatterns = [
    { pattern: /avgFeeRate/g, field: 'avgFeeRate — API returns avgFees (capital F)' },
    { pattern: /avg_fee_rate/g, field: 'avg_fee_rate — API returns avgFees' },
    { pattern: /\.date\b/g, field: 'date — API returns timestamp' },
  ];
  for (var i = 0; i < riskyPatterns.length; i++) {
    if (riskyPatterns[i].pattern.test(content)) {
      warn('FIELD ' + filePath + ': ' + riskyPatterns[i].field);
    }
  }
}

// 9. Check that feeFlashActive/lastFastestFee are properly scoped
function checkFlashScope() {
  var livePath = path.resolve(ROOT, 'live.html');
  var content = fs.readFileSync(livePath, 'utf8');
  // Check that feeFlashActive is not declared inside a function that also uses it outside
  var scripts = content.match(/<script>([\s\S]*?)<\/script>/g) || [];
  for (var si = 0; si < scripts.length; si++) {
    var js = scripts[si].replace(/<\/?script>/g, '');
    // Look for var feeFlashActive inside IIFE
    var insideIIFE = js.match(/\(function\(\)\s*\{[^}]*\bvar\s+feeFlashActive\b/);
    if (insideIIFE) {
      warn('SCOPE live.html: feeFlashActive declared inside IIFE — may be inaccessible from handlers');
    }
  }
}

String.prototype.count = function(s) {
  return this.split(s).length - 1;
};

// ── Measurement-layer integrity checks (the site's own standard) ──

// C1: every data/*.json + tools/*.json must parse AND be free of conflict markers.
function checkDataJSON() {
  var glob = child_process.execSync("ls data/*.json tools/*.json 2>/dev/null || true", { cwd: ROOT }).toString().trim().split('\n').filter(Boolean);
  if (!glob.length) return;
  glob.forEach(function(f) {
    var p = path.resolve(ROOT, f);
    if (!fs.existsSync(p)) return;
    var t = fs.readFileSync(p, 'utf8');
    if (t.indexOf('<<<<<<<') !== -1 || t.indexOf('=======') !== -1 || t.indexOf('>>>>>>>') !== -1) {
      errors.push('JSON conflict markers in ' + f + ' — a bad rebase/merge corrupted this file');
      return;
    }
    try { JSON.parse(t); }
    catch (e) { errors.push('Invalid JSON in ' + f + ' — ' + e.message); }
  });
}

// C2: no hardcoded numeric fallbacks in inline scripts or viz JS (|| 3, || 840000).
// Missing data must render as "— + 🟡 data pending", never a plausible default.
var MASK_FILES = ['index.html', 'live.html', 'fork-tracker.html', 'story.html', 'capacity.html',
  'tools/viz-core.js', 'tools/viz-send.js', 'tools/viz-lightning.js', 'tools/viz-exchange.js',
  'tools/viz-node.js', 'tools/viz-miner.js', 'tools/viz-research.js', 'tools/viz-developer.js',
  'tools/viz-bip110.js', 'tools/viz-block-interval.js', 'tools/viz-hashrate.js',
  'tools/viz-fee-heatmap.js', 'tools/viz-mempool-hist.js'];

function checkNumericFallbacks() {
  MASK_FILES.forEach(function(f) {
    var p = path.resolve(ROOT, f);
    if (!fs.existsSync(p)) return;
    var t = fs.readFileSync(p, 'utf8');
    var lines = t.split('\n');
    lines.forEach(function(line, i) {
      var m = line.match(/\|\|\s*(\d{1,9})(?![\d.])/);
      if (!m) return;
      var val = m[1];
      if (val === '0') return;
      if (val === '1' && /devicePixelRatio/.test(line)) return; // render scale, not a data mask
      if (/innerWidth|innerHeight|window\.width|window\.height|rect\.height/.test(line)) return; // canvas-size fallbacks, not data masks
      if (val === '1' && /Math\.sqrt|dist|dx|dy|dxc|dyc|distc|n\s*\|\||total\s*\|\||\(total\s*\|\|/.test(line)) return; // geometry/div guard, not a data mask
      if (val === '1' && /totalTxs\s*\|\|/.test(line)) return; // div-by-zero guard, not data
      if (val === '1' && /maxF|% 12|\|\s*12|maxF\s*\*/.test(line)) return; // axis-scale/clock guard, not data
      if (val === '12' && /% 12/.test(line)) return; // 12-hour clock, not data
      if (val === '50' && /interval/.test(line)) return; // animation frame interval, not data
      if (val === '350' && /baseH|maxHeight/.test(line)) return; // canvas height default, not data
      if (val === '800' && /w\s*\|\|\s*800|\(w\s*\|\|/.test(line)) return; // canvas width default, not data
      if (val === '400' && /h\s*\|\|\s*400|\(h\s*\|\|/.test(line)) return; // canvas height default, not data
      if (val === '600' && /rect\.height\s*\|\|\s*600/.test(line)) return; // canvas height default, not data
      if (val === '600' && /r\.width\s*\|\|\s*600|\.width\s*=\s*r\.width\s*\|\|\s*600/.test(line)) return; // canvas width default, not data
      if (val === '1000' && /clientWidth\s*\|\|/.test(line)) return; // canvas width default, not data
      if (val === '900' && /r\.width\s*\|\|/.test(line)) return; // canvas width default, not data
      if (val === '800' && /r\.width\s*\|\|/.test(line)) return; // canvas width default, not data
      if (/catch\s*\(/.test(line)) return;
      errors.push(f + ':' + (i + 1) + ' hardcoded fallback || ' + val + ' — missing data must show "— + 🟡 pending", not a plausible number');
    });
  });
}

// C3: no hardcoded measurement claims as literals in HTML.
var CLAIM_FILES = ['index.html', 'live.html', 'capacity.html', 'story.html', 'fork-tracker.html', 'learn.html'];
var CLAIM_RE = /(84M UTXOs|425 EH\/s|\$924|\$68K|13\+ data sources|17K\+ nodes|4,400\+ BTC|\-5\.2% difficulty)/;

function checkHardcodedClaims() {
  CLAIM_FILES.forEach(function(f) {
    var p = path.resolve(ROOT, f);
    if (!fs.existsSync(p)) return;
    var t = fs.readFileSync(p, 'utf8');
    var lines = t.split('\n');
    lines.forEach(function(line, i) {
      var m = line.match(CLAIM_RE);
      if (m) errors.push(f + ':' + (i + 1) + ' hardcoded claim "' + m[1] + '" — must be fetched from a pipeline JSON, not a literal');
    });
  });
}

// C4: no data fabrication (Math.random building "live" datasets) in viz JS.
var FAB_FILES = ['tools/viz-lightning.js', 'tools/viz-miner.js', 'tools/viz-research.js', 'tools/viz-send.js', 'tools/viz-node.js', 'tools/viz-exchange.js',
  'tools/viz-bip110.js', 'tools/viz-block-interval.js', 'tools/viz-hashrate.js',
  'tools/viz-fee-heatmap.js', 'tools/viz-mempool-hist.js'];

function checkFabrication() {
  FAB_FILES.forEach(function(f) {
    var p = path.resolve(ROOT, f);
    if (!fs.existsSync(p)) return;
    var t = fs.readFileSync(p, 'utf8');
    var lines = t.split('\n');
    lines.forEach(function(line, i) {
      // Only flag Math.random() producing DATA values (pubkey/alias/channels/
      // capacity/feeRate), NOT canvas layout positioning (x/y/vx/vy).
      if (/Math\.random\s*\(\s*\)/.test(line) && !/(x|y|vx|vy)\s*:\s*/.test(line)) {
        errors.push(f + ':' + (i + 1) + ' Math.random() producing a data value — fabricated "live" data must be removed or labeled');
      }
    });
  });
}

console.log('═══ Running validation... ═══\n');

// Run all checks
ALL_HTML.forEach(function(f) {
  var p = path.resolve(ROOT, f);
  if (!fs.existsSync(p)) { warn('MISSING ' + f); return; }
  checkSyntaxHTML(p);
  checkBraceBalance(p);
  checkTryCatch(p);
  checkAPIFields(p);
});

ALL_JS.forEach(function(f) {
  var p = path.resolve(ROOT, f);
  if (!fs.existsSync(p)) { warn('MISSING ' + f); return; }
  checkSyntaxJS(p);
  checkBraceBalance(p);
  checkAPIFields(p);
});

checkResizeExports();
checkDataEngineGuards();
checkFlashScope();

// Measurement-layer integrity (C1-C4)
checkDataJSON();
checkNumericFallbacks();
checkHardcodedClaims();
checkFabrication();

// Report
console.log('Errors: ' + errors.length);
errors.forEach(function(e) { console.log('  ❌ ' + e); });

console.log('\nWarnings: ' + warnings.length);
warnings.forEach(function(w) { console.log('  ⚠️  ' + w); });

console.log('\nVerdict: ' + (errors.length === 0 ? '✅ PASS' : '❌ FAIL (' + errors.length + ' errors)'));
process.exit(errors.length > 0 ? 1 : 0);
