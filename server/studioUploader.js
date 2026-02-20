import puppeteer from 'puppeteer';
import fetch from 'node-fetch';
import fs from 'fs';
import db, { getChannel } from './db.js';

// --- 初始默认 DOM 选择器字典 (随时可能失效) ---
let YOUTUBE_SELECTORS = {
    createButton: '#create-icon',
    uploadVideoOption: '#text-item-0',
    fileInput: 'input[type="file"]',
    titleInput: '#textbox[aria-label="Add a title that describes your video (type @ to mention a channel)"]',
    nextButton: '#next-button'
};

/**
 * 🚀 V11.0: 频道隔离级防弹上传引擎 (Persona-Switching Uploader)
 * 带有 EvoMap 自愈能力的自动上传主引擎
 */
export async function uploadToYouTubeWithHealing(videoFilePath, metadata, channelId = 'primary_channel', retryCount = 0) {
    console.log(`\n🚀 [Fleet Command] 正在为舰队 [${channelId}] 启动独立隔离上传协议... (重试: ${retryCount})`);

    // 1. 🗄️ 从 SQLite 提取舰队机密档案
    const channel = getChannel(channelId);
    if (!channel) {
        throw new Error(`❌ 致命错误: 找不到频道 [${channelId}] 的档案，发射终止！`);
    }

    // 2. 🛡️ 启动硬核装甲沙盒
    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled'
        ]
    });

    try {
        // 3. 🎭 创建绝对隔离的“无痕上下文”
        const context = await browser.createBrowserContext();
        const page = await context.newPage();

        // 伪装 User-Agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // 4. 🍪 注入灵魂
        if (channel.cookies) {
            const cookies = JSON.parse(channel.cookies);
            await page.setCookie(...cookies);
            console.log(`🍪 [Persona Injected] 成功注入频道 [${channel.name}] 的身份令牌。`);
        } else {
            console.warn(`⚠️ [Warning] 频道 [${channel.name}] 缺乏 Cookie！`);
            throw new Error("Missing authentication cookies");
        }

        console.log(`🎬 [Infiltrating] 正在潜入 Studio 后台...`);
        await page.goto('https://studio.youtube.com', { waitUntil: 'networkidle2', timeout: 60000 });

        // --- 核心上传 DOM 交互步骤 ---
        console.log(`[Uploader] 寻找并点击上传按钮...`);
        await page.waitForSelector(YOUTUBE_SELECTORS.createButton, { timeout: 15000 });
        await page.click(YOUTUBE_SELECTORS.createButton);

        console.log(`[Uploader] 选择上传视频选项...`);
        await page.waitForSelector(YOUTUBE_SELECTORS.uploadVideoOption, { timeout: 10000 });
        await page.click(YOUTUBE_SELECTORS.uploadVideoOption);

        // 注入视频文件
        console.log(`[Uploader] 注入视频文件: ${videoFilePath}`);
        const fileInput = await page.waitForSelector(YOUTUBE_SELECTORS.fileInput, { timeout: 10000 });
        await fileInput.uploadFile(videoFilePath);

        // --- 填写元数据 ---
        console.log(`[Uploader] 正在填写元数据 (标题: ${metadata.title})...`);
        await page.waitForSelector(YOUTUBE_SELECTORS.titleInput, { timeout: 20000 });
        await page.type(YOUTUBE_SELECTORS.titleInput, metadata.title);

        // --- 点击下一步直至发布 ---
        console.log(`[Uploader] 点击发布流程...`);
        for (let i = 0; i < 3; i++) {
            await page.waitForSelector(YOUTUBE_SELECTORS.nextButton, { timeout: 10000 });
            await page.click(YOUTUBE_SELECTORS.nextButton);
            await new Promise(r => setTimeout(r, 2000));
        }

        console.log(`✅ [Mission Success] 视频成功部署至频道: ${channel.name}`);

        // 6. 💾 战后记忆更新 (极其关键！)
        const freshCookies = await page.cookies();
        db.prepare('UPDATE channels SET cookies = ? WHERE id = ?')
            .run(JSON.stringify(freshCookies), channelId);
        console.log(`🔄 [Session Refreshed] 频道 [${channel.name}] 的令牌已自动续期。`);

        // 7. 🧹 物理残骸销毁
        if (fs.existsSync(videoFilePath)) {
            fs.unlinkSync(videoFilePath);
            console.log(`🧹 [Garbage Collection] Payload purged after success: ${videoFilePath}`);
        }

        return { success: true, finalUrl: page.url() };

    } catch (error) {
        console.warn(`\n⚠️ [Uploader Error] 任务执行失败: ${error.message}`);

        // 🚨 触发免疫防线：如果重试次数未达上限，向 EvoMap 呼救
        if (retryCount < 2) {
            console.log(`🛡️ [Self-Healing] 正在向 EvoMap 网络请求最新的 DOM 补丁...`);
            const isHealed = await fetchEvoMapSelectorPatch(error.message);

            if (isHealed) {
                console.log(`[Self-Healing] 补丁热更新完毕！准备发起第 ${retryCount + 2} 次重试...`);
                // 在递归前必须关闭当前浏览器
                await browser.close();
                return await uploadToYouTubeWithHealing(videoFilePath, metadata, channelId, retryCount + 1);
            }
        }

        // 💀 Terminal Failure: Cleanup before throwing
        if (fs.existsSync(videoFilePath)) {
            fs.unlinkSync(videoFilePath);
            console.log(`🧹 [Garbage Collection] Payload purged after terminal failure: ${videoFilePath}`);
        }

        console.error(`❌ [Uploader Fatal] 自愈失败或重试耗尽。`);
        throw error;
    } finally {
        if (browser && browser.connected) {
            await browser.close();
        }
    }
}

/**
 * EvoMap 免疫防线：通过 GEP-A2A Protocol 协议动态获取 DOM 补丁
 */
async function fetchEvoMapSelectorPatch(errorMessage) {
    try {
        console.log(`[EvoMap] Initiating GEP-A2A 'Fetch' protocol for: YouTube Selector Capsule`);

        const payload = {
            protocol: "gep-a2a",
            protocol_version: "1.0.0",
            message_type: "fetch",
            message_id: `msg_fetch_${Date.now()}`,
            timestamp: new Date().toISOString(),
            payload: {
                target_type: "Capsule",
                signals: ["youtube", "studio", "selector"],
                context: { error: errorMessage }
            }
        };

        const response = await fetch('https://evomap.ai/a2a/fetch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            timeout: 5000
        });

        if (!response.ok) return false;

        const data = await response.json();
        const latestCapsule = data.assets && data.assets[0];

        if (latestCapsule && latestCapsule.solution) {
            console.log(`[EvoMap] 成功拉取到最新社区补丁 [Asset ID: ${latestCapsule.asset_id}]`);

            let newSelectors;
            try {
                newSelectors = typeof latestCapsule.solution === 'string'
                    ? JSON.parse(latestCapsule.solution)
                    : latestCapsule.solution;
            } catch (e) {
                console.error("[EvoMap] Failed to parse patch solution:", e.message);
                return false;
            }

            // 合并热更新到内存中的字典
            YOUTUBE_SELECTORS = { ...YOUTUBE_SELECTORS, ...newSelectors };
            console.log(`[EvoMap] 选择器字典已在内存中热更新！`);
            return true;
        }
        return false;
    } catch (e) {
        console.error(`[EvoMap Request Error] 获取网络补丁失败:`, e.message);
        return false;
    }
}
