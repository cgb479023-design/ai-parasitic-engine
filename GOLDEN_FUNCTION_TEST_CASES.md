# 黄金功能测试用例设计

本文档旨在为 AI 内容创作智能化平台的 31 个黄金功能提供详细的自动化测试用例设计。测试覆盖单元测试、集成测试和端到端测试层面，确保核心功能的健壮性和可靠性。

## 1. 闭环 ① 🎬 视频生成与上传

### 1a. GeminiGen 视频生成
*   **单元测试**:
    *   `platforms/geminiGen/autoPilot.js` 中 `runGenAutomation()` 的参数校验和内部状态管理。
    *   `monitorResult()` 函数对不同生成结果（成功、失败、超时）的处理逻辑。
*   **集成测试**:
    *   模拟 `content.js` 发送 `OPEN_GEMINIGEN_TAB` 消息到 `background.js`，验证 `background.js` 是否正确打开 GeminiGen 页面并注入 `autoPilot.js`。
    *   验证 `autoPilot.js` 执行过程中与 GeminiGen 页面的 DOM 交互是否正确。
*   **端到端测试**:
    *   用户在 React 界面选择 GeminiGen 引擎，输入视频生成参数。
    *   验证 GeminiGen 页面是否被正确打开，自动化流程是否顺利执行。
    *   验证视频是否成功生成，并回传到 React 界面。

### 1b. Veo 3 Direct API 生成
*   **单元测试**:
    *   `veoService.ts` 中 `generateVideo()` 方法的输入校验、API 请求构建逻辑。
    *   `initiateGeneration()` 和 `pollOperation()` 中错误处理和状态轮询逻辑。
*   **集成测试**:
    *   Mock Gemini API 响应，验证 `VeoService.generateVideo()` 是否正确处理 API 返回的不同状态（成功、进行中、失败）。
    *   验证轮询机制在不同超时和成功条件下的行为。
*   **端到端测试**:
    *   用户在 React 界面选择 Veo 3 Direct API 引擎，输入视频生成参数。
    *   验证 API 调用是否成功发起，并在 React 界面显示生成进度。
    *   验证视频是否成功生成，并回传到 React 界面。

### 1c. Google Flow 视频生成
*   **单元测试**:
    *   `platforms/googleFlow/autoPilot.js` 中 `executeAutomation()` 的流程控制和参数处理。
    *   `monitorVideoResult()` 对视频结果的判定逻辑。
*   **集成测试**:
    *   模拟 `content.js` 发送 `GOOGLE_FLOW_GENERATE` 消息到 `background.js`，验证 `background.js` 是否正确打开 Google Flow 页面并注入 `autoPilot.js`。
    *   验证 `autoPilot.js` 与 Google Flow 页面的 DOM 交互。
*   **端到端测试**:
    *   用户在 React 界面选择 Google Flow 引擎，输入视频生成参数。
    *   验证 Google Flow 页面是否被正确打开，自动化流程是否顺利执行。
    *   验证视频是否成功生成，并回传到 React 界面。

### 1d. Google Vids 视频生成
*   **单元测试**:
    *   `platforms/googleVids/workflow.js` 中 `runGoogleVidsAutomation()` 的业务逻辑和状态管理。
    *   `waitForVideoGeneration()` 的等待和超时处理。
*   **集成测试**:
    *   模拟 `content.js` 发送 `GOOGLE_VIDS_GENERATE` 消息到 `background.js`，验证 `background.js` 是否正确打开 Google Vids 页面并注入 `workflow.js`。
    *   验证 `workflow.js` 与 Google Vids 页面的 DOM 交互。
*   **端到端测试**:
    *   用户在 React 界面选择 Google Vids 引擎，输入视频生成参数。
    *   验证 Google Vids 页面是否被正确打开，自动化流程是否顺利执行。
    *   验证视频是否成功生成，并回传到 React 界面。

### 2. 视频结果回传 React
*   **单元测试**:
    *   `processFoundVideo()` 函数对不同格式视频数据的处理，确保 base64 编码正确。
*   **集成测试**:
    *   模拟 `background.js` 接收视频生成结果并调用 `relayGeminiVideoResult`，验证 `content.js` 是否正确接收并向 React 页面 `window.postMessage`。
    *   验证 React 应用程序是否正确监听 `window.postMessage` 事件并更新 UI。
*   **端到端测试**:
    *   在任意视频生成引擎完成视频生成后，验证 React 界面是否实时显示视频结果或生成状态更新。

