# 🔍 Google Vids 实现对比 - 完整版 vs 当前版

> **对比日期**: 2025-12-29
> **完整版快照**: `content_flow_complete.js`, `background_flow_complete.js`
> **当前版本**: `content.js`, `background.js`

---

## 📊 核心差异总结

| 特性 | 完整版 (Working) | 当前版 V6.1 (Broken) |
|------|------------------|----------------------|
| **视频检测** | 简单：查找有效的 `<video>` 元素 | 复杂：多层检测 + URL 提取 |
| **视频获取** | `generatedVideo.src` 直接使用 | 尝试提取 URL → 失败 → File Download |
| **下载方式** | background.js `fetch(videoUrl)` | File > Download + 下载拦截器 |
| **转码方式** | background.js 中 arrayBuffer → base64 | 下载拦截器中 fetch + FileReader |
| **YouTube 打开** | 下载完成后立即打开 | 依赖下载拦截器（可能失败）|
| **成功率** | ✅ 高（直接获取视频源） | ❌ 低（多个失败点）|

---

## 🎯 关键代码对比

### 1. 视频生成完成检测

#### ✅ 完整版 (content_flow_complete.js:456-526)

```javascript
function monitorVideoGeneration() {
    console.log("🎬 [GoogleVids] Monitoring for video generation completion...");

    const checkInterval = setInterval(() => {
        // ✅ 简单有效：查找有效的 video 元素
        const videos = [...document.querySelectorAll('video')];
        const generatedVideo = videos.find(v => {
            const src = v.src || '';
            const rect = v.getBoundingClientRect();
            return src &&
                rect.width > 100 &&
                rect.height > 100 &&
                v.readyState >= 1 &&
                v.duration > 0 &&
                !src.includes('preview_tiny');
        });

        if (generatedVideo) {
            console.log("🎉 [GoogleVids] Video found! Proceeding with upload...");
            clearInterval(checkInterval);
            handleVideoFound(generatedVideo);
            return;
        }
    }, 3000);

    const handleVideoFound = (generatedVideo) => {
        console.log("🎬 [GoogleVids] Video generated! Source:", generatedVideo.src);

        // 🔑 关键：直接发送视频 URL 给 background
        chrome.runtime.sendMessage({ action: 'getGoogleVidsRequest' }, (response) => {
            const uploadData = response?.data?.uploadData || {};

            chrome.runtime.sendMessage({
                action: 'relayGoogleVidsComplete',
                videoUrl: generatedVideo.src,  // ← 直接使用 video.src
                uploadData: uploadData
            });
        });
    };
}
```

#### ❌ 当前版 (content.js:7452-7584)

```javascript
// 🔧 CRITICAL FIX: Handle Google Vids special download flow
if (videoData.videoUrl && videoData.videoUrl.startsWith('VIDEO_GENERATED')) {
    console.log("🔍 [Google Vids] Getting video directly from page...");

    // ❌ 问题：过于复杂的查找逻辑
    const allVideos = document.querySelectorAll('video');
    let targetVideo = null;
    let targetUrl = null;

    for (const video of allVideos) {
        const src = video.src || video.currentSrc || video.querySelector('source')?.src;
        
        // ❌ 问题：跳过 inspirationgallery 后可能没有其他视频
        if (src && src.includes('inspirationgallery')) {
            continue;
        }

        // ❌ 问题：条件过于严格
        if (src.startsWith('http') && video.duration && video.duration > 0) {
            targetVideo = video;
            targetUrl = src;
            break;
        }
    }

    if (targetUrl) {
        // ✅ 这部分是对的
        chrome.runtime.sendMessage({
            action: 'relayGoogleVidsComplete',
            videoUrl: targetUrl,
            uploadData: {...}
        });
    } else {
        // ❌ 问题：回退到 File > Download（不可靠）
        console.log("⚠️ [Google Vids] No target video URL found, trying File > Download...");
        // ... File > Download 流程
    }
}
```

---

### 2. background.js 处理

#### ✅ 完整版 (background_flow_complete.js:260-351)

