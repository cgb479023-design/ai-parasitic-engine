# AI 内容创作智能化平台 - 需求文档 (V3.1)

## 1. 功能概述 (Feature Overview)

*   **功能名称 (Feature Name)**: AI 内容创作智能化平台
*   **功能描述 (Description)**: 本平台旨在通过集成先进的 AI 能力和自动化工作流，为内容创作者提供一个智能化、高效率的视频及多媒体内容生产、分发与分析系统。它涵盖从素材处理、视频生成、跨平台发布、用户互动（评论自动化、动态反馈）、到数据分析与质量保障的全链路服务，大幅提升内容创作的效率和质量，并严格遵循黄金功能保护与多重验证机制，确保系统稳定与安全。

## 2. 用户故事 (User Stories)

*   **作为内容创作者**，我想要快速将我的视频素材转化为符合平台要求的短视频，并自动配上背景音乐，以便我能高效地发布到多个社交媒体平台。
*   **作为运营人员**，我想要系统自动收集和分析我的 YouTube 频道数据，并根据数据趋势提供内容优化建议，以便我能更好地理解受众并调整我的创作策略。
*   **作为平台管理者**，我希望系统能自动处理用户评论，并提供智能回复和互动，以便我能维护社区活跃度并减轻人工运营负担。
*   **作为开发者**，我希望平台提供标准化的工作流、严格的质量保障和安全策略，以便我能高效、安全地进行新功能开发和迭代，同时确保不破坏核心“黄金功能”。
*   **作为内容审核员**，我希望系统能够对生成内容进行初步的病毒检测和内容合规性检查，以便在发布前识别并避免潜在风险。

## 3. 预期行为 (Expected Behavior)

### 3.1. 正常流程 (Normal Flow)

*   用户上传视频素材后，系统能基于 GeminiGen 和 Veo3 API 自动进行视频剪辑、添加音乐，并在指定时间内（例如 20 秒内）完成处理并通知用户。
*   系统能通过 Ask Studio AI 和 DOM 抓取，定期从 YouTube 收集 Analytics 数据，并展示在用户 Dashboard 中。
*   核心自动化功能（如 `handleCommentAction`）应正常执行其业务逻辑，而非占位符。
*   系统在执行任务时，能利用多进程并发机制，同时处理本地和网页端的多个任务，提升整体效率。
*   新功能开发应遵循“计划优先模式”，经过充分设计和验证后才进入编码阶段，确保编辑通过率高于 92%。
*   代码提交前，系统应自动执行类型检查、Linting 和端到端测试，确保代码质量和功能完整性。

### 3.2. 异常处理 (Error Handling)

*   所有处理外部数据的代码（如 API 响应、用户输入）必须包含防御性检查，例如 `if (!data || !data.videoUrl)`，以避免因数据无效导致的系统崩溃。
*   当系统遇到错误时（如网络中断、API 调用失败），应提供用户友好的错误信息，并在后端记录详细的错误日志，而不会泄露敏感信息。
*   安全敏感操作（如认证、数据存储）应遵循 `/permissions` 白名单机制，防止未经授权的访问。
*   当 `npm run test` 脚本失效时，系统应能通过 `build-error-resolver` 等工具自动识别并协助修复。

### 3.3. 边界条件 (Edge Cases)

*   在多进程并发场景下，系统应能稳定处理高并发请求，避免资源竞争和死锁。
*   针对空输入、超大数据量或特殊字符输入，系统应能进行有效的输入验证和处理，防止潜在的攻击或错误。
*   在 Chrome 扩展环境中，`chrome.storage`, `chrome.runtime`, `chrome.tabs` 等受保护 API 的调用应遵循 `EXT_CONSTANTS` 中定义的规则，确保兼容性和安全性。
*   极端网络环境下，系统应有重试机制或优雅降级方案，保证核心功能的可用性。

## 4. 相关联的黄金功能 (Related Golden Functions)

本平台的核心功能围绕以下 8 大闭环及 31 个黄金功能构建：