### 3. 视频数据存储
*   **单元测试**:
    *   `storeVideoData` 函数将视频元数据格式化并准备存储的逻辑。
*   **集成测试**:
    *   模拟 `PREPARE_YOUTUBE_UPLOAD` 消息触发 `storeVideoData`，验证 Chrome Storage (`pendingUploads`) 是否正确存储了视频元数据。
    *   验证从 Chrome Storage 读取视频数据的操作是否正确。
*   **端到端测试**:
    *   视频生成并回传 React 后，验证相关视频数据是否在内部被正确暂存，为后续上传准备。

### 4. YouTube Studio 自动上传
*   **单元测试**:
    *   `platforms/youtube/studioUploader.js` 中各个独立步骤（如填写标题、描述、选择可见性）的 DOM 操作函数的有效性。
*   **集成测试**:
    *   模拟 `background.js` 收到上传请求，并打开 `studio.youtube.com` 页面，注入 `studioUploader.js`。
    *   验证 `studioUploader.js` 与 YouTube Studio 页面 DOM 元素的交互，包括表单填充和按钮点击。
    *   测试异常情况，如网络错误、页面元素未找到等。
*   **端到端测试**:
    *   从 React 界面触发 YouTube Studio 自动上传流程。
    *   验证 YouTube Studio 页面是否被正确导航，所有上传字段是否被自动填充。
    *   验证视频是否成功上传，并能在 YouTube Studio 中看到发布状态。

### 5. 上传完成通知
*   **单元测试**:
    *   `studioUploader.js` 中发送 `YOUTUBE_UPLOAD_COMPLETE` 消息的逻辑。
*   **集成测试**:
    *   模拟 `studioUploader.js` 发送 `YOUTUBE_UPLOAD_COMPLETE` 消息到 `background.js`，验证 `background.js` 是否正确中继此消息到 `content.js`，再由 `content.js` `postMessage` 到 React。
    *   验证 React 应用程序是否正确接收此通知并更新 UI 状态，例如显示上传成功消息或触发评论自动化流程。
*   **端到端测试**:
    *   在视频自动上传完成后，验证 React 界面是否显示上传成功通知，并检查是否触发了后续的评论自动化注册流程。

### 6. 视频下载代理 (CORS)
*   **单元测试**:
    *   `downloadVideo` 函数在 `background.js` 中处理 URL 和请求头，执行 `fetch()` 的逻辑。
*   **集成测试**:
    *   模拟 `content.js` 发送 `downloadVideo` 请求到 `background.js`，并提供一个测试视频 URL。
    *   验证 `background.js` 是否能成功下载视频数据并返回 base64 编码。
    *   测试不同视频源（同源、跨域）和文件大小的下载能力。
*   **端到端测试**:
    *   在需要预览或处理外部视频时，验证视频数据是否能通过代理成功下载并在 React 界面展示。

## 2. 闭环 ② 📊 YouTube Analytics 数据收集

### 7. Ask Studio AI 问答
*   **单元测试**:
    *   `youtube-analytics.js` 中 `askStudio(question)` 函数构建 AI 提问 prompt 的逻辑。
*   **集成测试**:
    *   Mock YouTube Studio AI 的响应，验证 `askStudio()` 是否正确发送问题并解析返回结果。
    *   测试不同类型问题的发送和响应解析。
*   **端到端测试**:
    *   用户在 React 界面触发 Ask Studio AI 提问。
    *   验证 YouTube Studio AI 面板是否打开，问题是否被正确输入并发送。
    *   验证 AI 返回的答案是否被正确捕获和显示。

### 8. Ask Studio 面板打开
*   **单元测试**:
    *   `youtube-analytics.js` 中 `ensurePanelOpen()` 的 DOM 查询和点击逻辑。
*   **集成测试**:
    *   在模拟的 YouTube Studio 页面环境中，验证 `ensurePanelOpen()` 能否准确找到并点击 AI 面板按钮。
    *   测试面板已打开和未打开两种情况。
*   **端到端测试**:
    *   用户在 React 界面触发 Analytics 数据收集。
    *   验证 YouTube Studio 页面中 AI 面板是否被成功打开。

### 9. 多类别串行采集 (7 类)
*   **单元测试**:
    *   `youtube-analytics.js` 中 `askMultipleQuestions()` 函数的串行执行逻辑和对不同类别的处理。
