# YouTubeAnalytics 功能迁移计划

基于 V3.1 需求文档，将旧版 15,511 行单体文件中的缺失功能迁移到已重构的模块化架构。

> [!IMPORTANT]
> 迁移策略：**复制→适配→集成→验证**，不修改旧版文件，仅从中提取代码。

---

## P0 — 核心基础设施 (闭环状态管理)

需求映射: §3.1 核心自动化功能, §4 黄金功能 #28-#30

### Core Utils

#### [NEW] [closedLoopHelpers.ts](file:///i:/ai-内容创作智能化平台/src/components/YouTubeAnalytics/utils/closedLoopHelpers.ts)
- 从旧版 L96-178 提取 `safeSetState`, `safeGetState`, `safeLog`
- 导入 `getStateManager`, `getAuditTrailService` from `../../../services`
- 导出函数供 hooks 和 panels 使用

#### [NEW] [nlReportParser.ts](file:///i:/ai-内容创作智能化平台/src/components/YouTubeAnalytics/utils/nlReportParser.ts)
- 从旧版 L180-336 提取 `parseNaturalLanguageReport`
- 用于 Ask Studio 文本报告解析（黄金功能 #7, #11）

#### [NEW] [analyticsConfig.ts](file:///i:/ai-内容创作智能化平台/src/components/YouTubeAnalytics/utils/analyticsConfig.ts)
- 从旧版 L339-504 提取 `ANALYTICS_CATEGORIES` 完整配置（13 个类别）
- 含 `algorithmMetrics`, `bgGradient`, `description` 等

---

## P1 — Analytics 数据展示卡片 (黄金功能 #8-#12)

需求映射: §4.② Analytics 数据收集, §7 Analytics 面板

### Cards

#### [NEW] [AnalyticsCategoryCard.tsx](file:///i:/ai-内容创作智能化平台/src/components/YouTubeAnalytics/cards/AnalyticsCategoryCard.tsx)
- 从旧版 L507-770 提取，~260 行
- 含 `extractMetric`, `formatValue`, `getStatusColor` 智能数据提取
- 导入 `ANALYTICS_CATEGORIES` from `../utils/analyticsConfig`

#### [NEW] [DFLReportCard.tsx](file:///i:/ai-内容创作智能化平台/src/components/YouTubeAnalytics/cards/DFLReportCard.tsx)
- 从旧版 L773-1064 提取，~290 行
- 含 `extractMetrics`, `deepFind`, `extractNumber`, `extractPercent`
- DFL 报告专业卡片（黄金功能 #13, #16）

---

## P2 — DFL 可视化组件 (黄金功能 #13-#17)

需求映射: §4.③ DFL 动态反馈, §7 系统通知

### Visualization

#### [NEW] [ViralPotentialGauge.tsx](file:///i:/ai-内容创作智能化平台/src/components/YouTubeAnalytics/charts/ViralPotentialGauge.tsx)
- 从旧版 L1066-1124 提取，~60 行
- 半圆 SVG 仪表盘 + 呼吸动画（病毒检测 #14）

#### [NEW] [HourlyHeatMap.tsx](file:///i:/ai-内容创作智能化平台/src/components/YouTubeAnalytics/charts/HourlyHeatMap.tsx)
- 从旧版 L1126-1182 提取，~60 行
- 24 小时热力图 + 峰值窗口高亮

#### [MODIFY] [DFLPanel.tsx](file:///i:/ai-内容创作智能化平台/src/components/YouTubeAnalytics/panels/DFLPanel.tsx)
- 导入并集成 `ViralPotentialGauge`, `HourlyHeatMap`, `DFLReportCard`
- 集成 `dflLearningService`, `autoPivotService` 服务

---

## P3 — 计划质量门控 (黄金功能 #18-#20)

需求映射: §4.④ 计划生成, §9 验收标准

### Plan Components

#### [NEW] [QualityGatePanel.tsx](file:///i:/ai-内容创作智能化平台/src/components/YouTubeAnalytics/panels/QualityGatePanel.tsx)
- 从旧版 `components/YouTubeAnalytics/plan/QualityGatePanel.tsx` 复制并适配
- 集成 `askStudioAdapter` (数据适配 #19, 计划验证 #20)

#### [MODIFY] [YPPPanel.tsx](file:///i:/ai-内容创作智能化平台/src/components/YouTubeAnalytics/panels/YPPPanel.tsx)
- 导入 `QualityGatePanel` 并在计划生成后展示
- 添加 `AlgorithmScores`, `StatusBadge` 等 plan 子组件

---

## P4 — 跨平台与设置 (黄金功能 #25-#27)

需求映射: §4.⑥ 跨平台分发, §6.1 API 定义

### New Panels & Settings

#### [NEW] [CrossPlatformPanel.tsx](file:///i:/ai-内容创作智能化平台/src/components/YouTubeAnalytics/panels/CrossPlatformPanel.tsx)
- 从旧版 `components/YouTubeAnalytics/CrossPlatformPanel.tsx` 复制并适配
- 集成 `crossPlatformService`, `mimicryService`

#### [NEW] [SettingsPanel.tsx](file:///i:/ai-内容创作智能化平台/src/components/YouTubeAnalytics/panels/SettingsPanel.tsx)
- 从旧版 `components/YouTubeAnalytics/Settings/TelegramConfig.tsx` 提取
- Telegram 配置 + 通知设置

#### [MODIFY] [YouTubeAnalytics.tsx](file:///i:/ai-内容创作智能化平台/src/components/YouTubeAnalytics.tsx)
- 添加 `crossPlatform` 和 `settings` tabs
- 导入新增的 panels

---

## P5 — 增强 UI (黄金功能 #31)

需求映射: §7 UI/UX 设计, §4.⑧ React 前端

### Enhanced Components

#### [NEW] [CalendarView.tsx](file:///i:/ai-内容创作智能化平台/src/components/YouTubeAnalytics/panels/CalendarView.tsx)
- 从旧版 `components/YouTubeAnalytics/CalendarView/` 复制并适配
- 发布日历视图

#### [NEW] [TemplateEditor.tsx](file:///i:/ai-内容创作智能化平台/src/components/YouTubeAnalytics/panels/TemplateEditor.tsx)
- 从旧版 `components/YouTubeAnalytics/Templates/` 复制并适配
- 模板编辑器

---

## 服务层集成 (贯穿 P0-P5)

| 服务 | 导入位置 | 黄金功能 |
|------|----------|----------|
| `dflLearningService` | `useDFL.ts` | #13, #15 |
| `autoPivotService` | `useDFL.ts` | #17 |
| `trendService` | `useDFL.ts` | #12 |
| `crossPlatformService` | `CrossPlatformPanel` | #25-#27 |
| `mimicryService` | `CrossPlatformPanel` | #22 |
| `queueStorageService` | `useYPP.ts` | #6, #18 |
| `sysLogService` | `closedLoopHelpers.ts` | #28 |
| `askStudioAdapter` | `useYPP.ts` | #19, #20 |

---

## 验证计划

### 自动化检查
```bash
# TypeScript 类型检查
npm run type-check

# ESLint 检查 (仅修改文件)
npx eslint src/components/YouTubeAnalytics --ext ts,tsx --quiet

# 构建验证
npm run build
```

### 功能验证
- 每个 P 阶段完成后运行 `tsc --noEmit`
- 最终完成后运行 `npm run build`
- 确认所有新增 tabs 在合成器中正确渲染

### 旧版清理
- 迁移完成并验证后，将 `components/YouTubeAnalytics.tsx` 标记为 `@deprecated`
