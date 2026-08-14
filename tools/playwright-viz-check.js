#!/usr/bin/env node
/* BSAHI visual upgrade verification — Playwright.
 * 1. Serves the repo over HTTP (static).
 * 2. Loads live.html, clicks through all 7 tabs, and counts NON-BACKGROUND
 *    pixels on each tab's primary canvas (real render, not blank).
 * 3. Collects console errors.
 * 4. Mobile 375px pass: no horizontal overflow, no canvas distortion.
 * 5. Also checks story.html (4 canvases) + index.html hero + fork-tracker daily.
 * Usage: node tools/playwright-viz-check.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8791;
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain'
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const fp = path.normalize(path.join(ROOT, p));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(data);
  });
});

let failures = 0;
function check(name, ok, detail) {
  console.log((ok ? '  PASS ' : '  FAIL ') + name + (detail ? ' — ' + detail : ''));
  if (!ok) failures++;
}

async function nonBgPixels(page, canvasId) {
  return page.evaluate((id) => {
    const c = document.getElementById(id);
    if (!c) return { found: false, nonBg: 0, w: 0, h: 0 };
    const ctx = c.getContext('2d');
    const w = c.width, h = c.height;
    if (!w || !h) return { found: true, nonBg: 0, w, h };
    const img = ctx.getImageData(0, 0, w, h).data;
    let nonBg = 0;
    // Background is #1A1612 (26,22,18). Count pixels that differ meaningfully.
    for (let i = 0; i < img.length; i += 4 * 7) { // sample every 7th px
      const dr = Math.abs(img[i] - 26), dg = Math.abs(img[i + 1] - 22), db = Math.abs(img[i + 2] - 18);
      if (dr + dg + db > 24) nonBg++;
    }
    const total = Math.ceil(img.length / 4 / 7);
    return { found: true, nonBg, w, h, pct: Math.round(nonBg / Math.max(1, total) * 1000) / 10 };
  }, canvasId);
}

const TAB_CANVASES = [
  { tab: 'send', label: 'Send', canvases: ['viz-send', 'viz-fee-heatmap', 'viz-mempool-hist'] },
  { tab: 'lightning', label: 'Lightning', canvases: ['viz-lightning'] },
  { tab: 'exchange', label: 'Exchange', canvases: ['viz-exchange'] },
  { tab: 'node', label: 'Node', canvases: ['viz-node'] },
  { tab: 'miner', label: 'Miner', canvases: ['viz-miner'] },
  { tab: 'research', label: 'Research', canvases: ['viz-research', 'viz-fee-trend', 'viz-block-interval', 'viz-hashrate'] },
  { tab: 'developer', label: 'Dev', canvases: [] } // DOM cards, not canvas
];

async function main() {
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch();
  const results = [];

  // ── Desktop pass ──
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));

  console.log('\n=== LIVE.HTML — DESKTOP (all 7 tabs) ===');
  await page.goto('http://localhost:' + PORT + '/live.html', { waitUntil: 'domcontentloaded' });
  // wait for live data + mirror fetches
  await page.waitForTimeout(9000);

  for (const t of TAB_CANVASES) {
    await page.click('.tab-btn[data-tab="' + t.tab + '"]');
    await page.waitForTimeout(1200);
    let row = { tab: t.tab, label: t.label, canvases: [] };
    for (const cid of t.canvases) {
      const r = await nonBgPixels(page, cid);
      row.canvases.push({ id: cid, ...r });
    }
    // verdict text + color for the tab
    const verdict = await page.evaluate((tab) => {
      const panel = document.getElementById('panel-' + tab);
      const dc = panel ? panel.querySelector('.dc-a') : null;
      return dc ? { text: dc.textContent, cls: dc.className } : null;
    }, t.tab);
    row.verdict = verdict;
    results.push(row);
  }

  // ── Mobile pass 375px ──
  console.log('\n=== LIVE.HTML — MOBILE 375px ===');
  const mob = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const mobErrors = [];
  mob.on('console', m => { if (m.type() === 'error') mobErrors.push(m.text()); });
  mob.on('pageerror', e => mobErrors.push('PAGEERROR: ' + e.message));
  await mob.goto('http://localhost:' + PORT + '/live.html', { waitUntil: 'domcontentloaded' });
  await mob.waitForTimeout(7000);

  const overflow = await mob.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth
  }));
  check('no horizontal overflow on mobile', overflow.scrollW <= overflow.innerW + 1, 'scrollW=' + overflow.scrollW + ' innerW=' + overflow.innerW);

  for (const t of TAB_CANVASES) {
    // Make the tab visible first (hidden panels have 0x0 rects — not distortion)
    await mob.click('.tab-btn[data-tab="' + t.tab + '"]');
    await mob.waitForTimeout(700);
    for (const cid of t.canvases) {
      const r = await mob.evaluate((id) => {
        const c = document.getElementById(id);
        if (!c) return null;
        const rect = c.getBoundingClientRect();
        const bufRatio = c.width / Math.max(1, c.height);
        const dispRatio = rect.width / Math.max(1, rect.height);
        return { id, dispW: Math.round(rect.width), dispH: Math.round(rect.height), bufRatio, dispRatio, distorted: Math.abs(bufRatio - dispRatio) > 0.08 && bufRatio > 0.01 };
      }, cid);
      if (r) {
        check('mobile canvas ' + cid + ' not distorted', !r.distorted, 'buf=' + r.bufRatio.toFixed(3) + ' disp=' + r.dispRatio.toFixed(3) + ' (' + r.dispW + 'x' + r.dispH + ')');
      }
    }
  }

  // ── story.html canvases ──
  console.log('\n=== STORY.HTML ===');
  await mob.goto('http://localhost:' + PORT + '/story.html', { waitUntil: 'domcontentloaded' });
  await mob.waitForTimeout(4000);
  for (const cid of ['bip-canvas', 'sccr-canvas', 'leverage-canvas', 'legs-canvas']) {
    const r = await nonBgPixels(mob, cid);
    check('story ' + cid + ' renders pixels', r.found && r.nonBg > 40, 'nonBg=' + r.nonBg + ' pct=' + r.pct + '%');
  }
  const storyDist = await mob.evaluate((id) => {
    const c = document.getElementById(id);
    const rect = c.getBoundingClientRect();
    return Math.abs(c.width / Math.max(1, c.height) - rect.width / Math.max(1, rect.height)) > 0.08;
  }, 'sccr-canvas');
  check('story sccr canvas not distorted on mobile', !storyDist);

  // ── index.html hero ──
  console.log('\n=== INDEX.HTML (hero) ===');
  const idx = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await idx.goto('http://localhost:' + PORT + '/index.html', { waitUntil: 'domcontentloaded' });
  await idx.waitForTimeout(8000);
  const hero = await nonBgPixels(idx, 'viz-fees');
  check('index hero renders pixels', hero.found && hero.nonBg > 200, 'nonBg=' + hero.nonBg + ' pct=' + hero.pct + '%');

  // ── fork-tracker daily ──
  console.log('\n=== FORK-TRACKER.HTML ===');
  await idx.goto('http://localhost:' + PORT + '/fork-tracker.html', { waitUntil: 'domcontentloaded' });
  await idx.waitForTimeout(4000);
  const ft = await nonBgPixels(idx, 'viz-bip110-daily');
  check('fork-tracker daily renders pixels', ft.found && ft.nonBg > 40, 'nonBg=' + ft.nonBg + ' pct=' + ft.pct + '%');

  // ── console errors ──
  console.log('\n=== CONSOLE ERRORS ===');
  const allErrors = [...new Set(consoleErrors.concat(mobErrors))];
  if (allErrors.length === 0) check('zero console errors across pages', true);
  else { check('zero console errors across pages', false, allErrors.slice(0, 8).join(' | ')); }

  // ── report table ──
  console.log('\n=== PER-TAB NON-BG PIXELS (desktop) ===');
  for (const row of results) {
    const c = row.canvases.map(x => (x.id + ':' + x.nonBg + (x.pct ? '(' + x.pct + '%)' : ''))).join(' ');
    console.log('  ' + row.label.padEnd(10) + ' ' + c + (row.verdict ? '  verdict="' + row.verdict.text + '" [' + row.verdict.cls + ']' : ''));
    for (const x of row.canvases) {
      check('tab ' + row.label + ' canvas ' + x.id + ' has real pixels', x.found && x.nonBg > 25, 'nonBg=' + x.nonBg);
    }
  }

  await browser.close();
  server.close();
  console.log('\nTOTAL FAILURES: ' + failures);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); server.close(); process.exit(1); });