*   **① 🎬 视频生成与上传**: #1a (GeminiGen), #2 (Veo3 API 整合), #3 (Google Flow 驱动), #4 (Google Vids 输出), #5 (视频处理), #6 (自动上传)
*   **② 📊 Analytics 数据收集**: #7 (Ask Studio AI 整合), #8 (DOM 抓取), #9 (YPP 采集), #10 (数据分析), #11 (报告生成), #12 (趋势预测)
*   **③ 🧠 DFL 动态反馈**: #13 (自动触发机制), #14 (病毒检测), #15 (内容生成), #16 (反馈处理), #17 (策略调整)
*   **④ 📝 计划生成**: #18 (Ask Studio 计划), #19 (数据适配), #20 (计划验证)
*   **⑤ 💬 评论自动化**: #21 (定时评论), #22 (Ignite 马甲), #23 (DFL 自动评论), #24 (互动管理)
*   **⑥ 🌐 跨平台分发**: #25 (YouTube 分发), #26 (TikTok 分发), #27 (X/Twitter 分发)
*   **⑦ 🔧 系统基础设施**: #28 (健康检查), #29 (ACK 机制), #30 (双向消息桥) - **#30 是全系统核心**
*   **⑧ 🎨 React 前端**: #31 (API 认证), #31 (视频生成界面), #31 (Dashboard), #31 (多语言支持)

## 5. 影响模块与文件 (Affected Modules & Files)

此项目的功能将主要影响以下模块和关键文件：

*   `content.js`: 处理 Chrome 扩展程序的内容脚本逻辑，与页面交互。
*   `background.js`: 处理 Chrome 扩展程序的后台逻辑，如消息传递、API 调用、跨平台分发。
*   `services/geminiService.ts`: GeminiGen 视频生成服务。
*   `services/veoService.ts`: Veo3 API 集成服务。
*   `autoPilot.js`, `workflow.js`: 视频生成与上传的工作流控制。
*   `youtube-analytics.js`: YouTube Analytics 数据收集脚本。
*   `YouTubeAnalytics.tsx`: React 前端分析数据展示组件。
*   `dflLearningService.ts`: DFL 动态反馈学习服务。
*   `askStudioAdapter.ts`: Ask Studio 计划生成的数据适配器。
*   `commentAutomation.js`: 评论自动化服务。
*   `App.tsx`: React 前端主应用入口。
*   `components/CanvasPanel.tsx`: 前端画布操作组件。
*   `services/performanceMonitorService.ts`: 性能监控服务。
*   `services/errorTrackingService.ts`: 错误追踪服务。
*   `services/securityScanService.ts`: 安全扫描服务。
*   `services/codeReviewService.ts`: 代码审查服务。
*   `scripts/deploy.js`: 自动化部署脚本。
*   `services/configManagerService.ts`: 配置管理服务。
*   `services/dependencyManagerService.ts`: 依赖管理服务。
*   `constants.ts`: 包含 `EXT_CONSTANTS` 等关键常量定义。

## 6. 前后端交互 (Frontend-Backend Interaction)

### 6.1. API 定义 (API Definition)

*   **API 认证**: 提供 OAuth2 或 JWT 等认证机制，确保前端请求的合法性。
*   **视频生成**: `POST /api/video/generate`
    *   请求体: `{ "materials": [...], "templateId": "...", "style": "..." }`
    *   响应体: `{ "status": "processing", "videoId": "..." }` 或 `{ "status": "completed", "videoUrl": "..." }`
*   **Analytics 数据**: `GET /api/analytics/youtube`
    *   请求参数: `{ "channelId": "...", "startDate": "...", "endDate": "..." }`
    *   响应体: `{ "data": [...], "metadata": { "totalViews": ..., "subscribers": ... } }`
*   **评论自动化**: `POST /api/comments/schedule`
    *   请求体: `{ "videoId": "...", "commentText": "...", "scheduleTime": "..." }`
    *   响应体: `{ "status": "scheduled", "commentId": "..." }`
*   **跨平台发布**: `POST /api/publish`
    *   请求体: `{ "videoId": "...", "platforms": ["youtube", "tiktok"], "title": "..." }`
    *   响应体: `{ "status": "publishing", "jobId": "..." }`
*   **DFL 反馈**: `POST /api/dfl/feedback`
    *   请求体: `{ "contentId": "...", "feedbackType": "...", "detail": "..." }`
    *   响应体: `{ "status": "received" }`

### 6.2. 数据实体 (Data Entities)

*   **User**: `id`, `username`, `email`, `subscriptionStatus`
*   **Video**: `id`, `title`, `description`, `thumbnailUrl`, `videoUrl`, `status`, `creatorId`, `uploadDate`, `platforms`
*   **AnalyticsReport**: `id`, `videoId`, `channelId`, `views`, `likes`, `comments`, `subscribers`, `reportDate`
*   **Comment**: `id`, `videoId`, `userId`, `text`, `status`, `scheduleTime`
*   **Task**: `id`, `type`, `status`, `progress`, `result`, `createdAt`, `updatedAt`

## 7. UI/UX 设计 (UI/UX Design)

