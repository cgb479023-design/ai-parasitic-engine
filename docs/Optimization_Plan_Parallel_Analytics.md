# Optimization Plan: Parallel Analytics Collection

## 1. Current Bottleneck
- **Sequential Processing:** Currently, the system collects data for 13 categories one by one.
- **Time Cost:** Each category takes ~2-5 seconds (including wait times). Total time is ~40-60 seconds.
- **Single Thread:** Only one YouTube Studio tab is used, limiting throughput.

## 2. Proposed Solution: Multi-Tab Parallel Processing
Instead of a single loop, we will distribute the workload across multiple browser tabs running in parallel.

### 2.1 Architecture
- **Batching:** Split the 13 categories into **3 batches**:
  - **Batch A (Tab 1):** `yppSprint`, `channelOverview`, `retention`, `velocity`
  - **Batch B (Tab 2):** `videoPerformance`, `audience`, `traffic`, `demographics`
  - **Batch C (Tab 3):** `devices`, `geography`, `operatingSystem`, `subtitles`, `cards`
- **Concurrency:** Open 3 YouTube Studio tabs simultaneously (background/minimized).
- **Aggregation:** Each tab reports results back to React independently. React aggregates them into the final report.

### 2.2 Workflow
1.  **React (`YouTubeAnalytics.tsx`)**:
    - User clicks "Collect Full Report".
    - React splits categories into 3 lists.
    - React sends 3 `OPEN_TAB` messages to `background.js` with specific `gemini_batch` parameters.
2.  **Background (`background.js`)**:
    - Opens 3 tabs:
      - Tab 1: `...&gemini_batch=A`
      - Tab 2: `...&gemini_batch=B`
      - Tab 3: `...&gemini_batch=C`
3.  **Content Script (`content.js`)**:
    - Detects `gemini_batch` parameter.
    - Determines which categories to collect based on the batch ID.
    - Executes its subset of queries sequentially (Fast Sequential).
    - Sends results back to React via `background.js`.
    - **Auto-Close:** Closes itself immediately after finishing its batch.
4.  **React**:
    - Receives `YOUTUBE_ANALYTICS_RESULT` messages from all 3 tabs.
    - Updates the UI progress bar (e.g., "Collecting... 4/13", "8/13", "13/13").
    - When all 13 are received (or timeout), marks collection as complete.

## 3. Expected Performance
- **Sequential:** ~60 seconds
- **Parallel (3 Tabs):** ~20 seconds (3x speedup)

## 4. Implementation Steps
1.  **Modify `YouTubeAnalytics.tsx`**:
    - Refactor `handleCollectSequentialAnalytics` to support batching.
    - Implement `startParallelCollection` function.
2.  **Modify `content.js`**:
    - Add logic to parse `gemini_batch` URL parameter.
    - Define category subsets for each batch.
    - Implement batch processing loop.
3.  **Verify `background.js`**:
    - Ensure it can handle multiple concurrent tabs sending results (already supported).

## 5. Risk Mitigation
- **Rate Limiting:** YouTube might block 3 simultaneous requests.
  - *Mitigation:* Add a small random start delay (e.g., 0ms, 500ms, 1000ms) for each tab.
- **Resource Usage:** 3 Studio tabs might be heavy.
  - *Mitigation:* Use `tab-overview` (lighter) and close tabs immediately.

---
*Plan Version: 1.0*
