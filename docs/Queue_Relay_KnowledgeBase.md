# Video Platform Queue Relay System - Knowledge Base

## 📋 Overview

The Video Platform Queue Relay System is a core component of the AI Content Creation Platform that enables **sequential automated video generation and publishing** across multiple video generation platforms.

---

## 🔄 Auto-Close Behavior

All video generation platforms automatically close their tabs after successful completion to allow the queue to advance:

| Platform | File | Close Timing | Trigger |
|----------|------|--------------|---------|
| **Google Flow** | `googleFlow/autoPilot.js` | 2 seconds after upload triggered | After `googleFlowUpload` or `forceOpenYouTubeStudio` |
| **Google Vids** | `googleVids/workflow.js` | 2 seconds after video sent | After `relayGoogleVidsComplete` |
| **GeminiGen** | `geminiGen/autoPilot.js` | 2 seconds after relay | After `relayGeminiVideoResult` |
| **YouTube Studio** | `youtube/studioUploader.js` | 5 seconds after scheduling | After `relayYouTubeUploadComplete` |

---

## 🎬 Supported Video Platforms

| Platform | ID | Message Type | Description |
|----------|----|--------------| ------------|
| **Google Vids** | `googlevids` | `GOOGLE_VIDS_GENERATE` | Google's video creation tool at docs.google.com/videos |
| **Google Flow** | `googleflow` | `GOOGLE_FLOW_GENERATE` | Google Labs experimental video tool at labs.google/fx/tools/video-fx |
| **GeminiGen** | `geminigen` | `OPEN_GEMINIGEN_TAB` | Third-party AI video generation website |
| **Veo API Direct** | `veoapi` | `VEO_API_GENERATE_REQUEST` | Direct Google Veo 3 API calls |

---

## 🔄 Queue Relay Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        YPP Plan Schedule                                │
│  [Video 1: pending] → [Video 2: pending] → [Video 3: pending] → ...    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Execute Full Plan Click                              │
│         Sets up executionQueue = [0, 1, 2, ...]                        │
│         Sets currentProcessingIndex = null                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              useEffect Queue Driver (Line ~8800)                        │
│                                                                         │
│  IF executionQueue.length > 0 AND currentProcessingIndex === null:     │
│      1. Set currentProcessingIndex = executionQueue[0]                 │
│      2. Remove first item from queue                                    │
│      3. Call processVideo(index)                                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    processVideo() Function                              │
│                                                                         │
│  Based on videoPlatform setting:                                        │
│    - googlevids → GOOGLE_VIDS_GENERATE                                 │
│    - googleflow → GOOGLE_FLOW_GENERATE                                 │
│    - geminigen  → OPEN_GEMINIGEN_TAB                                   │
│    - veoapi    → Direct API Call                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              Extension Handles Video Generation                         │
│                                                                         │
│  content.js → background.js → Platform Adapter                         │
│  Opens platform tab, injects prompt, waits for generation               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              YouTube Studio Upload & Schedule                           │
│                                                                         │
│  studioUploader.js:                                                     │
│    1. Upload video file                                                 │
│    2. Set title, description, tags                                      │
│    3. Select visibility (Schedule)                                      │
│    4. Set schedule date/time                                            │
│    5. Wait for 100% upload completion                                   │
│    6. Click "Schedule" button                                           │
│    7. Send YOUTUBE_UPLOAD_COMPLETE signal                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              YOUTUBE_UPLOAD_COMPLETE Handler                            │
│                                                                         │
│  1. Update yppPlan.schedule[index].status = 'uploaded'                 │
│  2. Dispatch QUEUE_ITEM_COMPLETE signal                                 │
│  3. Reset currentProcessingIndex = null                                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│            handleQueueComplete Listener (Line ~2430)                    │
│                                                                         │
│  1. Find next item with status === 'pending'                           │
│  2. Mark it as 'generating'                                             │
│  3. Send appropriate message based on videoPlatformRef.current:        │
│       - googlevids → GOOGLE_VIDS_GENERATE                              │
│       - googleflow → GOOGLE_FLOW_GENERATE                              │
│       - geminigen  → OPEN_GEMINIGEN_TAB + PREPARE_YOUTUBE_UPLOAD       │
│       - veoapi     → VEO_API_GENERATE_REQUEST                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                        (Loop continues until all videos processed)
```

---

## 📨 Message Types Reference

### 1. GOOGLE_VIDS_GENERATE
Triggers Google Vids automation workflow.

```javascript
window.postMessage({
    type: 'GOOGLE_VIDS_GENERATE',
    prompt: 'Video generation prompt...',
    aspectRatio: '9:16',
    uploadData: {
        id: 0,
        title: 'Video Title',
        description: 'Video description...',
        tags: 'tag1, tag2, tag3',
        scheduleDate: '01/07/2026',
        scheduleTime: '10:00 AM',
        pinnedComment: 'First comment text',
        isShorts: true
    }
}, '*');
```

**Flow**: content.js → background.js (storeGoogleVidsRequest + openGoogleVidsTab) → Google Vids page opens → googleVids/workflow.js handles automation

---

### 2. GOOGLE_FLOW_GENERATE
Triggers Google Flow automation workflow.

```javascript
window.postMessage({
    type: 'GOOGLE_FLOW_GENERATE',
    prompt: 'Video generation prompt...',
    aspectRatio: '9:16',
    uploadData: { ... }  // Same as above
}, '*');
```

**Flow**: content.js → background.js (storeGoogleVidsRequest + openGoogleFlowTab) → Google Flow page opens → googleFlow/autoPilot.js handles automation

---

### 3. OPEN_GEMINIGEN_TAB
Opens GeminiGen website with prompt pre-filled.

```javascript
window.postMessage({
    type: 'OPEN_GEMINIGEN_TAB',
    url: 'https://geminigen.ai/?prompt=...&model=veo-3-fast&ratio=9:16'
}, '*');

