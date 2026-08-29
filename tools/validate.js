var fs = require('fs');
var path = require('path');
var child_process = require('child_process');

var ROOT = path.resolve(__dirname, '..');
var ALL_HTML = ['index.html', 'live.html', 'learn.html', 'capacity.html', 'fork-tracker.html', 'story.html'];
 var ALL_JS = ['tools/data-engine.js', 'tools/viz-core.js', 'tools/viz-send.js', 'tools/viz-lightning.js',
   'tools/viz-exchange.js', 'tools/viz-node.js', 'tools/viz-miner.js', 'tools/viz-research.js', 'tools/viz-developer.js',
   'js/beta-gate.js', 'js/beta-nav.js', 'js/data-health.js', 'js/data-health-config.js', 'sw.js',
   'tools/viz-bip110.js', 'tools/viz-block-interval.js', 'tools/viz-hashrate.js',
   'tools/viz-fee-heatmap.js', 'tools/viz-mempool-hist.js', 'tools/generate_viz_data.js', 'tools/generate_research_data.js',
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
var MASK_FILES = ['index.html', 'live.html', 'fork-tracker.html', 'story.html', 'capacity.html', 'learn.html',
  'js/beta-gate.js', 'js/beta-nav.js', 'js/data-health.js', 'js/data-health-config.js', 'sw.js',
  'tools/viz-core.js', 'tools/viz-send.js', 'tools/viz-lightning.js', 'tools/viz-exchange.js',
  'tools/viz-node.js', 'tools/viz-miner.js', 'tools/viz-research.js', 'tools/viz-developer.js',
  'tools/viz-bip110.js', 'tools/viz-block-interval.js', 'tools/viz-hashrate.js',
  'tools/viz-fee-heatmap.js', 'tools/viz-mempool-hist.js'];

// C2 whitelist — layout / render / device constants that LOOK like numeric
// fallbacks but are NOT data masks. A line that matches any of these markers
// is skipped by every C2 sub-check (the ternary checks target DATA conditions
// like `price ? ... : 64000`, not responsive layout like `isMobile() ? 180 : 210`).
var C2_LAYOUT_LINE = /isMobile\s*\(|isMob\b|mob\b|mobile\b|stacked\b|w\s*<\s*\d|width\s*<\s*\d|h\s*<\s*\d|height\s*<\s*\d|devicePixelRatio|innerWidth|innerHeight|clientWidth|clientHeight|rect\.|Math\.min|Math\.max|canvas\.width|canvas\.height|blockFlashActive|flashActive/;

// C2c object-literal fallback keys: data field names that must NEVER carry a
// hardcoded numeric literal (fastestFee: 3, avgFeeRate: 10, ...). Keyed (not
// generic {k: n}) so layout objects like PAD = { top: 60, right: 150 } don't
// false-positive — every fabrication observed uses a data key.
var C2_DATA_KEY_RE = /(fastestFee|economyFee|halfHourFee|hourFee|minimumFee|avgFeeRate|avgFees|feeRate|btcPrice|priceUsd|totalTxs|txCount|tx_count|segwitTotalTxs|taprootSpends|segwitSpends|legacySpends|p2trPct|nodeCount|channelCount)\s*:\s*(\d{1,6})(?![\d.])/;

// C2e data-seed assignment: `btcPrice = 64000` / `displayFee = 5000000` —
// data inputs must seed at 0 (real engine values replace them on first
// update). Keyed so legit non-data assignments (layout vars, flags) never
// false-positive. 0/1 seeds are div/scale guards, not fabrications.
var C2_SEED_RE = /\b(btcPrice|displayPrice|displayFee|economyFee|displayEconomyFee|priceUsd|feeRate|avgFeeRate|totalTxs|txCount|fastestFee|halfHourFee|hourFee|minimumFee|taprootPct|segwitPct|legacyPct|nodeCount|channelCount)\b\s*=\s*(\d{1,9})(?![\d.])/;

// C2f invented unit-conversion constant on a data field: `avgFees / 2500000`
// or `avgFeeRate * 2500000`. 100000000 (real sats-per-BTC) is whitelisted —
// that is the genuine unit conversion, not a fabrication.
var C2_MAGIC_UNIT_RE = /(avgFees|avg_fees|fee|feeRate|avgFeeRate)\s*[\/*]\s*(?![\d.]*100000000)(\d{6,})(?![\d.])/;

function isC2LayoutLine(line) { return C2_LAYOUT_LINE.test(line); }
function isC2AllowedVal(v) { return v === '0' || v === '1'; } // div/scale guards, never plausible data

function checkNumericFallbacks() {
  MASK_FILES.forEach(function(f) {
    var p = path.resolve(ROOT, f);
    if (!fs.existsSync(p)) return;
    var t = fs.readFileSync(p, 'utf8');
    var lines = t.split('\n');
    lines.forEach(function(line, i) {
      var loc = f + ':' + (i + 1);
      var layout = isC2LayoutLine(line);
      var inCatch = /catch\s*\(/.test(line);

      // ── C2a: || <num> (original check, unchanged) ─────────────────────
      var m = line.match(/\|\|\s*(\d{1,9})(?![\d.])/);
      if (m) {
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
        if (inCatch) return;
        errors.push(loc + ' hardcoded fallback || ' + val + ' — missing data must show "— + 🟡 pending", not a plausible number');
      }

      // ── C2b: ternary numeric arm — cond ? <expr> : <num> or cond ? <num> : <expr>.
      //    Catches `price ? ... : 64000` (fabrication class that slipped past C2a).
      //    Whitelisted: : 0 / : 1 and any line carrying a layout marker (isMobile(),
      //    mob, w < 480, stacked, devicePixelRatio, canvas geometry...).
      var tm = line.match(/\?[^:;{}]*?:\s*(\d{1,6})(?![\d.])/);   // false arm = bare number
      var tm2 = line.match(/\?\s*(\d{1,6})\s*:/);                  // true arm = bare number
      (tm ? [tm] : []).concat(tm2 ? [tm2] : []).forEach(function(mm) {
        var v = mm[1];
        if (isC2AllowedVal(v)) return;
        if (layout || inCatch) return;
        errors.push(loc + ' hardcoded ternary default : ' + v + ' — missing data must show "— + 🟡 pending", not a plausible number');
      });

      // ── C2c: object-literal data fallback — { fastestFee: 3 } / avgFeeRate: 10
      var om = line.match(C2_DATA_KEY_RE);
      if (om) {
        var v2 = om[2];
        if (isC2AllowedVal(v2)) return;
        if (layout || inCatch) return;
        errors.push(loc + ' hardcoded object-literal default ' + om[1] + ': ' + v2 + ' — data fields must come from the pipeline, not literals');
      }

      // ── C2d: fabricated accumulation — totalTxs += 2500 (invented constant growth)
      var am = line.match(/\+=\s*(\d{3,})(?![\d.])/);
      if (am) {
        if (layout || inCatch) return;
        errors.push(loc + ' fabricated accumulation += ' + am[1] + ' — invented constants must not inflate real measurements');
      }

      // ── C2e: data-seed assignment — btcPrice = 64000 (plausible default that
      //    becomes a displayed value before real data arrives)
      var sm = line.match(C2_SEED_RE);
      if (sm) {
        var v3 = sm[2];
        if (isC2AllowedVal(v3)) return;
        if (layout || inCatch) return;
        errors.push(loc + ' hardcoded data seed ' + sm[1] + ' = ' + v3 + ' — data inputs must seed at 0 and render "—" until real data arrives');
      }

      // ── C2f: invented unit-conversion constant — avgFees / 2500000
      var um = line.match(C2_MAGIC_UNIT_RE);
      if (um) {
        if (layout || inCatch) return;
        if (/^\s*(\/\/|\/\*|\*)/.test(line)) return; // documentation comments quoting a past pattern are not fabrications
        errors.push(loc + ' invented unit constant ' + um[1] + ' ' + (line.indexOf('*') !== -1 ? '*' : '/') + ' ' + um[2] + ' — scale with the REAL conversion (1e8 sats/BTC) or render "—"');
      }
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
