var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var { EventEmitter } = require('events');

var DEFAULT_CONFIG = {
  dir: path.join(__dirname, '..', '..', 'captured-data', 'spool'),
  mirror: true,
  fsync: true,
  leaseTtlMs: 600000,
  attemptCap: 5,
  backoffBaseMs: 60000,
  backoffMaxMs: 1800000,
  expectedIntervalMinutes: 10,
  staleAfterMinutes: 30,
  indexTtlDays: 90
};

function parseLine(line) {
  try { return JSON.parse(line); } catch (e) { return null; }
}

function idempotentKey(source, captureTime) {
  return source + ':' + captureTime;
}

function Spool(config) {
  EventEmitter.call(this);
  this.cfg = Object.assign({}, DEFAULT_CONFIG, config || {});
  // S3b: real-time staleness threshold. If not explicitly configured, derive from
  // the actual capture schedule (2x base interval, floor 30) so healthy sources
  // on a 60-min cadence are never flagged mid-cycle.
  if (!(this.cfg.staleAfterMinutes > 0)) {
    try {
      var cfgMod = require('./config.js');
      this.cfg.staleAfterMinutes = (cfgMod.staleAfterMinutes && cfgMod.staleAfterMinutes()) || 120;
    } catch (e) {
      this.cfg.staleAfterMinutes = 120;
    }
  }
  this.dir = this.cfg.dir;
  this.queueFile = path.join(this.dir, 'queue.jsonl');
  this.acksFile = path.join(this.dir, 'acks.jsonl');
  this.leasesFile = path.join(this.dir, 'leases.jsonl');
  this.deadFile = path.join(this.dir, 'dead-letter.jsonl');
  this.corruptFile = path.join(this.dir, 'corrupt.log');
  this.metaFile = path.join(this.dir, 'spool-meta.json');
  this.historyFile = path.join(this.dir, 'history.jsonl');
  this.indexDir = path.join(this.dir, 'index');
  this.cursorsDir = path.join(this.dir, 'cursors');
  this.tmpDir = path.join(this.dir, 'tmp');

  this.entries = new Map();     // id -> entry (queue source of truth)
  this.acked = new Set();       // id
  this.dead = new Set();        // id
  this.leases = new Map();      // id -> { holder, leasedAt, expiresAt, attempts }
  this.seq = 0;
  this.totals = { enqueued: 0, acked: 0, dead: 0, pending: 0, leased: 0, duplicates: 0 };
  this.history = { totalEnqueued: 0, totalAcked: 0, totalDead: 0, totalDuplicates: 0, firstEnqueuedAt: null, lastEnqueuedAt: null };
  this.ready = false;
}

Spool.prototype = Object.create(EventEmitter.prototype);
Spool.prototype.constructor = Spool;