*   **集成测试**:
    *   Mock `askStudio()` 或 DOM 抓取的结果，验证 `askMultipleQuestions()` 是否按顺序请求/抓取 7 个类别的数据。
    *   测试中间某个类别采集失败时的错误处理。
*   **端到端测试**:
    *   用户触发 Analytics 数据收集后，验证 7 个类别的 Analytics 数据是否按预期顺序被采集并显示在 React 界面。

### 10. Direct DOM 数据抓取
*   **单元测试**:
    *   `youtube-analytics.js` 中 `scrapeActiveChart()` 的 DOM 查询和 SVG 数据提取逻辑。
*   **集成测试**:
    *   在模拟的 YouTube Studio 页面环境中，提供包含图表 SVG 的 DOM 结构。
    *   验证 `scrapeActiveChart()` 是否能正确提取 SVG 数据。
    *   测试不同图表结构和空数据的情况。
*   **端到端测试**:
    *   用户触发 Analytics 数据收集，并选择 DOM 抓取模式。
    *   验证图表数据是否被成功抓取并显示在 React 界面。

### 11. YPP 实时数据采集
*   **单元测试**:
    *   `youtube-analytics.js` 中 `scrapeYPPData()` 的 DOM 查询和数据提取逻辑。
*   **集成测试**:
    *   在模拟的 YouTube YPP 资格页面环境中，提供包含订阅/观看数据的 DOM 结构。
    *   验证 `scrapeYPPData()` 是否能正确提取 YPP 数据。
*   **端到端测试**:
    *   用户触发 YPP 数据采集。
    *   验证系统是否能正确导航到 YPP 资格页面，并成功抓取订阅和观看数据，显示在 React 界面。

### 12. 分析数据回传 React
*   **单元测试**:
    *   `background.js` 中处理 `ANALYTICS_DATA` 消息并传递到 `content.js` 的逻辑。
*   **集成测试**:
    *   模拟 `background.js` 发送 `ANALYTICS_DATA` 消息，验证 `content.js` 是否正确接收并 `window.postMessage` 到 React。
    *   验证 React 应用程序是否正确监听此事件并更新 Analytics Dashboard。
*   **端到端测试**:
    *   完成 Analytics 数据采集后，验证 React 界面中的 Analytics Dashboard 是否实时更新并展示采集到的数据。

## 3. 闭环 ③ 🧠 DFL 动态反馈循环

### 13. DFL 自动触发
*   **单元测试**:
    *   `youtube-analytics.js` 中 `checkAutoTrigger()` 函数的定时逻辑和触发条件判断。
*   **集成测试**:
    *   模拟定时器和相关状态，验证 `checkAutoTrigger()` 是否在满足条件时正确发起 DFL 循环。
*   **端到端测试**:
    *   配置 DFL 自动触发，验证系统是否在预定时间自动启动数据采集和 DFL 流程。

### 14. 病毒信号检测
*   **单元测试**:
    *   `dflLearningService.ts` 中 `runDFLLearningCycle()` 的核心算法，根据输入数据（firstHourVelocity, rewatchRatio, subsConversion）判断信号等级（EXTREME/HIGH/NORMAL）。
    *   测试信号阈值表的边界条件。
*   **集成测试**:
    *   提供模拟的 Analytics 数据输入，验证 `runDFLLearningCycle()` 是否正确输出信号等级和相应的操作建议。
    *   验证 React 界面与 `dflLearningService.ts` 之间的数据交互。
*   **端到端测试**:
    *   通过注入特定 Analytics 数据，模拟 EXTREME, HIGH, NORMAL 信号，验证 DFL 系统是否能正确检测并显示信号等级。

### 15. 病毒响应-内容生成
*   **单元测试**:
    *   `YouTubeAnalytics.tsx` 中 `triggerViralContentGeneration()` 的逻辑，根据信号等级调度视频生成。
*   **集成测试**:
    *   模拟 `triggerViralContentGeneration()` 被调用，验证是否正确向 `background.js` 发送视频生成请求。
*   **端到端测试**:
    *   模拟病毒信号检测为 EXTREME/HIGH，验证 DFL 系统是否自动触发闭环①的视频生成流程。

### 16. DFL 报告解析
*   **单元测试**:
    *   `youtube-analytics.js` 中 `parseDFLReport(responseText)` 函数解析 Ask Studio 返回的 DFL 报告文本的逻辑，确保结构化数据提取正确。
*   **集成测试**:
    *   提供不同格式的模拟 Ask Studio DFL 报告文本，验证 `parseDFLReport()` 是否能稳健地解析并提取关键信息。
