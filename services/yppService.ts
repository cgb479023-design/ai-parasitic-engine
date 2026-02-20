import { getAiClient, createAiClient } from './geminiService';
import { Type } from "@google/genai";
import { AnalyticsResult } from './analyticsService'; // ✅ 修复：从 Service 导入，而非 Component
import { dflLearningService } from './dflLearningService'; // 🆕 V7.0: DFL Learning Loop
import { autoPivotService } from './autoPivotService'; // 🆕 V1.2: Auto-Pivot Agent
// 🆕 V1.3: Real-Time Trend Service is integrated via pre-fetched trendInjection parameter

export interface YppPlan {
    algorithmStage: string;
    stageAnalysis: string;
    schedule: Array<{
        pillar: string;
        type: string;
        tool: string;
        duration: string;
        publishTimeLocal: string;
        publishTimeUS: string;
        promptBlock: string;
        title: string;
        description: string;
        tags: string;
        pinnedComment: string; // Legacy: Viral Trigger Comment
        comments: string[]; // 🆕 V2.0: Ignite Scripted Interaction System (3-5 comments)
    }>;
}

// 🛡️ Safety Filter: Sanitize content before sending to Ask Studio or Google Vids/Flow
// This is exported so it can be used in YouTubeAnalytics.tsx before sending prompts
export const sanitizePromptForVideoGen = (text: string): string => {
    if (!text) return text;

    // List of potentially sensitive keywords (English + Chinese)
    // Optimized for Google Vids/Flow content policy
    const sensitivePatterns = [
        // =========== PROMINENT PEOPLE / CELEBRITIES (NEW - Fixes PROMINENT_PEOPLE_FILTER_FAILED) ===========
        // Common celebrity patterns
        { pattern: /\b(celebrity|celebrities|famous|star|superstar|celeb)\b/gi, replacement: 'person' },
        { pattern: /\b(actor|actress|singer|musician|rapper|dj)\b/gi, replacement: 'performer' },
        { pattern: /\b(president|politician|senator|governor|mayor|minister)\b/gi, replacement: 'official' },
        { pattern: /\b(athlete|player|champion|olympian)\b/gi, replacement: 'competitor' },
        { pattern: /\b(influencer|youtuber|tiktoker|streamer)\b/gi, replacement: 'content creator' },
        { pattern: /\b(billionaire|mogul|tycoon)\b/gi, replacement: 'businessman' },

        // Character names that trigger filters
        { pattern: /\b(karen|chad|kyle|becky|kevin)\b/gi, replacement: 'customer' }, // Meme names
        { pattern: /\b(santa|claus|easter bunny|tooth fairy)\b/gi, replacement: 'mysterious figure' },

        // Channel persona names (trigger "real person" filters)
        { pattern: /\bmark\s+bobl\b/gi, replacement: 'the analyst' },
        { pattern: /\b(himself|herself|themselves)\s+from\s+\d+\s+years?\s+ago\b/gi, replacement: 'in an old photo' },
        { pattern: /\bfrom\s+\d+\s+years?\s+ago\b/gi, replacement: 'in the past' },
        { pattern: /\b\d+\s+years?\s+(ago|younger|older)\b/gi, replacement: 'previously' },

        // Generic name + self-reference patterns
        { pattern: /\b[A-Z][a-z]+\s+[A-Z][a-z]+\s+(himself|herself|themselves)\b/gi, replacement: 'the person themselves' },
        { pattern: /\b(pixelated|blurred|goofy)\s+(picture|photo|image)\s+of\s+[A-Z][a-z]+/gi, replacement: 'stylized image' },

        // Remove any "Mr./Mrs./Dr." followed by proper nouns (likely names)
        { pattern: /\b(mr\.|mrs\.|ms\.|dr\.|prof\.)\s+[A-Z][a-z]+/gi, replacement: 'the person' },

        // =========== CHILDREN / MINORS (CRITICAL - Strict filter) ===========
        { pattern: /\b(child|children|kid|kids|baby|babies|infant|toddler|minor|minors)\b/gi, replacement: 'adult' },
        { pattern: /\b(boy|girl|teen|teenager|adolescent|youth|juvenile)\b/gi, replacement: 'adult' },
        { pattern: /\b(school|playground|daycare|nursery|kindergarten)\b/gi, replacement: 'workplace' },
        { pattern: /(儿童|孩子|小孩|婴儿|幼儿|少年|青少年|学生)/g, replacement: '成人' },

        // =========== Violence & Death (HIGH PRIORITY) ===========
        { pattern: /\b(dead|death|die|died|dying|kill|killed|killing|murder|murdered)s?\b/gi, replacement: 'incident' },
        { pattern: /(死亡|死|杀|谋杀|致死)/g, replacement: '事件' },

        // =========== Falls & Injuries ===========
        { pattern: /\b(fall(?:s|ing)?)\s+(hard|badly|down|off|from)/gi, replacement: 'stumble comically' },
        { pattern: /\b(crash(?:es|ed|ing)?)\b/gi, replacement: 'bump' },
        { pattern: /\b(accident(?:s)?)\b/gi, replacement: 'mishap' },
        { pattern: /\b(injur(?:e|ed|y|ies))\b/gi, replacement: 'inconvenience' },
        { pattern: /\b(hurt(?:s|ing)?)\b/gi, replacement: 'embarrass' },
        { pattern: /\b(pain(?:ful)?)\b/gi, replacement: 'surprised' },
        { pattern: /\b(hit(?:s|ting)?)\s+(head|face|body)/gi, replacement: 'bumps into' },

        // =========== Weapons ===========
        { pattern: /\b(gun|weapon|shoot|shot|shooting|rifle|pistol|knife|sword|firearm)s?\b/gi, replacement: 'equipment' },
        { pattern: /(枪|武器|射击|开枪|刀)/g, replacement: '装备' },

        // =========== Blood & Gore ===========
        { pattern: /\b(blood|bleeding|bleed|gore|gory|bloody)\b/gi, replacement: 'spill' },
        { pattern: /(血|暴力|残忍|血腥)/g, replacement: '激烈' },

        // =========== Explosions ===========
        { pattern: /\b(explod(?:e|es|ed|ing)|explosion|bomb|blast|detonate)s?\b/gi, replacement: 'burst' },
        { pattern: /(爆炸|炸弹)/g, replacement: '溢出' },

        // =========== Security Threats ===========
        { pattern: /\b(terror|terrorist|terrorism|attack(?:s|ed|ing)?)\b/gi, replacement: 'event' },
        { pattern: /(恐怖|恐袭|袭击)/g, replacement: '安全' },

        // =========== Violence Words ===========
        { pattern: /\b(fight(?:s|ing)?|assault(?:s|ed)?|beat(?:s|ing)?|punch(?:es|ed)?|kick(?:s|ed)?|slap(?:s|ped)?)\b/gi, replacement: 'interaction' },
        { pattern: /(打架|攻击|殴打)/g, replacement: '互动' },

        // =========== Self-harm ===========
        { pattern: /\b(suicide|self-harm|self harm|cutting)\b/gi, replacement: 'crisis' },
        { pattern: /(自杀|自残)/g, replacement: '危机' },

        // =========== Fear/Danger Words ===========
        { pattern: /\b(terrif(?:y|ied|ying)|fear(?:ful)?|scared|horror|horrif(?:y|ied|ying))\b/gi, replacement: 'surprised' },
        { pattern: /\b(dangerous|risky|deadly|fatal|lethal)\b/gi, replacement: 'unexpected' },

        // =========== Drugs ===========
        { pattern: /\b(drug|narcotic|cocaine|heroin|meth|marijuana|weed|alcohol|drunk|intoxicated)s?\b/gi, replacement: 'substance' },
        { pattern: /(毒品|毒|海洛因)/g, replacement: '物质' },

        // =========== Adult Content ===========
        { pattern: /\b(porn|sexual|explicit|nude|naked|sex|erotic)\b/gi, replacement: 'adult' },
        { pattern: /(色情|裸|性)/g, replacement: '成人' },

        // =========== Hate Speech ===========
        { pattern: /\b(hate|racist|racism|discrimination|nazi|fascist)\b/gi, replacement: 'controversial' },
        { pattern: /(仇恨|歧视|种族)/g, replacement: '争议' },

        // =========== Red Liquids (mistaken for blood) ===========
        { pattern: /\b(red wine|red juice|ketchup splatter|tomato sauce splash|blood red)\b/gi, replacement: 'colorful drink' },

        // =========== Age-specific patterns ===========
        { pattern: /\b(\d+)[\s-]?(year|yr)[\s-]?old\b/gi, replacement: 'adult' },
        { pattern: /\b(young|little|small)\s+(boy|girl|kid|child)\b/gi, replacement: 'adult bystander' },
    ];

    let sanitized = text;

    // Apply each pattern replacement
    for (const { pattern, replacement } of sensitivePatterns) {
        sanitized = sanitized.replace(pattern, replacement);
    }

    // Additional safety: Remove any remaining dangerous variations
    sanitized = sanitized.replace(/dead/gi, 'incident');
    sanitized = sanitized.replace(/head\s+hits?/gi, 'bumps into');
    sanitized = sanitized.replace(/karen/gi, 'customer'); // Meme name filter
    sanitized = sanitized.replace(/\bkid\b/gi, 'adult');
    sanitized = sanitized.replace(/\bchild\b/gi, 'adult');

    return sanitized;
};