```javascript
if (request.action === "relayGoogleVidsComplete") {
    console.log("🎬 [Background] Google Vids Complete. URL:", request.videoUrl);
    const { videoUrl, uploadData } = request;

    // 1️⃣ 直接 fetch 视频
    fetch(videoUrl)
        .then(res => res.arrayBuffer())
        .then(buffer => {
            // 2️⃣ 转换为 base64
            let binary = '';
            const bytes = new Uint8Array(buffer);
            const len = bytes.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);

            // 3️⃣ 准备上传数据
            const videoData = {
                id: 'googlevids_' + Date.now(),
                videoData: base64,  // ← 已经有视频数据
                fileName: 'googlevids_generated.mp4',
                title: uploadData?.title || 'Google Vids Generated',
                description: uploadData?.description || '',
                tags: uploadData?.tags || [],
                scheduleDate: scheduleDate,
                scheduleTime: scheduleTime,
                visibility: 'private',
                isShorts: true
            };

            // 4️⃣ 存储数据
            pendingUploads[videoData.id] = videoData;
            pendingUploads['latest'] = videoData;

            // 5️⃣ 立即打开 YouTube Studio
            const uploadUrl = 'https://studio.youtube.com/channel/UC/videos/upload?d=ud&gemini_id=' + videoData.id;
            chrome.tabs.create({ url: uploadUrl }, (tab) => {
                console.log("🚀 [Background] Opened YouTube Upload Tab:", tab.id);

                // 6️⃣ 关闭 Google Vids 标签页
                if (sender.tab && sender.tab.id) {
                    setTimeout(() => {
                        chrome.tabs.remove(sender.tab.id);
                    }, 2000);
                }
            });
        })
        .catch(err => {
            console.error("❌ [Background] Failed to download Google Vids video:", err);
        });

    return true; // Async
}
```

#### ❌ 当前版 (background.js:416-533)

```javascript
if (request.action === "relayGoogleVidsComplete") {
    console.log("🎬 [Background] Google Vids/Flow Complete. URL:", request.videoUrl);
    const { videoUrl, videoData, uploadData } = request;

    const finalizeUpload = (base64) => {
        // ... 准备数据
        const finalData = {
            id: finalVideoId,
            videoData: base64,
            // ... 其他字段
        };

        pendingUploads[finalData.id] = finalData;
        pendingUploads['latest'] = finalData;

        // ✅ 打开 YouTube Studio
        const uploadUrl = 'https://studio.youtube.com/channel/mine/videos/upload?d=ud&gemini_id=' + finalData.id;
        chrome.tabs.create({ url: uploadUrl }, (tab) => {
            console.log("🚀 [Background] Opened YouTube Upload Tab:", tab.id);
        });
    };

    if (videoData) {
        // ✅ 如果已有 videoData，直接使用
        finalizeUpload(videoData);
    } else if (videoUrl) {
        // ✅ 如果有 URL，fetch 并转换
        fetch(videoUrl)
            .then(res => res.arrayBuffer())
            .then(buffer => {
                // ✅ 转 base64（使用分块处理避免溢出）
                const bytes = new Uint8Array(buffer);
                let binary = '';
                const chunkSize = 8192;
                for (let i = 0; i < bytes.length; i += chunkSize) {
                    const chunk = bytes.slice(i, i + chunkSize);
                    binary += String.fromCharCode.apply(null, chunk);
                }
                const base64 = 'data:video/mp4;base64,' + btoa(binary);
                finalizeUpload(base64);
            })
            .catch(err => console.error("❌ [Background] Failed to download video:", err));
    }
    return true;
}
```

**分析**: 当前版本的 `relayGoogleVidsComplete` 处理器本身是正确的！问题在于 **content.js 没有正确调用它**。

---

## 🐛 根本原因分析

### 问题 1: content.js 视频检测失败

**症状**: 日志显示 `"No target video URL found"`

**原因**:
1. Google Vids 页面可能有多个 `<video>` 元素（预览、灵感库等）
2. 当前代码的过滤逻辑过于严格，跳过了生成的视频
3. 生成的视频可能使用 `blob:` URL 或特殊格式

