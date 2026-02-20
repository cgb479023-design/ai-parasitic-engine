// h:\AI_Neural_Engine_Clean_v3.5\server\db.js
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'platform.db');

const db = new Database(dbPath, { verbose: null });

// 🚀 PHYSCIAL MEMORY COHESION: WAL Mode for High-Speed Automation
db.pragma('journal_mode = WAL');

// Initialize Tables: The Intent State Machine
db.exec(`
  CREATE TABLE IF NOT EXISTS intents (
    id TEXT PRIMARY KEY,
    timestamp INTEGER,
    type TEXT,
    payload TEXT,
    origin TEXT,
    status TEXT, -- pending, scraping, mutating, muxing, uploading, completed, failed
    error TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS viral_contents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    videoId TEXT,
    title TEXT,
    script TEXT,
    assets TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS patches (
    asset_id TEXT PRIMARY KEY,
    query TEXT,
    solution TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS viral_content_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_content_id INTEGER,
    type TEXT, -- title, thumbnail_prompt
    content TEXT,
    is_active INTEGER DEFAULT 0,
    performance_ctr REAL DEFAULT 0,
    FOREIGN KEY(parent_content_id) REFERENCES viral_contents(id)
  );

  CREATE TABLE IF NOT EXISTS performance_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    videoId TEXT,
    ctr REAL,
    views INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

/**
 * 🛡️ [State Machine] Upsert Intent for 7x24 Mission Continuity
 */
export function upsertIntent(intent) {
  const { id, timestamp, type, payload, origin, status, error } = intent;
  const stmt = db.prepare(`
    INSERT INTO intents (id, timestamp, type, payload, origin, status, error, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      error = excluded.error,
      updated_at = CURRENT_TIMESTAMP
  `);

  return stmt.run(id, timestamp, type, JSON.stringify(payload), origin, status, error || null);
}

/**
 * 🧟 [Auto-Recovery] Fetch tasks that were interrupted during execution
 */
export function getInterruptedIntents() {
  return db.prepare(`
    SELECT * FROM intents 
    WHERE status IN ('processing', 'scraping', 'mutating', 'muxing', 'uploading')
    AND updated_at < datetime('now', '-5 minutes') -- Only stale tasks
  `).all();
}

console.log('✅ Industrial State Machine Initialized at:', dbPath);

export default db;
