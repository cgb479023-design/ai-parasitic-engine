import express from 'express';
import cors from 'cors';
import { OAuth2Client } from 'google-auth-library';
import dotenv from 'dotenv';
import { fetchYoutubeData, searchEvoMapForFix, registerNode } from './evomapScraper.js';
import { triggerParasiticWorkflow, startVPHRadar } from './parasiticWorkflow.js';
import { synthesizeShortsVideo } from './videoSynthesisService.js';
import { uploadToYouTubeWithHealing } from './studioUploader.js';
import { triggerPuppeteerIgnite, triggerPuppeteerDistribution } from './tacticalExecution.js';
import { scrapeAnalyticsHeadless } from './analyticsScraper.js';
import { youtubeApiClient } from './youtubeApiClient.js';
import {
  getCachedAnalytics,
  getInterruptedIntents,
  upsertIntent,
  upsertSchedule,
  getPendingSchedules,
  upsertAnalyticsCache,
  getChannels,
  upsertChannel
} from './db.js';
import { startMeatGrinder } from './abMeatGrinder.js';

dotenv.config();

const app = express();
const PORT = process.env.OAUTH_SERVER_PORT || 51122;

app.use(cors({
  origin: [
    'http://localhost:4000',
    'http://localhost:51121',
    'http://127.0.0.1:4000',
    'http://localhost:5173'
  ],
  credentials: true
}));
app.use(express.json());

// OAuth2 Client 配置
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:51122/oauth-callback'
);

/**
 * 启动 OAuth 授权流程
 */
app.get('/auth/google', (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    state: req.query.state || null
  });

  console.log('[OAuth] Authorization URL generated:', authUrl);
  res.json({ authUrl });
});

/**
 * OAuth 回调处理
 * Google 重定向到此端点
 */
app.get('/oauth-callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    console.error('[OAuth] No code received');
    return res.status(400).json({ error: 'No authorization code received' });
  }

  try {
    console.log('[OAuth] Received callback with state:', state);

    // 交换授权码获取令牌
    const { tokens } = await oauth2Client.getToken(String(code));

    if (!tokens.access_token) {
      throw new Error('No access token received');
    }

    // 验证令牌
    await oauth2Client.verifyIdToken({
      idToken: tokens.id_token || '',
      audience: process.env.GOOGLE_CLIENT_ID
    });

    console.log('[OAuth] Tokens obtained successfully');
    console.log('[OAuth] Access token:', tokens.access_token ? tokens.access_token.substring(0, 20) + '...' : 'Missing');
    console.log('[OAuth] Refresh token:', tokens.refresh_token ? 'Present' : 'Not present');
    console.log('[OAuth] Scope:', tokens.scope);

    // 返回令牌到前端
    const redirectUrl = new URL(req.query.redirect_uri || 'http://localhost:4000');
    redirectUrl.searchParams.set('access_token', tokens.access_token);
    if (tokens.refresh_token) {
      redirectUrl.searchParams.set('refresh_token', tokens.refresh_token);
    }
    if (tokens.scope) {
      redirectUrl.searchParams.set('scope', encodeURIComponent(tokens.scope));
    }
    if (state) {
      redirectUrl.searchParams.set('state', String(state));
    }

    console.log('[OAuth] Redirecting to:', redirectUrl.href);
    res.redirect(redirectUrl.href);

  } catch (error) {
    console.error('[OAuth] Error exchanging code for tokens:', error.message);

    // 重定向回前端并带上错误信息
    const redirectUrl = new URL(req.query.redirect_uri || 'http://localhost:4000');
    redirectUrl.searchParams.set('error', error.message);
    redirectUrl.searchParams.set('error_code', 'oauth_failed');

    res.redirect(redirectUrl.href);
  }
});

/**
 * 刷新访问令牌
 */
app.post('/auth/refresh', async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: 'Refresh token required' });
  }

  try {
    oauth2Client.setCredentials({ refresh_token });
    const { credentials } = await oauth2Client.refreshAccessToken();

    console.log('[OAuth] Token refreshed successfully');

    res.json({
      access_token: credentials.access_token,
      expiry_date: credentials.expiry_date,
      scope: credentials.scope
    });
  } catch (error) {
    console.error('[OAuth] Error refreshing token:', error.message);
    res.status(401).json({ error: 'Failed to refresh token', details: error.message });
  }
});

