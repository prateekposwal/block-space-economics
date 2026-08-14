var REDUCED_MOTION = (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
// Lightning Network — honest aggregate visualization.
// Real data only: node/channel/capacity stats + the real Tor/Clearnet/Unannounced
// split from mempool.space captures, plus a real "nodes over time" line from the
// spool mirror (data/lightning_history.json). Graph topology is NOT captured, so
// no fake node graph is drawn — the radial ring is sized by real bucket shares.
var VIZ_Lightning = (function() {
  var canvas, ctx, w = 800, h = 480;
  var stats = { capacity: 0, nodes: 0, channels: 0, split: [] };
  var history = [];        // [{date, nodes, channels, capacity_btc, ...}] from mirror
  var historyLoaded = false;
  var animId = null;
  var frameCount = 0;

  var BUCKET_COLORS = { tor: '#3FB950', clearnet: '#D29922', unannounced: '#8B949E' };
  var BG = '#1A1612', PANEL = '#231F19', BORDER = '#3A3228', ACCENT = '#F7931A';
  var TEXT = 'rgba(255,255,255,0.7)', MUTED = '#6A5D4E';

  function isMobile() { return w < 480; }

  function init(canvasId) {
    canvas = document.getElementById(canvasId);
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resize();

    // Real aggregate stats from the engine (tor/clearnet/unannounced now flow
    // through DATA_ENGINE normalize — the old buildNodes() saw only zeros and
    // rendered a blank canvas).
    if (typeof DATA_ENGINE !== 'undefined') {
      var de = DATA_ENGINE;
      readEngine(de.get());
      de.onUpdate(function() { readEngine(de.get()); });
    }

    // Real nodes-over-time series from the committed spool mirror.
    fetch('/data/lightning_history.json').then(function(r) { return r.json(); }).then(function(d) {
      history = (d && Array.isArray(d.points)) ? d.points.filter(function(p) {
        return p && typeof p.nodes === 'number' && typeof p.date === 'string';
      }) : [];
      historyLoaded = true;
    }).catch(function() { historyLoaded = true; });

    window.addEventListener('resize', resize);
    loop();
  }

  function readEngine(d) {
    var ln = (d && d.lightning) || {};
    stats.capacity = ln.total_capacity || 0;
    stats.nodes = ln.node_count || 0;
    stats.channels = ln.channel_count || 0;
    var tor = ln.tor_nodes || 0, cl = ln.clearnet_nodes || 0, un = ln.unannounced_nodes || 0;
    var total = tor + cl + un;
    // Fall back to the node count when the split fields are missing (honest:
    // never invent a split — the ring renders only from captured shares).
    if (total > 0) {
      stats.split = [
        { label: 'Tor', key: 'tor', value: tor, color: BUCKET_COLORS.tor },
        { label: 'Clearnet', key: 'clearnet', value: cl, color: BUCKET_COLORS.clearnet },
        { label: 'Unannounced', key: 'unannounced', value: un, color: BUCKET_COLORS.unannounced }
      ];
    } else {
      stats.split = [];
    }
    if (stats.nodes === 0 && (d && d.lightning)) {
      // Engine reports zero nodes — still no captured data to render.
      stats.nodes = 0;
    }
  }

  function resize() {
    // Width from the parent (responsive); height from a fixed design value per
    // viewport. NEVER derive height from the parent's rect (runaway growth).
    var parent = canvas.parentElement;
    var pw = parent ? parent.clientWidth : 0;
    if (!pw || pw < 100) pw = window.innerWidth || 800;
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    w = Math.min(pw, 1600);
    h = isMobile() ? 520 : 480;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function timeLabel(dateStr) {
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return String(d.getUTCMonth() + 1).padStart(2, '0') + '/' + String(d.getUTCDate()).padStart(2, '0');
  }

  function loop() { try {
    var t = Date.now() / 1000;
    var mob = isMobile();

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, w, h);

    // Radial glow backdrop
    var cx = mob ? w / 2 : w * 0.28;
    var cy = mob ? h * 0.30 : h * 0.50;
    var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, mob ? w * 0.55 : h * 0.65);
    grad.addColorStop(0, 'rgba(247,147,26,0.05)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Title
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#EADCC8';
    ctx.font = (mob ? '15px' : '18px') + ' -apple-system, "SF Pro Display", sans-serif';
    ctx.fillText('Lightning Network — Real Aggregate Stats', 20, 16);
    ctx.fillStyle = MUTED;
    ctx.font = (mob ? '10px' : '11px') + ' -apple-system, sans-serif';
    ctx.fillText('Topology is not captured — the ring below is sized by the real Tor / Clearnet / Unannounced node split', 20, 40);

    // ── Stat chips (real values, context-colored) ──
    var chips = [
      { label: 'Nodes', value: stats.nodes > 0 ? stats.nodes.toLocaleString() : '--', color: stats.nodes > 0 ? '#3FB950' : MUTED },
      { label: 'Channels', value: stats.channels > 0 ? stats.channels.toLocaleString() : '--', color: stats.channels > 0 ? '#58A6FF' : MUTED },
      { label: 'Capacity', value: stats.capacity > 0 ? (stats.capacity / 100000000).toFixed(1) + ' BTC' : '--', color: stats.capacity > 0 ? ACCENT : MUTED }
    ];
    var chipX = mob ? 20 : w - 380;
    var chipY = mob ? 64 : 16;
    var chipW = mob ? (w - 46) / 3 : 118;
    var chipH = mob ? 44 : 64;
    for (var ci = 0; ci < 3; ci++) {
      var ccx = chipX + ci * (chipW + 5);
      ctx.fillStyle = PANEL;
      ctx.strokeStyle = BORDER;
      ctx.lineWidth = 1;
      VIZ.roundRect(ctx, ccx, chipY, chipW, chipH, 8);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = chips[ci].color;
      ctx.font = (mob ? 'bold 12px' : 'bold 16px') + ' -apple-system, sans-serif';
      ctx.fillText(chips[ci].value, ccx + chipW / 2, chipY + (mob ? 13 : 20));
      ctx.fillStyle = MUTED;
      ctx.font = (mob ? '7px' : '9px') + ' -apple-system, sans-serif';
      ctx.fillText(chips[ci].label, ccx + chipW / 2, chipY + (mob ? 31 : 44));
    }

    var ringCX = mob ? w / 2 : w * 0.28;
    var ringCY = mob ? h * 0.48 : h * 0.52;
    var ringR = mob ? Math.min(w * 0.32, 92) : 96;
    var lineL = mob ? 20 : w * 0.50 + 30;
    var lineR = w - (mob ? 20 : 24);
    var lineT = mob ? h * 0.58 : 96;
    var lineB = mob ? h - 40 : h - 64;

    // ── Radial split ring (REAL node shares) ──
    var hasData = stats.split.length > 0;
    if (hasData) {
      var totalSplit = 0;
      stats.split.forEach(function(b) { totalSplit += b.value; });
      var startAng = -Math.PI / 2;
      var sweep = Math.PI * 2;
      var rOut = ringR;
      var rIn = ringR * 0.62;
      var rot = REDUCED_MOTION ? 0 : Math.sin(t * 0.15) * 0.05; // gentle oscillation

      // Under-ring (empty track)
      ctx.beginPath();
      ctx.arc(ringCX, ringCY, (rOut + rIn) / 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(58,50,40,0.6)';
      ctx.lineWidth = rOut - rIn;
      ctx.stroke();

      // Arcs sized by REAL bucket share
      var ang = startAng;
      stats.split.forEach(function(b, bi) {
        var frac = b.value / totalSplit;
        var a0 = ang + rot, a1 = ang + frac * sweep + rot;
        ctx.beginPath();
        ctx.arc(ringCX, ringCY, (rOut + rIn) / 2, a0, a1);
        ctx.strokeStyle = b.color;
        ctx.lineWidth = rOut - rIn;
        ctx.globalAlpha = 0.92;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Arc label at the mid-angle (skip tiny slivers on mobile)
        var mid = (a0 + a1) / 2;
        var lr = (rOut + rIn) / 2;
        var lx = ringCX + Math.cos(mid) * (lr + 14);
        var ly = ringCY + Math.sin(mid) * (lr + 14);
        var pct = Math.round(frac * 1000) / 10;
        if (pct >= 4 || !mob) {
          ctx.fillStyle = b.color;
          ctx.font = (mob ? '9px' : '11px') + ' -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(b.label + ' ' + pct + '%', lx, ly);
        }
        ang = a1;
      });

      // Center total
      ctx.fillStyle = '#EADCC8';
      ctx.font = (mob ? 'bold 20px' : 'bold 30px') + ' -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(stats.nodes.toLocaleString(), ringCX, ringCY - 8);
      ctx.fillStyle = MUTED;
      ctx.font = (mob ? '9px' : '11px') + ' -apple-system, sans-serif';
      ctx.fillText('total nodes', ringCX, ringCY + 18);

      // Flowing particles around the ring — count per arc ∝ real bucket share
      if (!REDUCED_MOTION) {
        var perArc = [6, 4, 3];
        stats.split.forEach(function(b, bi) {
          var frac = b.value / totalSplit;
          var a0 = startAng + (stats.split.slice(0, bi).reduce(function(s2, x) { return s2 + x.value; }, 0) / totalSplit) * sweep;
          var a1 = a0 + frac * sweep;
          var count = Math.max(1, Math.round(perArc[bi % perArc.length] * (frac / (1 / 3))));
          for (var pi = 0; pi < count; pi++) {
            var phase = ((t * 0.12 + (bi * 7 + pi * 13) * 0.11) % 1);
            var angP = a0 + phase * (a1 - a0);
            var rr = (rOut + rIn) / 2 + Math.sin(phase * Math.PI) * 10;
            ctx.beginPath();
            ctx.arc(ringCX + Math.cos(angP) * rr, ringCY + Math.sin(angP) * rr, 2 + Math.sin(phase * Math.PI) * 1.5, 0, Math.PI * 2);
            ctx.fillStyle = b.color;
            ctx.globalAlpha = 0.25 + phase * 0.55;
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        });
      }
    } else {
      // Honest empty state (no captured network data at all)
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = (mob ? '12px' : '14px') + ' -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No network data captured yet — stats appear when the pipeline captures the next snapshot', ringCX, ringCY);
    }

    // ── Nodes over time (REAL spool history) ──
    var titleY = mob ? h * 0.54 : 60;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#EADCC8';
    ctx.font = (mob ? '12px' : '13px') + ' -apple-system, sans-serif';
    ctx.fillText('Nodes over time', lineL, titleY);
    ctx.fillStyle = MUTED;
    ctx.font = '9px -apple-system, sans-serif';
    ctx.fillText('data/lightning_history.json · real captures', lineL, titleY + (mob ? 16 : 20));

    var plotT = titleY + (mob ? 30 : 34);
    var plotH = lineB - plotT;
    var plotW = lineR - lineL;

    if (historyLoaded && history.length < 2) {
      ctx.fillStyle = TEXT;
      ctx.font = (mob ? '11px' : '12px') + ' -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🟡 Nodes-over-time history pending — no spool captures yet', lineL + plotW / 2, plotT + plotH / 2);
    } else if (history.length >= 2 && plotW > 60 && plotH > 24) {
      var minN = Infinity, maxN = 0;
      history.forEach(function(p) { if (p.nodes < minN) minN = p.nodes; if (p.nodes > maxN) maxN = p.nodes; });
      if (!isFinite(minN)) minN = 0;
      if (maxN === minN) { maxN = minN + 1; }
      var span = maxN - minN;
      if (span < maxN * 0.1) { minN = Math.max(0, minN - span * 0.5); maxN = maxN + span * 0.5; span = maxN - minN; }

      // Grid
      ctx.strokeStyle = 'rgba(58,50,40,0.6)';
      ctx.lineWidth = 1;
      var steps = mob ? 3 : 4;
      for (var s = 0; s <= steps; s++) {
        var v = minN + span * s / steps;
        var y = plotT + plotH - ((v - minN) / span) * plotH;
        ctx.beginPath(); ctx.moveTo(lineL, y); ctx.lineTo(lineR, y); ctx.stroke();
        ctx.fillStyle = MUTED;
        ctx.font = '9px -apple-system, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(Math.round(v).toLocaleString(), lineL - 5, y);
      }

      // Area + line
      ctx.beginPath();
      for (var i = 0; i < history.length; i++) {
        var ix = lineL + (i / (history.length - 1)) * plotW;
        var iy = plotT + plotH - ((history[i].nodes - minN) / span) * plotH;
        if (i === 0) ctx.moveTo(ix, iy); else ctx.lineTo(ix, iy);
      }
      ctx.lineTo(lineR, plotT + plotH);
      ctx.lineTo(lineL, plotT + plotH);
      ctx.closePath();
      ctx.fillStyle = 'rgba(63,185,80,0.10)';
      ctx.fill();

      ctx.beginPath();
      ctx.strokeStyle = '#3FB950';
      ctx.lineWidth = 2;
      for (var j = 0; j < history.length; j++) {
        var jx = lineL + (j / (history.length - 1)) * plotW;
        var jy = plotT + plotH - ((history[j].nodes - minN) / span) * plotH;
        if (j === 0) ctx.moveTo(jx, jy); else ctx.lineTo(jx, jy);
      }
      ctx.stroke();

      // Live point on the latest real capture
      var lastN = history[history.length - 1].nodes;
      var lx = lineR;
      var ly = plotT + plotH - ((lastN - minN) / span) * plotH;
      var pulseR = 4 + (REDUCED_MOTION ? 0 : Math.sin(t * 2.2) * 2);
      ctx.beginPath();
      ctx.arc(lx, ly, pulseR + 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(63,185,80,0.15)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(lx, ly, pulseR, 0, Math.PI * 2);
      ctx.fillStyle = '#3FB950';
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = (mob ? '9px' : '10px') + ' -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(lastN.toLocaleString() + ' nodes', lx - 6, ly - 4);

      // X labels (a few dates)
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = MUTED;
      var labelIdx = [0, Math.floor(history.length / 2), history.length - 1];
      labelIdx.forEach(function(li) {
        ctx.fillText(timeLabel(history[li].date), lineL + (li / (history.length - 1)) * plotW, plotT + plotH + 4);
      });
    } else if (!historyLoaded) {
      ctx.fillStyle = TEXT;
      ctx.font = (mob ? '11px' : '12px') + ' -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Loading nodes-over-time…', lineL + plotW / 2, plotT + plotH / 2);
    }

    // Honest provenance footer
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.font = '9px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Real aggregate network stats — graph topology not captured', 20, h - 6);

    // Vignette
    var vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.15, w / 2, h / 2, h * 0.85);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);

    frameCount++;
    } catch (e) { if (window.console) console.error('VIZ_Lightning draw:', e); }
    animId = REDUCED_MOTION ? 0 : requestAnimationFrame(loop);
  }

  return { init: init, resize: resize };
})();