Spool.prototype._mkdirs = function() {
  [this.dir, this.indexDir, this.cursorsDir, this.tmpDir].forEach(function(d) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
};

Spool.prototype._append = function(file, obj, opts) {
  var line = JSON.stringify(obj) + '\n';
  var fd = fs.openSync(file, 'a');
  try {
    fs.writeSync(fd, line);
    if (opts && opts.fsync) fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
};

Spool.prototype._foldLog = function(file, handler) {
  if (!fs.existsSync(file)) return;
  var raw = fs.readFileSync(file, 'utf8');
  if (!raw) return;
  var lines = raw.split('\n');
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (!line.trim()) continue;
    var rec = parseLine(line);
    if (rec === null) {
      this._append(this.corruptFile, { file: file, line: i, reason: 'parse', at: new Date().toISOString() }, {});
      continue;
    }
    handler(rec);
  }
};

Spool.prototype._indexPath = function(source, day) {
  return path.join(this.indexDir, source, day + '.jsonl');
};

Spool.prototype._writeIndex = function(source, day, entry) {
  var p = this._indexPath(source, day);
  var dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  this._append(p, entry, {});
};

Spool.prototype._updateCursor = function(source, cycleTs, err, opts) {
  opts = opts || {};
  var p = path.join(this.cursorsDir, source + '.json');
  var cur = { source: source, lastCycleTs: cycleTs, lastEnqueuedAt: new Date().toISOString(), lastSeen: new Date().toISOString(), expectedIntervalMinutes: this.cfg.expectedIntervalMinutes, status: 'healthy', missedCycles: 0, lastError: null };
  if (fs.existsSync(p)) {
    try { cur = Object.assign(JSON.parse(fs.readFileSync(p, 'utf8')), cur); } catch (e) {}
  }
  if (err) {
    cur.status = 'degraded';
    cur.lastError = String(err).slice(0, 200);
  }
  if (opts.advance === false && fs.existsSync(p)) {
    try {
      var prev = JSON.parse(fs.readFileSync(p, 'utf8'));
      cur.lastCycleTs = prev.lastCycleTs;
      cur.lastEnqueuedAt = prev.lastEnqueuedAt;
    } catch (e) {}
  }
  if (opts.missedCycles !== undefined) cur.missedCycles = opts.missedCycles;
  if (opts.expectedIntervalMinutes) cur.expectedIntervalMinutes = opts.expectedIntervalMinutes;
  var tmp = path.join(this.tmpDir, source + '.json.tmp');
  fs.writeFileSync(tmp, JSON.stringify(cur, null, 2));
  fs.renameSync(tmp, p);
};

Spool.prototype.init = function() {
  var self = this;
  this._mkdirs();
  this._foldLog(this.queueFile, function(rec) {
    self.entries.set(rec.id, rec);
    self.seq = Math.max(self.seq, rec.seq || 0);
    self.totals.enqueued++;
  });
  this._foldLog(this.acksFile, function(rec) {
    self.acked.add(rec.id);
    self.totals.acked++;
  });
  this._foldLog(this.leasesFile, function(rec) {
    var prev = self.leases.get(rec.id);
    self.leases.set(rec.id, { holder: rec.holder, leasedAt: rec.leasedAt, expiresAt: rec.expiresAt, attempts: (prev ? prev.attempts : 0) + 1 });
  });
  this._foldLog(this.deadFile, function(rec) {
    self.dead.add(rec.id);
    self.totals.dead++;
  });
  this._foldLog(this.historyFile, function(rec) {
    if (rec.t === 'enq') { self.history.totalEnqueued++; if (!self.history.firstEnqueuedAt) self.history.firstEnqueuedAt = rec.at; self.history.lastEnqueuedAt = rec.at; }
    else if (rec.t === 'ack') { self.history.totalAcked++; }
    else if (rec.t === 'dead') { self.history.totalDead++; }
    else if (rec.t === 'dup') { self.history.totalDuplicates++; }
  });
  this.ready = true;
  this.emit('ready');
  return Promise.resolve(this);
};

Spool.prototype.enqueue = function(source, capture, opts) {
  var self = this;
  opts = opts || {};
  return new Promise(function(resolve) {
    var captureTime = opts.captureTime || (capture && capture.captureTime) || '';
    var day = opts.day || (captureTime ? captureTime.slice(0, 10) : new Date().toISOString().slice(0, 10));
    if (!captureTime) {
      var now = new Date();
      captureTime = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') + '_' + String(now.getHours()).padStart(2, '0') + '-' + String(now.getMinutes()).padStart(2, '0') + '-' + String(now.getSeconds()).padStart(2, '0');
    }
    var id = idempotentKey(source, captureTime);
    if (self.entries.has(id)) {
      self.totals.duplicates++;
      self.history.totalDuplicates++;
      self._append(self.historyFile, { t: 'dup', id: id, at: new Date().toISOString() }, {});
      return resolve({ ok: true, id: id, duplicate: true });
    }
    self.seq += 1;
    var entry = {
      id: id,
      source: source,
      captureTime: captureTime,
      day: day,
      seq: self.seq,
      enqueuedAt: new Date().toISOString(),
      payload: capture && (capture.data !== undefined || (capture.env && capture.env.magic === 'BSAHI-CAPTURE'))
        ? capture : { data: capture, fetchedAt: new Date().toISOString() },
      attempts: 0,
      producer: opts.producer || 'spool',
      schemaVersion: 1
    };
    try {
      self._append(self.queueFile, entry, { fsync: self.cfg.fsync });
      self._writeIndex(source, day, entry);
      self.entries.set(id, entry);
      self.totals.enqueued++;
      self.totals.pending++;
      self.history.totalEnqueued++;
      if (!self.history.firstEnqueuedAt) self.history.firstEnqueuedAt = entry.enqueuedAt;
      self.history.lastEnqueuedAt = entry.enqueuedAt;
      self._append(self.historyFile, { t: 'enq', id: id, seq: self.seq, at: entry.enqueuedAt }, {});
      self._updateCursor(source, captureTime, undefined,
        opts.expectedIntervalMinutes ? { expectedIntervalMinutes: opts.expectedIntervalMinutes } : undefined);
      resolve({ ok: true, id: id, duplicate: false });
    } catch (e) {
      try { self._updateCursor(source, captureTime, e); } catch (e2) {}
      resolve({ ok: false, id: id, error: String(e) });
    }
  });
};

Spool.prototype._expireLeases = function() {
  var now = Date.now();
  var expired = [];
  this.leases.forEach(function(lease, id) {
    if (lease.expiresAt && new Date(lease.expiresAt).getTime() < now) expired.push(id);
  });
  var self = this;
  expired.forEach(function(id) { self.leases.delete(id); });
};

Spool.prototype._pendingForSource = function(source) {
  this._expireLeases();
  var self = this;
  var out = [];
  this.entries.forEach(function(entry) {
    if (entry.source !== source) return;
    if (self.acked.has(entry.id) || self.dead.has(entry.id)) return;
    if (self.leases.has(entry.id)) return;
    out.push(entry);
  });
  out.sort(function(a, b) { return a.seq - b.seq; });
  return out;
};

Spool.prototype.dequeue = function(source, opts) {
  var self = this;
  opts = opts || {};
  return new Promise(function(resolve) {
    var pending = self._pendingForSource(source);
    if (pending.length === 0) return resolve(null);
    var entry = pending[0];
    var holder = opts.consumer || 'default';
    var leasedAt = new Date().toISOString();
    var expiresAt = new Date(Date.now() + self.cfg.leaseTtlMs).toISOString();
    var prev = self.leases.get(entry.id);
    var attempts = (prev ? prev.attempts : 0) + 1;
    entry.attempts = attempts;
    self._append(self.leasesFile, { id: entry.id, holder: holder, leasedAt: leasedAt, expiresAt: expiresAt }, { fsync: self.cfg.fsync });
    self.leases.set(entry.id, { holder: holder, leasedAt: leasedAt, expiresAt: expiresAt, attempts: attempts });
    self.totals.pending--;
    self.totals.leased++;
    resolve(entry);
  });
};

Spool.prototype.ack = function(id, consumer) {
  var self = this;
  return new Promise(function(resolve) {
    if (self.acked.has(id)) return resolve({ ok: true, duplicate: true });
    self._append(self.acksFile, { id: id, ackedAt: new Date().toISOString(), consumer: consumer || 'default' }, { fsync: self.cfg.fsync });
    self.acked.add(id);
    self.leases.delete(id);
    self.totals.leased = Math.max(0, self.totals.leased - 1);
    self.totals.acked++;
    self.history.totalAcked++;
    self._append(self.historyFile, { t: 'ack', id: id, at: new Date().toISOString() }, {});
    resolve({ ok: true });
  });
};

Spool.prototype.requeue = function(id, reason, opts) {
  var self = this;
  opts = opts || {};
  return new Promise(function(resolve) {
    var entry = self.entries.get(id);
    if (!entry) return resolve({ ok: false, error: 'no such entry' });
    var lease = self.leases.get(id);
    var attempts = (lease ? lease.attempts : 0) + 1;
    if (attempts >= self.cfg.attemptCap) {
      self._append(self.deadFile, { id: id, source: entry.source, captureTime: entry.captureTime, attempts: attempts, reason: String(reason || 'attempt cap'), diedAt: new Date().toISOString() }, { fsync: self.cfg.fsync });
      self.dead.add(id);
      self.leases.delete(id);
      self.totals.leased = Math.max(0, self.totals.leased - 1);
      self.totals.dead++;
      self.history.totalDead++;
      self._append(self.historyFile, { t: 'dead', id: id, at: new Date().toISOString() }, {});
      return resolve({ ok: true, dead: true, id: id });
    }
    var delay = Math.min(self.cfg.backoffBaseMs * Math.pow(2, attempts), self.cfg.backoffMaxMs);
    var leasedAt = new Date().toISOString();
    var expiresAt = new Date(Date.now() + delay).toISOString();
    self._append(self.leasesFile, { id: id, holder: 'backoff', leasedAt: leasedAt, expiresAt: expiresAt }, { fsync: self.cfg.fsync });
    self.leases.set(id, { holder: 'backoff', leasedAt: leasedAt, expiresAt: expiresAt, attempts: attempts });
    resolve({ ok: true, requeued: true, id: id, attempts: attempts, nextAttemptInMs: delay });
  });
};

Spool.prototype.peek = function(source, n) {
  var self = this;
  return new Promise(function(resolve) {
    resolve(self._pendingForSource(source).slice(0, n || 10));
  });
};

Spool.prototype.resolve = function(source, day) {
  var self = this;
  return new Promise(function(resolve) {
    var p = self._indexPath(source, day);
    var out = [];
    if (fs.existsSync(p)) {
      var raw = fs.readFileSync(p, 'utf8');
      var lines = raw.split('\n');
      for (var i = 0; i < lines.length; i++) {
        var rec = parseLine(lines[i]);
        if (rec) out.push(rec);
      }
      return resolve(out);
    }
    self.entries.forEach(function(entry) {
      if (entry.source === source && entry.day === day) out.push(entry);
    });
    out.sort(function(a, b) { return a.seq - b.seq; });
    resolve(out);
  });
};

Spool.prototype.dequeueById = function(id, opts) {
  var self = this;
  opts = opts || {};
  return new Promise(function(resolve) {
    var entry = self.entries.get(id);
    if (!entry) return resolve(null);
    if (self.acked.has(id) || self.dead.has(id)) return resolve(null);
    if (self.leases.has(id)) return resolve(null);
    var holder = opts.consumer || 'default';
    var leasedAt = new Date().toISOString();
    var expiresAt = new Date(Date.now() + self.cfg.leaseTtlMs).toISOString();
    var attempts = 1;
    self._append(self.leasesFile, { id: id, holder: holder, leasedAt: leasedAt, expiresAt: expiresAt }, { fsync: self.cfg.fsync });
    self.leases.set(id, { holder: holder, leasedAt: leasedAt, expiresAt: expiresAt, attempts: attempts });
    entry.attempts = attempts;
    resolve(entry);
  });
};

Spool.prototype.consume = function(source, day, handler, opts) {
  var self = this;
  opts = opts || {};
  return new Promise(function(resolve) {
    self.resolve(source, day).then(function(entries) {
      var pending = [];
      entries.forEach(function(e) {
        if (self.acked.has(e.id) || self.dead.has(e.id)) return;
        if (self.leases.has(e.id)) return;
        pending.push(e);
      });
      if (pending.length === 0) return resolve({ source: source, day: day, processed: 0, failed: 0 });
      var processed = 0;
      var failed = 0;
      var idx = 0;
      function next() {
        if (idx >= pending.length) return resolve({ source: source, day: day, processed: processed, failed: failed });
        var entry = pending[idx++];
        self.dequeueById(entry.id, { consumer: opts.consumer || 'consume' }).then(function(deq) {
          if (!deq) {
            self._expireLeases();
            return next();
          }
          Promise.resolve(handler(deq.payload, { source: source, day: day, captureTime: deq.captureTime, id: deq.id }))
            .then(function() { return self.ack(deq.id, opts.consumer || 'consume'); })
            .then(function() { processed++; next(); })
            .catch(function(err) {
              failed++;
              return self.requeue(deq.id, err).then(function() { next(); });
            });
        }).catch(function() { next(); });
      }
      next();
    });
  });
};

Spool.prototype.stats = function() {
  var self = this;
  return new Promise(function(resolve) {
    self._expireLeases();
    var perSource = {};
    var stale = [];
    var now = Date.now();
    self.entries.forEach(function(entry) {
      if (self.acked.has(entry.id) || self.dead.has(entry.id)) return;
      if (self.leases.has(entry.id)) return;
      if (!perSource[entry.source]) perSource[entry.source] = { pending: 0, latest: null, stale: false };
      perSource[entry.source].pending++;
      if (!perSource[entry.source].latest || entry.seq > perSource[entry.source].latest.seq) perSource[entry.source].latest = entry.captureTime;
    });
    // Staleness from cursors — scan ALL cursor files, not just pending sources.
    // Post-drain this is meaningful (cursors persist through compaction).
    var cursorFiles = [];
    if (fs.existsSync(self.cursorsDir)) {
      cursorFiles = fs.readdirSync(self.cursorsDir).filter(function(f) { return f.endsWith('.json'); });
    }
    cursorFiles.forEach(function(f) {
      var s = f.replace('.json', '');
      var curPath = path.join(self.cursorsDir, f);
      try {
        var cur = JSON.parse(fs.readFileSync(curPath, 'utf8'));
        // Retired source (agent-06 btc_rpc, 2026-08-14): a deliberately dormant
        // source's cursor never advances, so staleness would fire forever. A
        // retired cursor is expected to be stale by design — skip it.
        if (cur.retired === true) return;
        var lastSeen = new Date(cur.lastSeen).getTime();
        var ageMin = (now - lastSeen) / 60000;
        // S3b: per-source real-time window — a source is stale only after 2x of its
        // ACTUAL captured schedule (stamped by capture-agent), not a fixed wall clock.
        var thresh = self.cfg.staleAfterMinutes;
        var exp = cur.expectedIntervalMinutes || 0;
        if (exp >= 60) thresh = Math.max(thresh, 2 * exp);
        if (ageMin > thresh) {
          if (!perSource[s]) perSource[s] = { pending: 0, latest: null };
          perSource[s].stale = true;
          if (stale.indexOf(s) === -1) stale.push(s);
        }
      } catch (e) {}
    });
    var queuedBytes = fs.existsSync(self.queueFile) ? fs.statSync(self.queueFile).size : 0;
    var oldest = null;
    self.entries.forEach(function(entry) {
      if (self.acked.has(entry.id) || self.dead.has(entry.id) || self.leases.has(entry.id)) return;
      if (!oldest || entry.seq < oldest.seq) oldest = entry;
    });
    var activeLeases = 0;
    self.leases.forEach(function(lease, id) {
      if (self.acked.has(id) || self.dead.has(id)) return;
      if (!self.entries.has(id)) return;
      activeLeases++;
    });
    var totals = {
      enqueued: self.entries.size,
      acked: self.acked.size,
      dead: self.dead.size,
      leased: activeLeases,
      pending: self.entries.size - self.acked.size - self.dead.size - activeLeases,
      duplicates: self.totals.duplicates
    };
    var accountingOk = totals.enqueued === totals.acked + totals.dead + totals.leased + totals.pending;
    resolve({
      totals: totals,
      accountingOk: accountingOk,
      perSource: perSource,
      staleSources: stale,
      queueBytes: queuedBytes,
      oldestPending: oldest ? oldest.id : null,
      history: Object.assign({}, self.history),
      lastCompaction: fs.existsSync(self.metaFile) ? (JSON.parse(fs.readFileSync(self.metaFile, 'utf8')).lastCompaction || null) : null
    });
  });
};

Spool.prototype.compact = function() {
  var self = this;
  return new Promise(function(resolve) {
    self._expireLeases();
    var kept = [];
    var removed = 0;
    self.entries.forEach(function(entry) {
      if (self.acked.has(entry.id) || self.dead.has(entry.id)) { removed++; return; }
      kept.push(entry);
    });
    kept.sort(function(a, b) { return a.seq - b.seq; });
    var tmp = path.join(self.tmpDir, 'queue.jsonl.tmp');
    var content = kept.map(function(e) { return JSON.stringify(e); }).join('\n') + (kept.length ? '\n' : '');
    fs.writeFileSync(tmp, content);
    fs.renameSync(tmp, self.queueFile);
    fs.writeFileSync(self.acksFile, '');
    fs.writeFileSync(self.leasesFile, '');
    fs.writeFileSync(self.deadFile, '');
    self.acked.clear();
    self.dead.clear();
    self.leases.clear();
    var pruned = 0;
    if (self.cfg.indexTtlDays > 0) pruned = self.pruneIndex(self.cfg.indexTtlDays);
    var meta = { formatVersion: 1, lastCompaction: new Date().toISOString(), totalRemoved: removed, totalKept: kept.length, indexPruned: pruned };
    fs.writeFileSync(self.metaFile, JSON.stringify(meta, null, 2));
    self.totals.acked = 0;
    self.totals.dead = 0;
    self.totals.leased = 0;
    resolve({ removed: removed, kept: kept.length, indexPruned: pruned });
  });
};

Spool.prototype.pruneIndex = function(ttlDays) {
  if (!fs.existsSync(this.indexDir)) return 0;
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - ttlDays);
  var cutoffStr = cutoff.toISOString().slice(0, 10);
  var pruned = 0;
  var self = this;
  fs.readdirSync(this.indexDir).forEach(function(sourceDir) {
    var dir = path.join(self.indexDir, sourceDir);
    var stat;
    try { stat = fs.statSync(dir); } catch (e) { return; }
    if (!stat.isDirectory()) return;
    fs.readdirSync(dir).forEach(function(f) {
      if (!f.endsWith('.jsonl')) return;
      var day = f.replace('.jsonl', '');
      if (day < cutoffStr) {
        try { fs.unlinkSync(path.join(dir, f)); pruned++; } catch (e) {}
      }
    });
  });
  return pruned;
};

