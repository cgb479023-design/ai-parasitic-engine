# 自动首发评论 (Auto First Comment) 实现审核

> **审核日期:** 2025-12-28 12:25  
> **上次审核:** 2025-12-26 14:25  
> **状态:** ✅ 已修复 (跨域存储 + Shorts 支持 + 防重复 Tab)

---

## 🔧 2025-12-28 修复记录 (第二批)

### 问题 4: 三重 Tab 打开 ⚠️ 用户体验问题
- **症状:** 视频发布后同时打开 3 个相同的视频 Tab
- **原因:** 
  1. YouTube Studio content.js 执行 `window.location.href` (重定向)
  2. React 收到完成消息后发送 `REQUEST_IGNITE`
  3. `REQUEST_IGNITE` 处理器调用 `openTab`
- **修复:**
  - 禁用 React 端的 `REQUEST_IGNITE` 发送 (Studio 端已处理)
  - `REQUEST_IGNITE` 只在 `source === 'scheduled_monitor'` 时打开 Tab
  - `scheduledCommentMonitor.js` 添加 `source: 'scheduled_monitor'` 标记

### 问题 5: PROMINENT_PEOPLE_FILTER_FAILED ⚠️ 视频生成失败
- **症状:** GeminiGen 生成失败，错误代码 `PUBLIC_ERROR_PROMINENT_PEOPLE_FILTER_FAILED`
- **原因:** 提示词包含名人、角色或儿童相关词汇
- **修复:**
  - `yppService.ts sanitizePromptForVideoGen()` 增加名人/角色过滤规则
  - `promptSanitizer.js SANITIZE_RULES` 增加 30+ 新过滤规则
  - 新增 Karen、Chad 等 meme 名称过滤
  - 新增年龄模式过滤 (X-year-old)
  - 新增职业/头衔过滤 (celebrity, actor, president 等)

---

## 🔧 2025-12-28 修复记录 (第一批)

### 问题 1: sessionStorage 跨域限制 ⚠️ 严重
- **位置:** content.js 第 5901 行
- **问题:** `sessionStorage` 在 `studio.youtube.com` 存储，但目标页面 `www.youtube.com` 无法读取（不同域）
- **修复:** 改用 `chrome.storage.local`，跨域持久化存储

### 问题 2: Shorts 页面不支持
- **位置:** commentAutomation.js 第 493 行
- **问题:** `checkAndPost()` 只检测 `/watch` 路径，不支持 `/shorts/`
- **修复:** 增加 `/shorts/` 路径检测

### 问题 3: checkAndPost 只读 localStorage
- **位置:** commentAutomation.js checkAndPost() 方法
- **问题:** 只检查 localStorage，不检查 chrome.storage.local
- **修复:** 双重检测 localStorage 和 chrome.storage.local

---

## 1. 当前实现状态

### 1.1 React 端触发逻辑 ✅ 已实现

**位置:** `YouTubeAnalytics.tsx`

- 立即发布: 发送 `REQUEST_IGNITE`
- 预约发布: 发送 `REGISTER_SCHEDULED_COMMENT`

### 1.2 Extension 执行端 ✅ 已实现

**位置:** `gemini-extension/platforms/youtube/`

- `commentAutomation.js` - 即时评论发布
- `scheduledCommentMonitor.js` - 预约评论监控

### 1.3 状态同步回 React ✅ 已实现

**消息类型:** `COMMENT_POSTED`

同步内容:
- `commentPosted: true` - 评论已发布
- `commentPinned: boolean` - 是否已置顶  
- `commentPostedAt: string` - 发布时间戳

---

## 2. 数据流分析

### 2.1 预期数据流

```
Ask Studio 生成计划
    ↓ pinnedComment: "🔥 Who else thinks this is insane?"
React 显示计划
    ↓ 存储在 yppPlan.schedule[i].pinnedComment
视频上传完成
    ↓ YOUTUBE_UPLOAD_COMPLETE { videoId, videoUrl }
React 检测到 pinnedComment
    ↓ REQUEST_IGNITE { url, text, pin: true }
[问题] content.js 应该接收此消息
    ↓
[未实现] 打开视频页面，找到评论框，发布并置顶评论
```

### 2.2 当前断点

