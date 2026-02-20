# YouTube Schedule Time Debug Guide (时间调试指南)

## 问题描述
- React 页面显示: `12/31/2025 10:00 AM`
- YouTube Studio 显示: `12/31/2025 12:00 AM` (午夜)
- 时间差异: **10小时**

## 调试步骤

### 步骤 1: 检查 React 页面控制台

当执行 plan 时，查看以下日志：

```javascript
// 应该看到类似这样的日志:
📅 [Google Vids/Flow] Schedule data for video X: 
{
  publishTimeLocal: "12/31/2025 10:00 AM",
  scheduleDate: "12/31/2025",       // ← 应该是 MM/DD/YYYY
  scheduleTime: "10:00 AM",         // ← 应该是 HH:MM AM/PM
}
```

**问题诊断:**
- ❌ 如果 `scheduleTime` 是空的或是完整日期时间字符串 → 提取逻辑失败
- ✅ 如果格式正确 → 继续下一步

### 步骤 2: 检查 Google Vids/Flow 控制台

当视频生成完成后，查看以下日志：

```javascript
// 应该看到类似这样的日志:
📅 [Google Vids] scheduleDate: "12/31/2025", scheduleTimeOnly: "10:00 AM"
📦 [Google Vids] Preparing YouTube upload: 
{
  scheduleDate: "12/31/2025",
  scheduleTime: "10:00 AM"         // ← 注意这里应该只有时间
}
```

**问题诊断:**
- ❌ 如果 `scheduleTimeOnly` 是空的 → React 没有正确传递
- ❌ 如果 `scheduleTime` 是完整日期时间 → 使用了错误的字段
- ✅ 如果格式正确 → 继续下一步

### 步骤 3: 检查 Background.js 控制台

在扩展背景页 (`chrome://extensions` → 服务工作者) 查看：

```javascript
// 应该看到类似这样的日志:
📅 [Background] Full uploadData received: { ... }
📅 [Background] Initial scheduleDate: "12/31/2025", scheduleTime: "10:00 AM"
```

**问题诊断:**
- ❌ 如果时间格式不正确 → 数据传递出错
- ✅ 如果格式正确 → 继续下一步

### 步骤 4: 检查 YouTube Studio 控制台

当 YouTube Studio 上传页面打开后，查看：

```javascript
// 应该看到类似这样的日志:
📅 [STRICT CONSISTENCY] Schedule Data Received:
   📆 scheduleDate: "12/31/2025"
   ⏰ scheduleTime: "10:00 AM"

📅 [Scheduler] Setting schedule: 12/31/2025 10:00 AM
⏰ [Scheduler] Setting time: 10:00 AM
⏰ [Scheduler] Current time: "12:00 AM"    // ← YouTube 默认值
✅ [Scheduler] Time set: 10:00 AM          // ← 目标值

// 如果时间设置失败，会看到:
⚠️ [Scheduler] Time mismatch! Got: "12:00 AM", expected: "10:00 AM"
```

**问题诊断:**
- ❌ 如果看到 "Time mismatch" → YouTubeScheduler 设置失败
- ❌ 如果 `scheduleTime` 是空的或格式错误 → 数据未正确传递到 YouTube Studio
- ✅ 如果看到 "Time set: 10:00 AM" → 成功

## 手动调试命令

### 在 React 页面控制台运行:
```javascript
// 检查当前 plan 的时间数据
if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    console.log("使用 React DevTools 查看 yppPlan state");
} else {
    // 触发一个测试 log
    console.log("检查 React 页面的 Network 或 Console 日志");
}
```

### 在 Google Vids/Flow 页面控制台运行:
```javascript
// 检查 pending request 中的 schedule 数据
if (chrome.runtime) {
    chrome.runtime.sendMessage({ action: 'getGoogleVidsRequest' }, (response) => {
        console.log("Pending Request:", response);
        if (response?.data?.uploadData) {
            console.log("📅 scheduleDate:", response.data.uploadData.scheduleDate);
            console.log("⏰ scheduleTimeOnly:", response.data.uploadData.scheduleTimeOnly);
        }
    });
}
```

### 在 YouTube Studio 控制台运行:
```javascript
// 测试 YouTubeScheduler 是否可用
if (window.YouTubeScheduler) {
    console.log("✅ YouTubeScheduler 已加载");
    
    // 手动测试时间设置
    // window.YouTubeScheduler.setTime("10:00 AM");
} else {
    console.error("❌ YouTubeScheduler 未找到！");
}
```

## 常见问题及解决方案

### 问题 1: scheduleTimeOnly 为空
**原因**: React 没有正确提取时间部分
**解决**: 检查 `useEffect` 修复逻辑 (第 2562-2600 行)

### 问题 2: YouTube Scheduler 设置失败
**原因**: 
- 时间格式不匹配 (需要 "HH:MM AM/PM")
- 时间选择器 UI 未正确识别
**解决**: 检查 YouTubeScheduler.setTime() 的逐字符输入逻辑

### 问题 3: 时区问题
**原因**: 服务器时间与本地时间不一致
**解决**: 确保所有时间都使用本地格式 (GMT+8)

## 下一步

如果以上步骤无法定位问题，请提供以下信息：
1. React 页面的控制台日志截图
2. Google Vids/Flow 页面的控制台日志截图
3. YouTube Studio 页面的控制台日志截图
4. 具体的错误消息

---
*最后更新: 2025-12-30*