*   **端到端测试**:
    *   DFL 循环中，验证 Ask Studio 返回的 DFL 报告是否被成功解析并在系统中应用。

### 17. DFL 排期调整
*   **单元测试**:
    *   `background.js` 中 `rescheduleVideo` 函数根据信号强度调整发布排期的逻辑。
*   **集成测试**:
    *   模拟 `content.js` 发送 `DFL_SCHEDULE_ADJUST_REQUEST` 消息，包含不同的信号强度和视频 ID。
    *   验证 `background.js` 是否正确更新视频的发布排期。
*   **端到端测试**:
    *   在 DFL 检测到 EXTREME/HIGH 信号后，验证系统是否自动调整了相关视频的发布排期。

## 4. 闭环 ④ 📝 计划生成

### 18. Ask Studio 发布计划生成
*   **单元测试**:
    *   `youtube-analytics.js` 中 `runAnalyticsAgent(payload)` 构建发布计划 prompt 的逻辑。
*   **集成测试**:
    *   模拟 `content.js` 发送 `ASK_STUDIO_GENERATE_PLAN` 消息到 `background.js`，验证 `background.js` 是否正确调用 `runAnalyticsAgent()`。
    *   Mock Ask Studio AI 的响应，验证是否能正确处理并传递。
*   **端到端测试**:
    *   用户在 React 界面请求生成发布计划。
    *   验证 Ask Studio AI 是否被正确触发，并返回一份发布计划。

### 19. 计划数据适配
*   **单元测试**:
    *   `askStudioAdapter.ts` 中 `adaptAskStudioResponse()` 函数将 AI 返回的原始文本转换为标准数据格式的逻辑。
    *   测试不同 AI 响应格式的健壮性。
*   **集成测试**:
    *   提供原始的 AI 响应文本作为输入，验证 `adaptAskStudioResponse()` 是否能正确输出结构化的计划数据。
*   **端到端测试**:
    *   Ask Studio AI 返回计划后，验证计划数据是否被成功适配并显示在 React 界面。

### 20. 计划验证与清洗
*   **单元测试**:
    *   `askStudioAdapter.ts` 中 `validatePlanStructure()` 验证计划结构完整性的逻辑。
    *   `sanitizePlanData()` 清洗异常数据的逻辑（如去除不必要的字符、处理空值）。
*   **集成测试**:
    *   提供包含完整、缺失或异常字段的计划数据，验证 `validatePlanStructure()` 和 `sanitizePlanData()` 的行为。
*   **端到端测试**:
    *   Ask Studio AI 返回计划并经过适配后，验证计划数据是否通过了验证与清洗，确保数据的可用性和正确性。

## 5. 闭环 ⑤ 💬 评论自动化

### 21. 定时评论注册
*   **单元测试**:
    *   `background.js` 中 `storeScheduledComment` 函数将定时评论任务存储到 Chrome Storage 的逻辑。
*   **集成测试**:
    *   模拟 `content.js` 发送 `REGISTER_SCHEDULED_COMMENT` 消息，验证 Chrome Storage 是否正确记录了评论任务。
    *   验证从 Chrome Storage 读取评论任务的逻辑。
*   **端到端测试**:
    *   视频上传完成后，验证是否成功注册了定时评论任务，并在 React 界面显示相关状态。

### 22. 定时评论执行
*   **单元测试**:
    *   `platforms/youtube/commentAutomation.js` 中 `postComment()` 函数的 DOM 操作（输入评论内容、点击发布）。
    *   `scheduledCommentMonitor.js` 中 `runCheck()` 函数的定时和任务调度逻辑。
*   **集成测试**:
    *   在模拟的 YouTube 视频页面环境中，验证 `postComment()` 是否能成功发布评论。
    *   模拟 `scheduledCommentMonitor.js` 找到待执行的评论任务，验证其是否能触发 `postComment()`。
*   **端到端测试**:
    *   在预定的评论发布时间到达后，验证主账号是否成功发布了置顶评论。

### 23. Ignite 2.0 马甲评论
*   **单元测试**:
    *   `YouTubeCommentAutomation` 中 `storeIgniteScript()` 和 `executeIgniteQueue()` 的队列管理和马甲账号切换逻辑。
*   **集成测试**:
    *   模拟 `content.js` 发送 `IGNITE_SCRIPT` 消息。
    *   在模拟的 YouTube 视频页面环境中，验证 `executeIgniteQueue()` 是否能按序切换马甲账号并发布评论。
    *   测试多个马甲账号的串行评论流程。
