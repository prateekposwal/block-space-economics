CREATE TABLE IF NOT EXISTS captures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  captured_at TEXT NOT NULL,          -- ISO 8601
  source TEXT NOT NULL,               -- endpoint key (fees, mempool, etc.)
  endpoint_url TEXT,                  -- full URL fetched
  status INTEGER,                     -- HTTP status
  latency_ms INTEGER,                 -- response time
  json_data TEXT,                     -- full response (for server captures)
  minimized_data TEXT,                -- minimized version (for browser captures)
  file_path TEXT,                     -- original flat file path
  cycle_id INTEGER,                   -- reference to capture cycle
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_captures_source ON captures(source);
CREATE INDEX IF NOT EXISTS idx_captures_time ON captures(captured_at);
CREATE INDEX IF NOT EXISTS idx_captures_source_time ON captures(source, captured_at);

CREATE TABLE IF NOT EXISTS cycles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  endpoint_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  total_latency_ms INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS block_stats (
  height INTEGER PRIMARY KEY,
  hash TEXT,
  timestamp TEXT,
  tx_count INTEGER,
  size INTEGER,
  weight INTEGER,
  avg_fee_sats REAL,
  avg_fee_rate_satvb REAL,
  fee_percentiles TEXT,               -- JSON array [p10,p25,p50,p75,p90]
  subsidy_btc REAL,
  utxo_size_inc INTEGER,              -- getblockstats → utxo_size_inc (net UTXO set delta, bytes)
  miner TEXT,
  captured_at TEXT DEFAULT (datetime('now'))
);

-- ⚠️ DORMANT — DO NOT BUILD ON (marked 2026-08-14).
-- This table has schema but 0 rows and NO writer. It was designed for
-- per-tx classification (segwit/legacy/inscription) fed by a local
-- Bitcoin Core (btc-rpc) spool source that never synced (blocks:0 /
-- pruneHeight:0). The tx-type question is now answered by the
-- block_adoption capture source (tools/data-engineering/block-adoption-collect.js)
-- with 1/100th the infra: authoritative SegWit share from block summaries +
-- a bounded uniform Taproot spend sample classified by
-- vin[].prevout.scriptpubkey_type. Do NOT repoint new work here; extend
-- block_adoption instead. Kept (not deleted) for history.
CREATE TABLE IF NOT EXISTS transactions (
  txid TEXT PRIMARY KEY,
  block_height INTEGER,
  block_hash TEXT,
  fee_sats INTEGER,
  vsize INTEGER,
  fee_rate_satvb REAL,
  tx_type TEXT,                       -- 'segwit', 'legacy', 'inscription'
  is_coinbase INTEGER DEFAULT 0,
  input_count INTEGER DEFAULT 0,
  output_count INTEGER DEFAULT 0,
  total_output_sats INTEGER DEFAULT 0,
  weight INTEGER DEFAULT 0,
  captured_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (block_height) REFERENCES block_stats(height)
);

CREATE INDEX IF NOT EXISTS idx_tx_block ON transactions(block_height);
CREATE INDEX IF NOT EXISTS idx_tx_type ON transactions(tx_type);
CREATE INDEX IF NOT EXISTS idx_tx_fee_rate ON transactions(fee_rate_satvb);

CREATE TABLE IF NOT EXISTS research_findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent TEXT,
  source TEXT,
  title TEXT,
  finding TEXT NOT NULL,
  details TEXT,
  confidence REAL DEFAULT 0.5,
  category TEXT DEFAULT 'general',
  url TEXT,
  cycle_id INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE VIEW IF NOT EXISTS latest_fees AS
  SELECT c.captured_at, 
    json_extract(c.json_data, '$.fastestFee') as fastest,
    json_extract(c.json_data, '$.halfHourFee') as half_hour,
    json_extract(c.json_data, '$.hourFee') as hour_fee,
    json_extract(c.json_data, '$.economyFee') as economy,
    json_extract(c.json_data, '$.minimumFee') as minimum
  FROM captures c 
  WHERE c.source = 'fees' 
  ORDER BY c.captured_at DESC LIMIT 1;

CREATE VIEW IF NOT EXISTS fee_trend_24h AS
  SELECT date(captured_at) as day, 
    strftime('%H', captured_at) as hour,
    COUNT(*) as samples,
    AVG(json_extract(json_data, '$.fastestFee')) as avg_fastest,
    AVG(json_extract(json_data, '$.economyFee')) as avg_economy,
    MIN(json_extract(json_data, '$.economyFee')) as min_economy,
    MAX(json_extract(json_data, '$.fastestFee')) as max_fastest
  FROM captures 
  WHERE source = 'fees' 
    AND captured_at >= datetime('now', '-1 day')
  GROUP BY day, hour;
