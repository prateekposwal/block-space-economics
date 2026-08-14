var REDUCED_MOTION = (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
var VIZ_FeeHeatmap = (function () {
  'use strict';

  var BG = '#1A1612', PANEL = '#231F19', BORDER = '#3A3228';
  var ACCENT = '#F7931A', TEXT = 'rgba(255,255,255,0.7)', MUTED = '#6A5D4E';

  // Fee-rate buckets (sat/vB) — rows of the heatmap, bottom = cheapest.
  var BUCKETS = [
    { label: '≥ 50', test: function (r) { return r >= 50; } },
    { label: '20–50', test: function (r) { return r >= 20; } },
    { label: '10–20', test: function (r) { return r >= 10; } },
    { label: '5–10', test: function (r) { return r >= 5; } },
    { label: '2–5', test: function (r) { return r >= 2; } },
    { label: '1–2', test: function (r) { return r >= 1; } },
    { label: '< 1', test: function (r) { return r >= 0; } }
  ];
  var BLOCK_WEIGHT_VBYTES = 4000000;   // 4M vbytes per block (fee rate = sats / vbytes)

  var canvas = null, ctx = null, w = 0, h = 0, dpr = 1;
  var grid = null;        // [24][7] counts
  var maxCount = 0, totalBlocks = 0;
  var loaded = false, failed = false;
  var raf = 0;

  function isMobile() { return w < 480; }

  function resize() {
    if (!canvas) return;
    var parent = canvas.parentElement;
    var pw = parent ? parent.clientWidth : 0;
    if (!pw || pw < 100) pw = 800;
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    w = Math.min(pw, 1400);
    h = w < 480 ? 320 : 300;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function bucketOf(rate) {
    for (var i = 0; i < BUCKETS.length; i++) {
      if (BUCKETS[i].test(rate)) return i;
    }
    return BUCKETS.length - 1;
  }

  function load() {
    fetch('/data/fee_history_blocks.json').then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (d) {
      var blocks = (d && Array.isArray(d.blocks)) ? d.blocks : [];
      totalBlocks = blocks.length;
      grid = [];
      for (var hh = 0; hh < 24; hh++) grid.push([0, 0, 0, 0, 0, 0, 0]);
      blocks.forEach(function (b) {
        if (!b || typeof b.avgFees !== 'number' || typeof b.t !== 'number') return;
        var rate = b.avgFees / BLOCK_WEIGHT_VBYTES;
        var hour = new Date(b.t * 1000).getUTCHours();
        var bucket = bucketOf(rate);
        grid[hour][bucket]++;
      });
      maxCount = 0;
      for (var x = 0; x < 24; x++) {
        for (var y = 0; y < BUCKETS.length; y++) {
          if (grid[x][y] > maxCount) maxCount = grid[x][y];
        }
      }
      loaded = true;
      failed = !totalBlocks;
      draw();
    }).catch(function () {
      loaded = true; failed = true; draw();
    });
  }

  function cellColor(count) {
    if (!count) return 'rgba(58,50,40,0.35)';
    var denom = maxCount > 0 ? maxCount : 1;
    var t = count / denom;
    // dark → orange → red
    var r = Math.round(247 - t * 40);
    var g = Math.round(147 - t * 90);
    var b = Math.round(26 - t * 0);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + (0.35 + t * 0.65) + ')';
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#EADCC8';
    ctx.font = 'bold 15px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Fee Heatmap — 24h × fee tier', 16, 12);
    ctx.fillStyle = MUTED;
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText('Per-block avg fee rate (avgFees ÷ 4M vbytes) bucketed by level. Columns = hour of day (UTC), rows = fee tier. Color = block count.', 16, 32);

    if (!loaded) { drawPending('Loading fee data…'); return; }
    if (failed || !grid) { drawPending('🟡 Data pending — no per-block fee history yet'); return; }

    var padL = 52, padR = 10, padT = 56, padB = 30;
    var plotW = w - padL - padR;
    var plotH = h - padT - padB;
    if (plotW < 40 || plotH < 20) return;

    var rows = BUCKETS.length;
    var cellH = plotH / rows;
    var cellW = plotW / 24;

    // Rows (bottom-up = cheapest)
    for (var y = 0; y < rows; y++) {
      var cy = padT + plotH - (y + 1) * cellH;
      for (var x = 0; x < 24; x++) {
        var cx = padL + x * cellW;
        ctx.fillStyle = cellColor(grid[x][y]);
        ctx.fillRect(cx + 0.5, cy + 0.5, cellW - 1, cellH - 1);
      }
      // bucket label
      ctx.fillStyle = MUTED;
      ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(BUCKETS[y].label, padL - 6, cy + cellH / 2);
    }

    // Hour labels (every 3h)
    ctx.fillStyle = MUTED;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (var hh = 0; hh < 24; hh += 3) {
      ctx.fillText(hh + 'h', padL + hh * cellW + cellW / 2, padT + plotH + 6);
    }
    ctx.fillText('23h', padL + 23 * cellW + cellW / 2, padT + plotH + 6);

    // Legend
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = MUTED;
    ctx.font = '10px -apple-system, sans-serif';
    ctx.fillText('blocks: ', padL, padT - 18);
    var lx = padL + 46;
    [0, 0.25, 0.5, 0.75, 1].forEach(function (t) {
      var n = Math.round(t * (maxCount > 0 ? maxCount : 1));
      ctx.fillStyle = t === 0 ? 'rgba(58,50,40,0.35)' : cellColor(t > 0 ? n : 0);
      ctx.fillRect(lx, padT - 24, 14, 12);
      lx += 18;
    });
    ctx.fillStyle = MUTED;
    ctx.fillText('0 → ' + maxCount, lx + 2, padT - 18);
    ctx.fillText('· ' + totalBlocks + ' blocks mapped', w - padR, padT - 18);

    // Current-hour column — the "now" moment, pulsed with real-data presence
    var nowHour = new Date().getUTCHours();
    if (nowHour >= 0 && nowHour < 24) {
      var colX = padL + nowHour * cellW;
      var hasNow = grid[nowHour].some(function (c) { return c > 0; });
      var pulse = REDUCED_MOTION ? 0.35 : 0.16 + (Math.sin(Date.now() / 1000 * 2.2) * 0.5 + 0.5) * 0.22;
      if (hasNow) {
        ctx.fillStyle = 'rgba(247,147,26,' + pulse + ')';
        ctx.fillRect(colX + 0.5, padT + 0.5, cellW - 1, plotH - 1);
      }
      ctx.fillStyle = hasNow ? 'rgba(247,147,26,0.9)' : 'rgba(255,255,255,0.4)';
      ctx.font = 'bold 9px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('now', colX + cellW / 2, padT - 12);
    }
  }

  function drawPending(msg) {
    ctx.fillStyle = TEXT;
    ctx.font = (isMobile() ? '12px' : '14px') + ' -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(msg, w / 2, h / 2 + 8);
  }

  function loop() {
    try { draw(); } catch (e) { if (window.console) console.error('VIZ_FeeHeatmap draw:', e); }
    if (REDUCED_MOTION) return;
    raf = requestAnimationFrame(loop);
  }

  function init(canvasId) {
    canvas = document.getElementById(canvasId);
    if (!canvas) return;
    resize();
    window.addEventListener('resize', function () { resize(); });
    load();
    if (REDUCED_MOTION) { draw(); return; }
    raf = requestAnimationFrame(loop);
  }

  function destroy() {
    if (raf) cancelAnimationFrame(raf);
  }

  return { init: init, destroy: destroy, resize: resize };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VIZ_FeeHeatmap: VIZ_FeeHeatmap };
}