*   **端到端测试**:
    *   主评论发布后，验证 Ignite 马甲账号是否按序发布了后续评论。

### 24. DFL 自动评论
*   **单元测试**:
    *   `background.js` 中 `triggerAskStudio` (source: DFL_AUTO_COMMENT) 构建 AI 评论 prompt 的逻辑。
*   **集成测试**:
    *   模拟 `content.js` 发送 `DFL_AUTO_COMMENT_REQUEST` 消息，验证 `background.js` 是否正确触发 Ask Studio 生成评论。
    *   Mock Ask Studio 响应，验证评论生成和发布流程。
*   **端到端测试**:
    *   在 DFL 系统检测到特定信号后，验证是否自动触发 AI 生成评论，并在视频下方发布。

## 6. 闭环 ⑥ 🌐 跨平台分发

### 25. 跨平台分发编排
*   **单元测试**:
    *   `background.js` 中 `crossPlatformDistribute` 函数的调度逻辑，确保并行调用各个平台的分发功能。
*   **集成测试**:
    *   模拟 `content.js` 发送 `CROSS_PLATFORM_DISTRIBUTE` 消息。
    *   Mock 各个平台的上传/发帖函数，验证 `crossPlatformDistribute` 是否正确调用它们。
*   **端到端测试**:
    *   用户从 React 界面触发跨平台分发，验证视频/内容是否同时分发到 YouTube, TikTok, X/Twitter。

### 26. TikTok 上传
*   **单元测试**:
    *   `platforms/tiktok/tiktokAutoPilot.js` 中各个独立步骤（如填写标题、选择封面）的 DOM 操作函数的有效性。
*   **集成测试**:
    *   模拟 `background.js` 收到 TikTok 上传请求，并打开 TikTok 页面注入 `tiktokAutoPilot.js`。
    *   验证 `tiktokAutoPilot.js` 与 TikTok 页面的 DOM 交互。
*   **端到端测试**:
    *   触发 TikTok 上传，验证视频是否成功上传到 TikTok 平台。

### 27. X/Twitter 发帖
*   **单元测试**:
    *   `platforms/x/xAutoPilot.js` 中 `xPost()` 函数的 DOM 操作（输入推文内容、点击发布）。
*   **集成测试**:
    *   模拟 `background.js` 收到 X/Twitter 发帖请求，并打开 X/Twitter 页面注入 `xAutoPilot.js`。
    *   验证 `xAutoPilot.js` 与 X/Twitter 页面的 DOM 交互。
*   **端到端测试**:
    *   触发 X/Twitter 发帖，验证推文是否成功发布到 X/Twitter 平台，并包含 YouTube 链接。

## 7. 闭环 ⑦ 🔧 系统基础设施

### 28. 扩展健康检查
*   **单元测试**:
    *   `content.js` 中 `ping` 函数的逻辑，确保它能正确响应 `CHECK_EXTENSION_STATUS` 消息。
*   **集成测试**:
    *   模拟 `content.js` 发送 `CHECK_EXTENSION_STATUS` 消息，验证 `background.js` 是否能接收并返回心跳响应。
    *   测试扩展不可用时的错误路径。
*   **端到端测试**:
    *   验证 React 界面是否能准确显示 Chrome 扩展的健康状态。

### 29. 消息确认系统 (ACK)
*   **单元测试**:
    *   `content.js` 中 `sendMessageWithAck()` 和 `setupAckListener()` 的消息 ID 管理、定时器和回调处理逻辑。
*   **集成测试**:
    *   模拟 `content.js` 发送带 ACK 的消息到 `background.js`，验证 `background.js` 是否能正确响应 ACK。
    *   测试 ACK 超时、重复消息等异常情况。
*   **端到端测试**:
    *   在关键消息传递场景（如视频生成结果回传），验证消息确认机制是否正常工作，确保消息不丢失。

### 30. Background ↔ Page 双向消息桥
*   **单元测试**:
    *   `content.js` 中 `chrome.runtime.onMessage` 处理来自 `background.js` 消息的逻辑。
    *   `content.js` 中 `window.addEventListener('message')` 处理来自 React 消息的逻辑。
*   **集成测试**:
    *   **方向 A (Background → React)**: 模拟 `background.js` 发送消息到 `content.js`，验证 `content.js` 是否正确添加 `source:'extension'` 并 `window.postMessage`。
    *   **方向 B (React → Background)**: 模拟 React 页面 `window.postMessage` 消息，验证 `content.js` 是否正确过滤并 `chrome.runtime.sendMessage` 到 `background.js`。
    *   测试消息过滤、数据序列化/反序列化。
