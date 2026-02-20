import express from 'express';
import cors from 'cors';
import { OAuth2Client } from 'google-auth-library';
import dotenv from 'dotenv';
import { fetchYoutubeData, searchEvoMapForFix } from './evomapScraper.js';
import { triggerParasiticWorkflow, startVPHRadar } from './parasiticWorkflow.js';
import { synthesizeShortsVideo } from './videoSynthesisService.js';
import { uploadToYouTubeWithHealing } from './studioUploader.js';
import { startMeatGrinder } from './abMeatGrinder.js';
import db, { upsertIntent, getInterruptedIntents } from './db.js';

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

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 OAuth Server Started');
  console.log('='.repeat(60));
  console.log(`📡 Server running at http://localhost:${PORT}`);
  console.log(`🔐 Client ID: ${process.env.GOOGLE_CLIENT_ID?.substring(0, 10)}...`);
  console.log(`🔄 Redirect URI: ${process.env.GOOGLE_REDIRECT_URI}`);
  console.log('='.repeat(60));
  console.log('\nAvailable endpoints:');
  console.log('  GET  /auth/google       - Start OAuth flow');
  console.log('  GET  /oauth-callback    - OAuth callback (Google redirect)');
  console.log('  POST /auth/refresh      - Refresh access token');
  console.log('  GET  /auth/verify       - Verify access token');
  console.log('  GET  /auth/userinfo     - Get user info');
  console.log('  GET  /health            - Health check');
  console.log('='.repeat(60));

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

  // 🛰️ [V2.0 Industrial Ignition]
  startVPHRadar();
  startMeatGrinder();
});
