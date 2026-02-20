# ⚖️ 黄金功能宪法 (Golden Functions Constitution)

> **本文档是 AI 内容创作智能化平台的最高开发准则。**  
> **任何代码修改、重构、新功能开发，都必须以本文档为底线。**  
> **违反本宪法的修改必须立即回滚。**

**版本**: V1.0  
**生效日期**: 2026-02-17  
**权威等级**: 🔴 **最高 — 无条件遵守**

---

## 📜 宪法总纲

### 第一条：底线原则
任何代码修改，无论大小，**绝不允许**破坏本文档列出的 **8 大闭环 × 31 个黄金功能** 中的任何一个。

### 第二条：验证义务
每次代码修改后，**必须**验证涉及的黄金功能仍然正常工作。跳过验证等同于违宪。

### 第三条：声明义务
修改核心文件前，**必须**声明本次修改可能影响的黄金功能编号，并在修改后逐一确认。

### 第四条：回滚机制
一旦发现任何黄金功能被破坏，**必须立即停止修改**并回滚到最近的快照，不允许"先继续开发再修复"。

---

## 🏗️ 系统消息链路总图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        React 前端                                    │
│  App.tsx → YouTubeAnalytics.tsx → services/* → hooks/*              │
└────────────┬──────────────────────────────────────────┬─────────────┘
             │  window.postMessage                      │  直接 API 调用
             ▼                                          ▼
┌────────────────────────┐                   ┌──────────────────────┐
│    content.js (桥梁)    │                   │  Veo 3 API (Direct)  │
│    消息路由 + 中继       │                   │  veoService.ts       │
└─────────┬──────────────┘                   └──────────────────────┘
          │  chrome.runtime.sendMessage
          ▼
┌────────────────────────┐
│    background.js       │
│    Service Worker       │
│    消息处理 + Tab管理    │
└─────────┬──────────────┘
          │  chrome.tabs / chrome.scripting
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    目标平台页面                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────┐ ┌──────┐       │
│  │GeminiGen │ │Google    │ │Google    │ │YouTube│ │TikTok│ │X│   │
│  │autoPilot │ │Flow      │ │Vids      │ │Studio │ │auto  │ │ │   │
│  │.js       │ │autoPilot │ │workflow  │ │upload │ │Pilot │ │ │   │
│  └──────────┘ └──────────┘ └──────────┘ └───────┘ └──────┘ └─┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 闭环 ① 🎬 视频生成与上传（4 引擎 + 统一上传）

> **核心主线**: 这是系统存在的根本目的 — 自动化视频创作和发布

### 生成引擎

| # | 黄金功能 | 引擎 | 代码路径 | 关键函数 |
|---|---------|------|---------|---------|
| **1a** | **GeminiGen 视频生成** | GeminiGen (浏览器自动化) | React → content.js `OPEN_GEMINIGEN_TAB` → background.js → geminigen.ai 页面 | `platforms/geminiGen/autoPilot.js` → `runGenAutomation()` → `monitorResult()` |
| **1b** | **Veo 3 Direct API 生成** | Veo 3 / 3.1 (直接 API) | React → `services/veoService.ts` → Gemini API → 轮询操作状态 | `VeoService.generateVideo()` → `initiateGeneration()` → `pollOperation()` |
| **1c** | **Google Flow 视频生成** | Google Flow (浏览器自动化) | React → content.js `GOOGLE_FLOW_GENERATE` → background.js → labs.google 页面 | `platforms/googleFlow/autoPilot.js` → `executeAutomation()` → `monitorVideoResult()` |
| **1d** | **Google Vids 视频生成** | Google Vids (浏览器自动化) | React → content.js `GOOGLE_VIDS_GENERATE` → background.js → docs.google.com/videos 页面 | `platforms/googleVids/workflow.js` → `runGoogleVidsAutomation()` → `waitForVideoGeneration()` |

### 统一回传与上传

| # | 黄金功能 | 作用 | 代码路径 | 关键函数 |
|---|---------|------|---------|---------|
| **2** | **视频结果回传 React** | 4 引擎生成的视频统一回传 | 各平台 `relayGeminiVideoResult` → background.js → content.js → React | `processFoundVideo()` → base64 → `window.postMessage` |
| **3** | **视频数据存储** | 存储待上传的视频元数据 | React `PREPARE_YOUTUBE_UPLOAD` → content.js → background.js | `storeVideoData` → Chrome Storage `pendingUploads` |
| **4** | **YouTube Studio 自动上传** | 自动填充标题/描述/排期并上传 | background.js `openTab(studio.youtube.com)` → DOM 自动化 | `platforms/youtube/studioUploader.js` 全流程 |
| **5** | **上传完成通知** | 通知 React 上传已完成 | studioUploader.js → `YOUTUBE_UPLOAD_COMPLETE` → background → React | React 状态更新 + 触发评论注册 |
| **6** | **视频下载代理 (CORS)** | 绕过跨域限制获取视频数据 | content.js → background.js `downloadVideo` → `fetch()` | 返回 base64 视频数据 |

### 闭环路径验证

```
✅ 完整闭环:
  4 个引擎任选一个生成视频
       ↓
  视频结果回传 React (#2)
       ↓
  视频数据存储到 Chrome Storage (#3)
       ↓
  打开 YouTube Studio 自动上传 (#4)
       ↓
  上传完成通知 React (#5)
       ↓
  闭环完成 ✅ → 可触发闭环⑤评论自动化
```

---

## 闭环 ② 📊 YouTube Analytics 数据收集

> **数据引擎**: 为 DFL 系统提供算法数据输入

| # | 黄金功能 | 作用 | 关键代码 | 关键函数 |
|---|---------|------|---------|---------|
| **7** | **Ask Studio AI 问答** | 向 YouTube Studio AI 提问获取深度分析 | `youtube-analytics.js` | `askStudio(question)` |
| **8** | **Ask Studio 面板打开** | 自动点击 ✨ 按钮打开 AI 面板 | `youtube-analytics.js` | `ensurePanelOpen()` (含多策略点击) |
| **9** | **多类别串行采集 (7 类)** | 依次采集 7 个分析类别数据 | `youtube-analytics.js` | `askMultipleQuestions(questions, category)` |
| **10** | **Direct DOM 数据抓取** | 直接从 Studio 页面抓取图表 SVG 数据 | `youtube-analytics.js` | `scrapeActiveChart()` |
| **11** | **YPP 实时数据采集** | 抓取 YPP 资格页面的订阅/观看数据 | `youtube-analytics.js` | `scrapeYPPData()` |
| **12** | **分析数据回传 React** | 将采集数据传回前端显示 | background.js → content.js → React | `ANALYTICS_DATA` → `window.postMessage` |

### 闭环路径验证

```
✅ 完整闭环:
  React 点击 Collect
       ↓
  打开 YouTube Studio (#8 面板打开)
       ↓
  Ask Studio 提问 (#7) 或 DOM 抓取 (#10)
       ↓
  串行采集 7 类数据 (#9)
       ↓
  数据回传 React (#12) 显示图表
       ↓
  闭环完成 ✅ → 数据输入闭环③ DFL
```

### 7 个采集类别

| 类别 Key | 数据内容 |
|---------|---------|
| `yppSprint` | YPP Sprint 冲刺进度 |
| `velocity` | 首小时推送速度 |
| `retention` | 观众留存率曲线 |
| `rewatch` | 重播比例 |
| `swipeAway` | 划走率 |
| `subsConversion` | 订阅转化率 |
| `sessionTime` | 会话时长 |

---

## 闭环 ③ 🧠 DFL 动态反馈循环（24/7 无人运营）

> **智能中枢**: 自动监控 → 检测信号 → 触发响应

| # | 黄金功能 | 作用 | 关键代码 | 关键函数 |
|---|---------|------|---------|---------|
| **13** | **DFL 自动触发** | 定时自动启动数据采集 | `youtube-analytics.js` | `checkAutoTrigger()` |
| **14** | **病毒信号检测** | 分析数据判定 EXTREME/HIGH/NORMAL | React + `dflLearningService.ts` | `runDFLLearningCycle()` |
| **15** | **病毒响应-内容生成** | 检测到病毒信号后自动触发闭环①生成视频 | React `YouTubeAnalytics.tsx` | `triggerViralContentGeneration()` |
| **16** | **DFL 报告解析** | 解析 Ask Studio 返回的 DFL 报告数据 | `youtube-analytics.js` | `parseDFLReport(responseText)` |
| **17** | **DFL 排期调整** | 根据信号强度动态调整发布排期 | content.js → background.js | `DFL_SCHEDULE_ADJUST_REQUEST` → `rescheduleVideo` |

### 信号阈值表（不可修改）

| 信号等级 | firstHourVelocity | rewatchRatio | subsConversion | 自动操作 |
|---------|-------------------|-------------|----------------|---------|
| 🔥 **EXTREME** | ≥ 1000 | ≥ 1.8x | ≥ 5/1k views | 立即生成 3 个趋势视频 |
| ⚡ **HIGH** | ≥ 750 | ≥ 1.5x | ≥ 3/1k views | 生成 1 个 Queue Jump 视频 |
| ✅ **NORMAL** | < 750 | < 1.5x | < 3/1k views | 继续监控，执行标准计划 |

### 闭环路径验证

```
✅ 完整闭环 (无限循环):
  定时自动触发 (#13)
       ↓
  采集数据 (触发闭环②)
       ↓
  检测病毒信号 (#14)
       ↓
  ┌─ EXTREME/HIGH → 自动生成内容 (#15, 触发闭环①)
  │                  → 密集排期发布 (#17)
  │                  → 继续监控 ♻️
  └─ NORMAL → 执行标准计划 → 继续监控 ♻️
```

---

## 闭环 ④ 📝 计划生成（Ask Studio 驱动）

> **策略大脑**: 基于数据分析生成发布策略

| # | 黄金功能 | 作用 | 关键代码 | 关键函数 |
|---|---------|------|---------|---------|
| **18** | **Ask Studio 发布计划生成** | 向 Studio AI 发送 prompt 获取结构化发布计划 | content.js → background.js → `youtube-analytics.js` | `ASK_STUDIO_GENERATE_PLAN` → `runAnalyticsAgent(payload)` |
| **19** | **计划数据适配** | 将 AI 返回的原始文本转为标准数据格式 | `services/askStudioAdapter.ts` | `adaptAskStudioResponse()` |
| **20** | **计划验证与清洗** | 验证计划结构完整性，清洗异常数据 | `services/askStudioAdapter.ts` | `validatePlanStructure()` + `sanitizePlanData()` |

### 闭环路径验证

```
✅ 完整闭环:
  React 请求生成计划
       ↓
  打开 Studio → Ask Studio 提问 (#18)
       ↓
  AI 返回原始响应
       ↓
  数据适配 (#19) + 验证清洗 (#20)
       ↓
  结构化计划回传 React 显示
       ↓
  用户确认 → 计划进入执行队列 → 触发闭环①逐个生成视频
       ↓
  闭环完成 ✅
```

---

## 闭环 ⑤ 💬 评论自动化（Ignite 系统）

> **互动引擎**: 自动发布评论提升互动率

| # | 黄金功能 | 作用 | 关键代码 | 关键函数 |
|---|---------|------|---------|---------|
| **21** | **定时评论注册** | 视频上传后注册定时评论任务 | content.js `REGISTER_SCHEDULED_COMMENT` → background.js | `storeScheduledComment` → Chrome Storage |
| **22** | **定时评论执行** | 到达预定时间后自动发布评论 | `platforms/youtube/commentAutomation.js` + `scheduledCommentMonitor.js` | `runCheck()` + `postComment()` |
| **23** | **Ignite 2.0 马甲评论** | 使用多个马甲账号串行发布评论 | content.js `IGNITE_SCRIPT` → `YouTubeCommentAutomation` | `storeIgniteScript()` → `executeIgniteQueue()` |
| **24** | **DFL 自动评论** | DFL 系统自动触发 AI 生成评论 | content.js `DFL_AUTO_COMMENT_REQUEST` → background.js | `triggerAskStudio` (source: DFL_AUTO_COMMENT) |

### 马甲账号配置（EXT_CONSTANTS.IGNITE_CONFIG）

| 序号 | 账号名 | 角色 |
|------|-------|------|
| 0 | Mark Bobl \| Digital Forensics | 主账号 (置顶评论) |
| 1 | CCTV Debunker | 马甲 1 |
| 2 | c hao | 马甲 2 |
| 3 | chi rimmon | 马甲 3 |

### 闭环路径验证

```
✅ 完整闭环:
  视频上传完成 (闭环①#5 触发)
       ↓
  注册定时评论 (#21)
       ↓
  定时器到达 → 主账号发布置顶评论 (#22)
       ↓
  Ignite 马甲按序跟评 (#23)
       ↓
  互动数据提升 → 间接提升算法推荐
       ↓
  闭环完成 ✅
```

---

## 闭环 ⑥ 🌐 跨平台分发

> **分发网络**: 一次生成，多平台发布

| # | 黄金功能 | 作用 | 关键代码 | 关键函数 |
|---|---------|------|---------|---------|
| **25** | **跨平台分发编排** | 统一调度 YouTube + TikTok + X 同步发布 | content.js `CROSS_PLATFORM_DISTRIBUTE` → background.js | `crossPlatformDistribute` → 多平台并行 |
| **26** | **TikTok 上传** | 自动上传视频到 TikTok | content.js → background.js → `platforms/tiktok/tiktokAutoPilot.js` | `tiktokUpload` → DOM 自动化 |
| **27** | **X/Twitter 发帖** | 自动发布推文 + YouTube 链接 | content.js → background.js → `platforms/x/xAutoPilot.js` | `xPost` → DOM 自动化 |

### 闭环路径验证

```
✅ 完整闭环:
  React 发起跨平台分发 (#25)
       ↓
  ┌─ YouTube: 触发闭环① (#4 上传)
  ├─ TikTok: 自动上传 (#26)
  └─ X/Twitter: 自动发帖 (#27)
       ↓
  各平台上传结果回传 React
       ↓
  闭环完成 ✅
```

---

## 闭环 ⑦ 🔧 系统基础设施

> **生命线**: 这些功能是所有闭环运行的基础

| # | 黄金功能 | 作用 | 关键代码 | 破坏后果 |
|---|---------|------|---------|---------|
| **28** | **扩展健康检查** | 检测 Chrome 扩展是否可用 | content.js `CHECK_EXTENSION_STATUS` → `ping` | 无法检测扩展断开，所有功能静默失败 |
| **29** | **消息确认系统 (ACK)** | 确保关键消息被接收和处理 | content.js `sendMessageWithAck()` + `setupAckListener()` | 消息丢失无法检测，功能随机失败 |
| **30** | **Background ↔ Page 双向消息桥** | React 与 Chrome 扩展的唯一通信通道 | content.js: `chrome.runtime.onMessage` → `window.postMessage` + `window.addEventListener('message')` → `chrome.runtime.sendMessage` | ⛔ **整个系统瘫痪** — 所有 6 个上游闭环全部失效 |

### ⚠️ 特别警告

**#30 双向消息桥是全系统的心脏。** 它由 `content.js` 中的两段代码构成：

```
方向 A (Background → React):
  chrome.runtime.onMessage → 添加 source:'extension' → window.postMessage

方向 B (React → Background):
  window.addEventListener('message') → 过滤 → chrome.runtime.sendMessage
```

**破坏这两段代码中的任何一行，等同于拔掉系统的电源线。**

---

## 闭环 ⑧ 🎨 React 前端核心

> **用户界面**: 用户与系统交互的唯一入口

| # | 黄金功能 | 关键文件 | 关键逻辑 | 破坏后果 |
|---|---------|---------|----------|---------|
| **31** | **前端核心功能集** | 见下方详细列表 | 见下方 | 前端不可用 |

### #31 包含的子功能

| 子项 | 功能 | 关键文件 |
|------|------|---------|
| 31-a | API Key 认证与初始化 | `App.tsx` → Gemini API Key |
| 31-b | 视频生成主流程 (4 引擎调度) | `App.tsx` → `handleSubmit()` → `geminiService.ts` |
| 31-c | YouTube Analytics Dashboard | `YouTubeAnalytics.tsx` (15,511 行) |
| 31-d | DFL 控制面板 | `YouTubeAnalytics.tsx` → DFL 状态管理 |
| 31-e | 多语言切换 | `contexts/LocalizationContext.tsx` |
| 31-f | 通知系统 | `services/notificationService.ts` |

---

## 📊 风险等级分类

### ⛔ 致命级（破坏 = 系统瘫痪）

| # | 功能 | 理由 |
|---|------|------|
| **30** | Background ↔ Page 双向消息桥 | 所有闭环的通信基础 |
| **6** | 视频下载代理 (CORS) | 视频无法获取 |
| **2** | 视频结果回传 React | 生成完成但无法交付 |
| **5** | 上传完成通知 | DFL + 评论闭环断裂 |

### 🔴 高危级（破坏 = 核心功能丢失）

| # | 功能 | 理由 |
|---|------|------|
| **1a-1d** | 4 个视频生成引擎 | 内容生产能力丧失 |
| **7** | Ask Studio AI 问答 | 数据采集失效 |
| **13** | DFL 自动触发 | 24/7 无人运营失效 |
| **22** | 定时评论执行 | 互动自动化失效 |
| **18** | Ask Studio 计划生成 | 策略生成能力丧失 |
| **3** | 视频数据存储 | 上传流程断裂 |
| **4** | YouTube Studio 自动上传 | 核心发布能力丧失 |

### 🟠 重要级（破坏 = 特定功能失效）

| # | 功能 |
|---|------|
| **8-12** | Analytics 子功能 |
| **14-17** | DFL 子功能 |
| **23-24** | Ignite 子功能 |
| **25-27** | 跨平台分发 |
| **28-29** | 基础设施辅助 |

---

## 🔍 核心文件保护清单

以下文件包含黄金功能代码，修改前**必须**执行 Pre-Modification Checklist：

| 文件 | 大小 | 包含的黄金功能 | 危险等级 |
|------|------|---------------|---------|
| `gemini-extension/content.js` | 36 KB | #2, #3, #5, #6, #28, #29, **#30** (全部消息路由) | ⛔ 致命 |
| `gemini-extension/background.js` | 186 KB | #2, #3, #4, #5, #6, #17, #18, #21, #24, #25-27 | ⛔ 致命 |
| `gemini-extension/youtube-analytics.js` | 352 KB | #7, #8, #9, #10, #11, #12, #13, #16, #18 | 🔴 高危 |
| `components/YouTubeAnalytics.tsx` | 939 KB | #14, #15, #31-c, #31-d | 🔴 高危 |
| `App.tsx` (根目录) | 38 KB | #31-a, #31-b | 🔴 高危 |
| `services/veoService.ts` | 16 KB | #1b | 🟠 重要 |
| `services/geminiService.ts` | 86 KB | #1a, #31-b | 🟠 重要 |
| `services/dflLearningService.ts` | 26 KB | #14 | 🟠 重要 |
| `services/askStudioAdapter.ts` | 9 KB | #19, #20 | 🟠 重要 |
| `platforms/geminiGen/autoPilot.js` | 23 KB | #1a | 🟠 重要 |
| `platforms/googleFlow/autoPilot.js` | 27 KB | #1c | 🟠 重要 |
| `platforms/googleVids/workflow.js` | 40 KB | #1d | 🟠 重要 |
| `platforms/youtube/studioUploader.js` | - | #4, #5 | 🔴 高危 |
| `platforms/youtube/commentAutomation.js` | - | #22, #23 | 🟠 重要 |
| `platforms/youtube/scheduledCommentMonitor.js` | - | #22 | 🟠 重要 |
| `core/constants.js` | 2.7 KB | 全部 (常量定义) | 🔴 高危 |

---

## ✅ 修改前强制检查清单 (Pre-Modification Checklist)

```
修改任何上述文件前，必须完成:

□ 1. 声明: "本次修改涉及黄金功能 #___, #___, #___"
□ 2. 快照: 运行 /create_snapshot
□ 3. 基线: 运行 build + node --check 确认当前状态正常
□ 4. 风险: 说明可能影响的其他黄金功能
□ 5. 策略: 说明如何验证涉及的黄金功能仍然正常

修改完成后，必须完成:

□ 6. 语法: node --check (JS) 或 tsc --noEmit (TS)
□ 7. 构建: npx vite build
□ 8. 验证: 逐一确认声明的黄金功能正常
□ 9. 对比: 与快照对比确认无回归
```

---

## 📐 常量覆盖要求

`gemini-extension/core/constants.js` (EXT_CONSTANTS) 必须覆盖所有消息类型。
以下消息**必须**使用常量引用，**禁止**硬编码字符串：

### React → Content.js 消息

| 消息类型 | 相关黄金功能 |
|---------|-------------|
| `PREPARE_YOUTUBE_UPLOAD` | #3 |
| `OPEN_YOUTUBE_UPLOAD_TAB` | #4 |
| `GOOGLE_VIDS_GENERATE` | #1d |
| `GOOGLE_FLOW_GENERATE` | #1c |
| `OPEN_GEMINIGEN_TAB` | #1a |
| `REQUEST_YOUTUBE_ANALYTICS` | #7 |
| `REQUEST_YOUTUBE_SHORTS_REFRESH` | #11 |
| `REGISTER_SCHEDULED_COMMENT` | #21 |
| `DFL_AUTO_COMMENT_REQUEST` | #24 |
| `DFL_SCHEDULE_ADJUST_REQUEST` | #17 |
| `IGNITE_SCRIPT` | #23 |
| `IGNITE_SOCKPUPPET` | #23 |
| `ASK_STUDIO_GENERATE_PLAN` | #18 |
| `CROSS_PLATFORM_DISTRIBUTE` | #25 |
| `TIKTOK_UPLOAD_REQUEST` | #26 |
| `X_POST_REQUEST` | #27 |
| `CHECK_EXTENSION_STATUS` | #28 |
| `START_DIRECT_COLLECT` | #10 |

### Content.js → Background.js 消息

| Action | 相关黄金功能 |
|--------|-------------|
| `storeVideoData` | #3 |
| `openTab` | #4 |
| `downloadVideo` | #6 |
| `relayGeminiVideoResult` | #2 |
| `relayAnalyticsRequest` | #7 |
| `storeScheduledComment` | #21 |
| `triggerAskStudio` | #24 |
| `rescheduleVideo` | #17 |
| `postComment` | #22 |
| `ASK_STUDIO_GENERATE_PLAN` | #18 |
| `crossPlatformDistribute` | #25 |
| `tiktokUpload` | #26 |
| `xPost` | #27 |

---

*本宪法由系统架构深度审计生成，基于实际代码路径逐行验证。*  
*任何对本文档的修改需要经过完整的系统影响评估。*  
*版本 V1.0 | 2026-02-17 | 最高权威等级*
