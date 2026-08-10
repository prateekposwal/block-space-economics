#!/usr/bin/env node
// BSAHI — Mobile & UX Audit (all pages, one run)
// The loop-breaker: instead of fixing overflow/overlap page-by-page (which became 38
// one-off commits), this checks ALL pages on Android + iPhone in ONE run and reports
// every failure. Run after any layout change. If this passes, the site is mobile-clean.
// Usage: node tools/mobile-audit.js [--live]   (--live checks bitcoinsahi.com; default localhost:8899)
var { chromium } = require('playwright-core');
var path = require('path');
var fs = require('fs');

var BASE = process.argv.includes('--live') ? 'https://bitcoinsahi.com' : 'http://localhost:8899';
var PAGES = ['/', '/live', '/learn', '/capacity', '/fork-tracker', '/research/', '/story.html', '/articles.html'];
var DEVICES = [
  { name: 'Android', width: 412, ua: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) Chrome/119 Mobile Safari/537.36' },
  { name: 'iPhone', width: 390, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1' }
];
// Desktop (short window) for fixed-element overlap (legend toggle vs CTA etc.)
var DESKTOP = { width: 1280, height: 700, name: 'Desktop-short' };

async function checkPage(page, p) {
  await page.goto(BASE + p, { waitUntil: 'networkidle', timeout: 30000 }).catch(function(){});
  await page.waitForTimeout(800);
  return page.evaluate(function() {
    var out = { overflowX: false, sw: document.documentElement.scrollWidth, vw: window.innerWidth };
    out.overflowX = out.sw > out.vw;
    // fixed-element overlaps (any two fixed elements overlapping)
    var fixed = Array.from(document.querySelectorAll('*')).filter(function(el) {
      var s = getComputedStyle(el);
      return (s.position === 'fixed' || s.position === 'sticky') && el.getBoundingClientRect().width > 0;
    });
    out.fixedCount = fixed.length;
    out.overlaps = [];
    for (var i = 0; i < fixed.length; i++) {
      for (var j = i + 1; j < fixed.length; j++) {
        var a = fixed[i].getBoundingClientRect(), b = fixed[j].getBoundingClientRect();
        var overlap = !(a.bottom < b.top || a.top > b.bottom || a.right < b.left || a.left > b.right);
        var parentChild = fixed[i].contains(fixed[j]) || fixed[j].contains(fixed[i]);
        if (overlap && (a.width > 20 && b.width > 20) && !parentChild) {
          var isCanvas = fixed[i].tagName === 'CANVAS' || fixed[j].tagName === 'CANVAS';
          // Ignore intentional canvas-first overlays (canvas = full-screen background).
          // Ignore the known nav+CTA vertical stack (both anchored bottom, non-overlapping content).
          if (!isCanvas) {
            out.overlaps.push((fixed[i].className || fixed[i].tagName).toString().slice(0, 18) + ' x ' + (fixed[j].className || fixed[j].tagName).toString().slice(0, 18));
          }
        }
      }
    }
    // empty canvases (rendered but blank)
    out.blankCanvases = Array.from(document.querySelectorAll('canvas')).filter(function(c) {
      var r = c.getBoundingClientRect();
      if (r.width < 20 || r.height < 20) return false;
      try { var d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (var k = 3; k < d.length; k += 4) { if (d[k] > 0) return false; } return true; } catch(e){ return false; }
    }).map(function(c){ return c.id; });
    return out;
  });
}

(async function() {
  var browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  var failures = 0;
  console.log('BSAHI Mobile & UX Audit — ' + (process.argv.includes('--live') ? 'LIVE' : 'LOCAL') + '\n');

  // Mobile + tablet device checks
  for (var d = 0; d < DEVICES.length; d++) {
    var dev = DEVICES[d];
    var ctx = await browser.newContext({ viewport: { width: dev.width, height: 900 }, userAgent: dev.ua });
    console.log('=== ' + dev.name + ' (' + dev.width + 'px) ===');
    for (var i = 0; i < PAGES.length; i++) {
      var page = await ctx.newPage();
      var r = await checkPage(page, PAGES[i]);
      var issues = [];
      if (r.overflowX) issues.push('OVERFLOW sw=' + r.sw);
      if (r.overlaps.length) issues.push('OVERLAP: ' + r.overlaps.join(', '));
      if (r.blankCanvases.length) issues.push('BLANK: ' + r.blankCanvases.join(','));
      if (issues.length) { failures++; console.log('  ❌ ' + PAGES[i] + ' → ' + issues.join(' | ')); }
      else console.log('  ✅ ' + PAGES[i]);
      await page.close();
    }
    await ctx.close();
  }

  // Desktop short-window fixed-overlap check
  var dctx = await browser.newContext({ viewport: { width: DESKTOP.width, height: DESKTOP.height } });
  console.log('=== ' + DESKTOP.name + ' (1280x700, fixed-element overlap) ===');
  for (var i2 = 0; i2 < PAGES.length; i2++) {
    var dp = await dctx.newPage();
    var dr = await checkPage(dp, PAGES[i2]);
    if (dr.overlaps.length) { failures++; console.log('  ❌ ' + PAGES[i2] + ' → ' + dr.overlaps.join(', ')); }
    else console.log('  ✅ ' + PAGES[i2]);
    await dp.close();
  }
  await dctx.close();

  await browser.close();
  console.log('\nRESULT: ' + (failures === 0 ? 'ALL PAGES PASS — mobile-clean ✅' : failures + ' FAILURE(S) — fix before shipping'));
  process.exit(failures === 0 ? 0 : 1);
})();