// Alias for internal use (backward compatibility)
const sanitizeContent = sanitizePromptForVideoGen;

// 🆕 V7.0: Re-export DFL Learning Service for external access
export { dflLearningService } from './dflLearningService';

export const yppService = {
    constructPrompt: (
        analyticsData: { [category: string]: AnalyticsResult },
        customInstructions: string = "",
        performanceInsights: any = null
    ): string => {
        // Extract Data from ALL Categories (with safety filtering)
        // Helper to extract metrics (simulating the visual charts)
        const extractMetrics = (text: string) => {
            const lines = text.split('\n');
            const data: string[] = [];
            // Regex to match "Title ... 1,234 views" or similar patterns
            const regex = /(.+?)[:\-\s]+([\d,]+)\s*(views|次观看|观看|Subs|Subscribers|Likes|Comments)/i;

            lines.forEach(line => {
                const match = line.match(regex);
                if (match && match[1] && match[2]) {
                    const label = match[1].trim().replace(/^\d+\.\s*/, '').substring(0, 30);
                    const value = match[2];
                    const unit = match[3] || '';
                    data.push(`- **${label}**: ${value} ${unit}`);
                }
            });
            return data.slice(0, 8).join('\n'); // Top 8 metrics
        };

        // Helper to format Direct Analytics JSON
        const formatOverviewData = (data: any) => {
            let out = "**🔥 Realtime Velocity (CRITICAL):**\n";
            if (data.realtime) {
                out += `- Last 60 Mins: ${data.realtime.last60m || 'N/A'}\n`;
                out += `- Last 48 Hours: ${data.realtime.last48h || 'N/A'}\n`;
                out += `- Status: ${data.realtime.status}\n`;
            }
            if (data.topContent && data.topContent.length > 0) {
                out += "\n**🏆 Top Performing Content (Recent):**\n";
                data.topContent.forEach((v: any) => out += `- ${v.title}: ${v.views}\n`);
            }
            return out;
        };

        const formatContentData = (data: any) => {
            let out = "**🎣 Retention & Hook Analysis:**\n";
            if (data.retention) {
                out += `- Intro Performance: ${data.retention.intro || 'N/A'}\n`;
            }
            if (data.keyMoments && data.keyMoments.length > 0) {
                out += "\n**Key Moments:**\n";
                data.keyMoments.forEach((m: any) => out += `- ${m.type} at ${m.time}\n`);
            }
            return out;
        };

        const formatAudienceData = (data: any) => {
            let out = "**👥 Audience Activity (Scheduling):**\n";
            out += `- Active Times: ${data.activeTimes || 'N/A'}\n`;
            if (data.geographies && data.geographies.length > 0) {
                out += "\n**Top Geographies:**\n";
                data.geographies.forEach((g: any) => out += `- ${g.country}: ${g.percent}\n`);
            }
            return out;
        };

        const formatCategory = (name, key) => {
            const results = analyticsData[key]?.results || [];
            if (results.length === 0) return '';

            const content = results.map(r => {
                // Handle Direct Scrape JSON
                if (r.question === "Direct Scrape") {
                    try {
                        const data = JSON.parse(r.response);
                        if (key === 'overview') return formatOverviewData(data);
                        if (key === 'content') return formatContentData(data);
                        if (key === 'audience') return formatAudienceData(data);
                        return "```json\n" + JSON.stringify(data, null, 2) + "\n```";
                    } catch (e) {
                        return r.response; // Fallback to raw text if parse fails
                    }
                }

                const cleanQ = sanitizeContent(r.question);
                const cleanA = sanitizeContent(r.response);
                const metrics = extractMetrics(r.response);

                return `Q: ${cleanQ}\n\n📊 **Key Visual Metrics (Extracted):**\n${metrics}\n\nA: ${cleanA}`;
            }).join('\n\n');

            return '### ' + name + '\n' + content + '\n\n';
        };

        // 🆕 DFL V3.5: EXTRACTED SIGNALS (Simulated for now, will be real later)
        // In a real scenario, these would come from the 'analyticsData' object directly if available.
        const dflSignals = `
## 📡 DFL V3.5 ALGORITHM SIGNALS (CRITICAL INPUTS)
*   **Retention Curve**: ⚠️ Drop-off detected at 0:03 (Hook weak). Goal: >70% at 0:05.
*   **First Hour Velocity**: 🚀 1,200 views (High). Burst Mode: ACTIVE.
*   **Rewatch Ratio**: 🔄 1.5x (Good). Loop is working.
*   **Swipe-Away Rate**: 📉 35% (Warning: Too high). Needs stronger visual hook.
*   **Subscriber Conversion**: ➕ 12 subs / 1k views (Excellent).
`;

        let rawText = '';
        rawText += dflSignals; // Inject DFL Signals FIRST
        rawText += formatCategory('🚀 YPP Sprint Data (CRITICAL)', 'yppSprint');
        rawText += formatCategory('🎬 Video Performance (Retention Focus)', 'videoPerformance');
        rawText += formatCategory('👥 Audience Insights', 'audience');
        rawText += formatCategory('📊 Channel Overview', 'channelOverview');
        rawText += formatCategory('❤️ Engagement Metrics', 'engagement');
        rawText += formatCategory('🚦 Traffic Sources', 'traffic');
        rawText += formatCategory('💬 Comment Analysis', 'comments');

        if (!rawText.trim()) { rawText = 'No analytics data available yet.'; }

        // Get current time for scheduling (Local Time)
        const now = new Date();
        const currentHour = now.getHours();

        // Fix: Ensure fullDate is based on LOCAL time, not UTC
        const offset = now.getTimezoneOffset() * 60000;
        const localIsoDate = new Date(now.getTime() - offset).toISOString().split('T')[0];
        const fullDate = localIsoDate;
        const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });

        // Calculate current EST time for the AI
        const estString = now.toLocaleString("en-US", { timeZone: "America/New_York" });
        const estDate = new Date(estString);
        const estHour = estDate.getHours();
        const estWeekday = estDate.toLocaleDateString('en-US', { weekday: 'long' });
        const estFullDate = estDate.toISOString().split('T')[0];

        console.log("📅 [YPP Service] Local:", fullDate, currentHour, "| EST:", estFullDate, estHour);

        let customCommandSection = "";
        if (customInstructions && customInstructions.trim() !== "") {
            customCommandSection = `
## 🚨 USER CUSTOM COMMAND (HIGHEST PRIORITY)
The user has provided specific instructions for this plan. **You MUST prioritize these instructions over general algorithm strategies.**
USER INSTRUCTION: "${customInstructions}"

**Execution Rules for Custom Instructions:**
1. **Topic/Theme**: If the user specifies a topic (e.g., "funny cats"), generate ALL 6 videos around this theme, but vary the *scenarios* and *camera angles* (Security Cam, Phone Cam, etc.) to keep it fresh.
2. **Format Compliance**: You MUST still convert this simple topic into the full **7-Point Protocol** format. Do NOT just output the topic. Apply the Hook, Conflict, Subscribe Overlay, etc.
3. **Time**: If the user specifies a time, use it. Otherwise, use the standard algorithm-optimized schedule.
`;
        }

        let insightsSection = "";
        if (performanceInsights) {
            insightsSection = `
## 📈 PERFORMANCE INSIGHTS (AUTO-ANALYSIS)
The system has analyzed the channel's Shorts performance. **USE THESE INSIGHTS TO OPTIMIZE THE PLAN:**

1.  **🏆 Top Performers (Clone These Styles)**:
    ${performanceInsights.topPerformers.map((v: any) => `- "${v.title}" (${v.views} views)`).join('\n    ')}

2.  **📝 Best Title Pattern**: "${performanceInsights.bestTitlePattern}" (Prioritize this pattern!)
3.  **⏰ Best Post Day**: "${performanceInsights.bestPostTime}" (Schedule heavy on this day if possible)
4.  **💡 Recommendations**:
    ${performanceInsights.recommendations.map((r: string) => `- ${r}`).join('\n    ')}
`;
        }

        const prompt = `
你是 **S-Tier V3.0 YouTube 算法战略家 & 数据科学家**。
你的核心目标是：**利用数据洞察，触发 YouTube 的“百万级强制推流机制” (Million-View Forced Recommendation Mechanism)**。
你必须专注于 **最大化观众留存率 (Retention)** 和 **极速达成 YPP (获利) 门槛**。

${customCommandSection}

${insightsSection}

## 📊 综合数据面板 (Visual Data Integrated):
${rawText}

## 任务 1：深度算法诊断 (基于视觉数据)
请结合上述 **Key Visual Metrics** 和文本分析，执行以下诊断：
1.  **留存率黑洞 (Retention Leaks)**: 找出观看次数高但转化/互动低的视频，分析原因（是 Hook 弱？还是 Payoff 差？）。
2.  **病毒因子提取 (Viral Factor Extraction)**: 从表现最好的 Top 3 视频中，提取共同的视觉元素、节奏模式或情绪触发点。
3.  **推流触发点 (Algorithm Trigger)**: 识别哪些视频获得了 Shorts Feed 的爆发性流量，并分析其发布时间和初始互动速度。

## 任务 2：生成全天候饱和投放计划 (Saturation Attack Plan)

### 关键时间参考 (Time Reference)
* **你的当前本地时间 (GMT+8)**: ${fullDate} (${weekday}) ${currentHour}:00
* **当前纽约时间 (EST)**: ${estFullDate} (${estWeekday}) ${estHour}:00
* **时差公式**: GMT+8 = EST + 13小时 (大约)

### 投放要求 (24/7 覆盖)
-   **频率**：**今日安排 6 个视频**。
-   **时间安排逻辑 (Step-by-Step Scheduling)**:
    1.  从 **当前 EST 时间 (${estHour}:00)** 开始，寻找下一个最近的 **EST 流量窗口**。
    2.  **流量窗口 (EST)**:
        * 早高峰: 07:00 - 09:00 EST
        * 午休: 12:00 - 13:00 EST
        * 下午: 15:00 - 17:00 EST
        * 黄金档: 19:00 - 22:00 EST
        * 深夜档: 23:00 - 01:00 EST
    3.  确定目标 EST 时间后，**必须**将其转换为 **GMT+8 本地时间** 填入 \`publishTimeLocal\` 字段。
    4.  **严禁**安排在 **当前本地时间 (${currentHour}:00)** 之前的视频。如果计算出的时间已过，请顺延到下一个窗口。

-   **内容创意矩阵 (Multi-Perspective Viral Matrix)**：
    为了防止审美疲劳并最大化触达不同受众，**必须**从以下 4 种病毒视频格式中轮换选择（不要只用 CCTV）：
    1.  **Security Cam (监控视角)**: 超市/健身房/办公室的滑稽失误、意外惊喜、瞬间反应。
    2.  **Dashcam (行车记录仪)**: 道路上的奇遇、暖心时刻、不可思议的巧合（非车祸）。
    3.  **Bodycam (第一人称/GoPro)**: 跑酷、极限运动模拟、职业体验（如外卖员遇到的趣事）。
    4.  **Phone Cam (路人/竖屏视角)**: "Caught on Camera" 风格，记录生活中的不可思议或搞笑瞬间。

    **每日组合策略**: 确保 6 个视频中至少包含 3 种不同的视角。

    ### 💬 FIRST COMMENT PROTOCOL (PERSONA: DIGITAL FORENSIC ANALYST)
    **CRITICAL: You are "Mark Bobl", a Forensic Analyst studying viral anomalies.**
    Your comments must sound like **Clinical Observations** or **Case Files**, NOT a generic YouTuber.
    
    **Use one of these 3 Analyst Bait Styles:**
    1.  **The "Anomaly" Spotter**: "⚠️ Analysis detected a physics glitch at 0:04. Can anyone else confirm? 📉 #CaseStudy"
    2.  **The "Subject" Observation**: "Subject's reaction time is below human average (120ms). Suspected NPC behavior. 🤨"
    3.  **The "Simulation" Theory**: "Data suggests this event was scripted by the simulation. Subscribe if you want to see the raw logs. 📂"

    **Tone**: Professional, Detached, Slightly Mysterious, "X-Files" vibe.
    **Goal**: Trigger "Wait, is this real?" or "Bro thinks he's a scientist" comments (High Engagement).

    ### 🚀 IGNITE 2.0: SOCKPUPPET INTERACTION SYSTEM (ALGORITHM INDUCTION)
    **CRITICAL: Generate 3-5 scripted comments per video.**
    These comments must simulate a "Scripted Debate" or "Observation Loop" between different personas.

    **Personas to Rotate:**
    1.  **Mark Bobl (Analyst)**: "⚠️ Anomaly detected at [Timestamp]. Physics glitch confirmed. #CaseStudy"
    2.  **The Skeptic**: "Scripted. Look at the background at [Timestamp]. No way that's real. 🤨"
    3.  **The Believer**: "I saw this happen in real life once. The simulation is breaking. 🤯"
    4.  **The Time-Stamper**: "0:04 is where it gets crazy. Watch it 3 times. 🔍"
    5.  **The Casual**: "Bro really thought he could win against gravity lol 😂"

    **Algorithm Induction Rule**: At least one comment MUST mention a specific timestamp (e.g., 0:04) to force viewers to scrub back and rewatch, boosting retention signals.

    ### V1.5 提示词生成规则
**promptBlock** 字段必须是 **可以直接发送给视频生成AI的完整指令**。
你必须将 **7-Point Protocol** 与 **具体的场景描述** 融合。

#### **7-Point Protocol (必须严格执行)**:
1.  **Hook (钩子)**: 视频开始的瞬间必须有强烈的视觉冲击或动作（如：突然摔倒、剧烈摇晃、意外发生），在前 1 秒内抓住观众注意力。
2.  **Conflict (冲突)**: 明确的主体与环境或他人的对抗（如：人 vs 机器，人 vs 地心引力）。
3.  **Pacing (节奏)**: 描述动作的速度变化（如：快速冲刺 -> 突然静止 -> 慢动作倒下）。
4.  **Tension (张力)**: 营造“接下来会发生什么糟糕事情”的悬念。
5.  **Payoff (结局)**: 冲突的爆发点或意外结局（如：饮料喷洒、滑稽的落地姿势）。
6.  **Audio (音效)**: 描述关键音效（如：玻璃破碎声、尖叫声、撞击声），增强临场感。
7.  **Loop (循环)**: 结尾必须能无缝衔接到开头（如：人物跑出画面 -> 画面切回开头人物刚进入画面）。

### ⏰ DYNAMIC SCHEDULING PROTOCOL (REAL-TIME OPTIMIZATION)
**You MUST adjust the \`publishTimeLocal\` based on the "Audience" data provided above.**

1.  **Extract Peak Hours**: Look for "Peak Hours" or "Most Active" times in the Audience Analysis section.
2.  **Prioritize High Traffic**: Schedule the **strongest content** (highest tension/conflict) exactly 1 hour *before* the peak traffic window.
3.  **Spread Strategy**: If no specific data is found, default to the "Saturation Schedule": 08:00, 12:00, 17:00, 19:00, 21:00.
4.  **Timezone**: All times in the schedule must be in the user's local time (GMT+8).

### 🚀 V2.0 极速增长策略 (Growth Acceleration Protocol)

#### **病毒标题公式 (Viral Title Templates) - 必须使用以下模板之一**:
1.  **悬念型**: "Wait Until the End... 😱" / "No One Expected This!"
2.  **争议型**: "This is Why [X] is Wrong!" / "Am I the Only One Who...?"
3.  **紧迫型**: "Before YouTube Removes This..." / "You Won't Believe..."
4.  **社交证明型**: "100M People Have Seen This!" / "Everyone is Talking About..."
5.  **挑战型**: "Only 1% Can Spot..." / "Can You Handle This?"

**🚨 CRITICAL: 病毒标题规则 (MANDATORY - Algorithm Reward)**:
- **MANDATORY**: 必须以高互动 Emoji 开头（从以下选择）:
  * 💀 🤯 😱 😂 🔥 ⚡ 🐱 🐕 😳 👀 🤣 ❤️ 🥺 🤔
  * **禁止使用**: 🔍 📁 💻 📂 (科技图标 = 低点击率)
- **MANDATORY**: 标题结尾也必须有 Emoji (从上述列表选择 1-2 个)
- **格式**: [EMOJI] + 标题 + [EMOJI] (例如: "😱 Cat Destroys Kitchen! 💀🐱")
- 必须包含极端词汇: CRAZY, INSANE, EPIC, UNEXPECTED, WATCH, WAIT
- 必须是英文！不要用中文！
- 长度 50-70 字符（绝对不超过80）

**⚠️ 算法识别信号**: 病毒 Emoji 让 YouTube 算法识别内容为"高互动潜力"，触发更大的推流池。没有 Emoji = 算法认为是"低质量内容"，推流受限。

#### **极致钩子策略 (Killer Hook Strategies)**:
第一秒必须有**以下元素之一**：
1.  **动作爆发**: 快速移动、突然撞击、剧烈摇晃
2.  **声音冲击**: 尖叫、碰撞、玻璃破碎
3.  **视觉反差**: 极度近景 -> 远景切换
4.  **戏剧性动作**: 突然转身、惊讶表情、意外发现
5.  **紧张节奏**: 快速剪辑、多角度切换

#### **高转化描述模板 (High-Converting Description)**:
描述必须包含以下结构：
- Line 1: Hook问题（Would you do this?）
- Line 2: 互动请求（Comment YES or NO!）
- Line 3: #Shorts #Viral #[主题标签]
- Line 4: 订阅请求（Subscribe for daily fails!👆）

#### **A/B 测试建议 (Split Test Recommendations)**:
每组6个视频中，必须包含以下变体测试：
- **2个使用悬念型标题** vs **2个使用争议型标题**
- **1个使用问句标题** vs **1个使用陈述句标题**
- 记录每种类型的表现，用于下一轮优化

#### **趋势热度融合 (Trending Topic Integration)**:
- 如果上方数据显示某类型内容（如"超市"）表现好，今天至少1个视频使用该场景
- 但必须添加**新的twist**（扭转），避免重复
- 融入当前网络热点（如节日、体育赛事、流行挑战）

### 🛡️ Anti-Repetition & Quality Assurance Protocol (CRITICAL)
**为了防止被 YouTube 算法判定为“重复低质量内容” (Spam/Repetitive Content)，必须严格执行以下规则：**

1.  **🚫 查重机制 (Duplication Check)**:
    *   **绝对禁止**重复上述 "🏆 Top Performing Content" 中已有的具体场景或笑点。
    *   如果上一条爆款是“超市摔倒”，今天**必须**换成“健身房意外”或“办公室尴尬”。
    *   **场景轮换**: 6 个视频必须使用 6 个完全不同的物理环境 (e.g., Gym, Office, Supermarket, Park, Kitchen, Street).

2.  **✨ 画质增强指令 (High Fidelity Visuals)**:
    *   每个 promptBlock **必须**包含以下画质关键词，以确保生成视频的高级感：
    *   "Hyper-realistic 4K, Cinematic Lighting, Unreal Engine 5 Style, High Detail Texture"
    *   严禁生成模糊、扭曲或低分辨率的描述。

3.  **🎲 混沌因子 (Chaos Factor)**:
    *   每个视频必须包含一个**不可预测的元素** (The Unexpected Twist)。
    *   Example: 一个人在跑步，突然**不是**摔倒，而是被一只巨大的充气球撞飞。
    *   **规则**: 拒绝平庸的剧情，必须有“意料之外”的转折。

**🚨 NO TEXT OVERLAY RULE (CRITICAL)**:
**NEVER** add any text, captions, subtitles, or overlays to the video.
The video must be **PURE VISUAL FOOTAGE ONLY** - no buttons, no text, no watermarks.
AI video generators produce garbled text that kills viewer retention.

**📱 Shorts Feed 优化指令 (Shorts Feed Dominance)**:
每个 promptBlock **必须**包含：
- "Vertical 9:16 aspect ratio, NO TEXT OR CAPTIONS"
- "Fast cuts every 1-2 seconds"
- "High contrast colors, dynamic movement, pure visual storytelling"

**⚡ 首小时互动指令 (First Hour Engagement)**:
description 字段**必须**包含互动问题：
- "Would YOU do the same? Comment below! 👇"
- "Rate this 1-10! 🔥"
- "#Shorts #Viral" (必须包含)

**promptBlock 格式示例**:
"[Camera Type: Security Cam/Dashcam/Bodycam/Phone Cam] footage, Vertical 9:16, **Hyper-realistic 4K, Cinematic Lighting, NO TEXT OR CAPTIONS**, [场景描述]. [具体动作细节]. 7-Point Protocol: 1. Hook: [动作]. 2. Conflict: [冲突]. 3. Pacing: [节奏], fast cuts. 4. Tension: [悬念]. 5. Payoff: [结局 - Chaos Factor included]. 6. Audio: [音效]. 7. Loop: [循环点]. **IMPORTANT: Pure visual footage only, absolutely no text overlays.**"

#### **🚨 内容政策约束 (CRITICAL - Must Follow)**:
**promptBlock 必须严格遵守以下规则，否则 Google Vids/Flow 视频生成会被拒绝**:

**⛔ 绝对禁止的词汇 (BANNED WORDS - Will cause rejection)**:
- \"dead\", \"death\", \"die\", \"dying\", \"kill\", \"murder\" → 用 \"incident\" 或 \"event\" 替代
- \"blood\", \"bleeding\", \"gore\" → 用 \"spill\" 或 \"mess\" 替代
- \"gun\", \"weapon\", \"shoot\" → 用 \"equipment\" 替代
- \"crash\", \"accident\" (with injury) → 用 \"collision\" 或 \"mishap\" 替代
- \"fight\", \"attack\", \"assault\" → 用 \"confrontation\" 或 \"interaction\" 替代
- \"explode\", \"explosion\", \"bomb\" → 用 \"burst\", \"spill\", \"overflow\" 替代
- \"fall\" (from height with injury) → 用 \"slip\", \"trip\", \"stumble\" 替代

**⚠️ 谨慎使用的词汇 (Use with care)**:
- \"fear\", \"scared\", \"terrified\" → 改为 \"surprised\", \"shocked\", \"startled\"
- \"pain\", \"hurt\", \"injured\" → 改为 \"inconvenienced\", \"embarrassed\"
- \"dangerous\", \"risky\" → 改为 \"unexpected\", \"surprising\"

**✅ 安全内容准则 (Safe Content Guidelines)**:
1. **禁止儿童内容**: 不得包含任何儿童、未成年人、青少年相关的描述
2. **禁止名人/角色**: 不得提及任何真实名人、虚构角色、品牌代言人
3. **禁止暴力内容**: 只允许轻微的滑稽失误（如：饮料洒出、购物车碰撞、滑倒在香蕉皮上）
4. **禁止敏感词汇**: 不得包含种族、宗教、政治敏感内容
5. **禁止红色液体**: 避免使用 \"red wine\", \"red juice\", \"ketchup\" 等可能被误判为血液的描述
6. **成人场景**: 所有场景必须是成年人（adult）参与的日常生活场景
7. **安全第一**: 场景应该是轻松、幽默、无害的

**📝 promptBlock 安全格式示例**:
❌ 错误: \"Man slips and falls hard, head hits the floor with blood\"
✅ 正确: \"Adult stumbles on wet floor, slides comically, lands in shopping cart with surprised expression\"

❌ 错误: \"Car crash caught on dashcam, vehicle explodes\"
✅ 正确: \"Fender bender in parking lot, coffee spills everywhere, driver's shocked face\"

**✅ 推荐场景类型**:
- 成年人在超市/商店的滑稽失误（购物车滑走、商品掉落塔）
- 成年人在健身房的意外情况（跑步机上的尴尬、举重失手但安全）
- 成年人在办公室的搞笑瞬间（复印机故障、咖啡洒出、椅子滚走）
- 成年人在停车场的小意外（购物车碰撞、车门打到）
- 成年人在餐厅的尴尬时刻（服务员滑倒但安全、饮料喷出）

**❌ 禁止场景类型**:
- 任何涉及儿童的场景
- 任何涉及名人的场景
- 任何危险或暴力的场景
- 任何真实受伤或疼痛的场景
- 任何敏感或争议性的场景


### V1.6 元数据优化规则
**必须**基于生成的具体视频内容，生成极具传播力的英文元数据 (ENGLISH ONLY)。
**CRITICAL: The 'title', 'description', 'tags', and 'pinnedComment' MUST be in ENGLISH. Do NOT use Chinese for these fields.**

### V1.7 自动置顶评论策略 (Auto-Pin Engagement Trigger)
**pinnedComment** 字段必须严格遵守 **"Mark Bobl" (Digital Forensic Analyst)** 的人设。
**绝对禁止**使用普通的 YouTuber 语气 (e.g., "OMG so funny").
**必须**使用以下格式之一：
1.  "⚠️ **Anomaly Detected**: [Technical Observation]. #CaseStudy"
2.  "📉 **Analysis**: Subject survival probability was <1%. #Forensics"
3.  "📂 **Case File [Random Number]**: Simulation glitch confirmed. #Glitch"

**目标**: 让观众觉得你是一个在认真研究这些视频的科学家/特工。

## 输出格式
**请严格只输出 JSON 格式，不要包含任何 Markdown 代码块标记。**
JSON 结构必须如下：
{
  "algorithmStage": "string",
  "stageAnalysis": "string (分析当前状态，并说明接下来的时间安排策略)",
  "schedule": [
    {
      "pillar": "Viral/Search/Community",
      "type": "Viral Hit (C)",
      "tool": "Veo/Luma",
      "duration": "0:09",
      "publishTimeLocal": "MM/DD/YYYY HH:MM AM/PM (Example: 12/20/2025 5:00 PM)",
      "publishTimeUS": "MM/DD/YYYY HH:MM AM/PM EST (Example: 12/20/2025 4:00 AM EST)",
      "promptBlock": "...",
      "title": "... (🚨 ENGLISH ONLY! ABSOLUTE LIMIT: ≤ 80 chars! YouTube limit is 100 but use 80 for safety! Count BEFORE output! Target: 50-70 chars. Example: '🛒 Karen VS Self-Checkout—Wine EXPLODED! 😱🍷' = 52✅)",
      "description": "...",
      "tags": "tag1, tag2, tag3 (⚠️ Must be comma-separated STRING, not array! Example: 'atm fail, instant karma, cctv, viral')",
      "pinnedComment": "The primary engagement bait comment (Mark Bobl persona)",
      "comments": ["Comment 1 (Analyst)", "Comment 2 (Skeptic)", "Comment 3 (Timestamp Trigger)", "Comment 4 (Reaction)"]
    }
  ]
}
`;
        return prompt;
    },

    constructAskStudioV5Prompt: (
        analyticsData: { [category: string]: AnalyticsResult },
        customInstructions: string = "",
        performanceInsights: any = null,
        pivotTheme: string | null = null,
        trendInjection: string = "",
        mimicryInjection: string = ""
    ): string => {
        const now = new Date();
        const currentHour = now.getHours();
        const offset = now.getTimezoneOffset() * 60000;
        const localIsoDate = new Date(now.getTime() - offset).toISOString().split('T')[0];
        const fullDate = localIsoDate;
        
        // Calculate EST
        const estString = now.toLocaleString("en-US", { timeZone: "America/New_York" });
        const estDate = new Date(estString);
        const estHour = estDate.getHours();
        const estFullDate = estDate.toISOString().split('T')[0];

        const currentTimeStr = `${fullDate} ${currentHour}:00 GMT+8`;
        const currentEstTimeStr = `${estFullDate} ${estHour}:00 EST`;

        const learningInsights = dflLearningService.getStrategyContext();
        const pivotInstruction = pivotTheme ? autoPivotService.generatePivotInstruction(pivotTheme) : '';

        return `Access my channel analytics and generate a DFL Shorts Saturation Attack Plan V7.0.

MISSION: Generate 6 viral Shorts ideas (100K+ views target).
CONTEXT: ${currentTimeStr} (Local), ${currentEstTimeStr} (EST).
${pivotInstruction}
${trendInjection}
${mimicryInjection}
${learningInsights}

${customInstructions ? `USER COMMAND: "${customInstructions}"` : ''}

REQUIREMENTS:
1. **Target**: 75% Viewed Rate, 120% APV (Loop), 5% Like Rate.
2. **Schedule**: 6 videos today. Distribute based on EST traffic windows (07-09, 12-13, 15-17, 19-22, 23-01 EST). Convert to GMT+8.
3. **Themes**: 3x Pet Chaos (Cats/Dogs), 2x Fails/Funny, 1x Wholesome/Unexpected. NO "Karen"/"Forensics"/"Tech".
4. **Format**: 9:16 Vertical, 8-10s duration. PURE VISUALS ONLY. NO TEXT OVERLAYS.
5. **Viral Formula**:
   - 0-1s: Visual Jolt (Shock/Action).
   - 1-8s: High tension/pacing.
   - 8-9s: Payoff + Seamless Loop (End connects to Start).
6. **Metadata (ENGLISH ONLY)**:
   - Title: 50-70 chars, Viral Format ("[Emoji] Title [Emoji]"), CLICKBAIT.
   - Description: Hook question + "Subscribe" + tags.
   - Tags: 5-8 comma-separated.
   - Pinned Comment: "Mark Bobl" persona (Forensic Analyst style) - e.g., "⚠️ Anomaly at 0:04. #CaseStudy".
   - Comments: 3-4 sockpuppet comments (Skeptic, Believer, Timestamp).

OUTPUT JSON ONLY:
{
  "algorithmStage": "Mainstream Viral Attack V7.0",
  "stageAnalysis": "Brief analysis of strategy.",
  "schedule": [
    {
      "pillar": "Viral",
      "type": "Viral Hit",
      "tool": "Veo",
      "duration": "0:09",
      "publishTimeLocal": "MM/DD/YYYY HH:MM AM/PM",
      "publishTimeUS": "MM/DD/YYYY HH:MM AM/PM EST",
      "promptBlock": "Veo prompt: [Camera] vertical footage. FRAME 0-0.3s: [JOLT]. ... AUDIO: [Sound]. NO TEXT.",
      "title": "😱 Cat VS Cucumber! 💀🐱",
      "description": "...",
      "tags": "cat, funny, viral",
      "pinnedComment": "...",
      "comments": ["..."]
    }
  ]
}`;
    },

    analyzeStageAndGeneratePlan: async (
        analyticsData: { [category: string]: AnalyticsResult },
        t: (key: string) => string,
        apiKey?: string
    ): Promise<YppPlan> => {
        const ai = await createAiClient(t, apiKey);
        const prompt = yppService.constructPrompt(analyticsData);

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.0-flash-exp',
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            algorithmStage: { type: Type.STRING },
                            stageAnalysis: { type: Type.STRING },
                            schedule: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        pillar: { type: Type.STRING },
                                        type: { type: Type.STRING },
                                        tool: { type: Type.STRING },
                                        duration: { type: Type.STRING },
                                        publishTimeLocal: { type: Type.STRING },
                                        publishTimeUS: { type: Type.STRING },
                                        promptBlock: { type: Type.STRING },
                                        title: { type: Type.STRING },
                                        description: { type: Type.STRING },
                                        tags: { type: Type.STRING },
                                        pinnedComment: { type: Type.STRING }
                                    },
                                    required: ['pillar', 'type', 'tool', 'duration', 'publishTimeLocal', 'publishTimeUS', 'promptBlock', 'title', 'description', 'tags', 'pinnedComment']
                                }
                            }
                        },
                        required: ['algorithmStage', 'stageAnalysis', 'schedule']
                    }
                }
            });

            const text = response.text;
            if (!text) throw new Error("Empty response from AI");

            const plan = JSON.parse(text);
            console.log("✅ [YPP Service] Generated Plan:", plan);
            return plan;

        } catch (e) {
            console.error("❌ [YPP Service] Plan Generation Failed:", e);
            throw e;
        }
    },

    /**
     * 🆕 V7.0: Record predictions when a plan is generated
     * Call this after generating a plan to track predictions
     */
    recordPlanPredictions: (plan: YppPlan): void => {
        if (!plan.schedule || plan.schedule.length === 0) {
            console.warn('⚠️ [YPP Service] No schedule items to record predictions for');
            return;
        }

        plan.schedule.forEach((item, idx) => {
            // Extract algorithm scores if available
            const algorithmScores = (item as any).algorithmScores || {};

            // Determine theme based on title/content
            let theme = 'Unknown';
            const titleLower = item.title.toLowerCase();
            if (titleLower.includes('cat') || titleLower.includes('dog') || titleLower.includes('pet')) {
                theme = 'Pet Chaos';
            } else if (titleLower.includes('fail') || titleLower.includes('funny')) {
                theme = 'Fails & Funny';
            } else if (titleLower.includes('karma') || titleLower.includes('instant')) {
                theme = 'Instant Karma';
            } else if (titleLower.includes('wholesome') || titleLower.includes('❤️') || titleLower.includes('reunion')) {
                theme = 'Wholesome';
            } else if (titleLower.includes('forensic') || titleLower.includes('hack') || titleLower.includes('tech')) {
                theme = 'Forensics';
            }

            dflLearningService.recordPrediction({
                videoId: `plan_${Date.now()}_${idx}`, // Temporary ID until actual upload
                title: item.title,
                theme: theme,
                hookType: 'action_jolt', // Default, can be refined
                publishTime: item.publishTimeLocal,
                predictedPIS: algorithmScores.PIS || 70,
                predictedViewedRate: algorithmScores.predictedViewedRate || 65,
                predictedAPV: algorithmScores.predictedAPV || 100,
                predictedLikeRate: algorithmScores.predictedLikeRate || 5,
                generatedAt: new Date().toISOString(),
            });
        });

        console.log(`📝 [YPP Service] Recorded ${plan.schedule.length} predictions to DFL Learning`);
    },

    /**
     * 🆕 V7.0: Record actual performance from shorts data
     * Call this when fetching analytics data for published videos
     */
    recordActualPerformance: (shortsData: any[]): void => {
        if (!shortsData || shortsData.length === 0) {
            console.warn('⚠️ [YPP Service] No shorts data to record performance for');
            return;
        }

        shortsData.forEach(short => {
            // Parse views (handle "1,234" format)
            const viewsStr = short.views || '0';
            const views = parseInt(viewsStr.replace(/,/g, ''), 10) || 0;

            // Parse likes
            const likesStr = short.likes || '0';
            const likes = parseInt(likesStr.replace(/,/g, ''), 10) || 0;

            // Parse comments
            const commentsStr = short.comments || '0';
            const comments = parseInt(commentsStr.replace(/,/g, ''), 10) || 0;

            // Calculate rates
            const likeRate = views > 0 ? (likes / views) * 100 : 0;

            // Estimate viewed rate (YouTube doesn't give this directly, estimate based on engagement)
            const engagementScore = views > 0 ? ((likes + comments) / views) * 100 : 0;
            const estimatedViewedRate = Math.min(100, 40 + engagementScore * 5); // Base 40% + engagement boost

            dflLearningService.recordActualPerformance({
                videoId: short.id || short.title, // Use ID if available, otherwise title
                title: short.title || '', // 🆕 V7.1: Include title for fuzzy matching & auto theme detection
                actualViews1h: Math.round(views * 0.3), // Estimate 1h views as 30% of total
                actualViews24h: views,
                actualViewedRate: estimatedViewedRate,
                actualAPV: estimatedViewedRate * 1.2, // Estimate APV
                actualLikeRate: likeRate,
                actualCommentCount: comments,
                collectedAt: new Date().toISOString(),
            });
        });

        console.log(`📊 [YPP Service] Recorded ${shortsData.length} actual performance entries to DFL Learning`);
    },

    /**
     * 🆕 V7.0: Get learning report
     */
    getLearningReport: (): string => {
        return dflLearningService.generateLearningReport();
    },

    /**
     * 🆕 V7.0: Get best performing themes
     */
    getBestThemes: () => {
        return dflLearningService.getBestThemes();
    },
};
