var REDUCED_MOTION = (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const VIZ_Research = (() => {
  const REGIME_COLORS = {
    very_low: { bg: 'rgba(59,163,93,0.15)', text: '#3BA35D', label: 'Very Low' },
    low: { bg: 'rgba(59,163,93,0.25)', text: '#3BA35D', label: 'Low' },
    moderate: { bg: 'rgba(212,118,42,0.2)', text: '#D4762A', label: 'Moderate' },
    high: { bg: 'rgba(192,57,43,0.2)', text: '#C0392B', label: 'High' },
    very_high: { bg: 'rgba(192,57,43,0.35)', text: '#C0392B', label: 'Peak' },
  };

  let canvas, ctx, w = 0, h = 0;
  let data = [];
  let rafId = null;
  let btcPrice = 64000;
  let stacked = false;
  let feeSpread = { fastest: 3, hour: 1.5, economy: 1 };
  let animTime = 0;

  function isMobile() { return w < 480; }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function init(canvasId) {
    canvas = document.getElementById(canvasId);
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);

    canvas.addEventListener('touchstart', function(e) { e.preventDefault(); }, { passive: false });
    canvas.addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });
    canvas.addEventListener('touchend', function() {});

    if (typeof DATA_ENGINE !== 'undefined') {
      var de = DATA_ENGINE;
      var state = de.get();
      if (state && state.fee_history && state.fee_history.length > 0) {
        data = buildSeries(state.fee_history);
      }
      if (state && state.btc_price) btcPrice = state.btc_price;

      de.onUpdate(function(state) {
        if (state && state.fee_history) {
          data = buildSeries(state.fee_history);
        }
        if (state && state.btc_price) btcPrice = state.btc_price;
        if (state && state.fees && typeof state.fees.fastestFee === 'number' && typeof state.fees.economyFee === 'number' && state.fees.economyFee > 0) {
          var eco = state.fees.economyFee;
          feeSpread = { fastest: state.fees.fastestFee / eco, hour: (state.fees.hourFee || eco) / eco, economy: 1 };
        }
      });
    }

    // Honest empty state: no fabricated fee series. The chart renders a
    // "data pending" message instead of inventing points (integrity rule).
    // (draw() already guards on data.length < 2.)

    loop();
  }

  function loop() { try { animTime += 0.02; draw(); } catch (e) {}
    rafId = REDUCED_MOTION ? 0 : requestAnimationFrame(loop);
  }

  function resize() {
    var parent = canvas.parentElement;
    var pw = parent ? parent.clientWidth : window.innerWidth;
    if (!pw || pw < 100) pw = window.innerWidth;
    var dpr = window.devicePixelRatio || 1;
    w = pw;
    stacked = w < 768;
    h = stacked ? 700 : 550;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
  }

  function buildSeries(raw) {
    if (!raw || !Array.isArray(raw) || raw.length === 0) return [];
    var fs = feeSpread || { fastest: 3, hour: 1.5, economy: 1 };
    return raw.map(function(e) {
      var economy = (e.avgFees || e.avgFee || 0) / 2500000;
      return {
        t: e.timestamp,
        economy: economy,
        hour: economy * fs.hour,
        fastest: economy * fs.fastest,
      };
    });
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#161310';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#EADCC8';
    ctx.font = 'bold 18px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('The Fee Story — Last 24 Hours', 30, 16);
    ctx.font = '12px -apple-system, sans-serif';
    ctx.fillStyle = '#6A5D4E';
    ctx.fillText('How network congestion changed over time', 30, 40);

    if (stacked) {
      drawRegimeTimeline(0, 60, w, 200);
      drawStatCards(0, 300, w);
      drawNarrativeBar(0, 400, w);
    } else {
      drawRegimeTimeline(0, 60, w, 280);
      drawStatCards(0, 360, w);
      drawNarrativeBar(0, 460, w);
    }

    var grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.05, w / 2, h / 2, h * 0.7);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  function getRegimes() {
    if (data.length === 0) return [];
    var regimes = [];
    for (var i = 0; i < data.length; i++) {
      var fee = data[i].economy || 0;
      var regime = fee < 3 ? 'very_low' : fee < 5 ? 'low' : fee < 10 ? 'moderate' : fee < 20 ? 'high' : 'very_high';
      regimes.push(regime);
    }
    var merged = [];
    for (var i = 0; i < regimes.length; i++) {
      if (merged.length > 0 && merged[merged.length - 1].type === regimes[i]) {
        merged[merged.length - 1].count++;
      } else {
        merged.push({ type: regimes[i], count: 1 });
      }
    }
    return merged;
  }

  function drawRegimeTimeline(px, py, pw, ph) {
    if (pw < 60 || ph < 40 || data.length < 2) return;

    var merged = getRegimes();
    if (merged.length === 0) return;

    ctx.fillStyle = '#231F19';
    ctx.strokeStyle = '#3A3228';
    ctx.lineWidth = 1;
    roundRect(ctx, px + 20, py, pw - 40, ph, 10);
    ctx.fill();
    ctx.stroke();

    var bandLeft = px + 40;
    var bandRight = pw - 40;
    var bandW = bandRight - bandLeft;
    var bandY = py + 20;
    var bandH = ph - 60;
    var totalData = data.length;

    var x = bandLeft;
    for (var i = 0; i < merged.length; i++) {
      var segW = (merged[i].count / totalData) * bandW;
      var rc = REGIME_COLORS[merged[i].type] || REGIME_COLORS.moderate;
      ctx.fillStyle = rc.bg;
      ctx.fillRect(x, bandY, segW, bandH);
      ctx.fillStyle = rc.text;
      ctx.font = 'bold 12px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(rc.label, x + segW / 2, bandY + bandH / 2 - 10);
      ctx.font = '10px -apple-system, sans-serif';
      ctx.fillStyle = '#6A5D4E';
      var hours = Math.round(merged[i].count / totalData * 24);
      ctx.fillText('~' + hours + 'h', x + segW / 2, bandY + bandH / 2 + 12);
      x += segW;
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.fillStyle = '#6A5D4E';
    var timeLabels = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'];
    for (var i = 0; i < timeLabels.length; i++) {
      ctx.fillText(timeLabels[i], bandLeft + (i / (timeLabels.length - 1)) * bandW, bandY + bandH + 8);
    }

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(234,220,200,0.5)';
    ctx.lineWidth = 2;
    var maxFee = 50;
    for (var i = 0; i < data.length; i++) {
      var fee = data[i].economy || 0;
      var lx = bandLeft + (i / totalData) * bandW;
      var ly = bandY + bandH - Math.min(1, fee / maxFee) * bandH * 0.85;
      if (i === 0) ctx.moveTo(lx, ly);
      else ctx.lineTo(lx, ly);
    }
    ctx.stroke();
  }

  function drawStatCards(px, py, pw) {
    var currentFee = data.length > 0 ? data[data.length - 1].economy : 0;
    var peakFee = 0;
    var sumFee = 0;
    for (var i = 0; i < data.length; i++) {
      var f = data[i].fastest || 0;
      if (f > peakFee) peakFee = f;
      sumFee += data[i].economy || 0;
    }
    var avgFee = data.length > 0 ? sumFee / data.length : 0;

    var cardW = Math.min(200, (pw - 80) / 3);
    var cardGap = (pw - 80 - cardW * 3) / 2;
    if (cardGap < 4) { cardW = (pw - 80) / 3; cardGap = 0; }

    var cardData = [
      { label: 'Current (Economy)', value: currentFee.toFixed(1) + ' sat/vB', color: '#3BA35D' },
      { label: '24h Peak (Fastest)', value: peakFee.toFixed(0) + ' sat/vB', color: '#C0392B' },
      { label: '24h Average', value: avgFee.toFixed(1) + ' sat/vB', color: '#58A6FF' },
    ];

    for (var i = 0; i < 3; i++) {
      var cx = 40 + i * (cardW + cardGap);
      var pulse = Math.sin(animTime * 1.2 + i) * 0.03 + 0.97;
      ctx.fillStyle = '#231F19';
      ctx.strokeStyle = '#3A3228';
      ctx.lineWidth = 1;
      if (i === 1) { ctx.shadowColor = 'rgba(192,57,43,0.06)'; ctx.shadowBlur = 6 + Math.sin(animTime * 1.2) * 3; }
      roundRect(ctx, cx, py, cardW, 80, 10);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold ' + Math.round(24 * pulse) + 'px -apple-system, sans-serif';
      ctx.fillStyle = cardData[i].color;
      ctx.fillText(cardData[i].value, cx + cardW / 2, py + 30);
      ctx.font = '10px -apple-system, sans-serif';
      ctx.fillStyle = '#6A5D4E';
      ctx.fillText(cardData[i].label, cx + cardW / 2, py + 58);
    }
  }

  function drawNarrativeBar(px, py, pw) {
    if (data.length < 2) return;

    var recent = data.slice(-6);
    var first = recent[0].economy;
    var last = recent[recent.length - 1].economy;
    var diff = last - first;
    var trend = diff > 1 ? 'up' : diff < -1 ? 'down' : 'flat';
    var trendWord = trend === 'up' ? 'upward' : trend === 'down' ? 'downward' : 'sideways';
    var trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';

    ctx.fillStyle = '#231F19';
    ctx.strokeStyle = '#3A3228';
    ctx.lineWidth = 1;
    roundRect(ctx, 40, py, pw - 80, 50, 10);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 14px -apple-system, sans-serif';
    ctx.fillStyle = trend === 'up' ? '#C0392B' : trend === 'down' ? '#3BA35D' : '#D4762A';
    ctx.shadowColor = trend === 'up' ? 'rgba(192,57,43,0.15)' : trend === 'down' ? 'rgba(59,163,93,0.15)' : 'rgba(212,118,42,0.15)';
    ctx.shadowBlur = 6 + Math.sin(animTime * 1.5) * 3;
    ctx.fillText(trendIcon + ' Fees trending ' + trendWord + ' over last 24 hours', 60, py + 25);
    ctx.shadowBlur = 0;
  }

  function downloadCSV() {
    if (data.length === 0) return;
    var csv = 'Timestamp,Economy (sat/vB),1 Hour (sat/vB),Fastest (sat/vB)\n';
    for (var i = 0; i < data.length; i++) {
      var d = data[i];
      var ts = new Date(d.t).toISOString();
      csv += ts + ',' + d.economy.toFixed(2) + ',' + d.hour.toFixed(2) + ',' + d.fastest.toFixed(2) + '\n';
    }
    var blob = new Blob([csv], { type: 'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'fee_history_24h.csv';
    a.textContent = 'Download CSV';
    a.style.cssText = 'display:inline-block;margin-top:8px;padding:6px 14px;background:#1e293b;color:#94a3b8;border:1px solid rgba(255,255,255,0.1);border-radius:4px;font:11px -apple-system,sans-serif;text-decoration:none;';
    a.onclick = function() { setTimeout(function() { URL.revokeObjectURL(url); }, 5000); };
    return a;
  }

  function destroy() {
    if (rafId) cancelAnimationFrame(rafId);
    window.removeEventListener('resize', resize);
  }

  return { init: init, destroy: destroy, downloadCSV: downloadCSV, resize: resize };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { VIZ_Research };
}
