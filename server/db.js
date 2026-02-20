// h:\AI_Neural_Engine_Clean_v3.5\server\db.js
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbName = process.env.NODE_ENV === 'test' ? 'platform.test.db' : 'platform.db';
const dbPath = path.join(__dirname, dbName);

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
    target_channel_id TEXT, -- V11.0 Empire Expansion
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    platform TEXT DEFAULT 'youtube',
    niche TEXT,
    cookies TEXT, -- 专属无头浏览器 Session (JSON 字符串)
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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

  -- 军火库：存储爆款文案/分镜模板
  CREATE TABLE IF NOT EXISTS script_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT,
      category TEXT,
      content TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 情报局：存储雷达抓取到的频道 Topic 数据
  CREATE TABLE IF NOT EXISTS topic_research (
      category_id TEXT PRIMARY KEY,
      analytics_data TEXT, -- JSON 格式存储胜率和图表数据
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- V3.0 schedules: Industrial durability for Calendar & Tasks
  CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    title TEXT,
    publishTimeLocal TEXT,
    status TEXT,
    platform TEXT,
    payload TEXT,
    error TEXT,
    target_channel_id TEXT DEFAULT 'primary_channel',
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- V6.0 MONITOR CLUSTER: Headless Scraper Cache
  CREATE TABLE IF NOT EXISTS analytics_cache (
    category TEXT,
    time_range TEXT,
    data TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (category, time_range)
  );
`);

// 🛡️ [V11.0 Matrix Expansion] Column injection to existing databases
try {
  db.exec(`ALTER TABLE intents ADD COLUMN target_channel_id TEXT DEFAULT 'primary_channel'`);
  db.exec(`ALTER TABLE schedules ADD COLUMN target_channel_id TEXT DEFAULT 'primary_channel'`);
  try { db.exec(`ALTER TABLE channels ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`); } catch (e) { }
  console.log("🛠️ [Database Ordnance] Fleet matrix columns successfully migrated.");
} catch (e) {
  // Column already exists, suppressing error
}


/**
 * 🛡️ [State Machine] Upsert Intent for 7x24 Mission Continuity
 */
export function upsertIntent(intent) {
  const { id, timestamp, type, payload, origin, status, error, target_channel_id } = intent;
  const stmt = db.prepare(`
    INSERT INTO intents (id, timestamp, type, payload, origin, status, error, target_channel_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      error = excluded.error,
      target_channel_id = COALESCE(excluded.target_channel_id, intents.target_channel_id),
      updated_at = CURRENT_TIMESTAMP
  `);

  return stmt.run(id, timestamp, type, JSON.stringify(payload), origin, status, error || null, target_channel_id || null);
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

export function upsertSchedule(item) {
  const { id, title, publishTimeLocal, status, platform, payload, error, target_channel_id } = item;
  const stmt = db.prepare(`
        INSERT INTO schedules (id, title, publishTimeLocal, status, platform, payload, error, target_channel_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            publishTimeLocal = excluded.publishTimeLocal,
            status = excluded.status,
            platform = excluded.platform,
            payload = excluded.payload,
            error = excluded.error,
            target_channel_id = COALESCE(excluded.target_channel_id, schedules.target_channel_id),
            last_updated = CURRENT_TIMESTAMP
    `);
  return stmt.run(id, title, publishTimeLocal, status, platform, JSON.stringify(payload || {}), error || null, target_channel_id || null);
}

export function getPendingSchedules() {
  return db.prepare("SELECT * FROM schedules WHERE status = 'scheduled'").all();
}

/**
 * V6.0 MONITOR CLUSTER: Upsert Analytics Cache
 */
export function upsertAnalyticsCache(category, timeRange, data) {
  const stmt = db.prepare(`
        INSERT INTO analytics_cache (category, time_range, data, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(category, time_range) DO UPDATE SET
            data = excluded.data,
            updated_at = CURRENT_TIMESTAMP
    `);
  return stmt.run(category, timeRange, JSON.stringify(data));
}

/**
 * V6.0 MONITOR CLUSTER: Get Cached Analytics
 */
export function getCachedAnalytics(category, timeRange) {
  const row = db.prepare("SELECT * FROM analytics_cache WHERE category = ? AND time_range = ?").get(category, timeRange);
  return row ? { ...row, data: JSON.parse(row.data) } : null;
}

/**
 * V11.0 MATRIX EXPANSION: Channel Management
 */
export function upsertChannel(channel) {
  const { id, name, platform, niche, cookies, status } = channel;
  const stmt = db.prepare(`
    INSERT INTO channels (id, name, platform, niche, cookies, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      platform = excluded.platform,
      niche = excluded.niche,
      cookies = COALESCE(excluded.cookies, channels.cookies),
      status = excluded.status
  `);
  return stmt.run(id, name, platform || 'youtube', niche, cookies || null, status || 'active');
}

export function getChannels() {
  return db.prepare('SELECT * FROM channels WHERE status = "active" ORDER BY created_at DESC').all();
}

export function getChannel(id) {
  return db.prepare("SELECT * FROM channels WHERE id = ?").get(id);
}

/**
 * 🔒 [Fleet Security] Rate Limit Monitor
 * Counts completed missions for a specific channel within an hour/day window.
 */
export function getChannelMissionCount(channelId, windowMinutes = 60) {
  const row = db.prepare(`
    SELECT COUNT(*) as count FROM intents 
    WHERE target_channel_id = ? 
    AND status = 'completed'
    AND updated_at > datetime('now', ?)
  `).get(channelId, `-${windowMinutes} minutes`);
  return row ? row.count : 0;
}

export default db;