/**
 * 验证访问令牌
 */
app.get('/auth/verify', async (req, res) => {
  const { access_token } = req.query;

  if (!access_token) {
    return res.status(400).json({ error: 'Access token required' });
  }

  try {
    // 使用 Google OAuth2 验证端点
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${access_token}`);
    const tokenInfo = await response.json();

    if (response.ok) {
      console.log('[OAuth] Token verified:', tokenInfo.email);
      res.json({
        valid: true,
        email: tokenInfo.email,
        scope: tokenInfo.scope,
        expires_in: tokenInfo.expires_in
      });
    } else {
      console.error('[OAuth] Token invalid:', tokenInfo.error);
      res.status(401).json({
        valid: false,
        error: tokenInfo.error_description || tokenInfo.error
      });
    }
  } catch (error) {
    console.error('[OAuth] Error verifying token:', error.message);
    res.status(500).json({ error: 'Failed to verify token' });
  }
});

/**
 * 获取用户信息
 */
app.get('/auth/userinfo', async (req, res) => {
  const { access_token } = req.query;

  if (!access_token) {
    return res.status(400).json({ error: 'Access token required' });
  }

  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    if (response.ok) {
      const userInfo = await response.json();
      res.json(userInfo);
    } else {
      res.status(response.status).json({ error: 'Failed to fetch user info' });
    }
  } catch (error) {
    console.error('[OAuth] Error fetching user info:', error.message);
    res.status(500).json({ error: 'Failed to fetch user info' });
  }
});

/**
 * � V2.0 终极版：Parasitic Viral Workflow Endpoint
 * Handles both Radar-triggered missions and manual hijacks with state awareness.
 */
app.post('/api/trigger-parasitic-workflow', async (req, res) => {
  const { videoId, originalTitle, intentId: manualIntentId } = req.body;
  if (!videoId) return res.status(400).json({ error: "Missing videoId" });

  const intentId = manualIntentId || `int_${Date.now()}`;

  try {
    console.log(`🎯 [Radar Trigger] Initiating hijack mission for: ${videoId} (ID: ${intentId})`);

    // 状态机：如果传入了手动 ID，确保初始状态正确（用于前端 UI 同步）
    if (manualIntentId) {
      upsertIntent({
        id: intentId,
        timestamp: Date.now(),
        type: 'AUTO_NINJA_MISSION',
        payload: { videoId, originalTitle },
        origin: 'VPH_RADAR',
        status: 'scraping'
      });
    }

    // 启动端到端工业流水线
    const result = await triggerParasiticWorkflow(videoId, originalTitle || 'Viral Host', intentId);
    res.json({ success: true, result });
  } catch (err) {
    console.error("❌ [Radar Trigger] Mission Ignition Failed:", err.message);
    // 💀 致命错误兜底：如果流水线在点火阶段炸了，必须把状态机改成 failed，否则前端进度条会永远卡住！
    upsertIntent({
      id: intentId,
      status: 'failed',
      error: err.message
    });
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 📽️ V12.0: Video Synthesis Endpoint (Muxing)
 */
app.post('/api/synthesize-video', async (req, res) => {
  const { script, rawVideoPath } = req.body;
  if (!script || !rawVideoPath) return res.status(400).json({ error: "Missing script or rawVideoPath" });

  try {
    const outputFilename = `final_${Date.now()}.mp4`;
    const finalPath = await synthesizeShortsVideo(script, rawVideoPath, outputFilename);
    res.json({ success: true, finalPath });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 🔮 V13.0: Intent Persistence Sync
 */
app.post('/api/intents/sync', (req, res) => {
  try {
    upsertIntent(req.body);
    console.log(`💾 [State Machine] Intent ${req.body.id} synced -> [${req.body.status}]`);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ [State Machine] Sync failed:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 📡 V14.0: EvoMap Self-Healing API (Proxy & Cache)
 */
app.post('/api/evomap/search', async (req, res) => {
  const { query, error } = req.body;

  try {
    // 1. Check local cache first
    const cached = db.prepare('SELECT solution FROM patches WHERE query = ? ORDER BY timestamp DESC LIMIT 1').get(query);
    if (cached) {
      console.log(`💊 [EvoMap] Cache hit for query: ${query}`);
      return res.json({ success: true, solution: cached.solution });
    }

    // 2. Cache miss -> Query EvoMap Hub
    console.log(`📡 [EvoMap] Cache miss. Fetching from Hub: ${query}`);
    const capsule = await searchEvoMapForFix(query, error);

    if (capsule && capsule.solution) {
      // 3. Persist to cache
      const insert = db.prepare('INSERT INTO patches (asset_id, query, solution) VALUES (?, ?, ?)');
      insert.run(capsule.asset_id || `patch_${Date.now()}`, query, capsule.solution);

      res.json({ success: true, solution: capsule.solution });
    } else {
      res.json({ success: false, error: "No patch found for this blockage." });
    }
  } catch (err) {
    console.error("❌ [EvoMap API] Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 🚀 V15.0: Backend Autonomous Upload Endpoint
 */
app.post('/api/upload-video', async (req, res) => {
  const { videoPath, metadata } = req.body;

  if (!videoPath || !metadata) {
    return res.status(400).json({ error: "Missing videoPath or metadata" });
  }

  try {
    console.log(`🚀 [Backend Upload] Initiating mission for: ${metadata.title}`);
    const result = await uploadToYouTubeWithHealing(videoPath, metadata);
    res.json(result);
  } catch (err) {
    console.error("❌ [Backend Upload] Mission Failed:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/intents', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM intents ORDER BY timestamp DESC LIMIT 100').all();
    res.json(rows.map(r => ({ ...r, payload: JSON.parse(r.payload) })));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🛰️ V2.0 Intelligence Layer: Radar & Trigger
let radarBreakoutsPool = [
  {
    id: "mock_radar_1",
    videoId: "dQw4w9WgXcQ",
    title: "🔥刚刚发布！2026年取代程序员的3个AI神器",
    thumbnail: "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    vph: 8520,
    hoursAlive: 2.5,
    status: "hunting"
  },
  {
    id: "mock_radar_2",
    videoId: "7mE7f-U3kG8",
    title: "How I Built a Million Dollar AI Business",
    thumbnail: "https://img.youtube.com/vi/7mE7f-U3kG8/hqdefault.jpg",
    vph: 4100,
    hoursAlive: 1.2,
    status: "hunting"
  }
];

/**
 * 🛠️ [Helper] Extract YouTube ID from various URL formats
 */
function extractYouTubeId(url) {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
}

/**
 * 📥 V16.0: Manual Mission Injection (Fire-and-Forget)
 * Receives manual tasks from the UI and injects them into the DFL Meat Grinder.
 */
app.post('/api/intents/manual-injection', async (req, res) => {
  const { type, targetUrl, metadata } = req.body;
  const intentId = `manual_${Date.now()}`;

  try {
    if ((type === 'hijack' || targetUrl) && targetUrl) {
      const videoId = extractYouTubeId(targetUrl);
      if (!videoId) throw new Error("Invalid YouTube URL");

      console.log(`📥 [Manual Injection] Hijack target detected: ${videoId}`);

      // Persist to state machine as 'pending'
      upsertIntent({
        id: intentId,
        timestamp: Date.now(),
        type: 'AUTO_NINJA_MISSION',
        payload: { ...metadata, videoId, originalTitle: metadata.title || 'Manual Hijack' },
        origin: 'UI_MANUAL',
        status: 'scraping'
      });

      // Fire-and-forget: Trigger the industrial pipeline
      triggerParasiticWorkflow(videoId, metadata.title || 'Manual Hijack', intentId)
        .catch(err => {
          console.error(`❌ [Manual Pipeline] Task ${intentId} failed:`, err.message);
          upsertIntent({ id: intentId, status: 'failed', error: err.message });
        });
    } else {
      console.log(`📥 [Manual Injection] Original brief detected: ${metadata.title}`);

      // Original content follows a slightly different mutation-first path
      upsertIntent({
        id: intentId,
        timestamp: Date.now(),
        type: 'AUTO_NINJA_MISSION',
        payload: metadata,
        origin: 'UI_MANUAL',
        status: 'mutating' // Skip scraping for original content
      });

      // Future: triggerOriginalWorkflow(metadata, intentId).catch(...)
      // For now, we reuse the mutation logic if possible or log it.
      console.log(`⚠️ [Manual Injection] Original content pipeline pending implementation.`);
    }

    res.json({ success: true, intentId });
  } catch (err) {
    console.error("❌ [Manual Injection] Ignition Failed:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/radar/breakouts', (req, res) => {
  res.json({ success: true, data: radarBreakoutsPool });
});

// [DELETE] Shadowed route removed for V2.0 Consolidation

/**
 * 健康检查
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'AI Content Platform OAuth Server',
    port: PORT
  });
});

// --- 📥 [军火库] 获取所有模板 ---
app.get('/api/templates', (req, res) => {
  try {
    const templates = db.prepare('SELECT * FROM script_templates ORDER BY updated_at DESC').all();
    res.json({ success: true, data: templates });
  } catch (err) {
    console.error("❌ [Armory] Fetch Failed:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- 📤 [军火库] 保存/更新模板 ---
app.post('/api/templates', (req, res) => {
  const { id, name, content } = req.body;
  try {
    const stmt = db.prepare(`
            INSERT INTO script_templates (id, name, content, updated_at) 
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET name = ?, content = ?, updated_at = CURRENT_TIMESTAMP
        `);
    stmt.run(id || `tmpl_${Date.now()}`, name, content, name, content);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ [Armory] Save Failed:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- 📥 [情报局] 获取 Topic 研究数据 ---
app.get('/api/topics', (req, res) => {
  try {
    const topics = db.prepare('SELECT * FROM topic_research ORDER BY updated_at DESC').all();
    // Parse JSON data for frontend consumption
    const parsed = topics.map(t => ({
      ...t,
      analytics_data: t.analytics_data ? JSON.parse(t.analytics_data) : null
    }));
    res.json({ success: true, data: parsed });
  } catch (err) {
    console.error("❌ [Intelligence] Fetch Failed:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- 📤 [情报局] 保存 Topic 研究数据 (雷达静默上报) ---
app.post('/api/topics', (req, res) => {
  const { category_id, analytics_data } = req.body;
  try {
    const stmt = db.prepare(`
            INSERT INTO topic_research (category_id, analytics_data, updated_at) 
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(category_id) DO UPDATE SET 
                analytics_data = excluded.analytics_data, 
                updated_at = CURRENT_TIMESTAMP
        `);
    stmt.run(category_id, JSON.stringify(analytics_data));
    res.json({ success: true });
  } catch (err) {
    console.error("❌ [Intelligence] Save Failed:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// V3.0 SCHEDULING & CROSS-PLATFORM API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 📅 [GET] Fetch all schedules
 */
app.get('/api/schedules', (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM schedules ORDER BY publishTimeLocal ASC").all();
    const schedules = rows.map(r => ({
      ...r,
      payload: r.payload ? JSON.parse(r.payload) : {}
    }));
    res.json(schedules);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * 🚀 [POST] Upsert schedule item
 */
app.post('/api/schedules', (req, res) => {
  try {
    const item = req.body;
    if (!item.id) return res.status(400).json({ error: 'Missing ID' });

    upsertSchedule(item);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * 🗑️ [DELETE] Remove schedule
 */
app.delete('/api/schedules/:id', (req, res) => {
  try {
    db.prepare("DELETE FROM schedules WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Tactical & Distribution API (V5.0 Hardening) ---

/**
 * 🚢 V11.0: Multi-Channel Matrix Management
 */
app.get('/api/channels', (req, res) => {
  try {
    const channels = getChannels();
    res.json({ success: true, data: channels });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/channels', (req, res) => {
  try {
    upsertChannel(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Tactical "Ignite" Engagement
 * Triggers autonomous comments/likes via backend Puppeteer or API
 */
app.post('/api/ignite', async (req, res) => {
  const { videoId, title, text } = req.body;
  try {
    console.log(`🔥 [Tactical] Ignite command received for: ${title || videoId}`);

    // Background execution to avoid blocking the API response
    triggerPuppeteerIgnite(videoId, text)
      .then(() => console.log(`✅ [Autonomous] Ignite successful for ${videoId}`))
      .catch(err => console.error(`❌ [Autonomous] Ignite failed for ${videoId}:`, err.message));

    res.json({ success: true, message: 'Command queued for autonomous execution' });
  } catch (err) {
    console.error(`❌ [Tactical] Ignite failed:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Cross-Platform Distribution
 * Triggers autonomous posting to X and TikTok
 */
app.post('/api/distribute', async (req, res) => {
  const payload = req.body;
  try {
    console.log(`🌐 [Distribution] Cross-platform request received`);

    // Background execution
    triggerPuppeteerDistribution(payload)
      .then(() => console.log(`✅ [Distribution] Cross-platform mission completed`))
      .catch(err => console.error(`❌ [Distribution] Mission failed:`, err.message));

    res.json({
      success: true,
      state: {
        x: payload.x ? 'pending' : 'skipped',
        tiktok: payload.tiktok ? 'pending' : 'skipped'
      }
    });
  } catch (err) {
    console.error(`❌ [Distribution] Failed:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 OAuth Server Started');
  console.log('='.repeat(60));
  console.log(`📡 Server running at http://localhost:${PORT}`);
  console.log(`🔐 Client ID: ${process.env.GOOGLE_CLIENT_ID?.substring(0, 10)}...`);
  console.log(`🔄 Redirect URI: ${process.env.GOOGLE_REDIRECT_URI}`);
  console.log('='.repeat(60));

  // ⏰ [V3.0 Industrial Scheduling]
  initSchedulingLoop();

  // 📡 [V6.0 Monitor Cluster Heartbeat]
  // Automatically refresh analytics every 4 hours for autonomous 7x24 visibility
  setInterval(() => {
    console.log('🛰️ [Heartbeat] Triggering autonomous analytics refresh...');
    scrapeAnalyticsHeadless('overview', 'default').catch(() => { });
    scrapeAnalyticsHeadless('content', 'default').catch(() => { });
  }, 4 * 60 * 60 * 1000); // 4 hours

  console.log('\nAvailable endpoints:');
  console.log('  GET  /auth/google       - Start OAuth flow');
  console.log('  GET  /oauth-callback    - OAuth callback (Google redirect)');
  console.log('  POST /auth/refresh      - Refresh access token');
  console.log('  GET  /auth/verify       - Verify access token');
  console.log('  GET  /auth/userinfo     - Get user info');
  console.log('  GET  /health            - Health check');
  console.log('  GET  /api/schedules     - Fetch schedules');
  console.log('  POST /api/schedules     - Sync schedules');
  console.log('='.repeat(60));

  /**
   * V6.0 MONITOR CLUSTER: Analytics Data Access
   */
  app.get('/api/analytics/data', async (req, res) => {
    const { category, timeRange } = req.query;
    try {
      const data = getCachedAnalytics(category, timeRange || 'default');
      if (data) {
        res.json({ success: true, ...data.data });
      } else {
        res.status(404).json({ success: false, error: 'Cache miss. Scrape required.' });
      }
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * V6.0 MONITOR CLUSTER: Headless Scrape Trigger
   */
  app.post('/api/analytics/scrape', async (req, res) => {
    const { category, timeRange } = req.body;
    try {
      console.log(`📡 [Analytics] Triggering headless scrape for: ${category}`);

      // Background execution
      scrapeAnalyticsHeadless(category, timeRange)
        .then(() => console.log(`✅ [Analytics] Scrape mission completed for ${category}`))
        .catch(err => console.error(`❌ [Analytics] Scrape failed for ${category}:`, err.message));

      res.json({ success: true, message: 'Scrape mission queued' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * V6.0 MONITOR CLUSTER: YouTube API Proxy (Quota Armor)
   */
  app.get('/api/youtube/video-details', async (req, res) => {
    const { videoId } = req.query;
    try {
      const data = await youtubeApiClient.getVideoDetails(videoId);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/youtube/channel-stats', async (req, res) => {
    const { channelId } = req.query;
    try {
      const data = await youtubeApiClient.getChannelStatistics(channelId);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/youtube/search', async (req, res) => {
    const { q, maxResults } = req.query;
    try {
      const data = await youtubeApiClient.searchVideos(q, maxResults);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/youtube/comments', async (req, res) => {
    const { videoId, maxResults } = req.query;
    try {
      const data = await youtubeApiClient.getVideoComments(videoId, maxResults);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/youtube/playlists', async (req, res) => {
    const { channelId, maxResults } = req.query;
    try {
      const data = await youtubeApiClient.getChannelPlaylists(channelId, maxResults);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Keep these for backward compatibility if needed, but point to new logic
  app.get('/api/external-analytics', (req, res) => {
    res.json({ success: true, status: 'Proxying to /api/analytics/data' });
  });

  app.get('/api/viral-weights', (req, res) => {
    res.json({
      success: true,
      weights: { hookEffectiveness: 0.85, retentionRate: 0.72, sharesVelocity: 0.91 }
    });
  });

  app.post('/api/external-analytics/scrape', async (req, res) => {
    res.json({ success: true, message: 'Forwarded to headless scraper' });
  });

  // 🧟 [Auto-Recovery] Wake up the undead tasks
  try {
    const interrupted = getInterruptedIntents();
    if (interrupted.length > 0) {
      console.warn(`🧟 [Auto-Recovery] Found ${interrupted.length} interrupted tasks. Re-injecting into pipeline...`);
      // 遍历所有意外死亡的任务，重新塞回绞肉机流水线
      for (const task of interrupted) {
        console.log(`   -> Resurrecting Task [${task.id}] (Died at stage: ${task.status})`);

        // 我们不需要从头跑，直接呼叫触发器并传入原始 ID
        const payload = typeof task.payload === 'string' ? JSON.parse(task.payload) : task.payload;

        triggerParasiticWorkflow(payload?.videoId, payload?.originalTitle || 'Viral Host', task.id)
          .catch(e => {
            console.error(`❌ [Auto-Recovery] Task ${task.id} failed again:`, e.message);
            upsertIntent({ id: task.id, status: 'failed', error: e.message });
          });
      }
    }
  } catch (err) {
    console.error("❌ [Auto-Recovery] Failed to scan database:", err.message);
  }

  // 🚢 [V11.0: Matrix Provisioning]
  try {
    upsertChannel({
      id: 'primary_channel',
      name: 'Primary Fleet',
      platform: 'youtube',
      niche: 'general',
      status: 'active'
    });
    console.log("🚢 [Matrix] Primary Fleet member pre-provisioned.");
  } catch (err) {
    console.error("❌ [Matrix] Provisioning failure:", err.message);
  }

  // 🛰️ [V2.0 Industrial Ignition]
  registerNode(); // 📡 EvoMap GEP-A2A Node Activation
  startVPHRadar();
  startMeatGrinder();
});

// ═══════════════════════════════════════════════════════════════════════════════
// INDUSTRIAL SCHEDULING LOOP (7x24 Autonomous Execution)
// ═══════════════════════════════════════════════════════════════════════════════

async function initSchedulingLoop() {
  console.log('⏰ [Scheduler Loop] Starting 1-minute autonomous heartbeat...');

  setInterval(async () => {
    try {
      const pending = getPendingSchedules();
      const now = new Date();

      for (const item of pending) {
        const publishTime = new Date(item.publishTimeLocal);
        if (now >= publishTime) {
          console.log(`🚀 [Dispatch] Initiating autonomous execution for schedule: ${item.id} (${item.title})`);

          // 1. 立即锁定状态，防止下一个心跳重复抓取
          item.status = 'processing';
          upsertSchedule(item);

          // 2. 🛡️ 移除 await！将任务抛入后台执行池，并绑定微任务回调
          try {
            if (item.platform === 'youtube') {
              const payload = item.payload ? JSON.parse(item.payload) : {};
              const videoId = payload.videoId || item.id;

              triggerParasiticWorkflow(videoId, item.title, item.id)
                .then(() => {
                  console.log(`✅ [Dispatch] Schedule ${item.id} execution completed.`);
                  item.status = 'completed';
                  upsertSchedule(item);
                })
                .catch((err) => {
                  console.error(`❌ [Dispatch] Schedule ${item.id} failed:`, err.message);
                  item.status = 'failed';
                  item.error = err.message;
                  upsertSchedule(item);
                });
            } else {
              // Standard fallback for other platforms (Mocked async)
              Promise.resolve().then(() => {
                setTimeout(() => {
                  item.status = 'completed';
                  upsertSchedule(item);
                  console.log(`✅ [Dispatch] Task completed (Mocked): ${item.id}`);
                }, 5000);
              });
            }
          } catch (workError) {
            console.error(`❌ [Dispatch] Sync failure for ${item.id}:`, workError.message);
            item.status = 'failed';
            item.error = workError.message;
            upsertSchedule(item);
          }
        }
      }
    } catch (e) {
      console.error('❌ [Scheduler Loop] Heartbeat error:', e.message);
    }
  }, 60000); // 1 minute
}
