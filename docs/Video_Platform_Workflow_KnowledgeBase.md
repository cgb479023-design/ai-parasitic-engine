# 视频生成平台完整工作流知识库
## Video Generation Platform Complete Workflow Knowledge Base

> 版本: 1.0 | 更新日期: 2025-12-20
> 适用于 NotebookLM 知识库导入

---

## 📋 目录
1. [系统概述](#1-系统概述)
2. [三大视频生成平台](#2-三大视频生成平台)
3. [提示词生成机制](#3-提示词生成机制)
4. [视频生成流程](#4-视频生成流程)
5. [YouTube自动上传机制](#5-youtube自动上传机制)
6. [发布日期时间管理](#6-发布日期时间管理)
7. [队列自动化管理](#7-队列自动化管理)
8. [消息流架构](#8-消息流架构)
9. [代码文件映射](#9-代码文件映射)

---

## 1. 系统概述

### 1.1 系统架构
本系统是一个端到端的AI视频内容创作自动化平台，实现从内容策划到YouTube发布的全流程自动化。

```
┌─────────────────────────────────────────────────────────────────┐
│                    React 前端 (YouTubeAnalytics.tsx)             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ 数据分析  │→│ 计划生成  │→│ 视频执行  │→│ 状态同步/队列管理 │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                ↓ window.postMessage
┌─────────────────────────────────────────────────────────────────┐
│                Chrome Extension (background.js)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ 标签页管理    │  │ 消息中继      │  │ 存储管理 (pendingUploads)│ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                ↓ chrome.tabs.sendMessage
┌─────────────────────────────────────────────────────────────────┐
│                Content Scripts (content.js)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ 视频平台控制  │  │ YouTube上传   │  │ 表单自动化              │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 核心组件
| 组件 | 文件路径 | 职责 |
|------|----------|------|
| React前端 | `components/YouTubeAnalytics.tsx` | UI、状态管理、队列控制 |
| 后台脚本 | `gemini-extension/background.js` | 消息中继、标签页管理 |
| 内容脚本 | `gemini-extension/content.js` | 页面自动化、表单填写 |

---

## 2. 三大视频生成平台

### 2.1 平台对比

| 特性 | GeminiGen | Google Flow | Google Vids |
|------|-----------|-------------|-------------|
| URL | geminigen.ai | labs.google/fx/tools/flow | docs.google.com/videos |
| 模型 | Veo 3 Fast | Veo 2 | Veo 3.1 |
| 比例 | 9:16 (Shorts) | 9:16 | 9:16 |
| 触发方式 | URL参数 + 扩展 | URL参数 + 扩展 | 消息 + 扩展 |
| 视频输出 | Base64 | Base64 | Blob URL → Base64 |

### 2.2 平台选择代码 (YouTubeAnalytics.tsx L5183-5210)
```javascript
// 平台选择逻辑
if (videoPlatform === 'googlevids') {
    // Google Vids: 使用消息传递
    window.postMessage({ type: 'GOOGLE_VIDS_GENERATE', prompt, ... }, '*');
} else if (videoPlatform === 'googleflow') {
    // Google Flow: URL参数传递
    genUrl = `https://labs.google/fx/tools/flow?prompt=${...}&scheduleTime=${...}`;
    window.postMessage({ type: 'OPEN_GEMINIGEN_TAB', url: genUrl }, '*');
} else {
    // GeminiGen: URL参数传递  
    genUrl = `https://geminigen.ai/?prompt=${...}&model=veo-3-fast&ratio=9:16`;
    window.postMessage({ type: 'OPEN_GEMINIGEN_TAB', url: genUrl }, '*');
}
```

---

## 3. 提示词生成机制

### 3.1 提示词来源
提示词通过 **LMArena** 平台使用 Gemini 3 Pro 模型生成：

```
用户点击 "Generate Plan"
       ↓
打开 LMArena (lmarena.ai)
       ↓
发送 YouTube Analytics 数据 + 用户自定义指令
       ↓
AI 生成包含 promptBlock 的 JSON 计划
       ↓
解析并存储到 yppPlan.schedule[]
```

### 3.2 promptBlock 结构
每个视频计划项包含以下字段：
```json
{
  "title": "视频标题 (50-70字符)",
  "promptBlock": "完整的视频生成提示词，包含场景、角色、动作描述",
  "description": "YouTube视频描述",
  "tags": ["标签1", "标签2", "标签3"],
  "publishTimeLocal": "12/20/2025 8:00 PM",
  "scheduleDate": "12/20/2025",
  "scheduleTime": "8:00 PM",
  "pinnedComment": "可选的置顶评论"
}
```

### 3.3 动态提示词增强 (DFL 2.0)
当检测到病毒信号时，系统会动态增强提示词：
- **Velocity Spike**: 速度最大化协议
- **Rewatch Surge**: 复看爆发优化
- **Trend Detected**: 趋势冲浪模式
- **Pattern Match**: 模式匹配复制

---

## 4. 视频生成流程

### 4.1 统一视频接收机制
所有三个平台生成的视频都通过相同的消息类型返回：

```javascript
// YouTubeAnalytics.tsx L5212-5234
videoBase64 = await new Promise((resolve, reject) => {
    const videoHandler = (e) => {
        if (e.data?.type === 'GEMINI_VIDEO_RESULT') {
            if (e.data.payload?.length > 100) {
                resolve(e.data.payload);  // Base64 视频数据
            }
        }
    };
    window.addEventListener('message', videoHandler);
    setTimeout(() => reject(new Error("Timeout")), 600000);  // 10分钟超时
});
```

### 4.2 各平台视频捕获

#### GeminiGen
```javascript
// content.js - GeminiGen页面
// 监听视频生成完成，获取下载链接
const videoUrl = document.querySelector('a[download]')?.href;
// 下载并转换为Base64
const response = await fetch(videoUrl);
const blob = await response.blob();
const base64 = await blobToBase64(blob);
// 发送给React
chrome.runtime.sendMessage({ action: 'relayGeminiVideoResult', payload: base64 });
```

#### Google Flow
```javascript
// content.js - Google Flow页面
// 监听视频预览元素出现
const videoElement = document.querySelector('video[src*="blob:"]');
// 从Blob URL提取视频数据
const base64 = await extractVideoFromBlob(videoElement.src);
chrome.runtime.sendMessage({ action: 'relayGeminiVideoResult', payload: base64 });
```

#### Google Vids
```javascript
// content.js - Google Vids页面
// Google Vids使用Export功能
// 监听导出完成，获取MP4文件
const exportUrl = await waitForExport();
const base64 = await downloadAndConvert(exportUrl);
chrome.runtime.sendMessage({ action: 'relayGeminiVideoResult', payload: base64 });
```

---

## 5. YouTube自动上传机制

### 5.1 上传流程

```
视频Base64数据
       ↓
PREPARE_YOUTUBE_UPLOAD 消息
       ↓  
background.js 存储到 pendingUploads
       ↓
OPEN_YOUTUBE_UPLOAD_TAB 消息
       ↓
打开 studio.youtube.com/channel/mine/videos/upload
       ↓
content.js 检测URL包含 gemini_id 参数
       ↓
从 background.js 获取 pendingUploads[id]
       ↓
自动化填写表单 + 上传视频
```

### 5.2 表单自动化 (content.js)

#### 步骤1: 文件上传
```javascript
// 创建虚拟文件并触发上传
const blob = base64ToBlob(data.videoData);
const file = new File([blob], data.fileName, { type: 'video/mp4' });
const fileInput = document.querySelector('input[type="file"]');
const dataTransfer = new DataTransfer();
dataTransfer.items.add(file);
fileInput.files = dataTransfer.files;
fileInput.dispatchEvent(new Event('change', { bubbles: true }));
```

#### 步骤2: 元数据填写
```javascript
// 标题
const titleInput = document.querySelector('#textbox[placeholder*="title"]');
titleInput.value = data.title;
titleInput.dispatchEvent(new Event('input', { bubbles: true }));

// 描述
const descInput = document.querySelector('#textbox[placeholder*="description"]');
descInput.value = data.description;
descInput.dispatchEvent(new Event('input', { bubbles: true }));

// 标签
// 展开"显示更多"按钮，找到标签输入框
const tagsInput = document.querySelector('input[placeholder*="tags"]');
tagsInput.value = data.tags;
```

#### 步骤3: 向导导航
```javascript
// 自动点击 "NEXT" 按钮通过各个步骤
// Video Elements → Checks → Visibility
const nextBtn = document.querySelector('#next-button');
await clickWithRetry(nextBtn);
```

### 5.3 上传完成信号
```javascript
// content.js L4626-4640
chrome.runtime.sendMessage({
    action: 'relayYouTubeUploadComplete',
    videoUrl: videoLink,
    videoId: finalVideoId,
    status: 'completed'  // 或 'scheduled'
});
```

---

## 6. 发布日期时间管理

### 6.1 日期格式标准化

系统统一使用 **YouTube本地格式**:
- **日期**: `MM/DD/YYYY` (例: `12/20/2025`)
- **时间**: `H:MM AM/PM` (例: `8:00 PM`)

### 6.2 日期解析流程 (YouTubeAnalytics.tsx L5258-5298)

```javascript
// 支持两种输入格式:
// 新格式: "12/20/2025 8:00 PM" (YouTube native)
// 旧格式: "2025/12/20 20:00" (legacy)

const ytMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i);
if (ytMatch) {
    scheduleDate = `${month}/${day}/${year}`;
    scheduleTime = `${hour}:${minute} ${period}`;
} else {
    // 旧格式转换
    const oldMatch = dateStr.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/);
    // 转换为12小时制...
}
```

### 6.3 日期输入自动化 (content.js L3796-3910)

**5种策略确保日期输入成功:**

```javascript
// 策略0: 点击日期选择器激活输入框
const datePickerTrigger = document.querySelector('ytcp-datetime-picker');
datePickerTrigger?.click();

// 策略1: ytcp-date-picker 内的输入框
dateInput = document.querySelector('ytcp-date-picker input');

// 策略2: ytcp-datetime-picker 内的输入框
dateInput = document.querySelector('ytcp-datetime-picker input');

// 策略3: 全局搜索带日期格式的输入框
dateInput = Array.from(document.querySelectorAll('input')).find(inp => {
    return /\d{1,2}\/\d{1,2}\/\d{4}/.test(inp.value);
});

// 策略4: 排除法 - 找非时间输入的文本框
dateInput = allInputs.find(inp => !inp.value.includes(':'));
```

### 6.4 Schedule vs Publish 模式

```javascript
// content.js - 可见性设置
if (data.scheduleDate && data.scheduleTime) {
    // 预约发布模式
    const scheduleRadio = document.querySelector('#schedule-radio-button');
    scheduleRadio.click();
    // 设置日期和时间...
} else {
    // 立即发布模式
    const publicRadio = document.querySelector('tp-yt-paper-radio-button[name="PUBLIC"]');
    publicRadio.click();
}
```

---

## 7. 队列自动化管理

### 7.1 队列状态管理

```javascript
// YouTubeAnalytics.tsx - 核心状态
const [executionQueue, setExecutionQueue] = useState<number[]>([]);
const [currentProcessingIndex, setCurrentProcessingIndex] = useState<number | null>(null);
const [isExecutingPlan, setIsExecutingPlan] = useState(false);
```

### 7.2 执行流程

```
executeFullPlan()
       ↓
setExecutionQueue([0, 1, 2, ...]) // 初始化队列
       ↓
useEffect [依赖: executionQueue, currentProcessingIndex]
       ↓
processNextInQueue()
       ↓
currentProcessingIndex = queue[0]  // 取第一个
queue.shift()                       // 从队列移除
       ↓
processVideo(task)                  // 执行单个视频
       ↓
等待 YOUTUBE_UPLOAD_COMPLETE 消息
       ↓
setCurrentProcessingIndex(null)    // 清除当前任务
       ↓
useEffect 触发 → processNextInQueue() // 处理下一个
       ↓
循环直到 queue.length === 0
       ↓
🎉 "All queued videos processed!"
```

### 7.3 单窗口保证机制

```javascript
// processNextInQueue (L5472-5494)
const processNextInQueue = async () => {
    // 只有当没有正在处理的任务时才开始新任务
    if (executionQueue.length > 0 && currentProcessingIndex === null) {
        const nextTask = executionQueue[0];
        setCurrentProcessingIndex(nextTask);  // 锁定当前任务
        setExecutionQueue(prev => prev.slice(1));  // 从队列移除
        await processVideo(nextTask);  // 阻塞等待完成
        setCurrentProcessingIndex(null);  // 解锁
    }
};
```

### 7.4 状态同步 (L5525-5570)

```javascript
// 收到 YOUTUBE_UPLOAD_COMPLETE 后:
// 1. 更新执行状态
setExecutionStatus(prev => ({ ...prev, [videoId]: '✅ Published' }));

// 2. 更新计划数据
setYppPlan(prev => {
    const newSchedule = [...prev.schedule];
    newSchedule[index] = {
        ...newSchedule[index],
        publishedUrl: videoUrl,
        status: 'Published'
    };
    return { ...prev, schedule: newSchedule };
});

// 3. 触发下一个
setCurrentProcessingIndex(null);
```

---

## 8. 消息流架构

### 8.1 完整消息流图

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           REACT 前端                                      │
│  executeFullPlan() → processVideo() → 等待视频 → 触发上传 → 状态同步       │
└──────────────────────────────────────────────────────────────────────────┘
          ↓ OPEN_GEMINIGEN_TAB                    ↑ YOUTUBE_UPLOAD_COMPLETE
          ↓ PREPARE_YOUTUBE_UPLOAD                ↑ GEMINI_VIDEO_RESULT
┌──────────────────────────────────────────────────────────────────────────┐
│                         BACKGROUND.JS                                     │
│  chrome.tabs.create()    pendingUploads[]    消息中继到localhost          │
└──────────────────────────────────────────────────────────────────────────┘
          ↓ chrome.tabs.sendMessage               ↑ chrome.runtime.sendMessage
┌──────────────────────────────────────────────────────────────────────────┐
│                         CONTENT.JS                                        │
│  ┌────────────┐    ┌────────────┐    ┌────────────────────────────────┐  │
│  │ GeminiGen  │    │ Google Flow│    │ YouTube Studio                 │  │
│  │ 捕获视频    │    │ 捕获视频    │    │ 上传+填表+Schedule+关闭        │  │
│  └────────────┘    └────────────┘    └────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

### 8.2 关键消息类型

| 消息类型 | 发送方 | 接收方 | 作用 |
|----------|--------|--------|------|
| `OPEN_GEMINIGEN_TAB` | React | Background | 打开视频生成页面 |
| `GOOGLE_VIDS_GENERATE` | React | Content | 触发Google Vids生成 |
| `GEMINI_VIDEO_RESULT` | Content | React | 返回生成的视频Base64 |
| `PREPARE_YOUTUBE_UPLOAD` | React | Background | 存储上传数据 |
| `OPEN_YOUTUBE_UPLOAD_TAB` | React | Background | 打开YouTube上传页面 |
| `relayYouTubeUploadComplete` | Content | Background | 通知上传完成 |
| `YOUTUBE_UPLOAD_COMPLETE` | Background | React | 中继完成消息 |

---

## 9. 代码文件映射

### 9.1 核心代码位置

| 功能 | 文件 | 行号 |
|------|------|------|
| 平台选择 | YouTubeAnalytics.tsx | L5183-5210 |
| 视频接收 | YouTubeAnalytics.tsx | L5212-5234 |
| 日期解析 | YouTubeAnalytics.tsx | L5258-5298 |
| 队列处理 | YouTubeAnalytics.tsx | L5470-5497 |
| 状态同步 | YouTubeAnalytics.tsx | L5516-5622 |
| 执行计划 | YouTubeAnalytics.tsx | L5624-5641 |
| 日期输入 | content.js | L3796-3910 |
| 表单自动化 | content.js | L3500-4300 |
| 上传完成 | content.js | L4618-4690 |
| 消息中继 | background.js | L644-658 |
| 数据存储 | background.js | L40-90 |

### 9.2 配置文件

| 文件 | 作用 |
|------|------|
| `manifest.json` | Chrome扩展配置 |
| `package.json` | React项目依赖 |
| `.agent/workflows/*.md` | 自动化工作流定义 |

---

## 附录: 故障排除

### Q: 日期选择器找不到输入框?
**A**: 系统使用5种策略自动重试，查看控制台日志 `📅 [Schedule] Date input search attempt`

### Q: 视频生成超时?
**A**: 默认超时10分钟 (600000ms)，可在 L5230 调整

### Q: 队列卡住不继续?
**A**: 检查 `YOUTUBE_UPLOAD_COMPLETE` 是否被正确接收，查看 `✅ [Queue]` 日志

### Q: YouTube Studio表单自动化失败?
**A**: YouTube可能更新了DOM结构，需要更新content.js中的选择器

---

*文档生成时间: 2025-12-20 22:07 CST*
*系统版本: v3.20*
