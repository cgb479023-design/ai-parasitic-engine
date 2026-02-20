// h:\AI_Neural_Engine_Clean_v3.5\server\parasiticWorkflow.js
import { fetchYoutubeData } from './evomapScraper.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { synthesizeShortsVideo } from './videoSynthesisService.js';
import { uploadToYouTubeWithHealing } from './studioUploader.js';
import { upsertIntent, getChannels, getChannelMissionCount } from './db.js';
import { validateMutationOutput } from './validators.js';
import db from './db.js';
import fs from 'fs';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const IS_E2E_TEST = process.env.NODE_ENV === 'test';

const RADAR_INTERVAL = 60 * 60 * 1000; // 1 Hour
const VPH_THRESHOLD = 5000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 🏭 V2.0 Industrial Multi-Modal Pipeline
 * Realizes the Master-Slave inversion by driving everything from the backend.
 */
export async function triggerParasiticWorkflow(videoId, originalTitle, existingIntentId = null, targetChannelId = null) {
    const intentId = existingIntentId || `int_${Date.now()}`;
    const intent = {
        id: intentId,
        timestamp: Date.now(),
        type: 'AUTO_NINJA_MISSION',
        payload: { videoId, originalTitle },
        origin: 'VPH_RADAR',
        status: 'scraping',
        target_channel_id: targetChannelId // V11.0 Expansion
    };

    try {
        // Initial state persistence
        upsertIntent(intent);
        console.log(`\n🕸️ [Industrial Pipeline] Mission ID: ${intentId} | Target: ${videoId}`);

        if (IS_E2E_TEST) {
            console.log("🧪 [MOCK MODE] Simulating zero-cost industrial loop...");
            await sleep(2000);

            intent.status = 'mutating';
            upsertIntent(intent);
            await sleep(3000);

            intent.status = 'muxing';
            upsertIntent(intent);
            await sleep(4000);

            intent.status = 'uploading';
            upsertIntent(intent);
            await sleep(3000);

            intent.status = 'completed';
            upsertIntent(intent);
            console.log("🧪 [MOCK MODE] Simulation successful.");
            return { success: true, intentId, mock: true };
        }

        // 1. Scraping (EvoMap Hardened)
        console.log(`[Step 1] Scraping host essence...`);
        const hostData = await fetchYoutubeData(`https://www.youtube.com/watch?v=${videoId}`);
        if (!hostData?.transcript) throw new Error("Empty host genome.");

        // 2. Mutation (Gemini Core)
        intent.status = 'mutating';
        upsertIntent(intent);
        console.log(`[Step 2] Mutating viral code with Gemini...`);
        const viralAssets = await mutateWithGemini(originalTitle, hostData.transcript);

        // 🛡️ [Quality Gate] Constitution Check
        validateMutationOutput(viralAssets);

        // 3. Synthesis (Module 1: Visual & Vocal Reconstruction)
        intent.status = 'muxing';
        upsertIntent(intent);
        console.log(`[Step 3] Local Synthesis (ElevenLabs + FFmpeg)...`);
        // Assuming a default raw footage path for now, in a real env this would be dynamically sourced
        const rawFootagePath = './assets/base_shorts_footage.mp4';
        const outputFilename = `final_${intentId}.mp4`;
        const finalVideoPath = await synthesizeShortsVideo(viralAssets.full_script, rawFootagePath, outputFilename);

        // 4. Uploading (Module 2: Bulletproof Uploader)
        intent.status = 'uploading';
        upsertIntent(intent);

        // 🔒 [Fleet Security] Rule 4: Rate Limit Guard
        const hourlyCount = getChannelMissionCount(intent.target_channel_id, 60);
        const dailyCount = getChannelMissionCount(intent.target_channel_id, 1440);

        if (hourlyCount >= 5) throw new Error(`Rate Limit Exceeded: 5 uploads/hour reached for channel ${intent.target_channel_id}`);
        if (dailyCount >= 20) throw new Error(`Rate Limit Exceeded: 20 uploads/day reached for channel ${intent.target_channel_id}`);

        console.log(`[Step 4] Deployment (Puppeteer + EvoMap Self-Healing)...`);
        const uploadResult = await uploadToYouTubeWithHealing(finalVideoPath, {
            title: viralAssets.ab_titles[0] || originalTitle,
            description: `#Shorts #AI #IndustrialEngine\n\n${viralAssets.emotion_core}`
        }, intent.target_channel_id);

        // 5. Completion
        intent.status = 'completed';
        upsertIntent(intent);
        console.log(`✅ [Mission Success] Content deployed: ${uploadResult.finalUrl}`);

        // Save to viral contents for dashboard
        const stmt = db.prepare('INSERT INTO viral_contents (videoId, title, script) VALUES (?, ?, ?)');
        stmt.run(videoId, viralAssets.ab_titles[0], viralAssets.full_script);

        return { success: true, intentId };

    } catch (error) {
        intent.status = 'failed';
        intent.error = error.message;
        upsertIntent(intent);
        console.error(`❌ [Constitutional Failure] Mission Aborted:`, error.message);

        // 🧹 [Rule 3] Physical Garbage Collection
        // 'finalVideoPath' might or might not be defined depending on where it failed
        if (typeof finalVideoPath !== 'undefined' && fs.existsSync(finalVideoPath)) {
            fs.unlinkSync(finalVideoPath);
            console.log(`🧹 [Garbage Collection] Critical purge of artifact after failure: ${finalVideoPath}`);
        }

        throw error;
    }
}