**证据** (从截图):
```
[Google Vids] Checking video: src="https://ssl.gstatic.com/docs/generativeai/videogen/..."
   ↪ Skipped (inspiration gallery)
[Google Vids] No target video URL found
```

### 问题 2: File > Download 流程不可靠

**症状**: Download 触发后没有后续日志

**原因**:
1. 下载拦截器可能未正确匹配文件
2. `googleVidsUploadData` 存储可能失败
3. 60秒的 watchdog 不够（下载可能需要更长时间）

---

## ✅ 修复方案

### 方案 A: 恢复简单的视频检测逻辑 (推荐)

使用完整版的简单检测逻辑，不依赖 File > Download：

```javascript
// content.js: 替换 7452-7584 行的复杂逻辑
console.log("✅ [Google Vids] Video generated! Getting video data...");

// 简化：直接查找有效视频
const allVideos = document.querySelectorAll('video');
let targetVideo = null;

for (const video of allVideos) {
    const src = video.src || video.currentSrc;
    const rect = video.getBoundingClientRect();
    
    // 检查：有 src、可见、有时长、不是预览
    if (src && 
        src.startsWith('http') &&
        rect.width > 100 && 
        rect.height > 100 &&
        video.duration > 0 &&
        !src.includes('preview_tiny') &&
        !src.includes('inspirationgallery')) {
        
        targetVideo = video;
        console.log(`✅ [Google Vids] Found target video: ${src.substring(0, 100)}...`);
        break;
    }
}

if (targetVideo) {
    // 直接发送给 background
    chrome.runtime.sendMessage({
        action: 'relayGoogleVidsComplete',
        videoUrl: targetVideo.src,
        uploadData: {
            id: uploadData?.videoIndex ?? uploadData?.id ?? 'googlevids_' + Date.now(),
            title: uploadData?.title || 'Google Vids Video',
            description: uploadData?.description || '',
            tags: uploadData?.tags || '',
            scheduleDate: uploadData?.scheduleDate || '',
            scheduleTime: uploadData?.scheduleTimeOnly || uploadData?.scheduleTime || '',
            isShorts: uploadData?.isShorts ?? true,
            pinnedComment: uploadData?.pinnedComment || ''
        }
    });
    console.log("✅ [Google Vids] Video URL sent to background!");
    return;
}

// 如果找不到，才使用 File > Download 备用
console.warn("⚠️ [Google Vids] No video element found, falling back to File > Download...");
// ... 现有的 File > Download 代码
```

### 方案 B: 改进下载拦截器

如果必须使用 File > Download，需要：

1. **增加更详细的日志**
2. **放宽匹配条件**
3. **增加超时时间**

```javascript
// background.js:1217-1224 - 放宽匹配
const isGoogleVids = 
    url.includes('docs.google.com') ||
    url.includes('googleusercontent.com') ||
    url.includes('contribution.usercontent') ||
    filename.toLowerCase().endsWith('.mp4') ||
    filename.toLowerCase().endsWith('.webm') ||
    mime.includes('video') ||
    mime.includes('octet-stream'); // ← 新增：有些下载是 binary
```

---

## 📋 实施步骤

### 立即修复 (方案 A)

1. ✅ **备份当前代码** (已有快照 20251229_153532)
2. ✅ **简化视频检测逻辑** (参考完整版 456-522 行)
3. ✅ **移除过度复杂的过滤条件**
4. ✅ **保留 File > Download 作为最后备用**
5. ✅ **测试并监控日志**

### 测试检查清单

- [ ] Google Vids 标签页自动打开
- [ ] Prompt 自动填充
- [ ] Generate 按钮被点击
- [ ] 视频生成完成（查看时间轴）
- [ ] 控制台显示 "Found target video: https://..."
- [ ] YouTube Studio 自动打开
- [ ] 视频数据自动填充
- [ ] 上传成功，计划状态更新

---

**文档版本**: V6.1 | **创建日期**: 2025-12-29 | **状态**: 待实施