Spool.prototype.rebuildIndexFromHistory = function(entries) {
  var self = this;
  var added = 0;
  (entries || []).forEach(function(e) {
    var day = e.day || (e.captureTime ? e.captureTime.slice(0, 10) : null);
    if (!day) return;
    self._writeIndex(e.source, day, e);
    added++;
  });
  return added;
};

Spool.prototype.deadletter = function(id, reason, opts) {
  var self = this;
  return new Promise(function(resolve) {
    opts = opts || {};
    var rec = {
      id: id,
      source: opts.source || null,
      captureTime: opts.captureTime || null,
      reason: String(reason || 'unknown'),
      detail: opts.detail || null,
      producer: opts.producer || null,
      attempts: 0,
      quarantined: true,
      diedAt: new Date().toISOString()
    };
    try {
      self._append(self.deadFile, rec, { fsync: self.cfg.fsync });
      self.dead.add(id);
      self.totals.dead++;
      self.history.totalDead++;
      self._append(self.historyFile, { t: 'dead', id: id, at: new Date().toISOString() }, {});
      resolve({ ok: true, id: id, dead: true });
    } catch (e) {
      resolve({ ok: false, id: id, error: String(e) });
    }
  });
};

Spool.prototype.deadLetterList = function() {
  var self = this;
  return new Promise(function(resolve) {
    var out = [];
    if (!fs.existsSync(self.deadFile)) return resolve(out);
    var raw = fs.readFileSync(self.deadFile, 'utf8');
    var lines = raw.split('\n');
    for (var i = lines.length - 1; i >= 0; i--) {
      var rec = parseLine(lines[i]);
      if (rec) out.push(rec);
    }
    resolve(out);
  });
};

Spool.prototype.cursor = function(source) {
  var p = path.join(this.cursorsDir, source + '.json');
  if (!fs.existsSync(p)) return Promise.resolve(null);
  try { return Promise.resolve(JSON.parse(fs.readFileSync(p, 'utf8'))); }
  catch (e) { return Promise.resolve(null); }
};

Spool.prototype.updateCursor = function(source, cycleTs, err, opts) {
  this._updateCursor(source, cycleTs, err, opts);
  return Promise.resolve();
};

Spool.prototype.expireLeases = function() {
  this._expireLeases();
  return Promise.resolve();
};

function init(config) {
  var spool = new Spool(config);
  return spool.init();
}

module.exports = { init: init, Spool: Spool, idempotentKey: idempotentKey, DEFAULT_CONFIG: DEFAULT_CONFIG };
