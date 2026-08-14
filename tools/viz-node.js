var REDUCED_MOTION = (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
var VIZ_Node = (function() {
  var canvas, ctx, w = 0, h = 0;
  var animFrame = null;

  // Model inputs (user-adjustable — always labeled "model", never presented as
  // measured network data).
  var values = {
    hardware: 500,
    bandwidth: 50,
    power: 150,
    rate: 0.12
  };

  var STORAGE_FIXED = 50;
  var DEPRECIATION_YEARS = 3;

  var targetCosts = { hardware: 0, bandwidth: 0, electricity: 0, storage: 0, total: 0 };
  var currentCosts = { hardware: 0, bandwidth: 0, electricity: 0, storage: 0, total: 0 };
  var animating = false;
  var animStart = 0;
  var animDuration = 300;
  var prevCosts = { hardware: 0, bandwidth: 0, electricity: 0, storage: 0, total: 0 };

  // REAL data (seed 0 — rendered '--' until real values arrive)
  var btcPrice = 0;
  var displayPrice = 0;
  var blockHeight = 0;
  var lastBlockTxs = 0;
  var census = null;      // data/node_census.json (real local-node census)

  function isMobile() { return w < 480; }

  function init(canvasId) {
    canvas = document.getElementById(canvasId);
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    if (typeof DATA_ENGINE !== 'undefined') {
      var de = DATA_ENGINE;
      var initPrice = de.get().btc_price;
      if (initPrice && initPrice > 0) {
        values.hardware = Math.round(Math.min(2000, Math.max(200, initPrice * 0.025)));
      }
      var d0 = de.get();
      if (d0.btc_price) btcPrice = d0.btc_price;
      if (d0.block_height) blockHeight = d0.block_height;
      if (d0.blocks && d0.blocks.length > 0) lastBlockTxs = d0.blocks[0].tx_count || 0;
      de.onUpdate(function(state) {
        var newPrice = state.btc_price;
        if (newPrice && newPrice > 0) {
          btcPrice = newPrice;
          values.hardware = Math.round(Math.min(2000, Math.max(200, newPrice * 0.025)));
          draw();
        }
        if (state.block_height) blockHeight = state.block_height;
        if (state.blocks && state.blocks.length > 0) lastBlockTxs = state.blocks[0].tx_count || 0;
      });
    }

    // Real node census (local Bitcoin Core addrman lower bound)
    fetch('/data/node_census.json').then(function(r) { return r.json(); }).then(function(d) {
      if (d && typeof d.totalKnownAddresses === 'number') census = d;
    }).catch(function() {});

    createControls();
    resize();
    window.addEventListener('resize', resize);
    computeTarget();
    for (var k in targetCosts) currentCosts[k] = targetCosts[k];
    loop();
  }

  function createControls() {
    var existing = document.getElementById('viz-node-controls');
    if (existing) existing.remove();

    var container = document.createElement('div');
    container.id = 'viz-node-controls';
    container.style.cssText = 'max-width:800px;margin:16px auto 0;padding:0 20px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;';

    var sliderDefs = [
      { id: 'slider-hw', label: 'Hardware Cost',   min: 200, max: 2000, val: values.hardware, step: 50, fmt: function(v) { return '$' + Math.round(v); } },
      { id: 'slider-bw', label: 'Bandwidth',        min: 20,  max: 200,  val: values.bandwidth, step: 5,  fmt: function(v) { return '$' + Math.round(v) + '/mo'; } },
      { id: 'slider-pw', label: 'Power Draw',       min: 30,  max: 300,  val: values.power, step: 5,  fmt: function(v) { return Math.round(v) + 'W'; } },
      { id: 'slider-rate', label: 'Electricity Rate', min: 0.08, max: 0.40, val: values.rate, step: 0.01, fmt: function(v) { return '$' + parseFloat(v).toFixed(2) + '/kWh'; } }
    ];

    sliderDefs.forEach(function(s) {
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:12px;margin:5px 0;';

      var label = document.createElement('span');
      label.style.cssText = 'width:130px;color:#8B949E;font-size:13px;flex-shrink:0;';
      label.textContent = s.label;

      var slider = document.createElement('input');
      slider.type = 'range';
      slider.id = s.id;
      slider.min = s.min;
      slider.max = s.max;
      slider.value = s.val;
      slider.step = s.step;
      slider.style.cssText = 'flex:1;height:5px;-webkit-appearance:none;appearance:none;background:#30363D;border-radius:3px;outline:none;cursor:pointer;';
      slider.style.background = 'linear-gradient(to right,#58A6FF 0%,#58A6FF ' + ((slider.value - slider.min) / (slider.max - slider.min) * 100) + '%,#30363D ' + ((slider.value - slider.min) / (slider.max - slider.min) * 100) + '%,#30363D 100%)';

      var valSpan = document.createElement('span');
      valSpan.id = s.id + '-val';
      valSpan.style.cssText = 'width:90px;text-align:right;color:#E6EDF3;font-size:14px;font-weight:600;font-variant-numeric:tabular-nums;flex-shrink:0;';
      valSpan.textContent = s.fmt(s.val);

      slider.addEventListener('input', function() {
        var v = parseFloat(this.value);
        var key = keyFromId(this.id);
        values[key] = v;
        document.getElementById(this.id + '-val').textContent = s.fmt(v);
        var pct = ((v - this.min) / (this.max - this.min)) * 100;
        this.style.background = 'linear-gradient(to right,#58A6FF 0%,#58A6FF ' + pct + '%,#30363D ' + pct + '%,#30363D 100%)';
        onSliderChange();
      });

      row.appendChild(label);
      row.appendChild(slider);
      row.appendChild(valSpan);
      container.appendChild(row);
    });

    // Model provenance line — the sliders are assumptions, not measurements.
    var note = document.createElement('div');
    note.style.cssText = 'margin-top:8px;font-size:11px;color:#6A5D4E;';
    note.textContent = 'model — adjust the assumptions above; the stack animates to the new split';
    container.appendChild(note);

    canvas.parentNode.insertBefore(container, canvas.nextSibling);
  }

  function keyFromId(id) {
    var map = { 'slider-hw': 'hardware', 'slider-bw': 'bandwidth', 'slider-pw': 'power', 'slider-rate': 'rate' };
    return map[id] || 'hardware';
  }

  function onSliderChange() {
    prevCosts = { hardware: currentCosts.hardware, bandwidth: currentCosts.bandwidth, electricity: currentCosts.electricity, storage: currentCosts.storage, total: currentCosts.total };
    computeTarget();
    animStart = performance.now();
    animating = true;
  }

  function computeTarget() {
    var hw = values.hardware / DEPRECIATION_YEARS;
    var bw = values.bandwidth * 12;
    var elec = (values.power * 24 * 365 / 1000) * values.rate;
    var storage = STORAGE_FIXED;
    var total = hw + bw + elec + storage;
    targetCosts = { hardware: hw, bandwidth: bw, electricity: elec, storage: storage, total: total };
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function updateAnimation() {
    if (!animating) return;
    var elapsed = performance.now() - animStart;
    var t = Math.min(1, elapsed / animDuration);
    var ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    currentCosts.hardware = lerp(prevCosts.hardware, targetCosts.hardware, ease);
    currentCosts.bandwidth = lerp(prevCosts.bandwidth, targetCosts.bandwidth, ease);
    currentCosts.electricity = lerp(prevCosts.electricity, targetCosts.electricity, ease);
    currentCosts.storage = lerp(prevCosts.storage, targetCosts.storage, ease);
    currentCosts.total = lerp(prevCosts.total, targetCosts.total, ease);
    if (t >= 1) {
      currentCosts = { hardware: targetCosts.hardware, bandwidth: targetCosts.bandwidth, electricity: targetCosts.electricity, storage: targetCosts.storage, total: targetCosts.total };
      animating = false;
    }
  }

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

  var animT = 0;
  function draw() {
    if (!ctx) return;
    animT += 0.025;
    updateAnimation();
    displayPrice += (btcPrice - displayPrice) * 0.05;

    var c = currentCosts;
    var mobile = isMobile();

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#1A1612';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#EADCC8';
    ctx.font = (mobile ? '15px' : '18px') + ' -apple-system, sans-serif';
    ctx.fillText('⬡ Your Node\'s Impact', 24, 14);
    ctx.fillStyle = '#6A5D4E';
    ctx.font = (mobile ? '10px' : '12px') + ' -apple-system, sans-serif';
    ctx.fillText('Real network metrics · cost stack below is a labeled model', 24, 38);

    // ── Real metric chips (REAL values, '--' until they arrive) ──
    var chips = [
      { label: 'BTC Price', value: displayPrice > 0 ? '$' + Math.round(displayPrice).toLocaleString() : '--', color: displayPrice > 0 ? '#D4933A' : '#6A5D4E' },
      { label: 'Chain Height', value: blockHeight > 0 ? blockHeight.toLocaleString() : '--', color: blockHeight > 0 ? '#58A6FF' : '#6A5D4E' },
      { label: 'Last Block Txs', value: lastBlockTxs > 0 ? lastBlockTxs.toLocaleString() : '--', color: lastBlockTxs > 0 ? '#3FB950' : '#6A5D4E' }
    ];
    var chipW = mobile ? (w - 48) / 3 : 150;
    var chipGap = mobile ? 6 : (w - 48 - chipW * 3) / 2;
    for (var ci = 0; ci < 3; ci++) {
      var ccx = 24 + ci * (chipW + chipGap);
      ctx.fillStyle = '#231F19';
      ctx.strokeStyle = '#3A3228';
      ctx.lineWidth = 1;
      roundRect(ctx, ccx, 62, chipW, mobile ? 46 : 56, 8);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = chips[ci].color;
      ctx.font = (mobile ? 'bold 12px' : 'bold 15px') + ' -apple-system, sans-serif';
      ctx.fillText(chips[ci].value, ccx + chipW / 2, mobile ? 76 : 82);
      ctx.fillStyle = '#6A5D4E';
      ctx.font = (mobile ? '7px' : '9px') + ' -apple-system, sans-serif';
      ctx.fillText(chips[ci].label, ccx + chipW / 2, mobile ? 96 : 106);
    }

    // ── Node census radial (REAL local-node census) + propagation waves ──
    var censusCX = mobile ? w / 2 : w * 0.30;
    var censusCY = mobile ? 210 : 210;
    var censusR = mobile ? 62 : 74;

    // Propagation waves — count = real liveConnections, decorative motion
    if (census && typeof census.liveConnections === 'number') {
      var conns = census.liveConnections;
      for (var wi = 0; wi < 3; wi++) {
        var phase = ((animT * 0.5 + wi / 3) % 1);
        var rr = censusR + phase * 46;
        ctx.beginPath();
        ctx.arc(censusCX, censusCY, rr, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(247,147,26,' + (0.28 * (1 - phase)) + ')';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    var pulse = REDUCED_MOTION ? 1 : Math.sin(animT * 1.6) * 0.03 + 1;
    ctx.fillStyle = '#231F19';
    ctx.strokeStyle = '#3A3228';
    roundRect(ctx, censusCX - censusR - 14, censusCY - censusR - 14, censusR * 2 + 28, censusR * 2 + 40, 12);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(censusCX, censusCY, censusR * pulse, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(247,147,26,0.10)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(censusCX, censusCY, censusR * 0.72, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(247,147,26,0.08)';
    ctx.fill();

    var censusVal = census ? census.totalKnownAddresses : 0;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = censusVal > 0 ? '#D4933A' : '#6A5D4E';
    ctx.font = (mobile ? 'bold 16px' : 'bold 20px') + ' -apple-system, sans-serif';
    ctx.fillText(censusVal > 0 ? censusVal.toLocaleString() : '--', censusCX, censusCY - 6);
    ctx.fillStyle = '#6A5D4E';
    ctx.font = (mobile ? '8px' : '10px') + ' -apple-system, sans-serif';
    ctx.fillText('known addresses', censusCX, censusCY + 16);
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.font = (mobile ? '7px' : '9px') + ' -apple-system, sans-serif';
    ctx.fillText(census ? (census.lower_bound ? 'lower bound · local node' : 'local node') : 'data/node_census.json', censusCX, censusCY + 30);

    // Real live-connections line
    if (census && typeof census.liveConnections === 'number') {
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = (mobile ? '8px' : '10px') + ' -apple-system, sans-serif';
      ctx.fillText('node: ' + census.liveConnections + ' live connections (' + (census.outbound || 0) + ' out)', censusCX, censusCY + censusR + 20);
    }

    // ── Model cost stack (animated on slider move) ──
    var barY = mobile ? 330 : 330;
    var barH = 40;
    var barPad = mobile ? 24 : 48;
    var barW = w - barPad * 2;
    if (barW < 40) barW = 40;

    ctx.fillStyle = '#EADCC8';
    ctx.font = (mobile ? '12px' : '14px') + ' -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Annual cost breakdown — model estimate', barPad, barY - 24);

    var segs = [
      { key: 'hardware', label: 'Hardware', color: '#D4933A', cost: c.hardware },
      { key: 'bandwidth', label: 'Bandwidth', color: '#58A6FF', cost: c.bandwidth },
      { key: 'electricity', label: 'Electricity', color: '#3FB950', cost: c.electricity },
      { key: 'storage', label: 'Storage', color: '#BC8CFF', cost: c.storage }
    ];

    var total = segs.reduce(function(s, seg) { return s + seg.cost; }, 0);
    if (total < 1) total = 1;
    var x = barPad;

    segs.forEach(function(seg) {
      var segW = (seg.cost / total) * barW;
      if (segW < 1 && seg.cost > 0) segW = 1;
      ctx.fillStyle = seg.color;
      ctx.fillRect(x, barY, segW, barH);

      if (segW > 84) {
        ctx.fillStyle = '#1A1612';
        ctx.font = 'bold 11px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$' + Math.round(seg.cost) + ' ' + seg.label, x + segW / 2, barY + barH / 2);
      } else {
        ctx.fillStyle = '#9B8B78';
        ctx.font = '10px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(seg.label + ' $' + Math.round(seg.cost), x + segW / 2, barY + barH + 4);
      }
      x += segW;
    });

    // Total callout
    ctx.fillStyle = '#EADCC8';
    ctx.font = (mobile ? 'bold 13px' : 'bold 15px') + ' -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('≈ $' + Math.round(c.total) + '/yr total', barPad + barW, barY + barH + 16);

    // ── Model footer (honest labeling) ──
    var footY = mobile ? 420 : 440;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = (mobile ? '9px' : '11px') + ' -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    var modelNote = 'model — hardware depreciates over ' + DEPRECIATION_YEARS + ' yrs · hardware defaults scale with the real BTC price · storage fixed $' + STORAGE_FIXED + '/yr';
    ctx.fillText(modelNote, barPad, footY);

    // Vignette
    var grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.1, w / 2, h / 2, h * 0.7);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  function loop() { try { draw(); } catch (e) { if (window.console) console.error('VIZ_Node draw:', e); }
    if (!REDUCED_MOTION) requestAnimationFrame(loop);
  }

  function getCosts() {
    var hw = values.hardware / DEPRECIATION_YEARS;
    var bw = values.bandwidth * 12;
    var elec = (values.power * 24 * 365 / 1000) * values.rate;
    var storage = STORAGE_FIXED;
    return { hw: Math.round(hw), bw: Math.round(bw), elec: Math.round(elec), storage: Math.round(storage), total: Math.round(hw + bw + elec + storage) };
  }

  function resize() {
    var r = VIZ.responsiveSize(canvas, 620);
    w = r.w;
    h = r.h;
    ctx = r.ctx;
  }

  return { init: init, resize: resize, getCosts: getCosts };
})();