*   **端到端测试**:
    *   执行任何涉及 React 与 Chrome 扩展通信的关键业务流程（例如：触发视频生成、收集 Analytics 数据），验证双向消息桥的完整性。这是所有 E2E 测试的基础，如果它失败，则意味着整个扩展的核心通信机制被破坏。

## 8. 闭环 ⑧ 🎨 React 前端核心

### 31. 前端核心功能集 (31-a to 31-f)
由于这是一个复合功能，我们将针对其子项进行更细致的测试。

#### 31-a. API Key 认证与初始化
*   **单元测试**:
    *   `App.tsx` 中 API Key 校验逻辑、初始化服务逻辑。
*   **集成测试**:
    *   模拟不同 API Key 状态（有效、无效、缺失），验证 `App.tsx` 是否正确处理认证和初始化流程。
    *   验证 Gemini API Key 是否被正确加载和使用。
*   **端到端测试**:
    *   首次加载应用，验证用户是否被提示输入 API Key。
    *   输入有效 Key 后，验证应用是否成功初始化并进入主界面。
    *   输入无效 Key 后，验证错误提示是否正确显示。

#### 31-b. 视频生成主流程 (4 引擎调度)
*   **单元测试**:
    *   `App.tsx` 中 `handleSubmit()` 调度不同视频生成引擎的逻辑。
    *   `geminiService.ts` 中根据选择的引擎构建请求的逻辑。
*   **集成测试**:
    *   Mock 各个生成引擎的 API，验证 `handleSubmit()` 是否能根据用户选择正确调用相应的服务。
*   **端到端测试**:
    *   在 React 界面选择不同的视频生成引擎，并验证是否能成功触发对应的生成流程。

#### 31-c. YouTube Analytics Dashboard
*   **单元测试**:
    *   `YouTubeAnalytics.tsx` 中各个图表组件的数据渲染逻辑、交互逻辑。
*   **集成测试**:
    *   Mock Analytics 数据，验证 `YouTubeAnalytics.tsx` 是否能正确加载和显示所有图表和数据点。
    *   测试图表交互（如缩放、筛选）是否正常。
*   **端到端测试**:
    *   完成 Analytics 数据采集后，验证 `YouTubeAnalytics.tsx` 页面是否完整、准确地展示所有 Analytics 数据和图表。

#### 31-d. DFL 控制面板
*   **单元测试**:
    *   `YouTubeAnalytics.tsx` 中 DFL 状态管理（如自动触发开关、信号显示）的逻辑。
*   **集成测试**:
    *   模拟 DFL 信号和状态更新，验证控制面板是否能正确响应并显示。
*   **端到端测试**:
    *   在 DFL 循环运行时，验证 `YouTubeAnalytics.tsx` 中的 DFL 控制面板是否实时显示 DFL 状态和信号等级，用户是否能进行相关操作。

#### 31-e. 多语言切换
*   **单元测试**:
    *   `contexts/LocalizationContext.tsx` 中语言切换逻辑和文本加载逻辑。
*   **集成测试**:
    *   切换不同语言，验证 UI 文本是否正确更新。
*   **端到端测试**:
    *   用户在应用中切换语言，验证整个应用（包括 React UI 和可能的扩展界面）的文本是否能正确切换到选定语言。

#### 31-f. 通知系统
*   **单元测试**:
    *   `services/notificationService.ts` 中通知生成、显示和清除的逻辑。
*   **集成测试**:
    *   模拟不同类型的通知（成功、失败、警告），验证通知系统是否能正确显示和管理这些通知。
*   **端到端测试**:
    *   在应用中触发各种操作（如视频生成成功、上传失败），验证通知系统是否能及时、准确地显示相关通知。

---

**总结**:

这份文档提供了所有黄金功能的测试用例设计框架。在实际开发中，需要根据具体实现细节进一步细化每个测试用例，并确保测试覆盖率满足项目要求。特别强调基础设施（如 #30 消息桥）的健壮性测试，因为它们的失败会导致整个系统瘫痪。

在 `CLAUDE.md` 中提到的 `npm run verify:golden full` 和 `npm run verify:e2e all` 命令将是执行这些测试用例的核心机制。通过持续集成，这些测试将作为代码质量的最后一道防线。