// Also send upload data for later:
window.postMessage({
    type: 'PREPARE_YOUTUBE_UPLOAD',
    payload: uploadData
}, '*');
```

**Flow**: content.js → background.js (openTab) → GeminiGen page opens → geminiGen/autoPilot.js handles automation

---

### 4. VEO_API_GENERATE_REQUEST
Triggers direct Veo 3 API generation (no browser automation needed).

```javascript
window.postMessage({
    type: 'VEO_API_GENERATE_REQUEST',
    videoIndex: 0,
    prompt: 'Video generation prompt...',
    uploadData: { ... }
}, '*');
```

**Flow**: YouTubeAnalytics.tsx listener → veoService.generateVideoWithVeo() → API response → PREPARE_YOUTUBE_UPLOAD + OPEN_YOUTUBE_UPLOAD_TAB

---

### 5. QUEUE_ITEM_COMPLETE
Signals that a video generation + upload cycle is complete, triggering the next item.

```javascript
window.postMessage({ type: 'QUEUE_ITEM_COMPLETE' }, '*');
```

**Source**: Dispatched from YOUTUBE_UPLOAD_COMPLETE handler
**Handler**: handleQueueComplete listener in YouTubeAnalytics.tsx

---

### 6. YOUTUBE_UPLOAD_COMPLETE
Signals successful YouTube scheduling/publishing.

```javascript
window.postMessage({
    type: 'YOUTUBE_UPLOAD_COMPLETE',
    videoId: 0,  // or actual YouTube video ID
    videoUrl: 'https://youtube.com/shorts/...',
    status: 'scheduled',
    scheduleTime: '01/07/2026 10:00 AM'
}, '*');
```

**Source**: studioUploader.js after clicking Schedule button
**Handler**: YouTubeAnalytics.tsx message handler

---

## 🔧 Key Components

### 1. YouTubeAnalytics.tsx (React Frontend)

**Location**: `components/YouTubeAnalytics.tsx`

**Key State Variables**:
- `yppPlan` - The current publishing plan with schedule array
- `videoPlatform` - Currently selected video generation platform
- `videoPlatformRef` - Ref for accessing platform in closures
- `executionQueue` - Array of video indices to process
- `currentProcessingIndex` - Currently processing video index

**Key Listeners**:
- `handleQueueComplete` (Line ~2430) - Handles QUEUE_ITEM_COMPLETE
- `handleVeoApiRequest` (Line ~2365) - Handles VEO_API_GENERATE_REQUEST
- Main message handler (Line ~8800) - Handles YOUTUBE_UPLOAD_COMPLETE

---

### 2. content.js (Extension Bridge)

**Location**: `gemini-extension/content.js`

**Message Handlers**:
- `GOOGLE_VIDS_GENERATE` → stores request + opens Google Vids tab
- `GOOGLE_FLOW_GENERATE` → stores request + opens Google Flow tab
- `OPEN_GEMINIGEN_TAB` → opens GeminiGen tab
- `PREPARE_YOUTUBE_UPLOAD` → stores upload data in background

---

### 3. background.js (Extension Service Worker)

**Location**: `gemini-extension/background.js`

**Key Actions**:
- `storeGoogleVidsRequest` - Stores pending generation request
- `openGoogleVidsTab` - Opens or reuses Google Vids tab
- `openGoogleFlowTab` - Opens or reuses Google Flow tab
- `openTab` - Opens a new browser tab

---

### 4. studioUploader.js (YouTube Automation)

**Location**: `gemini-extension/platforms/youtube/studioUploader.js`

**Responsibilities**:
- Retrieve stored upload data from background
- Fill in video metadata (title, description, tags)
- Set visibility to Schedule
- Set schedule date and time
- Wait for upload to complete (100%)
- Click Schedule button
- Extract video URL and send YOUTUBE_UPLOAD_COMPLETE

---

## ⚠️ Common Issues & Solutions

### Issue 1: Next video not triggering
**Symptom**: First video schedules but second video doesn't start
**Cause**: Wrong message type being sent (e.g., GOOGLE_VIDS_GENERATE when using Google Flow)
**Solution**: Ensure videoPlatformRef is properly synced and handleQueueComplete uses correct message type

### Issue 2: Schedule button clicked too early
**Symptom**: Video stays in Draft status
**Cause**: Upload not 100% complete when Schedule clicked
**Solution**: studioUploader.js now waits for "Checks complete" or 100% progress before clicking

### Issue 3: Upload data missing
**Symptom**: YouTube upload has no title/description/schedule
**Cause**: uploadData not properly stored or retrieved
**Solution**: PREPARE_YOUTUBE_UPLOAD must be sent before opening YouTube Studio

---

## 📊 Platform Selection UI

The platform is selected via a dropdown in the YouTubeAnalytics component and stored in localStorage:

```javascript
localStorage.setItem('videoPlatform', 'googleflow');  // or 'googlevids', 'geminigen', 'veoapi'
```

---

## 🔍 Debug Logs to Watch

| Log Pattern | Meaning |
|-------------|---------|
| `🚀 [Queue] Platform: googleflow` | Queue is triggering next video with correct platform |
| `🌊 [Queue] Sending GOOGLE_FLOW_GENERATE` | Google Flow message dispatched |
| `✅ [GoogleFlow] Upload triggered!` | Extension received message |
| `🔄 [Queue] Dispatching QUEUE_ITEM_COMPLETE` | Completion signal sent |
| `🔄 [React] Received QUEUE_ITEM_COMPLETE` | React received completion signal |

---

## 📅 Last Updated
- **Date**: 2026-01-07
- **Version**: 4.4.0
- **Author**: AI Content Creation Platform Development Team
