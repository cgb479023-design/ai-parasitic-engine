# Feature Implementation Plan V1

## 目标功能

1. **集成新工具** - 在 YouTubeAnalytics.tsx 中使用新的 hooks 和 utils
2. **Telegram 配置** - 在设置页面添加 Telegram Bot 配置 UI
3. **模板管理 UI** - 添加模板编辑器界面
4. **日历视图** - 使用 scheduleUtils 实现可视化日历

---

## 1. 已有的基础设施

### Hooks (`/hooks/`)
- **useMessageHandler.ts** - 集中式消息处理，替代 YouTubeAnalytics.tsx 中的大型 useEffect
- **usePlanExecution.ts** - 视频计划执行队列管理

### Utils (`/utils/`)
- **scheduleUtils.ts** - 排程工具（冲突检测、最佳时间建议、时区转换、日历视图帮助）
- **statusUtils.ts** - 状态工具（isPending, isCompleted, canExecute 等）
- **cacheUtils.ts** - 缓存工具

---

## 2. 实施阶段

### Phase 1: 集成新 Hooks 到 YouTubeAnalytics.tsx
- [ ] 用 `useMessageHandler` 替换大型 `useEffect` 消息处理
- [ ] 用 `usePlanExecution` 管理执行队列
- [ ] 用 `statusUtils` 替换内联状态检查

### Phase 2: Telegram Bot 配置 UI
- [ ] 创建 `TelegramConfig.tsx` 组件
- [ ] 添加 Bot Token 和 Chat ID 输入
- [ ] 添加测试消息功能
- [ ] 创建 `telegramService.ts` 服务

### Phase 3: 模板管理 UI
- [ ] 创建 `TemplateEditor.tsx` 组件
- [ ] 支持变量插入（{title}, {date}, {tags}）
- [ ] 模板预览功能
- [ ] 本地存储模板

### Phase 4: 日历视图
- [ ] 创建 `CalendarView.tsx` 组件
- [ ] 使用 `scheduleUtils.getAvailableSlots()` 显示可用时段
- [ ] 使用 `scheduleUtils.detectConflicts()` 高亮冲突
- [ ] 拖拽调整排程功能

---

## 3. 组件结构

```
components/
├── YouTubeAnalytics/
│   ├── CalendarView/
│   │   ├── CalendarView.tsx      # 主日历组件
│   │   ├── DayCell.tsx           # 日期单元格
│   │   ├── TimeSlot.tsx          # 时间槽组件
│   │   └── index.ts
│   ├── Settings/
│   │   ├── SettingsPanel.tsx     # 设置面板
│   │   ├── TelegramConfig.tsx    # Telegram 配置
│   │   ├── NotificationConfig.tsx # 通知配置
│   │   └── index.ts
│   └── Templates/
│       ├── TemplateEditor.tsx    # 模板编辑器
│       ├── TemplateList.tsx      # 模板列表
│       ├── VariableHelper.tsx    # 变量助手
│       └── index.ts
```

---

## 4. 服务层

```
services/
├── telegramService.ts    # Telegram Bot API 集成
├── templateService.ts    # 模板管理
└── notificationService.ts # 通知服务
```

---

## 5. 优先级

| 功能 | 优先级 | 复杂度 | 预估时间 |
|------|--------|--------|----------|
| 集成新 Hooks | 高 | 中 | 2h |
| Telegram 配置 | 中 | 低 | 1h |
| 模板管理 UI | 中 | 中 | 2h |
| 日历视图 | 高 | 高 | 3h |

---

## 6. 开始实施

从 **Phase 2: Telegram Bot 配置** 开始，因为它是独立的功能且复杂度较低。
