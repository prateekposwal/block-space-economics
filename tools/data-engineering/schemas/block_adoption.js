var { isObj, isArr, isStr, isNum } = require('./helpers.js');

var HEX64 = /^[0-9a-f]{64}$/i;

var schema = { name: 'capture.block_adoption', source: 'block_adoption', major: 1, minor: 0, protocolDoc: 'docs/protocols/block_adoption.md' };

function validate(data) {
  if (!isObj(data)) return { ok: false, reasons: ['must be object'] };
  var reasons = [];
  if (!isStr(data.tipHash) || !HEX64.test(data.tipHash)) reasons.push('tipHash not 64-hex');
  if (!isArr(data.blocks) || data.blocks.length === 0) reasons.push('blocks must be non-empty array');
  if (!isObj(data.taprootSample)) reasons.push('taprootSample must be object');
  else {
    ['txsSampled', 'nonCoinbase', 'taprootSpends', 'segwitSpends', 'legacySpends', 'unclassified'].forEach(function (f) {
      if (!(f in data.taprootSample)) reasons.push('taprootSample missing ' + f);
      else if (!isNum(data.taprootSample[f]) || data.taprootSample[f] < 0) reasons.push('taprootSample.' + f + ' invalid');
    });
  }
  if (isArr(data.blocks) && data.blocks.length) {
    if (data.blocks.length > 10) reasons.push('more than 10 blocks');
    for (var i = 0; i < data.blocks.length; i++) {
      var b = data.blocks[i];
      if (!isObj(b)) { reasons.push('block ' + i + ' not object'); continue; }
      ['height', 'tx_count'].forEach(function (f) {
        if (!isNum(b[f]) || b[f] < 0) reasons.push('block ' + i + ' ' + f + ' invalid');
      });
      ['hash'].forEach(function (f) {
        if (!isStr(b[f]) || !HEX64.test(b[f])) reasons.push('block ' + i + ' ' + f + ' not 64-hex');
      });
      ['weight', 'segwitTotalTxs'].forEach(function (f) {
        if (!isNum(b[f]) || b[f] < 0) reasons.push('block ' + i + ' ' + f + ' invalid');
      });
    }
  }
  return reasons.length ? { ok: false, reasons: reasons } : { ok: true, reasons: [] };
}

module.exports = { schema: schema, validate: validate };
