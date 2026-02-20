// h:\AI_Neural_Engine_Clean_v3.5\server\studioUploader.js
import puppeteer from 'puppeteer';
import fetch from 'node-fetch';

// --- 初始默认 DOM 选择器字典 (随时可能失效) ---
let YOUTUBE_SELECTORS = {
    createButton: '#create-icon',
    uploadVideoOption: '#text-item-0',
    fileInput: 'input[type="file"]',
    titleInput: '#textbox[aria-label="Add a title that describes your video (type @ to mention a channel)"]',
    nextButton: '#next-button'
};

/**
 * 带有 EvoMap 自愈能力的自动上传主引擎
 * @param {string} videoFilePath - 本地合成好的 .mp4 文件路径
 * @param {object} metadata - 视频元数据 (标题, 描述等)
 * @param {number} retryCount - 当前重试次数
 */
export async function uploadToYouTubeWithHealing(videoFilePath, metadata, retryCount = 0) {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    try {
        console.log(`\n📤 [Uploader] 开始执行上传任务，尝试次数: ${retryCount + 1}`);
        // 🛡️ SECURITY NOTE: In a real production environment, you should inject cookies or use a persistent user data dir.
        // For this implementation, we assume authentication is handled.
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
        // YouTube Studio Inputs are often complex, using type() is safer
        await page.type(YOUTUBE_SELECTORS.titleInput, metadata.title);

        // --- 点击下一步直至发布 ---
        console.log(`[Uploader] 点击发布流程...`);
        for (let i = 0; i < 3; i++) {
            await page.waitForSelector(YOUTUBE_SELECTORS.nextButton, { timeout: 10000 });
            await page.click(YOUTUBE_SELECTORS.nextButton);
            await new Promise(r => setTimeout(r, 2000));
        }

        console.log(`[Uploader] ✅ 视频上传成功，进入 YouTube 后台处理队列！\n`);
        await browser.close();
        return { success: true, finalUrl: page.url() };

    } catch (error) {
        await browser.close();
        console.warn(`\n⚠️ [Uploader Error] DOM 交互失败: ${error.message}`);

        // 🚨 触发免疫防线：如果重试次数未达上限，向 EvoMap 呼救
        if (retryCount < 2) {
            console.log(`🛡️ [Self-Healing] 正在向 EvoMap 网络请求最新的 DOM 补丁...`);
            const isHealed = await fetchEvoMapSelectorPatch(error.message);

            if (isHealed) {
                console.log(`[Self-Healing] 补丁热更新完毕！准备发起第 ${retryCount + 2} 次重试...`);
                // 递归调用重试上传
                return await uploadToYouTubeWithHealing(videoFilePath, metadata, retryCount + 1);
            }
        }

        console.error(`❌ [Uploader Fatal] 补丁耗尽，自愈失败。请人工介入或等待社区发布新胶囊。`);
        throw error;
    }
}

/**
 * EvoMap 免疫防线：通过 REST API 搜索最新的 DOM 选择器胶囊
 */
async function fetchEvoMapSelectorPatch(errorMessage) {
    try {
        // 使用 EvoMap 的 REST 搜索接口，精准匹配 'youtube', 'studio', 'upload' 标签
        const searchUrl = `https://evomap.ai/a2a/assets/search?signals=youtube,studio,selector&status=promoted&type=Capsule&limit=1`;

        const response = await fetch(searchUrl, { timeout: 5000 });
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
