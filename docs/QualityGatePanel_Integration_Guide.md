# 🔧 QualityGatePanel 集成指南

## 快速集成步骤

### 步骤 1: 在 YouTubeAnalytics.tsx 顶部添加 import

```tsx
// 在已有的 import 后面添加
import { QualityGatePanel } from './YouTubeAnalytics/plan';
```

### 步骤 2: 在组件内部添加状态处理函数

在 `YouTubeAnalytics` 组件内部添加以下函数：

```tsx
// 🆕 Quality Gate: 更新单个视频项
const handleUpdatePlanItem = (id: string, updates: Partial<any>) => {
    if (!yppPlan?.schedule) return;
    
    const newSchedule = yppPlan.schedule.map((item: any) => {
        if (item.id === id) {
            return { ...item, ...updates };
        }
        return item;
    });
    
    setYppPlan({ ...yppPlan, schedule: newSchedule });
    localStorage.setItem('yppPlan', JSON.stringify({ ...yppPlan, schedule: newSchedule }));
};

// 🆕 Quality Gate: 重新加入生成队列
const handleRequeueItem = (item: any) => {
    const newItem = {
        ...item,
        status: 'pending',
        videoData: undefined,
        qualityCheck: undefined
    };
    handleUpdatePlanItem(item.id, newItem);
    console.log('🔄 [QualityGate] Requeued:', item.title);
};
```

### 步骤 3: 在计划表格区域添加 QualityGatePanel

找到显示计划表格的位置（搜索 `paginatedPlan` 或 `yppPlan.schedule`），在表格上方添加：

```tsx
{/* 🆕 Quality Gate Panel */}
{yppPlan?.schedule && yppPlan.schedule.length > 0 && (
    <div className="mb-6">
        <QualityGatePanel
            schedule={yppPlan.schedule}
            onUpdateItem={handleUpdatePlanItem}
            onRequeue={handleRequeueItem}
        />
    </div>
)}
```

---

## 完整代码片段

### 放置位置建议

1. **在 "Generate Today's Plan" 按钮下方**
2. **在计划表格上方**
3. **作为独立的折叠面板**

### 示例渲染代码

```tsx
{/* Video Plan Section */}
<div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
    <h2 className="text-xl font-bold text-white mb-4">📋 Today's Video Plan</h2>
    
    {/* Quality Gate Panel - 新增 */}
    {yppPlan?.schedule && yppPlan.schedule.length > 0 && (
        <QualityGatePanel
            schedule={yppPlan.schedule}
            onUpdateItem={handleUpdatePlanItem}
            onRequeue={handleRequeueItem}
        />
    )}
    
    {/* Existing Plan Table */}
    <div className="mt-4">
        {/* ... existing table code ... */}
    </div>
</div>
```

---

## 功能说明

### Tab 1: 质量检查 (🔍)
- 显示待审核的视频
- 通过/拒绝/重新生成按钮
- 真实表现数据追踪表格

### Tab 2: 多样性检查 (🎨)
- 开头词分布图
- 主题分布图
- 多样性评分 (0-100)
- 违规警告

### Tab 3: A/B 测试 (📊)
- 三批次发布计划
- 测试组 vs 对照组
- 策略说明

---

## 类型安全

确保 `yppPlan.schedule` 中的每个 item 包含以下新字段：

```typescript
interface PlanItemType {
    // ... existing fields ...
    
    // Solution 1: Quality Gate
    qualityCheck?: QualityCheckType;
    
    // Solution 2: Real Performance
    actualPerformance?: ActualPerformanceType;
    predictionAccuracy?: number;
    
    // Solution 4: A/B Testing
    abTestInfo?: ABTestInfoType;
}
```

这些类型已在 `components/YouTubeAnalytics/types.ts` 中定义。