| 阶段 | 状态 | 说明 |
|------|------|------|
| 计划生成 pinnedComment | ✅ 工作 | Ask Studio 返回 |
| React 存储 pinnedComment | ✅ 工作 | yppPlan.schedule |
| 上传完成触发 | ✅ 工作 | YOUTUBE_UPLOAD_COMPLETE |
| 发送 REQUEST_IGNITE | ✅ 工作 | postMessage |
| **Extension 处理 IGNITE** | ❌ 缺失 | 未实现 |
| **打开视频评论页** | ❌ 缺失 | 未实现 |
| **发布评论** | ❌ 缺失 | 未实现 |
| **置顶评论** | ❌ 缺失 | 未实现 |

---

## 3. 建议实现方案

### 3.1 需要添加的 content.js 代码

```javascript
// Handle REQUEST_IGNITE from React (Auto First Comment)
if (event.data && event.data.type === 'REQUEST_IGNITE') {
    const { url, text, pin } = event.data;
    console.log(`🔥 [Ignite] Received request to post comment on: ${url}`);
    console.log(`🔥 [Ignite] Comment text: ${text.substring(0, 50)}...`);
    
    // Store comment data for the video page
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
            action: 'storeIgniteRequest',
            data: { url, text, pin }
        }, (response) => {
            if (response && response.success) {
                // Open the video page to post comment
                chrome.runtime.sendMessage({
                    action: 'openTab',
                    url: url
                });
            }
        });
    }
}
```

### 3.2 需要添加的视频页面自动评论逻辑

```javascript
// 当页面是 YouTube 视频页面时
if (window.location.href.includes('youtube.com/watch')) {
    // 检查是否有待发布的评论
    chrome.runtime.sendMessage({ action: 'getIgniteRequest' }, async (data) => {
        if (data && data.text) {
            await postFirstComment(data.text, data.pin);
        }
    });
}

async function postFirstComment(text, shouldPin) {
    // 1. 等待评论框加载
    const commentBox = await waitForElement('#placeholder-area, #comment-form');
    if (!commentBox) return;
    
    // 2. 点击评论框激活
    commentBox.click();
    await delay(500);
    
    // 3. 找到输入区域
    const input = document.querySelector('#contenteditable-root');
    if (input) {
        input.focus();
        input.innerText = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    // 4. 点击发布按钮
    await delay(500);
    const submitBtn = document.querySelector('#submit-button');
    if (submitBtn) {
        submitBtn.click();
        console.log('🔥 [Ignite] Comment posted!');
    }
    
    // 5. 如果需要置顶（需要等待评论出现后操作）
    if (shouldPin) {
        await delay(2000);
        // 找到刚发布的评论，点击置顶
        // 注意：置顶功能需要特殊权限和额外操作
    }
}
```

---

## 4. 立即发布 vs 预约发布

### 4.1 立即发布 (Immediate)

```
视频发布 → YOUTUBE_UPLOAD_COMPLETE → REQUEST_IGNITE → 发布评论
```

**问题:** 视频可能还在处理中，评论框不可用

**解决方案:** 等待视频完全可播放后再发评论

### 4.2 预约发布 (Scheduled)

```
视频预约 → 等待预约时间到 → [系统如何知道？] → 发布评论
```

**问题:** 预约发布后，系统如何知道视频何时公开？

**解决方案选项:**
1. **轮询检查** - 定期检查视频是否已公开（资源消耗大）
2. **YouTube API** - 使用 API 监控视频状态（需要授权）
3. **手动触发** - 用户在视频公开后手动点击"发评论"
4. **DFL 系统集成** - 在每日监控时检查是否有待发评论的视频

---

## 5. 优先级建议

| 任务 | 优先级 | 复杂度 |
|------|--------|--------|
| 实现 REQUEST_IGNITE 处理器 | 🔴 高 | 中 |
| 实现视频页面自动评论 | 🔴 高 | 高 |
| 处理立即发布评论 | 🔴 高 | 中 |
| 处理预约发布评论 | 🟡 中 | 高 |
| 实现评论置顶 | 🟢 低 | 高 |

---

## 6. 当前结论

| 功能 | 状态 |
|------|------|
| pinnedComment 数据存储 | ✅ 完整 |
| 触发时机 (上传完成后) | ✅ 完整 |
| REQUEST_IGNITE 消息发送 | ✅ 完整 |
| **Extension 消息接收** | ❌ **需要实现** |
| **视频页面评论发布** | ❌ **需要实现** |
| **预约发布后自动评论** | ❌ **需要实现** |

---

*需要我现在实现自动首发评论的 Extension 端代码吗？*
