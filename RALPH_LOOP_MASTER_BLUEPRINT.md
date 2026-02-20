# 🎯 Ralph Loop: 自动化闭环主蓝图 (Master Blueprint)

本文档定义了 **YouTube 分析 (Ralph Loop)** 的全量数据链路与自动化生命周期，是 Aetheria-Flow 执行验证的唯一准则。

---

## 🏎️ 1. 触发与意图阶段 (Trigger & Intent)
*   **动作源**: 用户点击 "Collect" 按钮或 DFL 引擎自动触发。
*   **意图记录**: `useYouTubeData.ts` -> `intentStream.propose('COLLECT_ANALYTICS')`。
*   **因果打点**: `effectLogger.logEffect` 记录点击动作及其产生的 `intentId`。

## 🛰️ 2. 消息中继阶段 (Message Relaying)
1.  **React -> Window**: `window.postMessage({ type: 'REQUEST_YOUTUBE_ANALYTICS', ... })`。
2.  **Window -> Extension Bridge**: `content.js` 捕获消息通过 `chrome.runtime.sendMessage` 发给后台。
3.  **Background Control**: `background.js` 判断目标分析页（studio.youtube.com/analytics/...）是否打开。
    *   **IF NOT OPEN**: `background.js` 自动打开新标签页。
    *   **IF OPEN**: 保持沉默，等待内容脚本接管。

## 🕵️ 3. 采集与抓取阶段 (Scraping - extension-side)
*   **脚本激活**: `youtube-analytics.js` 在 Studio 页面监听来自 Background 的指令。
*   **多策略采集**:
    *   **策略 A (Ask Studio)**: 模拟输入 Prompt 向 AI 提问并解析回答。
    *   **策略 B (DOM Scrape)**: 直接抓取 SVG 图表数据、表格数据（如 `yppSprint`）。
*   **数据封装**: 将抓取到的 JSON/TSV 数据附带原始 `intentId` 封装进 `YOUTUBE_ANALYTICS_RESULT`。

## 📥 4. 摄入与核验阶段 (Ingestion & Verification)
1.  **Result Relay**: 数据经由 `background.js` -> `content.js` 回传至 React。
2.  **核心核验 (Aetheria-Flow)**:
    *   **`ContractManager`**: 校验数据结构与业务逻辑（禁止负值、空结果）。
    *   **`EffectLogger`**: 记录 `intentId` 对应的“数据已回传”效应。
    *   **`IntentStream`**: 调用 `intentStream.commit(intentId)`，意图状态转为 `committed`。

## 🧠 5. 计划生成与闭环触发 (Plan & Execution)
1.  **Plan Intent**: 导航至 "YPP Sprint" -> 点击 "Generate Plan" -> 触发新意图 `GENERATE_PLAN`。
2.  **AI 策略**: `askStudioAdapter.ts` 将采集到的原始数据转化为结构化视频生产计划。
3.  **Execution Intent**: 用户确认 -> 点击 "Start Execution" -> 触发 `START_EXECUTION`。
4.  **Auto-Upload**:
    *   React 将视频元数据存入 `chrome.storage.local`。
    *   Extension 自动打开 `studio.youtube.com/upload`。
    *   `studioUploader.js` 接管页面，自动完成文件上传与详情填充。

---

## 🛡️ 执行底线 (Execution Guards)
1.  **禁止中断**: 遇到 `timeout` 或 `connection reset`，浏览器子 Agent 必须立即重启服务并重载页面，严禁挂起。
2.  **因果必达**: 任何没有 `intentId` 标记的数据流均视为非法（违宪），将被 `ContractManager` 丢弃。
3.  **全量上报**: 每一阶段的终点必须在控制台看到 `✅ Intent Committed`。

---

*版本 V1.0 | 2026-02-18 | Ralph Loop 自动化指挥中心*