async function mutateWithGemini(title, transcript) {
    // 1. 植入系统级思想钢印 (System Instruction)
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-pro",
        systemInstruction: `你是一个冷酷且极其高效的 YouTube 顶级内容黑客和行为心理学家。
你的唯一任务是：解构爆款视频的原始基因，并将其重组为一个【绝对原创、无法被查重、且完播率极高】的降维打击剧本。
你的重组原则：
1. 绝对禁止同义词替换或简单摘要。你必须打碎原有的叙事时间线，采用“倒叙”、“制造悬念”或“从高潮切入”的手法重构故事。
2. 每一句话必须短促有力，专为 AI 语音合成 (TTS) 设计，禁止使用复杂的书面长句。
3. 严格遵循 JSON 输出格式，绝不输出任何多余的 Markdown 或解释性文字。`,
        generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.85, // 🔼 调高温度：在保证 JSON 结构的前提下，强制 AI 产生更具跳跃性和原创性的变异
            topP: 0.9
        }
    });

    // 2. 注入高维用户指令 (User Prompt)
    const prompt = `
    [Host Target Data]
    Original Title: ${title}
    Transcript Extract: ${transcript.substring(0, 15000)}

    [Mutation Directive]
    Perform a deep genetic mutation on the host data. Produce a "Mutation Plan" adhering strictly to this JSON schema:

    {
      "emotion_core": "Identify the primal human emotion driving this video (e.g., Fear of missing out, Greed, Curiosity, Outrage). Explain in 1 sentence.",
      
      "hook_script": "The crucial first 5 seconds. Must be a visual or auditory pattern interrupt. Start with a contrarian statement, a shocking statistic, or a direct provocative question. Do NOT introduce yourself.",
      
      "full_script": "The complete narrative script. \nRule 1: Place an 'Open Loop' (unresolved suspense) at the 15-second mark.\nRule 2: Restructure the original timeline (e.g., start with the final result, then explain how).\nRule 3: Keep sentences punchy for TTS.",
      
      "ab_titles": [
        "[The Contrarian]: (e.g., Why everyone is wrong about X)",
        "[The Urgent Warning]: (e.g., Stop doing X before 2026)",
        "[The Curiosity Gap]: (e.g., I tried the X hack (Here's the truth))",
        "[The Hyper-Specific Result]: (e.g., How X makes you $Y in Z days)",
        "[The Story-Driven]: (e.g., The dark truth behind X's success)"
      ],
      
      "thumbnail_prompts": [
        "High contrast close-up of [Subject] with a shocked expression, neon lighting, dramatic shadows.",
        "Split-screen comparison: Left side [Before/Failure], Right side [After/Success], extreme bold text.",
        "A hidden secret revealed concept: [Subject] pointing at a glowing blurred object, high saturation."
      ]
    }
    `;

    try {
        const result = await model.generateContent(prompt);
        return JSON.parse(result.response.text());
    } catch (error) {
        console.error("❌ 变异引擎基因重组失败:", error);
        throw error; // 抛出异常让外层的状态机捕捉并标记为 failed
    }
}

/**
 * 🦅 V11.0 Radar Sentinel (Zero-Touch Scout)
 * 7x24 autonomous scanning of competitor fleets.
 */
export function startVPHRadar() {
    console.log("🛰️ [VPH Radar Sentinel] 7x24 Autonomous Deep Scan Ignited.");

    // 每 1 小时执行一次雷达扫描 (3600000 毫秒)
    setInterval(async () => {
        try {
            console.log("🔍 [Radar Sentinel] Scanning competitor channels...");

            // TODO: 这里替换为真实的 YouTube API 或爬虫逻辑
            // 模拟雷达捕获到一个刚破 5000 VPH 的爆款
            const mockBreakout = {
                videoId: "viral_" + Date.now().toString().slice(-6),
                title: "🔥 刚刚破解的 2026 搞钱秘籍",
                vph: 6200,
                niche: "finance" // 领域标签
            };

            if (mockBreakout.vph > 5000) {
                console.log(`🎯 [Radar Lock] VPH threshold breached (${mockBreakout.vph}). Initiating Zero-Touch injection!`);

                // 1. 智能匹配：根据爆款领域，分配给对应的自有频道
                const targetChannelId = mockBreakout.niche === 'finance' ? 'channel_finance_01' : 'primary_channel';
                const intentId = `auto_${Date.now()}`;

                // 2. 自动立项入库 (射后不理)
                upsertIntent({
                    id: intentId,
                    status: 'pending',
                    target_video_id: mockBreakout.videoId,
                    target_channel_id: targetChannelId, // 绑定专属频道
                    payload: { originalTitle: mockBreakout.title, source: 'auto_radar' }
                });

                // 3. 异步唤醒绞肉机流水线 (不阻塞雷达心跳)
                triggerParasiticWorkflow(mockBreakout.videoId, mockBreakout.title, intentId, targetChannelId)
                    .catch(e => console.error(`❌ [Auto-Mission] Failed for ${intentId}:`, e));
            }
        } catch (error) {
            console.error("❌ [Radar Sentinel] Scan failed:", error.message);
        }
    }, 3600000);
}
