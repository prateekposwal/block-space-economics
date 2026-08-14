var REDUCED_MOTION = (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
var VIZ_Miner = (function() {
  var canvas, ctx, w = 0, h = 0;
  var feeHistory = [];
  var sparklineData = [];
  var blockFees = [];          // real per-block avgFees+usd from /data/fee_history_blocks.json
  var blockFeesLoaded = false; // true once the mirror fetch resolves (even to empty)
  var lastBlockCount = 0;      // previous mirror length — detects REAL block arrivals
  var arrivalFlash = 0;        // 0..1 decay — a real new block just arrived
  // Data inputs seed at 0 — real engine values replace them on first update.
  // (2026-08-14 honesty fix: seeds were fabricated $64,000 / 5,000,000 sats and
  // the reward cards rendered plausible USD from invented inputs. USD now
  // renders '—' until a real price arrives — see drawStatsCards.)
  var btcPrice = 0;
  var displayPrice = 0;
  var displayFee = 0;
  var blockIndex = 0;
  var tipHeight = 0; // real tip height for block-stack labels; 0 = unknown -> no labels

  function isMobile() { return w < 480; }

  function init(canvasId) {
    canvas = document.getElementById(canvasId);
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);

    if (typeof DATA_ENGINE !== 'undefined') {
      var de = DATA_ENGINE;
      var d = de.get() || {};
      if (d.fee_history && d.fee_history.length > 0) {
        feeHistory = d.fee_history;
        sparklineData = d.fee_history.slice(-144).map(function(b) { return b.avgFees || 0; });
      }
      if (d.btc_price) btcPrice = d.btc_price;
      if (d.block_height) tipHeight = d.block_height;

      de.onUpdate(function() {
        var d = de.get();
        if (d.fee_history && d.fee_history.length > 0) {
          if (d.fee_history.length !== feeHistory.length) {
            feeHistory = d.fee_history;
            sparklineData = d.fee_history.slice(-144).map(function(b) { return b.avgFees || 0; });
            blockIndex = 0;
          }
        }
        if (d.btc_price) btcPrice = d.btc_price;
        if (d.block_height) tipHeight = d.block_height;
      });
    }

    if (feeHistory.length === 0) {
      // Honest empty state: NO fabricated fee data. The miner view shows a
      // "data pending" message instead of inventing blocks (integrity rule).
      sparklineData = [];
    }

    // Real fee-revenue series from the public mirror (spool fee_history).
    fetch('/data/fee_history_blocks.json').then(function(r) { return r.json(); }).then(function(d) {
      var fresh = (d && Array.isArray(d.blocks)) ? d.blocks : [];
      // REAL block arrival: the mirror grew → a new block arrived.
      if (lastBlockCount > 0 && fresh.length > lastBlockCount) arrivalFlash = 1;
      lastBlockCount = fresh.length;
      blockFees = fresh;
      blockFeesLoaded = true;
    }).catch(function() { blockFeesLoaded = true; });

    loop();
  }

  function resize() {
    var parent = canvas.parentElement;
    var pw = parent ? parent.clientWidth : window.innerWidth;
    if (!pw || pw < 100) pw = window.innerWidth;
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    w = pw;
    h = 600;
    if (isMobile()) h = 700;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
  }

  function getCurrentFee() {
    if (feeHistory.length === 0) return null; // honest: no data, no fabricated fee
    var entry = feeHistory[blockIndex % feeHistory.length];
    return (entry && typeof entry.avgFees === 'number') ? entry.avgFees : null;
  }

  function loop() { try {
    var t = Date.now() / 1000;
    var targetFee = getCurrentFee();
    if (targetFee === null) {
      // Honest empty state: render a pending message instead of a fake number.
      // IMPORTANT: do NOT return before scheduling the next frame — the loop
      // must stay alive so it re-checks for data arrival (DATA_ENGINE updates
      // feeHistory asynchronously; a dead loop would leave the chart stuck on
      // "pending" forever and a resize would blank it entirely).
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#1A1612';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = (isMobile() ? '12px' : '14px') + ' -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Fee data pending — no fabricated values shown', w / 2, h / 2);
      requestAnimationFrame(loop);
      return;
    }
    displayFee += (targetFee - displayFee) * 0.08;
    displayPrice += (btcPrice - displayPrice) * 0.05;
    var feeTotal = displayFee;

    blockIndex = (blockIndex + 1) % Math.max(1, feeHistory.length);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#1A1612';
    ctx.fillRect(0, 0, w, h);

    if (arrivalFlash > 0) arrivalFlash = Math.max(0, arrivalFlash - 0.02);
    drawTitle();
    drawBlockStack(t, feeTotal);
    drawStatsCards(feeTotal, t);
    drawSparkline(t);
    drawFeeShare(feeTotal);
    drawFeeShareRing(feeTotal, t);

    var grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.1, w / 2, h / 2, h * 0.7);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    } catch (e) {}
    if (!REDUCED_MOTION) requestAnimationFrame(loop);
  }

  function drawTitle() {
    ctx.fillStyle = '#EADCC8';
    ctx.font = 'bold 18px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('\u26CF Block Forge \u2014 Reward Composition', 30, 14);
    ctx.font = '12px -apple-system, sans-serif';
    ctx.fillStyle = '#6A5D4E';
    ctx.fillText('Each block adds value to the chain', 30, 40);
  }

  function drawBlockStack(t, feeTotal) {
    var isMob = isMobile();
    var stackCenterX = isMob ? w * 0.5 : w * 0.25;
    var stackBottomY = isMob ? 280 : 250;
    var blockW = isMob ? 60 : 80;
    var blockH = isMob ? 12 : 14;
    var blockGap = isMob ? 2 : 2;
    var maxBlocks = isMob ? 8 : 10;

    for (var i = maxBlocks - 1; i >= 0; i--) {
      var bx = stackCenterX - blockW / 2;
      var by = stackBottomY - (maxBlocks - 1 - i) * (blockH + blockGap);
      var age = i / maxBlocks;
      var feeRatio = 0.2 + Math.sin(i * 1.3 + t * 0.05) * 0.15;
      var r = Math.round(59 + feeRatio * 189);
      var g = Math.round(163 + (1 - feeRatio) * 22);
      var b = Math.round(93 - feeRatio * 20);
      ctx.globalAlpha = 0.3 + age * 0.4;
      ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
      ctx.strokeStyle = 'rgba(58,50,40,0.3)';
      ctx.lineWidth = 1;
      VIZ.roundRect(ctx, bx, by, blockW, blockH, 3);
      ctx.fill();
      ctx.stroke();
      if (i % 3 === 0) {
        ctx.fillStyle = 'rgba(107,93,78,0.4)';
        ctx.font = '8px -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        // Real heights only — no fake '#' labels when the tip is unknown (2026-08-14).
        if (tipHeight > 0) ctx.fillText('#' + (tipHeight - (maxBlocks - 1 - i)), bx + blockW + 6, by + blockH / 2);
      }
    }
    ctx.globalAlpha = 1;

    var newestY = stackBottomY - (maxBlocks - 1) * (blockH + blockGap);
    var pulse = Math.sin(t * 2) * 0.05 + 1;
    var pulseW = blockW * pulse;
    // REAL block-arrival flash: the mirror grew → highlight the fresh top block
    var flashBoost = arrivalFlash > 0 ? arrivalFlash * 1.4 : 0;
    ctx.shadowColor = 'rgba(212,147,58,' + (0.4 + flashBoost) + ')';
    ctx.shadowBlur = 15 + Math.sin(t * 2) * 5 + flashBoost * 30;
    ctx.fillStyle = '#D4933A';
    VIZ.roundRect(ctx, stackCenterX - pulseW / 2, newestY - 2, pulseW, blockH + 4, 4);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#EADCC8';
    ctx.font = 'bold 9px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NEWEST', stackCenterX, newestY + blockH / 2);
    if (arrivalFlash > 0.4) {
      ctx.fillStyle = 'rgba(63,185,80,' + ((arrivalFlash - 0.4) / 0.6) + ')';
      ctx.font = 'bold 9px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('▲ NEW BLOCK', stackCenterX + blockW / 2 + 8, newestY + blockH / 2);
    }

    ctx.strokeStyle = 'rgba(58,50,40,0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(stackCenterX, stackBottomY + 10);
    ctx.lineTo(stackCenterX, stackBottomY + 40);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawStatsCards(feeTotal, t) {
    var isMob = isMobile();
    var cardW = isMob ? Math.min(160, w - 60) : Math.min(180, (w - 100) / 3);
    var cardGap = isMob ? 8 : Math.max(8, (w - 100 - cardW * 3) / 2);
    var statsY = isMob ? 310 : 300;
    var cardH = isMob ? 85 : 100;

    var subsidyBtc = 3.125;
    var feeBtc = feeTotal / 100000000;
    var totalBtc = subsidyBtc + feeBtc;

    // USD only when a REAL price is in hand — never a plausible fake.
    var usdTxt = function(v) { return displayPrice > 0 ? '$' + Math.round(v * displayPrice).toLocaleString() : '—'; };
    var statsData = [
      { value: subsidyBtc.toFixed(3) + ' BTC', sub: 'Subsidy', usd: usdTxt(subsidyBtc), color: '#D4933A' },
      { value: feeBtc.toFixed(4) + ' BTC', sub: 'Fees', usd: usdTxt(feeBtc), color: '#3BA35D' },
      { value: totalBtc.toFixed(3) + ' BTC', sub: 'Total Reward', usd: usdTxt(totalBtc), color: '#58A6FF' },
    ];

    if (isMob) {
      var singleW = w - 40;
      var singleH = 36;
      cardGap = 4;
      for (var i = 0; i < 3; i++) {
        var cx = 20;
        var cy = statsY + i * (singleH + cardGap);
        ctx.fillStyle = '#231F19';
        ctx.strokeStyle = '#3A3228';
        ctx.lineWidth = 1;
        VIZ.roundRect(ctx, cx, cy, singleW, singleH, 8);
        ctx.fill();
        ctx.stroke();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 14px -apple-system, sans-serif';
        ctx.fillStyle = statsData[i].color;
        ctx.fillText(statsData[i].value, cx + 14, cy + singleH / 2 - 2);
        ctx.font = '10px -apple-system, sans-serif';
        ctx.fillStyle = '#6A5D4E';
        ctx.fillText(statsData[i].sub + ' \u2022 ' + statsData[i].usd, cx + 14, cy + singleH / 2 + 14);
      }
      return;
    }

    for (var i = 0; i < 3; i++) {
      var cx = 50 + i * (cardW + cardGap);
      var pulseY = Math.sin(t * 1.5 + i * 1.2) * 1.2;
      var pulseGlow = Math.sin(t * 1.5 + i * 1.2) * 3 + 5;
      ctx.fillStyle = '#231F19';
      ctx.strokeStyle = '#3A3228';
      ctx.lineWidth = 1;
      if (i === 2) { ctx.shadowColor = 'rgba(88,166,255,' + (0.04 + Math.sin(t + i) * 0.02) + ')'; ctx.shadowBlur = pulseGlow; }
      VIZ.roundRect(ctx, cx, statsY, cardW, cardH, 10);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 18px -apple-system, sans-serif';
      ctx.fillStyle = statsData[i].color;
      ctx.fillText(statsData[i].value, cx + cardW / 2, statsY + 30 + (i === 2 ? pulseY * 0.3 : 0));
      ctx.font = '11px -apple-system, sans-serif';
      ctx.fillStyle = '#6A5D4E';
      ctx.fillText(statsData[i].sub, cx + cardW / 2, statsY + 54);
      ctx.font = '10px -apple-system, sans-serif';
      ctx.fillStyle = '#9B8B78';
      ctx.fillText(statsData[i].usd, cx + cardW / 2, statsY + 74);
    }
  }

  function drawSparkline(t) {
    var isMob = isMobile();
    if (blockFeesLoaded && blockFees.length === 0 && sparklineData.length < 2) {
      // Honest empty state: mirror resolved empty AND no live engine series.
      var px0 = isMob ? 20 : 50;
      var py0 = isMob ? 430 : 400;
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = (isMob ? '11px' : '12px') + ' -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('🟡 Fee revenue data pending — no real values shown', px0 + 8, py0 + 8);
      return;
    }
    if (blockFees.length < 2 && sparklineData.length < 2) return;

    var trendX = isMob ? 20 : 50;
    var trendY = isMob ? 430 : 400;
    var trendW = isMob ? w - 40 : w - 100;
    var trendH = isMob ? 90 : 110;

    ctx.fillStyle = '#1A1612';
    ctx.strokeStyle = '#3A3228';
    VIZ.roundRect(ctx, trendX, trendY, trendW, trendH, 8);
    ctx.fill();
    ctx.stroke();

    // Series: prefer the real mirror (avgFees + usd per block), else the engine.
    var series = blockFees.length > 0 ? blockFees : sparklineData.map(function(f, i) {
      return { avgFees: f, usd: null, t: i };
    });
    var hasUsd = blockFees.length > 0;
    var lastPt = series.length > 0 ? series[series.length - 1] : null;
    var price = lastPt && hasUsd && typeof lastPt.usd === 'number' && lastPt.usd > 0
      ? lastPt.usd : (typeof btcPrice === 'number' && btcPrice > 0 ? btcPrice : 0); // 0 = no price yet — USD axis hides

    var maxVal = 0;
    for (var si = 0; si < series.length; si++) {
      var fv = series[si].avgFees || 0;
      if (fv > maxVal) maxVal = fv;
    }
    if (maxVal === 0) maxVal = 1;

    var plotL = trendX + 34;
    var plotR = trendX + trendW - 6;
    var plotT = trendY + 16;
    var plotB = trendY + trendH - 18;
    var plotW = plotR - plotL;
    var plotH = plotB - plotT;
    if (plotW < 40 || plotH < 10) return;

    // Y axis: 3 ticks in BTC (fee sats -> BTC) + USD conversion when price known
    ctx.fillStyle = '#6A5D4E';
    ctx.font = '9px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (var yt = 0; yt <= 3; yt++) {
      var yv = maxVal * yt / 3;
      var yy = plotB - (yv / maxVal) * plotH;
      ctx.strokeStyle = 'rgba(58,50,40,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(plotL, yy); ctx.lineTo(plotR, yy); ctx.stroke();
      var btc = yv / 100000000;
      ctx.fillText(btc.toFixed(3) + ' BTC', plotL - 4, yy);
    }

    // Area + line
    ctx.beginPath();
    for (var i = 0; i < series.length; i++) {
      var ix = plotL + (i / (series.length - 1)) * plotW;
      var iy = plotB - ((series[i].avgFees || 0) / maxVal) * plotH;
      if (i === 0) ctx.moveTo(ix, iy);
      else ctx.lineTo(ix, iy);
    }
    ctx.lineTo(plotL + plotW, plotB);
    ctx.lineTo(plotL, plotB);
    ctx.closePath();
    ctx.fillStyle = 'rgba(212,147,58,0.08)';
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = '#D4933A';
    ctx.lineWidth = 2;
    for (var j = 0; j < series.length; j++) {
      var jx = plotL + (j / (series.length - 1)) * plotW;
      var jy = plotB - ((series[j].avgFees || 0) / maxVal) * plotH;
      if (j === 0) ctx.moveTo(jx, jy);
      else ctx.lineTo(jx, jy);
    }
    ctx.stroke();

    // Min/max value labels
    ctx.textAlign = 'left';
    ctx.fillStyle = '#9B8B78';
    ctx.fillText((maxVal / 100000000).toFixed(4) + ' BTC max', plotL, plotT - 3);
    if (price > 0) {
      ctx.fillText('≈ $' + fmtUSD(maxVal / 100000000 * price), plotL + 74, plotT - 3);
    }

    // X time labels — real timestamps from the mirror, else block indices
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    var labels = [];
    for (var li = 0; li < series.length; li++) {
      var ts = series[li].t;
      labels.push(typeof ts === 'number' ? ts : null);
    }
    [0, Math.floor(series.length / 2), series.length - 1].forEach(function (idx) {
      var lab = '—';
      var ts = labels[idx];
      // Real unix timestamps only (seconds or ms); block indices render as —.
      if (typeof ts === 'number' && ts > 1000000000) {
        var ms = ts > 100000000000 ? ts : ts * 1000;
        var d = new Date(ms);
        if (!isNaN(d.getTime())) {
          lab = String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
        }
      }
      ctx.fillText(lab, plotL + (idx / (series.length - 1)) * plotW, plotB + 4);
    });

    // Live point on the latest real capture
    var lpx = plotL + plotW;
    var lpy = plotB - ((series[series.length - 1].avgFees || 0) / maxVal) * plotH;
    var lr = 3 + (REDUCED_MOTION ? 0 : Math.sin(t * 2.4) * 1.5);
    ctx.beginPath();
    ctx.arc(lpx, lpy, lr + 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(212,147,58,0.18)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lpx, lpy, lr, 0, Math.PI * 2);
    ctx.fillStyle = '#D4933A';
    ctx.fill();

    // Title
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#6A5D4E';
    ctx.font = '9px -apple-system, sans-serif';
    ctx.fillText('Fee Revenue Trend — real per-block avg fees, last 144 blocks' + (hasUsd ? ' (USD at capture price)' : ''), trendX + 8, trendY + 2);
  }

  function drawFeeShare(feeTotal) {
    var isMob = isMobile();
    var subsidyBtc = 3.125;
    var feeBtc = feeTotal / 100000000;
    var totalBtc = subsidyBtc + feeBtc;
    var feePct = totalBtc > 0 ? (feeBtc / totalBtc * 100) : 0;

    var y = isMob ? 500 : 470;
    var x = isMob ? 20 : 50;
    var boxW = isMob ? w - 40 : w - 100;

    ctx.fillStyle = '#231F19';
    ctx.strokeStyle = '#3A3228';
    VIZ.roundRect(ctx, x, y, boxW, 36, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#9B8B78';
    ctx.font = '12px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Fee share: ' + feePct.toFixed(1) + '% of total reward', x + 18, y + 18);

    var barStart = isMob ? x + 10 : 200;
    var barW = Math.max(4, (isMob ? boxW - 20 : boxW - 200) * (feePct / 100));
    ctx.fillStyle = '#3BA35D';
    VIZ.roundRect(ctx, barStart, y + 12, Math.max(4, barW), 12, 6);
    ctx.fill();
  }

  function drawFeeShareRing(feeTotal, t) {
    var isMob = isMobile();
    var subsidyBtc = 3.125;
    var feeBtc = feeTotal / 100000000;
    var totalBtc = subsidyBtc + feeBtc;
    var feePct = totalBtc > 0 ? (feeBtc / totalBtc * 100) : 0;

    var rx = isMob ? w - 64 : w * 0.72;
    var ry = isMob ? 150 : 150;
    var rOut = isMob ? 44 : 52;
    var rIn = rOut * 0.66;
    var cx = rx, cy = ry;

    // Track
    ctx.beginPath();
    ctx.arc(cx, cy, (rOut + rIn) / 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(58,50,40,0.7)';
    ctx.lineWidth = rOut - rIn;
    ctx.stroke();

    // Fee share arc — REAL fee revenue as % of total reward
    var startA = -Math.PI / 2;
    var sweepA = Math.max(0.02, (feePct / 100) * Math.PI * 2);
    var reveal = REDUCED_MOTION ? 1 : Math.min(1, (t % 6) / 2); // arc re-sweeps every 6s
    ctx.beginPath();
    ctx.arc(cx, cy, (rOut + rIn) / 2, startA, startA + sweepA * reveal);
    ctx.strokeStyle = '#3FB950';
    ctx.lineWidth = rOut - rIn;
    ctx.shadowColor = 'rgba(63,185,80,0.35)';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Subsidy arc (remainder) — accent
    ctx.beginPath();
    ctx.arc(cx, cy, (rOut + rIn) / 2, startA + sweepA, startA + Math.PI * 2);
    ctx.strokeStyle = '#D4933A';
    ctx.lineWidth = rOut - rIn;
    ctx.globalAlpha = 0.85;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Center label
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#EADCC8';
    ctx.font = (isMob ? 'bold 12px' : 'bold 15px') + ' -apple-system, sans-serif';
    ctx.fillText(feePct.toFixed(1) + '%', cx, cy - 4);
    ctx.fillStyle = '#6A5D4E';
    ctx.font = (isMob ? '7px' : '9px') + ' -apple-system, sans-serif';
    ctx.fillText('fee share', cx, cy + 13);
  }

  function fmtUSD(val) {
    if (val >= 1000000) return (val / 1000000).toFixed(2) + 'M';
    if (val >= 1000) return (val / 1000).toFixed(1) + 'K';
    return val.toFixed(0);
  }

  return { init: init, resize: resize };
})();