*   **主 Dashboard**: 提供视频概览、Analytics 数据图表、任务队列和系统状态监控。
*   **视频生成界面**: 直观的素材上传区、模板选择器、AI 剪辑选项和实时预览功能。
*   **Analytics 面板**: 可定制的数据视图，支持时间范围选择、指标筛选和图表类型切换（如 `YouTubeAnalytics.tsx`）。
*   **评论自动化配置**: 评论内容编辑、定时策略设置、马甲账号管理界面。
*   **系统通知**: 统一的消息中心，展示任务完成、错误警告、DFL 反馈等信息。
*   **设计系统**: 遵循 React 19, Tailwind CSS 和 Lucide icons 的设计规范，确保界面一致性和现代感。
*   **复杂前端页面验证**: 在开发复杂前端交互（如 TikTok Studio）时，需要提供 F12 Console 调试指令供用户手工验证选择器和事件的 100% 有效性，避免盲目猜测。

## 8. 技术考量 (Technical Considerations)

*   **AI 模型选择**: 核心逻辑采用 Opus 4.5+ 模型进行思考和推理，以保证代码理解深度和工具调用成功率。对于轻量级任务或频繁调用的场景，可考虑 Haiku 4.5。
*   **并发处理**: 利用多进程并发技术 (`&` 命令, `--teleport` 等) 实现本地和网页端任务的高效同步处理，提升整体吞吐量。
*   **上下文管理**: 随时监控上下文窗口使用情况，当超过 80% 时主动进行 `/compact` 操作，以优化模型性能和成本。
*   **开发环境**: 优先建议在 `tmux` 中运行服务，使用 `/fork` 处理并行任务。
*   **Git 工作流**: 遵循 Conventional Commits 规范，提交前运行 `/refactor-clean` 进行代码清理。
*   **依赖管理**: 使用 Bun/NPM 作为标准包管理器，并通过 `dependencyManagerService.ts` 进行依赖扫描和管理。
*   **安全**: 严格遵循 `/permissions` 白名单策略，避免使用 `--dangerously-skip-permissions`。在代码提交前，必须通过 `security-reviewer` 进行安全扫描，确保没有硬编码密钥、SQL 注入、XSS 等漏洞。
*   **质量保障**: 引入三重验证设计（PostToolUse 钩子、AgentStop 回归测试、ralph-wiggum 沙盒验证）和全面的回归检查清单，确保代码质量和系统稳定性。
*   **可观测性**: 集成 MCP 协议，深度对接 Slack/Sentry/BigQuery 进行日志、监控和警报。
*   **扩展性**: 采用增强的 Skills 系统，通过 `performance-monitor`, `error-tracking`, `security-scan`, `code-review` 等服务模块化地扩展平台能力。

## 9. 验收标准 (Acceptance Criteria)

*   **功能完整性**:
    *   所有 31 个黄金功能（如 CLAUDE.md 中所述）必须完全实现并通过验证。
    *   新功能开发必须经过“计划优先模式”设计，确保编辑通过率达到 92% 以上。
    *   `npm run test` 脚本必须能稳定运行并通过所有测试。
    *   所有 TODO/FIXME 占位符必须被实际的功能代码替代。
*   **性能指标**:
    *   视频生成与上传的核心工作流，用户从点击生成到收到完成通知的端到端时间不超过 20 秒。
    *   Analytics 数据收集和展示响应时间在合理范围内，确保用户体验流畅。
    *   系统整体代码质量提升 300%，返工时间减少 80%。
*   **质量与可靠性**:
    *   代码测试覆盖率达到 80% 以上，包括单元测试、集成测试和端到端测试。
    *   每次代码修改后，必须通过 `npm run type-check` 和 `npm run lint` 检查。
    *   通过 `npm run verify:golden full` 和 `npm run verify:e2e all` 验证所有黄金功能和端到端场景无回归。
    *   `npm run snapshot compare` 结果应显示没有意外的逻辑破坏。
*   **安全性**:
    *   系统无硬编码密钥、敏感配置。
    *   所有用户输入经过严格验证。
    *   不存在 SQL 注入、XSS、CSRF 等 OWASP Top 10 漏洞。
    *   API 端点均受认证和授权保护。
*   **用户体验**:
    *   前端界面响应迅速，交互流畅，符合 UI/UX 设计规范。
    *   错误信息清晰明了，便于用户理解和采取行动。
    *   系统通知及时有效，反馈关键任务状态。

---
**提示**: 请尽可能详细地填写以上信息，这将有助于我更准确地理解您的需求，并自动进行后续的规划和代码生成。
