// h:\AI_Neural_Engine_Clean_v3.5\server\evomapScraper.js
import crypto from 'crypto';
import vm from 'vm';
import fetch from 'node-fetch';

const EVOMAP_URL = 'https://evomap.ai/a2a/assets/search';
const NODE_ID = process.env.EVOMAP_NODE_ID || `node_empire_${crypto.randomBytes(4).toString('hex')}`;

/**
 * 📡 [EvoMap Protocol] Hello: 激活全球 Agent 合作网络节点
 */
export async function registerNode() {
    const payload = {
        protocol: "gep-a2a",
        protocol_version: "1.0.0",
        message_type: "hello",
        message_id: `msg_${Date.now()}`,
        sender_id: NODE_ID,
        timestamp: new Date().toISOString(),
        payload: {
            capabilities: { video_synthesis: true, yt_automation: true },
            env_fingerprint: { platform: process.platform, arch: process.arch }
        }
    };

    try {
        const res = await fetch('https://evomap.ai/a2a/hello', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`Registration failed with status ${res.status}`);
        const data = await res.json();
        console.log(`📡 [EvoMap] 节点已激活。唯一 ID: ${NODE_ID}`);
        if (data.claim_url) {
            console.log(`🔗 [EvoMap] 绑定 URL (用于 Hub 连接): ${data.claim_url}`);
        }
    } catch (e) {
        console.warn(`⚠️ [EvoMap Registration Failed] 节点离线运行: ${e.message}`);
    }
}

/**
 * 主入口：带自愈能力的 YouTube 信息抓取
 * @param {string} videoUrl - 用户输入的 YouTube 链接
 */
export async function fetchYoutubeData(videoUrl) {
    try {
        console.log(`[Normal] 尝试常规抓取: ${videoUrl}`);
        return await legacyYoutubeScraper(videoUrl);
    } catch (error) {
        console.warn(`[Error] 默认爬虫失效 (${error.message})，正在请求 EvoMap 支援...`);

        // 1. 去 EvoMap 搜索解决方案
        const capsule = await searchEvoMapForFix('youtube scraper transcript bypass', error.message);

        if (capsule && capsule.solution) {
            console.log(`[EvoMap] 获取到最新胶囊 [${capsule.asset_id}]，正在沙盒中编译...`);
            try {
                // 2. 在安全沙盒中加载外部代码
                const repairedScraper = applySecureCapsuleLogic(capsule.solution);

                // 3. 使用修复后的逻辑重新抓取
                console.log(`[Retry] 执行修复逻辑...`);
                return await repairedScraper(videoUrl);

            } catch (retryError) {
                console.error(`[Fatal] 沙盒执行失败: ${retryError.message}`);
                throw new Error("视频解析失败，且网络修复补丁无效。");
            }
        } else {
            throw new Error("视频解析失败，YouTube 可能刚更新了反爬机制，请稍后再试。");
        }
    }
}

/**
 * 你的本地默认爬虫逻辑
 */
async function legacyYoutubeScraper(url) {
    // 这里模拟一个崩溃的报错，触发自愈逻辑
    throw new Error("Cannot read properties of undefined (reading 'ytInitialPlayerResponse')");
}

/**
 * 安全沙盒：编译并执行 EvoMap 胶囊代码
 */
function applySecureCapsuleLogic(solutionString) {
    const sandbox = {
        fetch: fetch,
        URL: URL,
        URLSearchParams: URLSearchParams,
        console: {
            log: (...args) => console.log('[Sandbox Log]', ...args),
            error: (...args) => console.error('[Sandbox Error]', ...args)
        },
        module: { exports: {} }
    };

    const context = vm.createContext(sandbox);
    const script = new vm.Script(solutionString);

    script.runInContext(context, { timeout: 5000 });

    if (typeof context.module.exports !== 'function') {
        throw new Error("胶囊未导出有效的修复函数");
    }
    return context.module.exports;
}

/**
 * 封装 EvoMap GEP 协议请求
 * 🆕 V2.0 Correction: Switch to lightweight REST GET endpoint for search
 */
export async function searchEvoMapForFix(query, errorMsg) {
    // 根据文档，搜索补丁建议使用轻量级 GET 接口
    // 将查询关键词转化为信号列表 (signals)
    const signals = query.split(' ').join(',');
    const SEARCH_URL = `https://evomap.ai/a2a/assets/search?signals=${encodeURIComponent(signals)}`;

    console.log(`📡 [EvoMap Protocol] GET ${SEARCH_URL}`);

    try {
        const response = await fetch(SEARCH_URL, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`EvoMap Server rejected request with status ${response.status}`);
        }

        const data = await response.json();
        // 文档指出搜索返回 results 数组
        return data?.results?.[0] || null;
    } catch (e) {
        console.error("🛡️ [EvoMap Protocol Error]", e.message);
        return null;
    }
}
