console.log("🚨 [YouTube Analytics] v2.3 LONGEST_PATH_FIX - Fallback document search enabled");



(async function () {



    // 🛡️ CRITICAL PROTECTION: NEVER RUN ON LOCALHOST (REACT APP)
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        console.log("🛡️ [YouTube Analytics] Localhost detected. Exiting immediately to prevent React app closure.");
        return;
    }

    if (!hostname.includes('youtube.com')) return;



    // Expose globally immediately (placeholder)

    /**
 * @typedef {Object} CommentActionPayload
 * @property {'reply' | 'like' | 'delete' | string} actionType - The type of action to perform (e.g., 'reply', 'like', 'delete').
 * @property {string} commentId - The ID of the target comment.
 * @property {string} [text] - The text content for the action (e.g., reply text).
 */

    // Helper: Deep Query Selector (Shadow DOM support)
    function querySelectorAllDeep(selector, root = document) {
        let all = [];
        const findAll = (el) => {
            if (el.shadowRoot) {
                const found = el.shadowRoot.querySelectorAll(selector);
                all = all.concat(Array.from(found));
                Array.from(el.shadowRoot.querySelectorAll('*')).forEach(findAll);
            }
        };

        const lightFound = root.querySelectorAll(selector);
        all = all.concat(Array.from(lightFound));
        Array.from(root.querySelectorAll('*')).forEach(findAll);
        return all;
    }

    function querySelectorDeep(selector, root = document) {
        return querySelectorAllDeep(selector, root)[0] || null;
    }

    window.scrapeAnalyticsData = async () => { console.log("⏰Scraper initializing..."); return null; };



    // Listen for manual scrape requests via postMessage (from React App or other sources)

    window.addEventListener('message', async (event) => {

        if (event.data && event.data.type === 'GEMINI_MANUAL_SCRAPE_REQUEST') {

            console.log('📤 [Content Script] Received MANUAL_SCRAPE_REQUEST. Executing scrapeAnalyticsData...');

            try {

                const result = await scrapeAnalyticsData();

                console.log('📤 [Content Script] Manual scrape result:', result);

                window.postMessage({ type: 'GEMINI_MANUAL_SCRAPE_RESULT', data: result }, '*');

            } catch (e) {

                console.error('📤 [Content Script] Manual scrape error:', e);

            }

        }

    });



    // Listen for time range updates (from React App)

    window.addEventListener('message', (event) => {

        if (event.data && event.data.type === 'SET_ANALYTICS_TIME_RANGE') {

            console.log("⏱️ [Content Script] Received Time Range:", event.data.timeRange);

            window._targetTimeRange = event.data.timeRange;

        }

        // Handle Direct Request (Polling from React)

        if (event.data && event.data.type === 'REQUEST_YOUTUBE_ANALYTICS') {

            console.log("⏱️ [Content Script] Received Direct Analytics Request:", event.data.payload);

            const payload = event.data.payload;

            if (payload.action === 'scrape_analytics_direct') {

                // Pass targetTimeRange if provided

                scrapeAnalyticsData(payload.targetTimeRange).then(result => {
                    // 1. Send to local window (Content Script)
                    window.postMessage({
                        type: 'YOUTUBE_ANALYTICS_DIRECT_RESULT',
                        data: {
                            category: payload.category, // Pass back category for routing
                            data: result                // Wrap actual data
                        }
                    }, '*');

                    // 2. Send to Runtime (Background -> React)
                    if (chrome.runtime && chrome.runtime.sendMessage) {
                        chrome.runtime.sendMessage({
                            action: 'relayAnalyticsDirectResult',
                            data: {
                                category: payload.category,
                                data: result
                            }
                        });
                    }

                    // 3. ⚡ AUTO-CLOSE TAB logic moved to robust handleAutoClose() at line 10894
                    // Legacy 1s delayed close removed to prevent interference with data collection
                });

            } else if (payload.action === 'boost_video') {
                // 🚀 Plan C: Seed Traffic Booster Automation
                console.log("🚀 [Content Script] Starting Boost Video Automation for:", payload.videoId);

                (async () => {
                    try {
                        // 1. Wait for page load (Content tab)
                        await sleep(3000);

                        // 2. Search for video row by ID or Title (simplified for now: assume filtered view)
                        // In a real scenario, we might need to use the search bar

                        // 3. Find "Add to playlist" button
                        // This is tricky as it's usually in a menu or requires selection
                        // Simplified approach: Click the first checkbox (assuming filtered by ID in URL)
                        const firstCheckbox = querySelectorDeep('ytcp-checkbox-lit');
                        if (firstCheckbox) {
                            firstCheckbox.click();
                            await sleep(1000);

                            // 4. Click "Add to playlist" in the black bar
                            const addToPlaylistBtn = Array.from(querySelectorAllDeep('ytcp-text-dropdown-trigger')).find(el => el.innerText.includes('Add to playlist') || el.innerText.includes('添加到播放列表'));

                            if (addToPlaylistBtn) {
                                addToPlaylistBtn.click();
                                await sleep(1500);

                                // 5. Select first playlist (e.g. "New Uploads")
                                const playlistCheckbox = querySelectorDeep('ytcp-checkbox-lit', document.querySelector('ytcp-playlist-dialog'));
                                if (playlistCheckbox) {
                                    playlistCheckbox.click();
                                    await sleep(500);

                                    // 6. Click Save
                                    const saveBtn = querySelectorDeep('ytcp-button.save-button');
                                    if (saveBtn) saveBtn.click();

                                    console.log("✅ [Content Script] Video added to playlist!");
                                    alert("🚀 视频已添加到播放列表！\n(Seed Traffic Booster Active)");
                                } else {
                                    console.warn("⚠️ [Content Script] No playlist found in dialog");
                                    alert("⚠️ 未找到播放列表，请先创建一个！");
                                }
                            } else {
                                console.warn("⚠️ [Content Script] 'Add to playlist' button not found");
                            }
                        } else {
                            console.warn("⚠️ [Content Script] Video row checkbox not found");
                        }
                    } catch (e) {
                        console.error("❌ [Content Script] Boost automation failed:", e);
                    }
                })();
            }

        }

    });



    // Listen for messages from Background Script

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

        if (message.type === 'EXECUTE_COMMENT_ACTION') {
            console.log("💬 [Content Script] Received Comment Action:", message.payload);
            handleCommentAction(message.payload).then(() => {
                if (typeof sendResponse === 'function') sendResponse({ success: true });
            });
            return true; // Keep channel open
        }

        // 🆕 V2.5: Bridge COMMENT_POSTED from background.js to React via window.postMessage
        if (message.type === 'COMMENT_POSTED') {
            console.log("📬 [Content Script] Bridging COMMENT_POSTED to React:", message);
            window.postMessage({
                type: 'COMMENT_POSTED',
                videoId: message.videoId,
                videoUrl: message.videoUrl,
                status: message.status,
                commentText: message.commentText,
                pinned: message.pinned,
                timestamp: message.timestamp
            }, '*');
        }

        // 🔥 V2.5: Bridge IGNITE_STATUS from background.js to React
        if (message.type === 'IGNITE_STATUS') {
            console.log("🔥 [Content Script] Bridging IGNITE_STATUS to React:", message);
            window.postMessage({
                type: 'IGNITE_STATUS',
                state: message.state,
                step: message.step,
                total: message.total,
                account: message.account,
                count: message.count,
                message: message.message
            }, '*');
        }

        // 🆕 V3.2: Bridge GEMINI_VIDEO_RESULT from background.js to React
        // CRITICAL: React queue waits for this message to continue with YouTube upload
        if (message.type === 'GEMINI_VIDEO_RESULT') {
            console.log("🎬 [Content Script] Bridging GEMINI_VIDEO_RESULT to React:",
                message.payload?.length ? `${Math.round(message.payload.length / 1024)}KB video` : 'no payload');
            window.postMessage({
                type: 'GEMINI_VIDEO_RESULT',
                payload: message.payload,
                metadata: message.metadata,
                source: message.source
            }, '*');
        }

        // 🆕 V3.3: Bridge GOOGLE_VIDS_STATUS from background.js to React
        // CRITICAL: React needs this for Google Vids generation status updates
        if (message.type === 'GOOGLE_VIDS_STATUS') {
            console.log("🎬 [Content Script] Bridging GOOGLE_VIDS_STATUS:", message.status);
            window.postMessage({
                type: 'GOOGLE_VIDS_STATUS',
                status: message.status,
                message: message.message,
                videoId: message.videoId
            }, '*');
        }

        // 🆕 V3.3: Bridge YOUTUBE_UPLOAD_COMPLETE from background.js to React
        // CRITICAL: React needs this to update video status to scheduled/published
        if (message.type === 'YOUTUBE_UPLOAD_COMPLETE') {
            console.log("📤 [Content Script] Bridging YOUTUBE_UPLOAD_COMPLETE:", message.videoId);
            window.postMessage({
                type: 'YOUTUBE_UPLOAD_COMPLETE',
                videoUrl: message.videoUrl,
                videoId: message.videoId,
                youtubeId: message.youtubeId,
                status: message.status,
                title: message.title,
                isScheduled: message.isScheduled,
                scheduleTime: message.scheduleTime
            }, '*');
        }

        // 🆕 V3.3: Bridge YOUTUBE_UPLOAD_STATUS for Google Vids generation progress
        // CRITICAL: React needs this to show real-time generation progress
        if (message.type === 'YOUTUBE_UPLOAD_STATUS') {
            console.log("📊 [Content Script] Bridging YOUTUBE_UPLOAD_STATUS:", message.status);
            window.postMessage({
                type: 'YOUTUBE_UPLOAD_STATUS',
                status: message.status,
                videoId: message.videoId
            }, '*');
        }

    });



    /**
     * Handles various comment actions on YouTube Studio.
     * This function was originally a TODO placeholder, and now dispatches comment actions.
     * @param {CommentActionPayload} payload - The payload containing action details.
     */
    async function handleCommentAction(payload) {


        const { actionType, commentId, text } = payload;

        console.log(`💬 [Comment Action] Executing ${actionType} on comment ${commentId}`);



        if (actionType === 'reply') {

            console.log(`💬 [Comment Action] Replying with: ${text}`);



            // 1. Find the target thread element

            let targetThread = findDeep(`[data-gemini-id="${commentId}"]`)[0];



            if (!targetThread) {

                // Fallback: Search all threads and match by ID or content

                const threads = findDeep('ytcp-comment-thread');

                targetThread = threads.find(t => t.getAttribute('id') === commentId || t.getAttribute('data-gemini-id') === commentId);

            }



            if (targetThread) {

                // 2. Execute reply using existing robust logic

                try {

                    await handleAIAutoReply(commentId, text, targetThread);



                    // 3. Notify successful execution

                    window.postMessage({

                        type: 'COMMENT_ACTION_RESULT',

                        status: 'success',

                        commentId: commentId

                    }, '*');

                } catch (e) {

                    console.error("❌ [Comment Action] Reply failed:", e);

                    window.postMessage({

                        type: 'COMMENT_ACTION_RESULT',

                        status: 'error',

                        message: e.message,

                        commentId: commentId

                    }, '*');

                }

            } else {

                console.warn(`⚠️ [Comment Action] Could not find comment thread for ID: ${commentId}`);

                window.postMessage({

                    type: 'COMMENT_ACTION_RESULT',

                    status: 'error',

                    message: 'Comment thread not found',

                    commentId: commentId

                }, '*');

            }

        }

    }



    // 🕵️‍♂️Shadow DOM Piercing Helper (Verified via Console)

    // Renamed/Aliased to match existing code usage

    function querySelectorAllDeep(selector, root = document) {

        const results = [];

        // 1. Check current root

        root.querySelectorAll(selector).forEach(item => results.push(item));

        // 2. Traverse children to find Shadow Roots

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null, false);

        let node;

        while (node = walker.nextNode()) {

            if (node.shadowRoot) {

                results.push(...querySelectorAllDeep(selector, node.shadowRoot));

            }

        }

        return results;

    }

    const findDeep = querySelectorAllDeep; // Alias for compatibility



    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));



    function getVisibleDeepText(element) {

        if (!element) return "";

        if (element.nodeType === Node.TEXT_NODE) return element.textContent;



        // Skip non-content elements

        const tagName = element.tagName?.toUpperCase();

        if (tagName === 'STYLE' || tagName === 'SCRIPT' || tagName === 'NOSCRIPT' ||

            tagName === 'SVG' || tagName === 'PATH' || tagName === 'IFRAME') {

            return "";

        }



        // Skip hidden elements

        if (element.style && (element.style.display === 'none' || element.style.visibility === 'hidden')) return "";



        let text = "";

        if (element.shadowRoot) {

            text += getVisibleDeepText(element.shadowRoot);

        }



        element.childNodes.forEach(child => {

            text += getVisibleDeepText(child);

        });



        return text;

    }



    // 📈 Helper: Simplify SVG path to reduce size (keeps shape but fewer points)

    const simplifyPath = (pathD, maxLength = 10000) => {

        if (!pathD) return pathD;

        if (pathD.length <= maxLength) return pathD;

        // 🛡️ DISABLE SIMPLIFICATION: It causes issues with relative commands (c, l)
        return pathD;

    };

    const simplifyPathOld = (pathD, maxLength = 10000) => {

        if (!pathD) return pathD;

        if (pathD.length <= maxLength) return pathD;



        // Strategy: Truncate but ensure we end on a valid coordinate pair

        let truncated = pathD.substring(0, maxLength);



        // Find the last valid command letter

        const lastCmdIndex = truncated.search(/[MLCSQTAHVZ][^MLCSQTAHVZ]*$/i);



        if (lastCmdIndex !== -1) {

            // If the last command is cut off, just include up to the previous command

            // But better: try to complete the current command's coordinates



            // Check if we are in the middle of a number sequence

            // Just cut off at the last space or comma to be safe-ish, 

            // but simplest is to find the last command and take everything up to it + some numbers



            // New approach: Take substring, then look for the last full coordinate pair pattern

            // This is hard to do perfectly with regex on partial string.



            // Fallback: Just increase the limit (10000 is usually fine for localStorage)

            // and do a hard cut at the last command to avoid partial numbers



            return truncated.substring(0, lastCmdIndex);

        }



        console.log("📈 Path truncated: " + pathD.length + " -> " + truncated.length);

        return truncated;

    };



    // 📱 Chart Scraper Helper (Shared)

    const scrapeActiveChart = () => {

        // 1. Initialize variables

        let pathD = null;

        let bestScore = -10000;

        let bestViewBox = "0 0 100 100";

        let viewBox = "0 0 100 100";



        /* REMOVED LEGACY LOGIC */

        // 2. Helper to evaluate paths



        const evaluatePath = (p, contextRoot) => {

            const d = p.getAttribute('d');

            if (d && d.length > 20) {

                let score = d.length;



                const lineCount = (d.match(/[Ll]/g) || []).length;

                const curveCount = (d.match(/[Cc]/g) || []).length;

                const arcCount = (d.match(/[Aa]/g) || []).length;

                const moveCount = (d.match(/[Mm]/g) || []).length;

                const closeCount = (d.match(/[Zz]/g) || []).length;



                // 1. Base Score: Length is good, but structure matters more

                score += (lineCount * 20);

                score += (curveCount * 100); // Curves are strong indicators of trend lines



                // 2. Penalties

                score -= (arcCount * 100); // Icons have arcs



                // 3. Critical Checks for Line Charts

                // A true line chart is a single continuous path (1 Move) and usually open (0 Close)

                if (moveCount > 1) score -= (moveCount * 200); // Multiple moves = multiple shapes (e.g. bars, grid)

                if (closeCount > 0) score -= 500; // Closed path = area or shape, not line



                // console.log(`   Path Analysis: Len=${d.length} Score=${score} (L:${lineCount} C:${curveCount} M:${moveCount} Z:${closeCount})`);



                if (score > bestScore) {

                    pathD = d;

                    bestScore = score;

                    // Try to get viewBox from closest SVG

                    const svg = p.closest('svg');

                    if (svg && svg.getAttribute('viewBox')) {

                        bestViewBox = svg.getAttribute('viewBox');

                    } else if (contextRoot && contextRoot.querySelector) {

                        const rootSvg = contextRoot.querySelector('svg');

                        if (rootSvg) bestViewBox = rootSvg.getAttribute('viewBox') || bestViewBox;

                    }

                }

            }

        };



        // Robust recursive helper

        const traverseAndFind = (node) => {

            if (!node) return;

            if (node.querySelectorAll) {

                const paths = node.querySelectorAll('svg path'); // Use verified selector

                paths.forEach(p => evaluatePath(p, node));

            }

            if (node.shadowRoot) traverseAndFind(node.shadowRoot);

            if (node.children) Array.from(node.children).forEach(child => traverseAndFind(child));

        };



        // Iterate ALL potential chart containers, not just the first one
        const potentialRoots = document.querySelectorAll('ytcp-chart-render, yta-line-chart-base, .chart-container, #chart-container');
        potentialRoots.forEach(root => {
            traverseAndFind(root);
        });

        // 🔧 FIX: If no chart path found in containers, search the ENTIRE document
        // The main chart SVG might not be inside any of the expected containers
        // Also trigger if found path is too short (likely icons, not the main chart)
        // 🚀 IMPROVED: Find the LONGEST path in the document, as the data chart is always complex
        if (!pathD || bestScore < 0 || (pathD && pathD.length < 5000)) {
            console.log(`📊 [scrapeActiveChart] Fallback triggered (pathD=${pathD?.length || 0}, score=${bestScore}). Searching for longest path...`);
            // 🚀 IMPROVED STRATEGY: 
            // 1. Look for specific chart classes first (yta-line-chart-base)
            // 2. Ignore hidden elements (BBox size 0)
            // 3. Fallback to longest visible path

            const allPaths = document.querySelectorAll('svg path[d]');
            let bestPath = null;
            let maxScore = -1;

            allPaths.forEach(p => {
                const d = p.getAttribute('d');
                if (!d || d.length < 50) return;

                // 1. Geometric Filter
                let bbox = null;
                try { bbox = p.getBBox(); } catch (e) { return; }

                // Must be visible and have chart-like proportions
                if (bbox.width < 100 || bbox.height < 10) return; // Too small
                if ((bbox.width / bbox.height) < 1.5) return; // Too square (likely an icon)

                // 2. Context Filter
                const parentSVG = p.closest('svg');
                if (parentSVG) {
                    const vb = parentSVG.getAttribute('viewBox');
                    // Exclude common icon viewboxes
                    if (vb && (vb.startsWith('0 0 24 24') || vb.startsWith('0 0 48 48'))) return;
                }

                // 3. Scoring
                let score = d.length;
                const classStr = p.getAttribute('class') || '';

                // Huge boost for verified chart classes
                if (classStr.includes('yta-line-chart') || classStr.includes('aplos-chart')) {
                    score += 20000; // Massive boost to ensure selection
                }

                if (score > maxScore) {
                    maxScore = score;
                    bestPath = p;
                }
            });

            if (bestPath) {
                pathD = bestPath.getAttribute('d');

                // 📏 Capture Bounding Box for perfect scaling
                try {
                    const bbox = bestPath.getBBox();
                    bestViewBox = `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`;
                } catch (e) {
                    console.warn("Could not get BBox:", e);
                }

                // Try to find color
                const computedStyle = window.getComputedStyle(bestPath);
                strokeColor = computedStyle.stroke || computedStyle.fill || '#3EA6FF';
                console.log(`📊 [scrapeActiveChart] Found best path: ${pathD.length} chars, class: ${bestPath.getAttribute('class')}, bbox: ${bestViewBox}`);
            }
        }



        // If we found a path, use the viewBox associated with it

        viewBox = bestViewBox;



        // Define root for subsequent operations (labels, markers) - use the first one or document

        // This is a compromise, but labels are usually in the first container

        const root = potentialRoots[0] || document;



        // 3. Get Axis Data - 🚨 ENHANCED: Use multiple strategies to find labels

        // Strategy 1: Find text elements in the chart base (yta-line-chart-base)
        let texts = [];

        const chartBase = document.querySelector('yta-line-chart-base');
        if (chartBase) {
            const chartTexts = Array.from(chartBase.querySelectorAll('text'))
                .map(t => t.textContent?.trim())
                .filter(Boolean);
            texts = texts.concat(chartTexts);
            console.log("📊 Chart Base Text Elements:", chartTexts.length);
        }

        // Strategy 2: Find x-axis labels from yta-chart-card (parent container)
        const chartCard = document.querySelector('yta-chart-card');
        if (chartCard) {
            const cardTexts = Array.from(chartCard.querySelectorAll('text'))
                .map(t => t.textContent?.trim())
                .filter(Boolean);
            texts = texts.concat(cardTexts);
            console.log("📊 Chart Card Text Elements:", cardTexts.length);
        }

        // Strategy 3: Traditional root-based query
        if (texts.length < 5) {
            const rootTexts = Array.from(root.querySelectorAll('text')).map(t => t.textContent?.trim()).filter(Boolean);
            texts = texts.concat(rootTexts);
        }

        // Strategy 4: Use querySelectorAllDeep for Shadow DOM
        if (texts.length < 5) {
            const deepTexts = querySelectorAllDeep('text', document).map(t => t.textContent?.trim()).filter(Boolean);
            texts = texts.concat(deepTexts);
            console.log("📊 Deep Text Elements:", deepTexts.length);
        }

        // Remove duplicates
        texts = [...new Set(texts)];
        console.log("📊 Total Unique Texts Found:", texts.length, texts.slice(0, 10));

        // Fallback: Look for HTML labels if SVG text is missing (common in some chart types)
        if (texts.length < 3) {
            const htmlLabels = Array.from(root.querySelectorAll('.tick-label, .axis-label, div[class*="label"], span[class*="label"]')).map(t => t.innerText.trim());
            texts = texts.concat(htmlLabels);
            console.log("📊 Found HTML Labels:", htmlLabels.length);
        }

        // Filter for dates - 🚨 ENHANCED: More comprehensive date regex
        const dateLabels = texts.filter(t =>
            /^[A-Z][a-z]{2}\s\d{1,2}(,?\s?\d{4})?/.test(t) ||  // "Nov 24" or "Nov 24, 2025"
            /^\d{4}$/.test(t) ||                                 // "2025"
            /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(t) ||          // "11/24" or "11/24/2025"
            /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i.test(t) ||
            /^\d{1,2}\s[A-Z][a-z]{2}(,?\s?\d{4})?$/.test(t)     // "24 Nov" or "24 Nov, 2025"
        );

        console.log("📅 Date Labels Found:", dateLabels);





        let maxY = 0;

        const parseVal = (str) => {

            if (!str) return 0;

            const num = parseFloat(str.replace(/,/g, ''));

            if (isNaN(num)) return 0;

            if (str.toUpperCase().includes('K')) return num * 1000;

            if (str.toUpperCase().includes('M')) return num * 1000000;

            return num;

        };



        const numericTexts = texts.filter(t => /^[\d.,]+[KMB]?$/.test(t));

        if (numericTexts.length > 0) {

            maxY = Math.max(...numericTexts.map(parseVal));

        }



        // 4. Get Video Markers (Publication Events) - YouTube Studio Style
        const markers = [];
        try {
            // Strategy 0: Find <text> elements inside yta-line-chart-base (EXACT match for YouTube Studio)
            const chartBase = document.querySelector('yta-line-chart-base');
            if (chartBase && markers.length === 0) {
                const chartRect = chartBase.getBoundingClientRect();
                // Find all text elements that contain only numbers (marker counts)
                const textElements = chartBase.querySelectorAll('text');

                console.log(`📰 [Markers] Found ${textElements.length} text elements in yta-line-chart-base`);

                // Track X positions to avoid duplicates
                const seenPositions = new Set();

                textElements.forEach((textEl, idx) => {
                    const text = textEl.textContent?.trim() || '';
                    // Only match numeric markers (1-99 or with + suffix) - exclude 0 which is Y-axis label
                    if (/^[1-9]\d*\+?$/.test(text)) {
                        const elRect = textEl.getBoundingClientRect();
                        // Calculate X position as percentage of chart width
                        let xPercent = 0;
                        if (chartRect.width > 0) {
                            xPercent = ((elRect.left + elRect.width / 2 - chartRect.left) / chartRect.width) * 100;
                        }

                        const count = parseInt(text.replace('+', '')) || 1;
                        const hasMore = text.includes('+');

                        // Filter: Only valid X positions (5-95%) and not duplicates
                        // Round to 1 decimal to detect duplicates
                        const xKey = xPercent.toFixed(1);

                        if (xPercent >= 5 && xPercent <= 95 && !seenPositions.has(xKey)) {
                            seenPositions.add(xKey);
                            markers.push({
                                x: xPercent,
                                count: count,
                                countText: text,
                                hasMore: hasMore,
                                label: `${count}${hasMore ? '+' : ''} video${count > 1 ? 's' : ''} published`,
                                type: 'video',
                                index: markers.length
                            });
                        }
                    }
                });

                // Sort markers by X position
                markers.sort((a, b) => a.x - b.x);

                console.log(`📰 [Markers] Strategy 0 (yta-line-chart-base text): Found ${markers.length} unique markers`);
            }

            // Strategy 1: yta-chart-markers container (Fallback)
            if (markers.length === 0) {
                const markerContainer = querySelectorDeep('yta-chart-markers', root);
                if (markerContainer) {
                    const containerRect = markerContainer.getBoundingClientRect();
                    const markerButtons = markerContainer.querySelectorAll('[role="button"], .chart-marker-item');

                    console.log(`📰 [Markers] Found yta-chart-markers with ${markerButtons.length} buttons`);

                    markerButtons.forEach((btn, idx) => {
                        const countText = btn.innerText?.trim() || '1';
                        const count = parseInt(countText.replace('+', '')) || 1;
                        const hasMore = countText.includes('+');

                        // Get position relative to container
                        const btnRect = btn.getBoundingClientRect();
                        let xPercent = 0;
                        if (containerRect.width > 0) {
                            xPercent = ((btnRect.left + btnRect.width / 2 - containerRect.left) / containerRect.width) * 100;
                        }

                        // Get aria-label for date info
                        const ariaLabel = btn.getAttribute('aria-label') || '';

                        if (xPercent >= 0 && xPercent <= 100) {
                            markers.push({
                                x: xPercent,
                                count: count,
                                countText: countText,
                                hasMore: hasMore,
                                label: ariaLabel || `${count} video${count > 1 ? 's' : ''} published`,
                                type: 'video',
                                index: idx
                            });
                        }
                    });
                }
            }

            // Strategy 2: Standard Selectors (Fallback)
            if (markers.length === 0) {
                let markerEls = Array.from(querySelectorAllDeep('ytcp-chart-marker, .chart-marker', root));

                // Strategy 3: Generic absolute divs with numbers
                if (markerEls.length === 0) {
                    const allDivs = querySelectorAllDeep('div, span', root);
                    markerEls = allDivs.filter(el => {
                        const text = el.innerText?.trim();
                        if (!text || !/^\d+\+?$/.test(text)) return false;

                        const style = window.getComputedStyle(el);
                        const w = parseFloat(style.width);
                        const h = parseFloat(style.height);

                        return (
                            style.position === 'absolute' &&
                            w > 10 && w < 60 &&
                            h > 10 && h < 60
                        );
                    });
                }

                console.log(`📰 [Markers] Fallback found ${markerEls.length} markers`);

                markerEls.forEach((m, idx) => {
                    const style = window.getComputedStyle(m);
                    const leftStr = style.left;

                    let xPercent = 0;
                    if (leftStr.includes('%')) {
                        xPercent = parseFloat(leftStr);
                    } else {
                        const left = parseFloat(leftStr);
                        const parent = m.offsetParent || m.parentElement;
                        const parentWidth = parent ? parent.offsetWidth : 0;
                        if (parentWidth > 0) {
                            xPercent = (left / parentWidth) * 100;
                        }
                    }

                    const countText = m.innerText?.trim() || '1';
                    const count = parseInt(countText.replace('+', '')) || 1;

                    if (!isNaN(xPercent) && xPercent >= 0 && xPercent <= 100) {
                        markers.push({
                            x: xPercent,
                            count: count,
                            countText: countText,
                            hasMore: countText.includes('+'),
                            label: m.getAttribute('aria-label') || `${count} video${count > 1 ? 's' : ''} published`,
                            type: 'video',
                            index: idx
                        });
                    }
                });
            }

            console.log(`📰 [Markers] Total markers found: ${markers.length}`);
        } catch (e) {
            console.warn("⚠️ Failed to scrape markers:", e);
        }







        // Fallback: Look for specific icon containers if custom element not found

        if (markers.length === 0) {

            const iconContainers = querySelectorAllDeep('div[style*="position: absolute"][style*="bottom"]', root);

            iconContainers.forEach(c => {

                if (c.querySelector('img') || c.querySelector('iron-icon')) {

                    const style = window.getComputedStyle(c);

                    const left = parseFloat(style.left);

                    if (!isNaN(left)) {

                        markers.push({ x: left, label: c.innerText || 'Video published', type: 'video' });

                    }

                }

            });

        }





        // 5. Get Precise Data Points (Tooltip Data)

        const dataPoints = [];

        try {

            // Use querySelectorAllDeep to find elements even in Shadow DOM

            // Also look for 'path' elements which are sometimes used for data points

            const interactiveElements = querySelectorAllDeep('circle[aria-label], g[aria-label], rect[aria-label], path[aria-label]', root);



            interactiveElements.forEach(el => {

                const label = el.getAttribute('aria-label');

                // Format usually: "Metric name, Date, Value" 

                if (label && (label.includes(',') || label.includes(':'))) {

                    dataPoints.push({

                        label: label,

                        x: el.getAttribute('cx') || el.getAttribute('x') || '0',

                        y: el.getAttribute('cy') || el.getAttribute('y') || '0'

                    });

                }

            });

            console.log(`📊 Found ${dataPoints.length} precise data points from DOM`);



            // 6. Fallback: Generate Data Points from Path if no aria-labels found

            if (dataPoints.length === 0 && pathD) {

                console.log("⚠️ No aria-labels found, generating data points from path...");

                // 🔧 FIX: Use robust regex for negative numbers (e.g. "1.4-0.6")
                const coords = pathD.match(/-?(?:\d+\.?\d*|\.\d+)/g);

                if (coords && coords.length >= 2) {

                    for (let i = 0; i < coords.length; i += 2) {

                        const x = parseFloat(coords[i]);

                        const y = parseFloat(coords[i + 1]);



                        const vbParts = (viewBox || "0 0 100 100").split(' ');

                        const vbH = parseFloat(vbParts[3]) || 100;



                        const value = maxY * (1 - (y / vbH));



                        dataPoints.push({

                            label: `${Math.round(value).toLocaleString()}`,

                            x: x,

                            y: y

                        });

                    }

                }

            }

        } catch (e) {

            console.warn("⚠️ Error extracting data points:", e);

        }



        // 🔍 DEBUG: Log the selected path for verification


        console.log(`📊 Selected Path Length: ${pathD?.length || 0}`);

        console.log(`📊 Selected Path Score: ${bestScore}`);

        console.log(`📊 Path Content (first 200 chars): ${pathD?.substring(0, 200)}`);

        console.log(`📊 ViewBox: ${viewBox}`);

        console.log(`📊 Data Points: ${dataPoints.length}`);




        return {

            path: pathD, // 🚀 FIX: Return raw path, do not simplify!

            viewBox: viewBox || "0 0 100 100",

            maxY: maxY,

            labels: texts,

            dateLabels: dateLabels,

            markers: markers,

            dataPoints: dataPoints // NEW

        };

    };



    // 📊 YPP Real-time Data Scraper - FIXED VERSION

    // Specifically looks for YPP Eligibility page format

    async function scrapeYPPData() {

        console.log("📊 [YPP Scraper] Starting real-time data scrape...");



        const yppData = {

            currentSubs: 0,

            currentViews: 0,

            last28DaysViews: 0,

            last90DaysViews: 0,

            watchTime: 0,

            source: 'youtube-studio-scrape',

            timestamp: Date.now()

        };



        try {

            const pageText = document.body.innerText;

            console.log(`📊 [YPP Scraper] Page text length: ${pageText.length}`);

            console.log(`📊 [YPP Scraper] Page snippet: ${pageText.substring(0, 500)}`);



            // PRIORITY 1: Look for "X subscribers" followed by a number (like "284 subscribers 500")

            // This matches: "284 subscribers" on its own line or "284 subscribers 500"

            const subsPatterns = [

                /(\d{1,3}(?:,\d{3})*)\s*subscribers?\s*(?:\d|$)/im,

                /^(\d{1,3}(?:,\d{3})*)\s*subscribers?$/im,

                /(\d{1,3}(?:,\d{3})*)\s*subscribers?\s+\d+/i

            ];



            for (const pattern of subsPatterns) {

                if (yppData.currentSubs === 0) {

                    const match = pageText.match(pattern);

                    if (match) {

                        const num = parseInt(match[1].replace(/,/g, ''));

                        if (num > 0 && num < 100000) {

                            yppData.currentSubs = num;

                            console.log(`✨[YPP Scraper] Found subscribers: ${yppData.currentSubs}`);

                            break;

                        }

                    }

                }

            }



            // PRIORITY 2: Look for "valid public Shorts views" (YPP specific)

            // Format: "145K valid public Shorts views"

            const shortsViewsMatch = pageText.match(/(\d{1,3}(?:,\d{3})*[KMB]?)\s*valid\s*public\s*Shorts\s*views/i);

            if (shortsViewsMatch) {

                let viewsStr = shortsViewsMatch[1].replace(/,/g, '');

                if (viewsStr.toUpperCase().includes('K')) {

                    yppData.currentViews = Math.round(parseFloat(viewsStr) * 1000);

                } else if (viewsStr.toUpperCase().includes('M')) {

                    yppData.currentViews = Math.round(parseFloat(viewsStr) * 1000000);

                } else if (viewsStr.toUpperCase().includes('B')) {

                    yppData.currentViews = Math.round(parseFloat(viewsStr) * 1000000000);

                } else {

                    yppData.currentViews = parseInt(viewsStr) || 0;

                }

                console.log(`✨[YPP Scraper] Found Shorts views (YPP): ${yppData.currentViews}`);

            }



            // FALLBACK: If no subscribers found, try more patterns

            if (yppData.currentSubs === 0) {

                const altSubsPatterns = [

                    /Subscribers?\s*(\d{1,3}(?:,\d{3})*)/i,

                    /(\d{1,3}(?:,\d{3})*)\s*\/\s*(?:500|1,?000)\s*subscribers?/i,

                    /(\d{1,3}(?:,\d{3})*)\s*subscribers?\s*(?:500|1,?000)/i

                ];

                for (const pattern of altSubsPatterns) {

                    const match = pageText.match(pattern);

                    if (match) {

                        const num = parseInt(match[1].replace(/,/g, ''));

                        if (num > 0 && num < 100000) {

                            yppData.currentSubs = num;

                            console.log(`✨[YPP Scraper] Found subscribers (alt): ${yppData.currentSubs}`);

                            break;

                        }

                    }

                }

            }



            // FALLBACK: General pattern with size filter

            if (yppData.currentSubs === 0) {

                const allSubsMatches = [...pageText.matchAll(/(\d{1,3}(?:,\d{3})*)\s*subscribers?/gi)];

                for (const match of allSubsMatches) {

                    const num = parseInt(match[1].replace(/,/g, ''));

                    if (num > 0 && num < 10000) {

                        yppData.currentSubs = num;

                        console.log(`✨[YPP Scraper] Found subscribers (fallback): ${yppData.currentSubs}`);

                        break;

                    }

                }

            }



            // FALLBACK for views: Look for Shorts-related views  

            if (yppData.currentViews === 0) {

                const viewPatterns = [

                    /(\d{1,3}(?:,\d{3})*[KMB]?)\s*(?:Shorts|shorts)\s*views/i,

                    /(\d{1,3}(?:,\d{3})*[KMB]?)\s*\/\s*10,?000,?000\s*views/i,

                    /Shorts\s*views[:\s]*(\d{1,3}(?:,\d{3})*[KMB]?)/i

                ];

                for (const pattern of viewPatterns) {

                    const match = pageText.match(pattern);

                    if (match) {

                        let viewsStr = match[1].replace(/,/g, '');

                        if (viewsStr.toUpperCase().includes('K')) {

                            yppData.currentViews = Math.round(parseFloat(viewsStr) * 1000);

                        } else if (viewsStr.toUpperCase().includes('M')) {

                            yppData.currentViews = Math.round(parseFloat(viewsStr) * 1000000);

                        } else {

                            yppData.currentViews = parseInt(viewsStr) || 0;

                        }

                        console.log(`✨[YPP Scraper] Found Shorts views (fallback): ${yppData.currentViews}`);

                        break;

                    }

                }

            }



            console.log(`📊 [YPP Scraper] Final: Subs=${yppData.currentSubs}, Views=${yppData.currentViews}`);



        } catch (e) {

            console.error("❌[YPP Scraper] Error scraping data:", e);

        }



        // 🎯 Calculate Conversion Rate & Metrics

        if (yppData.currentViews > 0) {

            yppData.conversionRate = (yppData.currentSubs / yppData.currentViews) * 100;

            yppData.shortsViews90Days = yppData.currentViews; // Scraped views are typically the YPP 90-day count

            console.log(`📊 [YPP Scraper] Calculated Conversion Rate: ${yppData.conversionRate.toFixed(4)}%`);

        }



        // Send data to React app

        if (yppData.currentSubs > 0 || yppData.currentViews > 0) {

            console.log(`📱 [YPP Scraper] Sending data to React: Subs=${yppData.currentSubs}, Views=${yppData.currentViews}`);



            // Post to opener (React app)

            if (window.opener) {

                window.opener.postMessage({

                    type: 'YPP_REALTIME_DATA',

                    data: yppData

                }, '*');

            }



            // Also send via chrome runtime for extension communication

            const isExtensionContextValid = () => {

                try {

                    return typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id;

                } catch (e) {

                    return false;

                }

            };



            if (isExtensionContextValid()) {

                try {

                    chrome.runtime.sendMessage({

                        action: 'relayYPPData',

                        data: yppData

                    }, () => {

                        // Ignore lastError to prevent "Unchecked runtime.lastError"

                        if (chrome.runtime.lastError) { }

                    });

                } catch (e) {

                    console.log("⚠️ [YPP] Extension context invalidated (reload page to fix)");

                }

            }

        } else {

            console.log("⚠️ [YPP Scraper] Could not find subscriber/view data on page");

        }



        return yppData;

    }



    // Auto-scrape on page load

    setTimeout(() => {

        scrapeYPPData();

    }, 5000);



    // Re-scrape every 60 seconds for real-time updates

    setInterval(() => {

        scrapeYPPData();

    }, 60000);



    // Expose for manual triggering

    window.scrapeYPPData = scrapeYPPData;





    // 🚀 AUTO-TRIGGER: Check URL and auto-open Ask Studio

    const urlParams = new URLSearchParams(window.location.search);

    const action = urlParams.get('gemini_action');

    const category = urlParams.get('category');



    // NEW: Auto-click Ask Studio button on page load

    if (action === 'analytics') {

        console.log('🚀 [Auto-trigger] Detected analytics action, will auto-open Ask Studio...');



        // Wait for page to load, then auto-click the Ask Studio button

        setTimeout(async () => {

            console.log('🔍 [Auto-trigger] Searching for Ask Studio button...');



            // Find and click the Ask Studio button

            let attempts = 0;

            const maxAttempts = 30;



            while (attempts < maxAttempts) {

                const askBtn = document.querySelector('ytcp-icon-button[aria-label*="Ask"]') ||

                    document.querySelector('ytcp-icon-button[icon="sparkles"]') ||

                    Array.from(document.querySelectorAll('ytcp-icon-button')).find(btn => {

                        const label = (btn.getAttribute('aria-label') || '').toLowerCase();


                    });



                if (askBtn) {

                    console.log('✨[Auto-trigger] Found Ask Studio button, clicking...');



                    // Multiple click strategies

                    askBtn.click();



                    // Also try shadow DOM button

                    if (askBtn.shadowRoot) {

                        const shadowBtn = askBtn.shadowRoot.querySelector('button');

                        if (shadowBtn) shadowBtn.click();

                    }



                    // Dispatch events as backup

                    ['mousedown', 'click', 'mouseup'].forEach(type => {

                        askBtn.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));

                    });



                    console.log('✨[Auto-trigger] Ask Studio button clicked!');

                    break;

                }



                attempts++;

                if (attempts % 5 === 0) console.log(`⏰[Auto-trigger] Waiting for Ask Studio button... (${attempts}/${maxAttempts})`);

                await new Promise(r => setTimeout(r, 1000));

            }



            if (attempts >= maxAttempts) {

                console.error('❌[Auto-trigger] Could not find Ask Studio button after 30 seconds');

            }

        }, 3000); // Wait 3s for page to load

    }



    if (action === 'analytics' && category) {

        console.log('🚀 [Auto-trigger] Detected URL params:', { action, category });

        // Wait for page to load and runAnalyticsAgent to be defined

        setTimeout(() => {

            if (typeof window.runAnalyticsAgent === 'function') {

                console.log('✨[Auto-trigger] Calling runAnalyticsAgent...');

                window.runAnalyticsAgent({ category: category });

            } else {

                console.error('❌[Auto-trigger] runAnalyticsAgent not available yet');

            }

        }, 8000); // Increased to 8s to ensure Ask Studio is open

    }



    // --- Configuration ---

    const CONFIG = {

        version: "2.1 (Fix Promotions Selector)", // 🎯 Version Tag

        selectors: {

            toggleButton: 'ytcp-icon-button[aria-label*="Ask"], ytcp-icon-button[icon="sparkles"], ytcp-icon-button[icon*="sparkle"], #ask-studio-button',


            submitButton: '#send-button, button[aria-label="Send"], button[aria-label="Submit"], ytcp-icon-button[icon="send"], ytcp-icon-button[aria-label="Send"], [id="send-button"]',

            messageBubbles: 'ytcp-assistant-message, ytcp-comment-thread, .message-bubble, [class*="chat-message"]',

            stopButton: 'button[aria-label="Stop generating"], ytcp-icon-button[icon="stop"]' // New selector for busy state

        },

        waitTimes: {

            panelOpen: 3000,

            beforeSubmit: 2000,

            maxResponseWait: 120000,

            betweenQuestions: 5000 // Increased buffer

        }

    };



    const ANALYTICS_QUESTIONS = {

        // YPP Sprint Dashboard

        yppSprint: [

            "YPP Progress Check: What is my current subscriber count? How many public Shorts views do I have in the last 90 days? Calculate: (1) Days to reach 1000 subscribers. (2) Subscriber Conversion Rate (Subs/Views %). (3) Days to reach 10M views."

        ],



        // Channel Overview - 48 Hour Signal

        channelOverview: [

            "48-Hour Signal: List Views, Subs Gained, and AVD for past 48h. Calculate Subs/Views ratio. Diagnosis: Is channel in 'viral pool' (Velocity > 1000/hr) or 'seeding phase'?"

        ],



        // Retention Analysis - CRITICAL

        retention: [

            "Deep Retention Analysis: For my recent Shorts, provide: 1. Average Percentage Viewed (APV). 2. Retention at 3 seconds (Hook efficiency). 3. Retention Curve Drop-off points (where do most viewers leave?). 4. Rewatch Ratio (Views / Unique Viewers)."

        ],



        // First Hour Velocity - Algorithm Trigger

        velocity: [

            "Velocity & Swipe-Away: 1. Average First Hour Velocity for recent videos. 2. Swipe-Away Rate (if available, or estimate based on impressions vs views). 3. Burst Mode Trigger: Is current velocity > 500 views/hour?"

        ],



        // Video Performance Ranking

        videoPerformance: [


        ],



        // Audience Insights

        audience: [

            "Golden Publishing Window: What are my audience's most active hours (in GMT+8) and top 3 geographic regions? Strategic recommendation: What is the optimal posting time to maximize first-hour push?"

        ],



        // Traffic Sources

        traffic: [

            "Shorts Feed Activation Check: What percentage of traffic comes from Shorts Feed vs Search vs Browse? Target: Shorts Feed >80%. Diagnosis: Has the algorithm identified this channel as a 'Shorts Creator'?"

        ],



        // Engagement & Social Proof

        engagement: [

            "Social Proof Audit: What is my Like/View ratio (target >4%)? Comment/View ratio? Share count? Diagnosis: Are engagement signals strong enough to trigger 'high-engagement weighting'? List the 3 videos with highest engagement rates."

        ],



        // Comment Insights

        comments: [

            "Demand Mining: What are the top 5 keywords in my comments? What content are viewers actively requesting? Are there signals like 'please make more of this'?"

        ],



        // Rewatch Rate - Strong Viral Signal

        rewatch: [

            "Analyze my video rewatch rate data. Please respond in this format: 1. Average replay multiplier: X.Xx 2. Video with highest rewatch rate: Title - X.Xx 3. Number of videos with APV over 100%: X"

        ],



        // Swipe-Away Rate - Negative Signal

        swipeAway: [

            "Analyze my Shorts video swipe-away rate. Please respond in this format: 1. Average swipe-away rate: X.X% 2. Video with highest swipe-away rate: Title - X.X% 3. Video with lowest swipe-away rate: Title - X.X%"

        ],



        // Subscriber Conversion - Growth Efficiency

        subsConversion: [

            "Subscriber Conversion Analysis: Which videos have the highest 'Subscribers gained per 1,000 views' ratio? What is my average subscriber conversion rate? List the top 3 videos for converting viewers into subscribers."

        ],



        // Session Time - Platform Contribution

        sessionTime: [

            "Session Time Contribution: Which of my videos lead to the longest overall viewing sessions? Do viewers tend to watch more content after watching specific videos? Identify 'Session Starters'."

        ]

    };





    // 🚀 PARALLEL BATCH DEFINITIONS - For 3x speedup in Analytics Collection
    const BATCH_DEFINITIONS = {
        A: ['yppSprint', 'channelOverview', 'retention', 'velocity'],
        B: ['videoPerformance', 'audience', 'traffic', 'engagement'],
        C: ['comments', 'rewatch', 'swipeAway', 'subsConversion', 'sessionTime']
    };

    // --- Core Logic ---



    async function ensurePanelOpen() {

        // Note: Ask Studio IS available on Comments page (verified manually)

        // It's used for AI Reply functionality



        // 1. Check if already open - Enhanced detection

        // Primary check: Look for the input box (most reliable indicator)

        const inputBox = querySelectorAllDeep('div[contenteditable="true"]').find(el => {

            const rect = el.getBoundingClientRect();

            return el.offsetParent !== null && rect.width > 100 && rect.height > 20;

        });



        if (inputBox) {

            console.log("✨[Ask Studio] Panel is already open (detected via input box)");

            return true;

        }



        // Secondary check: Look for dialog or visible panel text

        const dialogs = querySelectorAllDeep('ytcp-assistant-dialog, [role="dialog"]');

        const visibleDialog = dialogs.find(d => {

            const rect = d.getBoundingClientRect();

            return d.offsetParent !== null && rect.height > 0 && rect.width > 0;

        });



        // Also check for "How can I help" or "Ask something" text (English + Chinese)

        const bodyText = document.body.innerText;

        const hasAskText = bodyText.includes("How can I help you") ||

            bodyText.includes("Ask something") ||

            bodyText.includes("Ask Studio") && bodyText.includes("Send") ||

            // Chinese patterns (中文界面)


            bodyText.includes("提问");





        if (visibleDialog || hasAskText) {

            console.log("✨[Ask Studio] Panel is already open (detected via dialog/text)");

            return true;

        }



        console.log("🔄 [Ask Studio] Searching for toggle button...");

        let toggleBtn = null;

        const start = Date.now();



        // 2. Robust Search for the button (Deep Scan)

        while (Date.now() - start < 30000) {

            // Find all button-like elements deeply

            const allButtons = querySelectorAllDeep('ytcp-icon-button, button, [role="button"]');



            toggleBtn = allButtons.find(btn => {

                const label = (btn.getAttribute('aria-label') || '').toLowerCase();

                const html = btn.innerHTML.toLowerCase();

                const id = (btn.id || '').toLowerCase();



                // Match rules: Ask, Studio, Sparkle, or specific ID
                // ENHANCED: Added more detection patterns for YouTube Studio UI updates
                const hasSparkleIcon = btn.querySelector('iron-icon[icon*="sparkle"], ytcp-icon-shape, svg[class*="sparkle"]');
                const tooltip = (btn.getAttribute('title') || btn.getAttribute('data-tooltip') || '').toLowerCase();

                return label.includes('ask') ||
                    label.includes('studio') ||
                    label.includes('gemini') ||
                    label.includes('assistant') ||
                    label.includes('ai') ||
                    tooltip.includes('ask') ||
                    tooltip.includes('studio') ||
                    html.includes('sparkle') ||
                    html.includes('glow') ||
                    html.includes('gemini') ||
                    hasSparkleIcon ||
                    id === 'help-icon-button' ||
                    id.includes('assistant') ||
                    id.includes('ask');

            });



            if (toggleBtn) {

                console.log("✨[Ask Studio] Found toggle button:", toggleBtn);

                break;

            }

            // 🔍 DEBUG: Log what buttons are visible for troubleshooting
            if ((Date.now() - start) % 5000 < 1100) { // Every ~5 seconds
                const debugButtons = allButtons.slice(0, 10).map(b => ({
                    label: b.getAttribute('aria-label'),
                    id: b.id,
                    class: b.className?.slice(0, 50)
                }));
                console.log(`🔍 [Ask Studio DEBUG] Found ${allButtons.length} buttons. First 10:`, debugButtons);
            }

            await sleep(1000);

            console.log("⏰[Ask Studio] Waiting for toggle button...");

        }



        if (!toggleBtn) {

            console.error("❌[Ask Studio] Toggle button NOT found. Please manually open the 'Ask' panel.");

            return false;

        }



        console.log("🏠[Ask Studio] Clicking toggle button...", toggleBtn);



        // Multiple click strategies for browser compatibility

        const clickStrategies = async (btn) => {

            const rect = btn.getBoundingClientRect();

            const centerX = rect.left + rect.width / 2;

            const centerY = rect.top + rect.height / 2;



            // Strategy 0 (PROVEN WORKING - Click tp-yt-paper-icon-button-light inside shadowRoot)

            console.log("🏠[Ask Studio] Trying Strategy 0: paper-icon-button click (proven working)...");

            try {

                // This is the exact method that worked in F12 console

                if (btn.shadowRoot) {

                    // Priority 1: tp-yt-paper-icon-button-light (THIS WORKS!)

                    const paperBtn = btn.shadowRoot.querySelector('tp-yt-paper-icon-button-light');

                    if (paperBtn) {

                        console.log("🏠[Ask Studio] Found paper-icon-button-light, clicking...");

                        paperBtn.click();

                        await sleep(500);

                    }



                    // Priority 2: Any button inside

                    const innerButton = btn.shadowRoot.querySelector('button');

                    if (innerButton) {

                        console.log("🏠[Ask Studio] Clicking inner button...");

                        innerButton.focus();

                        innerButton.click();

                        await sleep(300);

                    }

                }



                // Also try direct click

                btn.focus();

                btn.click();

                await sleep(300);

            } catch (e) {

                console.warn("⚠️ Strategy 0 failed:", e);

            }



            // Strategy 1 (PRIORITY - Console Method 3): Clean MouseEvent simulation

            // This worked when executed from F12 console

            console.log("🏠[Ask Studio] Trying Strategy 1: Clean MouseEvent...");

            const clickEvent = new MouseEvent('click', {

                bubbles: true,

                cancelable: true,

                view: window,

                clientX: centerX,

                clientY: centerY,

                button: 0,

                buttons: 1

            });

            btn.dispatchEvent(clickEvent);

            await sleep(300);



            // Strategy 2: Focus and simulate Enter key

            console.log("🏠[Ask Studio] Trying Strategy 2: Enter key...");

            btn.focus();

            await sleep(100);

            btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));

            btn.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));

            await sleep(200);



            // Strategy 3: Standard click

            console.log("🏠[Ask Studio] Trying Strategy 3: Standard click...");

            btn.click();



            // Strategy 4: Shadow DOM internal button click

            if (btn.shadowRoot) {

                const internalBtn = btn.shadowRoot.querySelector('button, #button, [role="button"]');

                if (internalBtn) {

                    console.log("🏠[Ask Studio] Trying Strategy 4: Shadow DOM internal click...");

                    internalBtn.focus();

                    internalBtn.click();

                    // Also try MouseEvent on internal button

                    internalBtn.dispatchEvent(new MouseEvent('click', {

                        bubbles: true, cancelable: true, view: window,

                        clientX: centerX, clientY: centerY

                    }));

                }

            }



            // Strategy 5: Full event sequence (mousedown -> mouseup -> click)

            console.log("🏠[Ask Studio] Trying Strategy 5: Full event sequence...");

            ['mousedown', 'mouseup', 'click'].forEach(type => {

                btn.dispatchEvent(new MouseEvent(type, {

                    bubbles: true, cancelable: true, view: window,

                    clientX: centerX, clientY: centerY, button: 0

                }));

            });



            // Strategy 6: Pointer events

            console.log("🏠[Ask Studio] Trying Strategy 6: Pointer events...");

            btn.dispatchEvent(new PointerEvent('pointerdown', {

                bubbles: true, cancelable: true, view: window,

                clientX: centerX, clientY: centerY, pointerId: 1, isPrimary: true

            }));

            await sleep(50);

            btn.dispatchEvent(new PointerEvent('pointerup', {

                bubbles: true, cancelable: true, view: window,

                clientX: centerX, clientY: centerY, pointerId: 1, isPrimary: true

            }));

        };



        // 🔧 RETRY LOOP: Try clicking multiple times with increasing delays
        let panelOpened = false;
        const maxAttempts = 5;

        for (let attempt = 1; attempt <= maxAttempts && !panelOpened; attempt++) {
            console.log(`🔄 [Ask Studio] Attempt ${attempt}/${maxAttempts}...`);

            try {
                await clickStrategies(toggleBtn);
            } catch (e) {
                console.warn(`⚠️ [Ask Studio] Click attempt ${attempt} failed:`, e);
            }

            // Wait and Verify - Increase delay with each attempt
            const waitTime = 1500 + (attempt * 500); // 2s, 2.5s, 3s, 3.5s, 4s
            await sleep(waitTime);

            // Check if panel is now open
            const checkPanelOpen = () => {
                // Check for input box
                const inputBox = querySelectorAllDeep('div[contenteditable="true"]').find(el => {
                    const rect = el.getBoundingClientRect();
                    return el.offsetParent !== null && rect.width > 100;
                });
                if (inputBox) return true;

                // Check for dialog
                const isDialogOpen = querySelectorAllDeep('ytcp-assistant-dialog, [role="dialog"]').some(d => d.offsetParent !== null);
                if (isDialogOpen) return true;

                // Check for text indicators (English + Chinese)
                const bodyText = document.body.innerText;
                return bodyText.includes("How can I help you") ||
                    bodyText.includes("Ask something") ||
                    bodyText.includes("提问");
            };

            if (checkPanelOpen()) {
                console.log(`✨[Ask Studio] Panel opened successfully on attempt ${attempt}!`);
                panelOpened = true;
                return true;
            }

            console.log(`⏰ [Ask Studio] Panel not open yet, retrying...`);
        }

        // If still closed after all attempts, show visual cue for manual click
        console.error("❌[Ask Studio] Auto-click failed after 5 attempts. Please click the sparkle icon manually!");

        // Visual Cue on button

        toggleBtn.style.border = "5px solid red";

        toggleBtn.style.boxShadow = "0 0 30px red";

        toggleBtn.style.animation = "pulse 1s infinite";



        // Create floating notification

        let notification = document.getElementById('ask-studio-manual-click-notice');

        if (!notification) {

            notification = document.createElement('div');

            notification.id = 'ask-studio-manual-click-notice';

            notification.innerHTML = `

                    <div style="position:fixed; top:20px; left:50%; transform:translateX(-50%); z-index:999999;

                        background:linear-gradient(135deg, #ff4444, #cc0000); color:white; padding:20px 40px;

                        border-radius:12px; font-size:18px; font-weight:bold; box-shadow:0 8px 32px rgba(0,0,0,0.4);

                        animation: bounce 0.5s ease-in-out infinite alternate;">

                    </div>

                    <style>

                        @keyframes bounce { from { transform: translateX(-50%) translateY(0); } to { transform: translateX(-50%) translateY(-10px); } }

                        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

                    </style>

                `;

            document.body.appendChild(notification);

        }



        // Wait for user to click it (Increased to 60s)

        for (let i = 0; i < 60; i++) {

            const dialogs = querySelectorAllDeep('ytcp-assistant-dialog, [role="dialog"]');

            const visibleDialog = dialogs.find(d => d.offsetParent !== null && d.getBoundingClientRect().width > 0);



            // Text fallback: Look for "Ask something" input or "How can I help you" (English + Chinese)

            const bodyText = document.body.innerText;

            const hasText = bodyText.includes("How can I help you") ||

                bodyText.includes("Ask something") ||

                bodyText.includes("Ask Studio") ||


                bodyText.includes("提问")



            if (visibleDialog || hasText) {

                console.log("✨[Ask Studio] Panel detected open! Resuming...");

                // Remove visual cue

                toggleBtn.style.border = "";

                toggleBtn.style.boxShadow = "";

                toggleBtn.style.animation = "";

                // Remove floating notification

                const notice = document.getElementById('ask-studio-manual-click-notice');

                if (notice) notice.remove();

                return true;

            }

            if (i % 5 === 0) console.log(`⏰Waiting for manual open... (${i}/60)`);

            await sleep(1000);

        }

        return false;

    }



    async function askStudio(question) {

        console.log(`📝 [Ask Studio] Asking: "${question}"`);

        // ⚠️ Enhanced Error Detection: Check if panel has an error state before proceeding
        const checkForErrors = () => {
            const bodyText = document.body.innerText;
            // Check for error messages in English and Chinese
            return bodyText.includes("Something went wrong") ||
                bodyText.includes("error occurred") ||
                bodyText.includes("try again later") ||
                bodyText.includes("发生错误") ||
                bodyText.includes("请重试");
        };

        // 🔄 Enhanced retry loop with error detection and recovery
        for (let retry = 0; retry < 3; retry++) {
            console.log(`🔄 [Ask Studio] AskStudio attempt ${retry + 1}/3`);

            // Check for existing errors and close panel if needed
            if (checkForErrors()) {
                console.error(`❌ [Ask Studio] Detected error in panel, attempting to recover...`);
                // Try to close the error state by clicking on the panel or close button
                const closeButtons = querySelectorAllDeep('button[aria-label*="Close"], [role="button"], ytcp-icon-button[icon*="close"]');
                closeButtons.forEach(btn => {
                    try {
                        btn.click();
                    } catch (e) {
                        console.warn(`⚠️ [Ask Studio] Error closing panel: ${e.message}`);
                    }
                });
                // Wait for panel to close
                await sleep(2000);
            }

            // Try to open the panel
            if (!(await ensurePanelOpen())) {
                console.error(`❌ [Ask Studio] Could not open panel on attempt ${retry + 1}`);
                continue;
            }

            // Double-check for errors in the open panel
            if (checkForErrors()) {
                console.error(`❌ [Ask Studio] Panel opened but has errors, retrying...`);
                continue;
            }

            // Panel is open and error-free, proceed with asking the question
            break;
        }

        // Final check: If panel still has errors after all retries
        if (checkForErrors()) {
            console.error(`❌ [Ask Studio] Failed to recover from panel error after 3 attempts`);
            return { success: false, question, error: "Could not open panel due to persistent errors" };
        }



        let input = null;

        let container = null;



        // Find Input - Enhanced Strategy with Better Logging

        for (let i = 0; i < 25; i++) { // Increased attempts to 25



            // 0. Check for "Stop generating" button (Busy State)

            const stopBtns = querySelectorAllDeep(CONFIG.selectors.stopButton);

            const isBusy = stopBtns.some(b => b.offsetParent !== null && b.getBoundingClientRect().width > 0);

            if (isBusy) {

                console.log("⏰[Ask Studio] AI is generating... waiting...");

                await sleep(2000);

                continue;

            }



            // 1. Look for the specific custom element first

            const suggestionBox = querySelectorAllDeep('ytcp-social-suggestions-textbox, ytcp-mention-input').find(el => el.offsetParent !== null);

            if (suggestionBox) {

                input = querySelectorAllDeep('[contenteditable="true"]', suggestionBox)[0];

                if (input) console.log("✨[Ask Studio] Found input via suggestion box container");

            }



            // 2. Generic search if specific failed

            if (!input) {

                let inputs = querySelectorAllDeep(CONFIG.selectors.inputBox);

                input = inputs.find(inp => inp.offsetParent !== null && inp.getBoundingClientRect().height > 0 && inp.getAttribute('contenteditable') === 'true');

                if (input) console.log("✨[Ask Studio] Found input via generic search");

            }



            // 3. Fallback: Search near submit button

            if (!input) {

                const submitBtns = querySelectorAllDeep(CONFIG.selectors.submitButton);

                const visibleSubmit = submitBtns.find(b => b.offsetParent !== null);

                if (visibleSubmit) {

                    let parent = visibleSubmit.parentElement;

                    while (parent && !input && parent.tagName !== 'YTCP-ASSISTANT-DIALOG') {

                        const siblings = querySelectorAllDeep('[contenteditable="true"]');

                        const nearbyInputs = siblings.filter(el => parent.contains(el) && el !== visibleSubmit && el.offsetParent !== null);

                        if (nearbyInputs.length > 0) {

                            input = nearbyInputs[0];

                            console.log("✨[Ask Studio] Found input near submit button");

                        }

                        parent = parent.parentElement;

                    }

                }

            }



            // 4. Ultimate Fallback: Any contenteditable in the dialog

            if (!input) {

                const dialog = document.querySelector('ytcp-assistant-dialog');

                if (dialog) {

                    const candidates = querySelectorAllDeep('div[contenteditable="true"]', dialog);

                    input = candidates.find(el => el.offsetParent !== null);

                    if (input) console.log("⚠️ [Ask Studio] Found input via Ultimate Fallback (Dialog Search)");

                }

            }



            // 5. Super Fallback: Look for ANY visible contenteditable div on the page

            if (!input) {

                const allEditables = querySelectorAllDeep('div[contenteditable="true"]');

                input = allEditables.find(el => {

                    const rect = el.getBoundingClientRect();

                    return el.offsetParent !== null && rect.width > 100 && rect.height > 20;

                });

                if (input) console.log("🔧 [Ask Studio] Found input via Super Fallback (Any Visible Editable)");

            }



            if (input) {

                console.log("✨[Ask Studio] Found input box:", input);

                break;

            }

            if (i % 5 === 0) console.log(`⏰[Ask Studio] Searching for input... (${i}/25)`);

            await sleep(1000);

        }



        if (!input) return { success: false, question, error: "Input box not found" };



        // Find Container - Enhanced with Direct Selector Queries

        // First, try direct selectors for the Ask Studio dialog

        const dialogSelectors = [

            'ytcp-creator-chat-dialog', // 🎯 Found via debug

            'ytcp-assistant-dialog',

            '[role="dialog"]',

            '.style-scope.ytcp-assistant-dialog',

            'div[class*="assistant"]',

            '#dialog-content',

            'ytcp-dialog'

        ];



        for (const selector of dialogSelectors) {

            const found = querySelectorAllDeep(selector).find(el => {

                const rect = el.getBoundingClientRect();

                return el.offsetParent !== null && rect.width > 200 && rect.height > 200;

            });

            if (found) {

                container = found;

                console.log(`✨[Ask Studio] Found container via direct selector: ${selector}`);

                break;

            }

        }



        // Fallback: Traverse up from input element

        if (!container) {

            let curr = input;

            while (curr) {

                if (curr.tagName === 'YTCP-ASSISTANT-DIALOG' ||

                    curr.getAttribute('role') === 'dialog' ||

                    (curr.className && typeof curr.className === 'string' && curr.className.includes('dialog'))) {

                    container = curr;

                    console.log(`✨[Ask Studio] Found container via traversal: ${curr.tagName}`);

                    break;

                }

                if (curr.parentElement) {

                    curr = curr.parentElement;

                } else if (curr.parentNode instanceof ShadowRoot) {

                    curr = curr.parentNode.host;

                } else {

                    break;

                }

            }

        }



        if (!container) {

            console.warn("⚠️ [Ask Studio] Could not find dialog container. Falling back to document.body");

            container = document.body;

        }



        // Type Question

        input.focus();

        document.execCommand('selectAll', false, null);

        document.execCommand('delete', false, null);

        document.execCommand('insertText', false, question);

        input.dispatchEvent(new Event('input', { bubbles: true }));

        input.dispatchEvent(new Event('change', { bubbles: true }));

        await sleep(CONFIG.waitTimes.beforeSubmit);



        // Submit

        const clickSubmit = () => {

            const possibleBtns = querySelectorAllDeep(CONFIG.selectors.submitButton);

            const submitBtn = possibleBtns.find(b => {

                const isDisabled = b.disabled || b.getAttribute('disabled') !== null || b.getAttribute('aria-disabled') === 'true';

                const isVisible = b.offsetParent !== null && b.getBoundingClientRect().width > 0;

                return !isDisabled && isVisible;

            });



            if (submitBtn) {

                console.log("🏠[Ask Studio] Clicking submit button...");

                submitBtn.click();

                if (submitBtn.shadowRoot) {

                    const internalBtn = submitBtn.shadowRoot.querySelector('button, #button');

                    if (internalBtn) internalBtn.click();

                }

                return true;

            }

            return false;

        };



        clickSubmit();

        await sleep(2500);



        // Verify Submit & Retry with Enter

        let currentVal = input.value || input.innerText || "";

        const sendBtnVisible = querySelectorAllDeep(CONFIG.selectors.submitButton).some(b => !b.disabled && b.getAttribute('disabled') === null && b.offsetParent !== null && b.getBoundingClientRect().width > 0);



        if (currentVal.includes(question.substring(0, 10)) && sendBtnVisible) {

            console.log("⚠️ [Ask Studio] Button click didn't send. Trying Enter key...");

            const eventOptions = { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true, cancelable: true, composed: true };

            input.dispatchEvent(new KeyboardEvent('keydown', eventOptions));

            await sleep(50);

            input.dispatchEvent(new KeyboardEvent('keypress', eventOptions));

            await sleep(50);

            input.dispatchEvent(new KeyboardEvent('keyup', eventOptions));

        }



        console.log("✨[Ask Studio] Submission sequence finished. Watching for response...");



        // Wait for Response

        let lastText = getVisibleDeepText(container);

        let lastStableText = "";

        let stabilityCount = 0;

        const maxWait = CONFIG.waitTimes.maxResponseWait;

        const startWait = Date.now();

        let hasStartedChanging = false;



        const observer = new MutationObserver(() => { });

        observer.observe(container, { childList: true, subtree: true, characterData: true, attributes: true });



        // Count bubbles before we start waiting

        const bubbleSelectorsForCount = CONFIG.selectors.messageBubbles + ', ytcp-assistant-message-content';

        let initialBubbleCount = querySelectorAllDeep(bubbleSelectorsForCount).length;



        while (Date.now() - startWait < maxWait) {

            await sleep(1000);

            const currentText = getVisibleDeepText(container);

            const currentLen = currentText.length;

            const currentBubbles = querySelectorAllDeep(bubbleSelectorsForCount).length;



            // Check for loading indicators

            if (currentText.includes("Generating") || currentText.includes("Thinking")) {

                // console.log("⏰[Ask Studio] AI is generating...");

                hasStartedChanging = true;

                stabilityCount = 0; // Reset stability

                lastText = currentText;

                continue;

            }



            if (!hasStartedChanging) {

                // Trigger 1: Text length changed significantly

                if (Math.abs(currentLen - lastText.length) > 5) {

                    hasStartedChanging = true;

                }

                // Trigger 2: New bubbles appeared

                if (currentBubbles > initialBubbleCount) {

                    hasStartedChanging = true;

                }



                // Fallback: If we've waited 8 seconds and nothing changed, but we have bubbles, maybe we missed it?

                if (Date.now() - startWait > 8000 && currentBubbles > 0) {

                    console.log("⚠️ [Ask Studio] No change detected, but bubbles exist. Assuming response is ready.");

                    hasStartedChanging = true;

                    break; // Force exit to extraction

                }

                continue;

            }



            if (currentLen === lastText.length && currentLen > 0) {

                stabilityCount++;

                if (stabilityCount >= 2) {

                    lastStableText = currentText;

                    break;

                }

            } else {

                stabilityCount = 0;

                lastText = currentText;

            }

        }

        observer.disconnect();



        if (!lastStableText && hasStartedChanging) lastStableText = getVisibleDeepText(container);



        // ⚡FIX: If container text is empty, fallback to document.body

        if (lastStableText.length < 10) {

            console.warn("⚠️ [Ask Studio] Container text is empty or too short. Falling back to document.body scan...");

            const bodyText = getVisibleDeepText(document.body);

            if (bodyText.length > lastStableText.length) {

                lastStableText = bodyText;

                console.log(`✨[Ask Studio] Recovered text from body. New length: ${lastStableText.length}`);

            }

        }



        // --- Extraction Strategies ---

        console.log(`🔍 [Ask Studio] Extraction started. Container text length: ${lastStableText.length}`);



        // Strategy A: Explicit Bubble Filtering (Enhanced)

        // More comprehensive selectors for YouTube Studio's Ask Studio AI responses

        const bubbleSelectors = [

            'ytcp-creator-chat-response-item', // 🎯 Found via debug

            'markdown-div', // 🎯 Found via debug

            'ytcp-assistant-message-content',

            'ytcp-assistant-message',

            '.assistant-message-content',

            '[class*="assistant-message"]',

            '[class*="chat-message"]',

            '[class*="message-content"]',

            // 'ytcp-ve [class*="content"]', // ⚠️ REMOVED: Too broad, catches menu items like "Promotions"

            'yt-formatted-string.ytcp-assistant-message-content',

            'div[slot="message-content"]',

            'ytcp-markdown-content',

            '.markdown-content',

            '[class*="markdown"]'

        ].join(', ');



        const bubbles = querySelectorAllDeep(bubbleSelectors);

        console.log(`🔍 [Ask Studio] Found ${bubbles.length} elements with bubble selectors.`);

        // Iterate backwards to find the latest response

        for (let i = bubbles.length - 1; i >= 0; i--) {

            const bubble = bubbles[i];

            const text = getVisibleDeepText(bubble).trim();



            // Filter out empty or noise

            if (text.length < 2) continue;



            // 🚨 ERROR DETECTION: If the AI explicitly says it failed, return error immediately

            if (text.includes("Something went wrong") || text.includes("error occurred") || text.includes("try again later")) {


                return { success: false, question, error: "AI Response Error: " + text };

            }



            if (text.includes("Just a sec")) continue;

            // Filter out greetings (English & Chinese)

            const lowerText = text.toLowerCase();

            if (lowerText.includes("how can i help")) {

                console.log("⚠️ [Ask Studio] Skipping greeting: 'How can I help'");

                continue;

            }




            if (lowerText.startsWith("hi, i'm ask studio") || lowerText.startsWith("i'm ask studio")) {

                console.log("⚠️ [Ask Studio] Skipping greeting: English Hello");

                continue;

            }

            // Note: We do NOT filter out "subscribers" or "viewers" because 

            // those are expected in analytics responses!



            // Filter out the question itself (fuzzy match)

            const normalizedText = text.replace(/\s+/g, ' ').toLowerCase();

            const normalizedQuestion = question.replace(/\s+/g, ' ').toLowerCase();

            // Check if this bubble is the question we just asked

            if (normalizedText.includes(normalizedQuestion.substring(0, 20)) ||

                (question.length > 10 && normalizedText.includes(question.substring(0, 10)))) {

                console.log("🔍 [Ask Studio] Skipping user question bubble.");

                continue;

            }



            console.log("✨[Ask Studio] Found valid message bubble (Strategy A):", text.substring(0, 50) + "...");



            // 🧠 JSON Extraction - IMPROVED: More tolerant of mixed AI responses

            let jsonData = null;

            try {
                // Strategy 1: Try markdown code block first (most reliable)
                const codeBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
                if (codeBlockMatch) {
                    jsonData = JSON.parse(codeBlockMatch[1].trim());
                    console.log("📊 [Ask Studio] Extracted JSON from code block:", jsonData);
                }
                // Strategy 2: Try plain JSON extraction (but don't fail on parse error)
                else {
                    // Don't try to extract raw JSON blocks from AI text - it's unreliable
                    // parseDFLReport will handle individual key extraction instead
                    console.log("📊 [Ask Studio] No JSON code block found, will rely on parseDFLReport");
                }
            } catch (e) {
                console.warn("⚠️ [Ask Studio] JSON parse failed (non-fatal):", e.message);
                // This is ok - parseDFLReport has fallback strategies
            }



            return { success: true, question, response: text, jsonData: jsonData, timestamp: Date.now() };

        }



        // Strategy 0 (IMPROVED): Direct AI Response Detection (Moved after Strategy A as fallback)

        // Use regular querySelectorAll (not Deep) to avoid shadow DOM container issues

        const allTextElements = document.querySelectorAll('span, p, div, yt-formatted-string');

        console.log(`🔍 [Ask Studio] Scanning ${allTextElements.length} text elements for AI response...`);



        // Filter for elements that look like AI responses

        const aiResponseCandidates = Array.from(allTextElements).filter(el => {

            const text = (el.textContent || '').trim();



            // Must be substantial but not too long (to avoid page-level containers)

            if (text.length < 100 || text.length > 5000) return false;



            // Must be visible

            if (el.offsetParent === null) return false;



            // EXCLUDE common UI noise

            const lowerText = text.toLowerCase();



            // ⚠️ EXPLICIT EXCLUSIONS (Greetings)


            if (lowerText.startsWith("hi, i'm ask studio") || lowerText.startsWith("i'm ask studio")) return false;

            if (lowerText.includes("how can i help")) return false;



            if (lowerText.startsWith('skip navigation')) return false;

            if (lowerText.includes('channel content') && !lowerText.includes("i'm ask studio")) return false;



            // MUST contain Ask Studio signature pattern (English OR Chinese)

            const hasAskStudioPattern = (

                // English patterns

                lowerText.includes("i'm ask studio") ||

                lowerText.includes("ask studio") ||

                (lowerText.includes('hello') && lowerText.includes('analyzed')) ||

                (lowerText.includes('hello') && lowerText.includes('performed')) ||

                lowerText.includes("i've analyzed") ||

                lowerText.includes("i've performed") ||

                lowerText.includes("here's what i found") ||

                lowerText.includes("based on your data") ||

                lowerText.includes("your channel's") ||

                // Chinese patterns (涓枃妯″紡)

                text.includes('琛屽姩寤鸿') ||

                text.includes('建议') ||

                text.includes('鍒嗘瀽缁撴灉') ||


                text.includes('榛勯噾鍙戝竷') ||

                text.includes('瑙傜湅娆℃暟') ||


                text.includes('您的频道') ||


                text.includes('鎴戝垎鏋愪簡')

            );



            if (!hasAskStudioPattern) return false;



            // Should contain analytics keywords (English OR Chinese)

            const hasAnalyticsKeywords = (

                // English keywords

                lowerText.includes('views') ||

                lowerText.includes('subscribers') ||

                lowerText.includes('retention') ||

                lowerText.includes('shorts') ||

                lowerText.includes('traffic') ||

                lowerText.includes('watch time') ||

                lowerText.includes('%')









            );

            return hasAnalyticsKeywords;

        });



        console.log(`🔍 [Ask Studio] Found ${aiResponseCandidates.length} AI response candidates.`);



        // Sort by preference for medium-length responses (1000-3000 chars is ideal)

        // Also check if text STARTS with AI greeting pattern

        aiResponseCandidates.sort((a, b) => {

            const textA = (a.textContent || '').trim();

            const textB = (b.textContent || '').trim();



            // Prefer elements that START with "Hello" (actual AI response, not container)

            const startsWithHelloA = textA.toLowerCase().startsWith('hello');

            const startsWithHelloB = textB.toLowerCase().startsWith('hello');

            if (startsWithHelloA && !startsWithHelloB) return -1;

            if (!startsWithHelloA && startsWithHelloB) return 1;



            // If both start with Hello, prefer medium length

            const idealLength = 2000;

            const diffA = Math.abs(textA.length - idealLength);

            const diffB = Math.abs(textB.length - idealLength);

            return diffA - diffB;

        });



        if (aiResponseCandidates.length > 0) {

            const bestCandidate = aiResponseCandidates[0];

            const responseText = (bestCandidate.textContent || '').trim();



            // Final check: response should not start with noise

            if (responseText.toLowerCase().startsWith('skip') ||

                responseText.toLowerCase().startsWith('channel content')) {

                console.log(`⚠️ [Ask Studio] Skipping noise candidate, trying next...`);

                // Try next candidate

                for (let i = 1; i < Math.min(aiResponseCandidates.length, 5); i++) {

                    const altText = (aiResponseCandidates[i].textContent || '').trim();

                    if (altText.toLowerCase().startsWith('hello')) {

                        console.log(`✨[Ask Studio] Found AI response via Strategy 0 (alt ${i}):`, altText.substring(0, 100) + '...');



                        let jsonData = null;

                        try {

                            const jsonMatch = altText.match(/```json\s*([\s\S]*?)\s*```/) || altText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);

                            if (jsonMatch) jsonData = JSON.parse(jsonMatch[1] || jsonMatch[0]);

                        } catch (e) { }



                        return { success: true, question, response: altText, jsonData: jsonData, timestamp: Date.now() };

                    }

                }

            }



            console.log(`✨[Ask Studio] Found AI response via Strategy 0 (Direct Detection):`, responseText.substring(0, 100) + '...');



            // Make sure it's not the question we asked

            const normalizedResponse = responseText.replace(/\s+/g, ' ').toLowerCase();

            const normalizedQuestion = question.replace(/\s+/g, ' ').toLowerCase();

            if (!normalizedResponse.startsWith(normalizedQuestion.substring(0, 30))) {

                let jsonData = null;

                try {

                    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);

                    if (jsonMatch) jsonData = JSON.parse(jsonMatch[1] || jsonMatch[0]);

                } catch (e) { }

                return { success: true, question, response: responseText, jsonData: jsonData, timestamp: Date.now() };

            }

        }



        // Strategy B: Container Dump (Enhanced with Fuzzy Removal)

        console.log("⚠️ [Ask Studio] Strategy A failed. Trying Strategy B (Container Dump)...");

        let cleanText = lastStableText;



        const noise = [

            "Ask Studio", "Close", "Send feedback", "Ask something",

            "thumbs up", "thumbs down", "AI can make mistakes",

            "so double-check it", "Learn more", "google_logo",

            "Run YPP Sprint", "Run Full Report", // Buttons we added

            "Promotions", "Dashboard", "Content", "Analytics", "Comments", "Earn", "Copyright", "Settings", "New course"

        ];



        // Remove noise

        noise.forEach(n => {

            const regex = new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');

            cleanText = cleanText.replace(regex, ' ');

        });



        // Fuzzy Question Removal

        // Normalize whitespace for comparison

        const normClean = cleanText.replace(/\s+/g, ' ');

        const normQ = question.replace(/\s+/g, ' ');



        // Try to find the question in the text

        const qIndex = normClean.indexOf(normQ);

        if (qIndex !== -1) {

            // If found, take everything AFTER the question

            cleanText = normClean.substring(qIndex + normQ.length);

        } else {

            // Fallback: Try finding just the first 30 chars of the question

            const qStart = normQ.substring(0, 30);

            const startIdx = normClean.lastIndexOf(qStart); // Use lastIndexOf to find the *latest* occurrence

            if (startIdx !== -1) {

                cleanText = normClean.substring(startIdx + qStart.length);

            }

        }



        let answer = cleanText.trim();



        // Strategy C: Tail Dump (Refined)

        if (answer.length < 10) {

            console.log("⚠️ [Ask Studio] Answer too short. Using Strategy C (Tail Dump).");

            const lines = lastStableText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

            const validLines = lines.filter(l => {

                const lower = l.toLowerCase();

                return !lower.includes("ask something") &&

                    !lower.includes("send feedback") &&

                    !lower.includes("ai can make mistakes") &&

                    !lower.includes("run ypp sprint") &&

                    !lower.includes("promotions") &&

                    !lower.includes("dashboard") &&

                    !lower.includes("content") &&

                    !lower.includes("analytics") &&

                    !lower.includes("new course");

            });

            // Take the last 3 valid lines (increased context)

            answer = validLines.slice(-3).join('\n');

        }



        answer = answer.replace(/^\?/, '').trim();



        // Strategy D: "Bot Name" Anchor (New)

        if (answer.length < 10) {

            console.log("⚠️ [Ask Studio] Still too short. Using Strategy D (Bot Anchor).");

            // Look for "Ask Studio" text in the raw container text and take what follows

            // But skip the header "Ask Studio" which is usually at the start

            const botName = "Ask Studio";

            const firstIndex = lastStableText.indexOf(botName);

            const lastIndex = lastStableText.lastIndexOf(botName);



            if (lastIndex > firstIndex) { // If there's a second occurrence (the message sender name)

                answer = lastStableText.substring(lastIndex + botName.length).trim();

                // Clean up common suffix noise again just in case

                answer = answer.replace(/AI can make mistakes.*/gi, '').trim();

            }

        }



        if (answer.length > 5) {

            console.log(`✨[Ask Studio] Returning answer (${answer.length} chars)`);

            return { success: true, question, response: answer, timestamp: Date.now() };

        }



        // Final Fallback

        if (lastStableText.length > 20) {

            console.log("⚠️ [Ask Studio] Fallback: Returning full raw text as last resort.");

            return { success: true, question, response: lastStableText, timestamp: Date.now() };

        }



        console.error("❌[Ask Studio] Failed to extract valid response. Raw text length:", lastStableText.length);

        return { success: false, question, error: "Could not extract valid response from Ask Studio" };

    }



    async function askMultipleQuestions(questions, category) {

        const results = [];

        const MAX_RETRIES = 2;



        for (let i = 0; i < questions.length; i++) {

            let result = null;

            let retryCount = 0;



            // 🔄 RETRY MECHANISM - Try up to MAX_RETRIES times for failed questions

            while (retryCount <= MAX_RETRIES) {

                result = await askStudio(questions[i]);



                if (result.success) {

                    if (retryCount > 0) {

                        console.log(`✨[Retry] Question succeeded on retry ${retryCount}`);

                    }

                    break; // Success, exit retry loop

                }



                // Failed, check if we should retry

                if (retryCount < MAX_RETRIES) {

                    retryCount++;

                    console.log(`🔄 [Retry] Question failed, retrying (${retryCount}/${MAX_RETRIES})...`);

                    await sleep(3000); // Wait 3 seconds before retry



                    // Try to reset the Ask Studio panel before retrying

                    try {

                        const closeBtn = document.querySelector('ytcp-button[aria-label="Close"]');

                        if (closeBtn) {

                            closeBtn.click();

                            await sleep(1000);

                        }

                        await ensurePanelOpen();

                    } catch (e) {

                        console.warn("⚠️ [Retry] Panel reset failed:", e);

                    }

                } else {

                    console.error(`❌[Retry] Question failed after ${MAX_RETRIES} retries`);

                    break;

                }

            }



            results.push(result);

            if (i < questions.length - 1) await sleep(CONFIG.waitTimes.betweenQuestions);

        }

        return { category, results, successCount: results.filter(r => r.success).length, totalCount: results.length, retried: results.some(r => r.retries > 0) };

    }



    async function switchToTab(tabName) {

        console.log(`🔄 [Navigation] Switching to tab: ${tabName}`);

        const tabMap = {




        };



        const target = tabMap[tabName];

        if (!target) return false;



        // 1. Check if already there

        if (window.location.href.includes(target.urlPart)) {

            console.log(`✨[Navigation] Already on ${tabName} tab.`);

            return true;

        }



        // 2. Try to find tab element

        const tabs = document.querySelectorAll('tp-yt-paper-tab, a.ytcp-navigation-drawer-item, div.tab-header, div.tab-content');

        for (const tab of tabs) {

            const text = tab.textContent.trim();

            // Check text match OR href match

            if (target.text.some(t => text.includes(t)) || (tab.href && tab.href.includes(target.urlPart))) {


                tab.click();

                await sleep(3000); // Wait for transition

                return true;

            }

        }



        console.warn(`⚠️ [Navigation] Tab '${tabName}' not found via DOM.`);

        return false;

    }



    function injectManualButton() {

        if (document.getElementById('gemini-manual-container')) return;

        const container = document.createElement('div');

        container.id = 'gemini-manual-container';

        container.style.cssText = "position: fixed; bottom: 20px; right: 20px; z-index: 99999; display: flex; flex-direction: column; gap: 10px;";



        const btnYpp = document.createElement('button');

        btnYpp.id = 'gemini-run-ypp-btn';


        btnYpp.style.cssText = "padding: 15px 25px; background: #ff4500; color: white; font-weight: bold; border: 2px solid white; border-radius: 50px; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.5); font-size: 16px;";

        btnYpp.onclick = async () => {

            btnYpp.innerText = "⏰Running YPP...";

            btnYpp.style.background = "#ffa500";

            const now = new Date();

            const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;

            const dateStr = `${now.getMonth() + 1}/${now.getDate()}`;

            const question = `List all my video Views, Subscribers from yesterday to now (GMT+8 ${timeStr} ${dateStr}). Format as JSON array.`;

            const result = await askStudio(question);

            const data = { category: 'yppSprint', results: [result], successCount: result.success ? 1 : 0, totalCount: 1 };

            try {

                chrome.runtime.sendMessage({ action: 'relayAnalyticsResult', category: 'yppSprint', data: data });

                btnYpp.innerText = "✨YPP Done!";

                btnYpp.style.background = "#00aa00";


            } catch (e) { alert("Done! Check console."); }

        };



        const btnFull = document.createElement('button');

        btnFull.innerText = "📊 Run Full Report";

        btnFull.style.cssText = "padding: 10px 20px; background: #7c3aed; color: white; font-weight: bold; border: 2px solid white; border-radius: 50px; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.5); font-size: 14px;";

        btnFull.onclick = async () => {

            btnFull.innerText = "⏰Running Full...";

            const demoCategory = 'channelOverview';

            const res = await askMultipleQuestions(ANALYTICS_QUESTIONS[demoCategory], demoCategory);

            try {

                chrome.runtime.sendMessage({ action: 'relayAnalyticsResult', data: { [demoCategory]: res } });

                btnFull.innerText = "✨Full Done!";

                setTimeout(() => btnFull.innerText = "📊 Run Full Report", 3000);

            } catch (e) { alert("Done! Check console."); }

        };



        container.appendChild(btnYpp);

        container.appendChild(btnFull);

        document.body.appendChild(container);

    }

    setTimeout(injectManualButton, 2000);



    // Expose runAnalyticsAgent globally for content.js

    window.runAnalyticsAgent = async (payload) => {

        console.log("🚀 [YouTube Analytics] runAnalyticsAgent called with:", payload);

        try {

            const { category, collectAll, customQuery } = payload || {};

            let responseData = null;



            if (customQuery) {

                const result = await askStudio(customQuery);

                responseData = { category: 'custom', results: [result], successCount: result.success ? 1 : 0, totalCount: 1 };

            } else if (category === 'yppSprint') {

                const now = new Date();

                const timeStr = `${now.getHours()

                    }:${now.getMinutes().toString().padStart(2, '0')} `;

                const dateStr = `${now.getMonth() + 1}/${now.getDate()}`;

                const question = `List all my video Views, Subscribers from yesterday to now (GMT+8 ${timeStr} ${dateStr}). Format as JSON array.`;

                const result = await askStudio(question);

                responseData = { category: 'yppSprint', results: [result], successCount: result.success ? 1 : 0, totalCount: 1 };

            } else if (collectAll) {

                const allResults = {};

                for (const [cat, qs] of Object.entries(ANALYTICS_QUESTIONS)) {

                    // ⚠️ SKIP Audience AI (Use Direct Scrape instead)

                    if (cat === 'audience') continue;



                    allResults[cat] = await askMultipleQuestions(qs, cat);

                    await sleep(3000);

                }



                // 🚀 DIRECT SCRAPE FOR AUDIENCE

                try {

                    const switched = await switchToTab('audience');

                    if (switched) {

                        console.log("📊 [Direct Scrape] Scraping Audience Tab...");

                        const audienceData = await scrapeAudienceTab();

                        allResults['audience'] = {

                            category: 'audience',

                            results: [{

                                success: true,

                                question: 'Direct Scrape',

                                response: JSON.stringify(audienceData) // Wrap as JSON string

                            }],

                            successCount: 1,

                            totalCount: 1

                        };

                        // Switch back to Overview to be safe?

                        // await switchToTab('overview'); 

                    } else {

                        console.error("❌[Direct Scrape] Failed to switch to Audience tab.");

                        allResults['audience'] = { category: 'audience', results: [], error: "Tab switch failed" };

                    }

                } catch (e) {

                    console.error("❌[Direct Scrape] Error:", e);

                    allResults['audience'] = { category: 'audience', results: [], error: e.toString() };

                }



                const now = new Date();

                const timeStr = `${now.getHours()

                    }:${now.getMinutes().toString().padStart(2, '0')} `;

                const dateStr = `${now.getMonth() + 1}/${now.getDate()}`;

                const question = `List all my video Views, Subscribers from yesterday to now (GMT+8 ${timeStr} ${dateStr}). Format as JSON array.`;

                const result = await askStudio(question);

                allResults['yppSprint'] = { category: 'yppSprint', results: [result], successCount: result.success ? 1 : 0, totalCount: 1 };

                responseData = allResults;

            } else if (category && ANALYTICS_QUESTIONS[category]) {

                const results = await askMultipleQuestions(ANALYTICS_QUESTIONS[category], category);

                responseData = results;

            } else if (payload.action === 'scrape_analytics_direct') {

                // 🚀 Handle Direct Scrape Request

                console.log("🚀 [runAnalyticsAgent] Triggering Direct Scrape for:", payload.category);

                responseData = await scrapeAnalyticsData();

            }



            if (responseData) {

                // Send result back via BOTH methods to ensure delivery



                // Method 1: chrome.runtime (for background script relay)

                chrome.runtime.sendMessage({

                    action: 'relayAnalyticsResult',

                    category: category || 'custom',

                    data: responseData

                });



                // Method 2: window.postMessage (DIRECT to React app)

                window.postMessage({

                    type: 'YOUTUBE_ANALYTICS_RESULT',

                    category: category || 'custom',

                    data: responseData

                }, '*');



                console.log(`✨[YouTube Analytics] Data sent for category: ${category || 'custom'} `);



                return { success: true, message: "Analytics processed" };

            } else {

                return { success: false, error: "No valid action found" };

            }

        } catch (error) {

            console.error("❌[YouTube Analytics] Error processing request:", error);

            return { success: false, error: error.toString() };

        }

    };



    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

        if (message.type === 'REQUEST_YOUTUBE_ANALYTICS') {


            window.runAnalyticsAgent(message.payload).then(sendResponse);

            return true; // Keep channel open

        }

    });




    // Note: Content Scripts CAN see window.postMessage events if they are sent to the window.

    window.addEventListener('message', async (event) => {

        // We only care about messages with our specific type

        if (event.data && event.data.type === 'REQUEST_YOUTUBE_ANALYTICS') {


            try {

                const result = await window.runAnalyticsAgent(event.data.payload);

                console.log("✨[YouTube Analytics] Request processed, result:", result);



                // 🚀 FIX: Send result back to React via Background Relay

                // This closes the loop: React -> Content(Bridge) -> Background -> YouTube -> Background -> React

                chrome.runtime.sendMessage({

                    action: 'relayAnalyticsResult',

                    category: event.data.payload.category || 'unknown',

                    data: result

                });



            } catch (error) {

                console.error("❌[YouTube Analytics] Error processing request:", error);



                // Send error back to React so it doesn't hang

                chrome.runtime.sendMessage({

                    action: 'relayAnalyticsResult',

                    category: event.data.payload.category || 'unknown',

                    data: { error: error.toString(), success: false }

                });

            }

        }

    });











    function checkAutoTrigger() {

        const params = new URLSearchParams(window.location.search);

        const urlAction = params.get('gemini_action');

        const hashAction = window.location.hash.includes('action=ypp_sprint');



        if (urlAction === 'ypp_sprint' || hashAction) {

            let attempts = 0;

            const clickInterval = setInterval(() => {

                attempts++;

                const btn = document.getElementById('gemini-run-ypp-btn');

                if (btn) {

                    btn.click();

                    clearInterval(clickInterval);

                } else if (attempts > 20) {

                    clearInterval(clickInterval);

                    runDirectYppSprint();

                }

            }, 500);

        }


        // 🧠 DFL REPORT: Handle gemini_action=dfl_report for real-time DFL analysis
        if (urlAction === 'dfl_report') {
            console.log("🧠 [DFL Report] Starting DFL Real-Time Analysis with STRUCTURED PROMPT...");

            // Broadcast start
            chrome.runtime.sendMessage({
                action: 'relayAnalyticsResult',
                category: '__DFL_START__',
                data: { status: 'starting_dfl', timestamp: Date.now() }
            });

            setTimeout(async () => {
                // 🧠 NEW STRUCTURED DFL COMMAND - Returns JSON format
                const DFL_COMMAND = `启动 DFL 循环分析

请严格按以下固定 JSON 格式返回我频道的分析报告：

## 1. 实时速度审计 (Velocity Audit)
\`\`\`json
{
  "first_hour_velocity": {
    "latest_short_title": "最新Shorts标题",
    "latest_short_views_1h": 0,
    "latest_short_views_24h": 0,
    "velocity_rank": "S/A/B/C/D"
  },
  "48h_trend": {
    "total_views": 0,
    "total_watch_time_hours": 0,
    "trend_direction": "UP/DOWN/STABLE"
  }
}
\`\`\`

## 2. YPP 进度与转化效率
\`\`\`json
{
  "ypp_progress": {
    "current_subscribers": 0,
    "subscribers_needed": 0,
    "watch_hours_accumulated": 0,
    "watch_hours_needed": 0,
    "estimated_days_to_ypp": 0
  },
  "conversion_metrics": {
    "views_to_subs_rate": 0.0,
    "shorts_to_watch_time_efficiency": 0.0
  }
}
\`\`\`

## 3. 算法信号分析 (S-Tier Metrics)
\`\`\`json
{
  "algorithm_signals": {
    "shorts_feed_percentage": 0,
    "swipe_away_rate": 0,
    "average_view_percentage": 0,
    "rewatch_ratio": 0,
    "retention_at_3s": 0
  },
  "top_performing_shorts": [
    {"title": "", "views": 0, "avg_view_pct": 0, "likes": 0}
  ]
}
\`\`\`

## 4. 精准打击建议
\`\`\`json
{
  "winning_pattern": {
    "detected_hook_style": "",
    "best_emoji_pattern": "",
    "optimal_length_seconds": 0
  },
  "next_content_recommendation": {
    "suggested_topic": "",
    "suggested_title": "",
    "priority": "URGENT/HIGH/MEDIUM"
  }
}
\`\`\`

请用我频道的真实数据填充上述所有字段。`;

                // 🆕 JSON Parser for DFL Report - IMPROVED VERSION
                const parseDFLReport = (responseText) => {
                    const parsed = {
                        first_hour_velocity: null,
                        ypp_progress: null,
                        algorithm_signals: null,
                        winning_pattern: null,
                        top_performing_shorts: [],
                        conversion_metrics: null,
                        next_content_recommendation: null,
                        "48h_trend": null
                    };

                    try {
                        console.log("🧠 [DFL Parse] Raw response length:", responseText?.length || 0);

                        // 🔧 STRATEGY 1: Extract JSON from markdown code blocks (```json ... ```)
                        const codeBlockPattern = /```json\s*([\s\S]*?)\s*```/gi;
                        let codeBlockMatch;
                        while ((codeBlockMatch = codeBlockPattern.exec(responseText)) !== null) {
                            const jsonContent = codeBlockMatch[1].trim();
                            console.log("🧠 [DFL Parse] Found code block:", jsonContent.substring(0, 100) + "...");
                            try {
                                const obj = JSON.parse(jsonContent);
                                // Merge all keys from this JSON block
                                Object.assign(parsed, obj);
                                console.log("🧠 [DFL Parse] Merged keys:", Object.keys(obj));
                            } catch (e) {
                                console.warn(`[DFL Parse] Code block JSON parse failed:`, e.message);
                            }
                        }

                        // 🔧 STRATEGY 2: If no code blocks found, try direct key extraction
                        if (!parsed.first_hour_velocity && !parsed.ypp_progress) {
                            console.log("🧠 [DFL Parse] No code blocks found, trying direct extraction...");

                            // Extract first_hour_velocity
                            const velocityMatch = responseText.match(/"first_hour_velocity"\s*:\s*(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})/);
                            if (velocityMatch) {
                                try {
                                    parsed.first_hour_velocity = JSON.parse(velocityMatch[1]);
                                    console.log("🧠 [DFL Parse] Extracted first_hour_velocity:", parsed.first_hour_velocity);
                                } catch (e) { /* ignore */ }
                            }

                            // Extract 48h_trend
                            const trendMatch = responseText.match(/"48h_trend"\s*:\s*(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})/);
                            if (trendMatch) {
                                try {
                                    parsed["48h_trend"] = JSON.parse(trendMatch[1]);
                                    console.log("🧠 [DFL Parse] Extracted 48h_trend:", parsed["48h_trend"]);
                                } catch (e) { /* ignore */ }
                            }

                            // Extract ypp_progress
                            const yppMatch = responseText.match(/"ypp_progress"\s*:\s*(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})/);
                            if (yppMatch) {
                                try {
                                    parsed.ypp_progress = JSON.parse(yppMatch[1]);
                                } catch (e) { /* ignore */ }
                            }

                            // Extract algorithm_signals
                            const signalsMatch = responseText.match(/"algorithm_signals"\s*:\s*(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})/);
                            if (signalsMatch) {
                                try {
                                    parsed.algorithm_signals = JSON.parse(signalsMatch[1]);
                                } catch (e) { /* ignore */ }
                            }
                        }

                        // 🔧 STRATEGY 3: Extract arrays (top_performing_shorts)
                        const arrayPattern = /"top_performing_shorts"\s*:\s*\[([\s\S]*?)\]/;
                        const arrayMatch = responseText.match(arrayPattern);
                        if (arrayMatch) {
                            try {
                                const arrStr = '[' + arrayMatch[1] + ']';
                                parsed.top_performing_shorts = JSON.parse(arrStr);
                                console.log("🧠 [DFL Parse] Extracted top_performing_shorts:", parsed.top_performing_shorts.length);
                            } catch (e) { /* ignore */ }
                        }

                        // 🔧 STRATEGY 4: Extract individual numeric values if objects failed
                        if (!parsed.first_hour_velocity?.latest_short_views_1h) {
                            const viewsMatch = responseText.match(/"latest_short_views_1h"\s*:\s*(\d+)/);
                            const rankMatch = responseText.match(/"velocity_rank"\s*:\s*"([SABCD])"/);
                            if (viewsMatch || rankMatch) {
                                parsed.first_hour_velocity = {
                                    latest_short_views_1h: viewsMatch ? parseInt(viewsMatch[1]) : 0,
                                    velocity_rank: rankMatch ? rankMatch[1] : 'D'
                                };
                            }
                        }

                        if (!parsed["48h_trend"]?.total_views) {
                            const totalViewsMatch = responseText.match(/"total_views"\s*:\s*(\d+)/);
                            const trendDirMatch = responseText.match(/"trend_direction"\s*:\s*"(UP|DOWN|STABLE)"/);
                            if (totalViewsMatch || trendDirMatch) {
                                parsed["48h_trend"] = {
                                    total_views: totalViewsMatch ? parseInt(totalViewsMatch[1]) : 0,
                                    trend_direction: trendDirMatch ? trendDirMatch[1] : 'UNKNOWN'
                                };
                            }
                        }

                        if (!parsed.ypp_progress?.current_subscribers) {
                            const subsMatch = responseText.match(/"current_subscribers"\s*:\s*(\d+)/);
                            const hoursMatch = responseText.match(/"watch_hours_accumulated"\s*:\s*([\d.]+)/);
                            if (subsMatch || hoursMatch) {
                                parsed.ypp_progress = {
                                    current_subscribers: subsMatch ? parseInt(subsMatch[1]) : 0,
                                    watch_hours_accumulated: hoursMatch ? parseFloat(hoursMatch[1]) : 0
                                };
                            }
                        }

                        if (!parsed.algorithm_signals?.swipe_away_rate) {
                            const swipeMatch = responseText.match(/"swipe_away_rate"\s*:\s*([\d.]+)/);
                            const avgViewMatch = responseText.match(/"average_view_percentage"\s*:\s*([\d.]+)/);
                            if (swipeMatch || avgViewMatch) {
                                parsed.algorithm_signals = {
                                    swipe_away_rate: swipeMatch ? parseFloat(swipeMatch[1]) : 0,
                                    average_view_percentage: avgViewMatch ? parseFloat(avgViewMatch[1]) : 0
                                };
                            }
                        }

                        console.log("🧠 [DFL Parse] FINAL Extracted structured data:", JSON.stringify(parsed, null, 2));
                    } catch (e) {
                        console.error("🧠 [DFL Parse] Failed:", e);
                    }

                    return parsed;
                };


                console.log("🔓 [DFL Report] Opening Ask Studio panel...");
                const panelReady = await ensurePanelOpen();
                if (!panelReady) {
                    chrome.runtime.sendMessage({
                        action: 'relayAnalyticsResult',
                        category: '__DFL_ERROR__',
                        data: { error: 'Ask Studio panel could not be opened' }
                    });
                    return;
                }

                console.log("🧠 [DFL Report] Sending STRUCTURED command...");

                try {
                    const result = await Promise.race([
                        askStudio(DFL_COMMAND),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout 120s')), 120000))
                    ]);

                    // 🆕 Parse the structured response
                    const responseText = result?.response || '';
                    const structuredData = parseDFLReport(responseText);

                    // Send complete DFL report to React with BOTH raw and parsed data
                    chrome.runtime.sendMessage({
                        action: 'relayAnalyticsResult',
                        category: 'dflReport',
                        data: {
                            timestamp: Date.now(),
                            command: 'DFL_STRUCTURED_PROMPT_V2',
                            result: result,
                            parsed: structuredData,  // 🆕 Structured data
                            // 🆕 Flat metrics for easy access
                            metrics: {
                                firstHourVelocity: structuredData.first_hour_velocity?.latest_short_views_1h || 0,
                                velocityRank: structuredData.first_hour_velocity?.velocity_rank || 'D',
                                swipeAwayRate: structuredData.algorithm_signals?.swipe_away_rate || 0,
                                rewatchRatio: structuredData.algorithm_signals?.rewatch_ratio || 1.0,
                                retentionAt3s: structuredData.algorithm_signals?.retention_at_3s || 0,
                                shortsFeedPct: structuredData.algorithm_signals?.shorts_feed_percentage || 0,
                                avgViewPct: structuredData.algorithm_signals?.average_view_percentage || 0,
                                currentSubs: structuredData.ypp_progress?.current_subscribers || 0,
                                watchHours: structuredData.ypp_progress?.watch_hours_accumulated || 0,
                                daysToYPP: structuredData.ypp_progress?.estimated_days_to_ypp || 999,
                                trendDirection: structuredData["48h_trend"]?.trend_direction || 'UNKNOWN',
                                suggestedTitle: structuredData.next_content_recommendation?.suggested_title || '',
                                priority: structuredData.next_content_recommendation?.priority || 'MEDIUM'
                            },
                            topShorts: structuredData.top_performing_shorts || []
                        }
                    });

                    console.log("🎉 [DFL Report] Complete! Structured data sent to React.");

                    // Show success overlay
                    const overlay = document.createElement('div');
                    overlay.style.cssText = 'position: fixed; top: 20px; right: 20px; background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 20px; border-radius: 12px; z-index: 9999; box-shadow: 0 4px 20px rgba(16, 185, 129, 0.5); max-width: 400px;';
                    overlay.innerHTML = `
                        <div style="font-size: 18px; font-weight: bold; margin-bottom: 8px;">🧠 DFL 分析完成! (V2)</div>
                        <div style="font-size: 12px; opacity: 0.9;">结构化报告已发送到 React 应用。</div>
                        <div style="font-size: 11px; margin-top: 8px; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 6px;">
                            📊 Velocity: ${structuredData.first_hour_velocity?.velocity_rank || '?'} | 
                            Subs: ${structuredData.ypp_progress?.current_subscribers || '?'} |
                            Trend: ${structuredData["48h_trend"]?.trend_direction || '?'}
                        </div>
                        <button onclick="window.close()" style="margin-top: 12px; background: white; color: #059669; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold;">关闭标签页</button>
                    `;
                    document.body.appendChild(overlay);

                } catch (e) {
                    console.error("❌ [DFL Report] Failed:", e.message);
                    chrome.runtime.sendMessage({
                        action: 'relayAnalyticsResult',
                        category: '__DFL_ERROR__',
                        data: { error: e.message }
                    });
                }

            }, 10000);
        }

        // 🚀 FULL ANALYTICS: Handle gemini_action=full_analytics for complete sequential collection
        if (urlAction === 'full_analytics') {
            console.log("🚀 [Full Analytics] Starting OPTIMIZED sequential collection...");

            // Broadcast start to React
            chrome.runtime.sendMessage({
                action: 'relayAnalyticsResult',
                category: '__START__',
                data: { status: 'starting', timestamp: Date.now() }
            });

            setTimeout(async () => {
                // 🚀 SINGLE COMMAND: Ask Studio generates complete analytics report (VERIFIED)
                const FULL_ANALYTICS_COMMAND = `生成频道完整分析报告（JSON格式），包含以下13个类别：
1. yppSprint: 昨天到现在的每个视频的Views和Subscribers变化
2. channelOverview: 频道总订阅数、总观看时长、总视频数
3. retention: 过去28天平均观众留存率和平均观看百分比(AVP)
4. velocity: 过去48小时的观看量和观看时长变化(含首小时速度)
5. videoPerformance: 过去28天表现最好的5个视频(Views/AVP)
6. audience: 观众来源国家Top 5和年龄分布
7. traffic: 流量来源分布(推荐/搜索/外部/直接)
8. engagement: 过去28天的点赞数、评论数、分享数
9. comments: 最近5条热门评论
10. rewatch: 重播率最高的3个视频
11. swipeAway: 划走率/跳出率数据
12. subsConversion: 订阅转化率(Views per new subscriber)
13. sessionTime: 平均会话时长贡献
请为每个类别提供数据，格式如: {"yppSprint":{...},"channelOverview":{...},...}`;

                console.log("🔓 [Full Analytics] Opening Ask Studio panel...");
                const panelReady = await ensurePanelOpen();
                if (!panelReady) {
                    console.error("❌ [Full Analytics] Could not open Ask Studio panel!");
                    chrome.runtime.sendMessage({
                        action: 'relayAnalyticsResult',
                        category: '__ERROR__',
                        data: { error: 'Ask Studio panel could not be opened' }
                    });
                    return;
                }

                console.log(`🚀 [Full Analytics] Sending single command: "${FULL_ANALYTICS_COMMAND.substring(0, 50)}..."`);

                try {
                    const result = await Promise.race([
                        askStudio(FULL_ANALYTICS_COMMAND),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout 120s')), 120000))
                    ]);

                    // Send complete report to React
                    chrome.runtime.sendMessage({
                        action: 'relayAnalyticsResult',
                        category: 'fullReport',
                        data: {
                            timestamp: Date.now(),
                            command: FULL_ANALYTICS_COMMAND,
                            result: result
                        }
                    });

                    // Also broadcast completion
                    chrome.runtime.sendMessage({
                        action: 'relayAnalyticsResult',
                        category: '__COMPLETE__',
                        data: { completed: 1, failed: 0, total: 1 }
                    });

                    console.log("🎉 [Full Analytics] Complete! Report sent to React.");

                    // ✅ RE-ENABLED: Auto-close tab after success
                    console.log("✅ [Full Analytics] Closing tab in 3 seconds...");

                    setTimeout(() => {
                        // Try Chrome Runtime first (More reliable)
                        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                            try {
                                console.log("❌ [Full Analytics] Sending closeTab to background...");
                                chrome.runtime.sendMessage({ action: 'closeTab', url: window.location.href });
                            } catch (e) {
                                console.warn("chrome.runtime failed", e);
                                window.close(); // Fallback
                            }
                        } else {
                            window.close(); // Fallback
                        }
                    }, 3000);

                } catch (e) {
                    console.error("❌ [Full Analytics] Failed:", e.message);
                    chrome.runtime.sendMessage({
                        action: 'relayAnalyticsResult',
                        category: '__ERROR__',
                        data: { error: e.message }
                    });
                    // ❌ Do NOT close on error - allow manual debugging
                }

            }, 10000); // Wait 10s for page + panel to be ready
        }

        // NEW: Check for direct analytics scrape action (URL or Hash)

        // Handle hash like #gemini_action=scrape_analytics or #/analytics/tab-overview?gemini_action=scrape_analytics

        const hashActionScrape = window.location.hash.includes('gemini_action=scrape_analytics');



        if (urlAction === 'scrape_analytics' || hashActionScrape) {

            console.log("🚀 [Auto-trigger] Detected scrape_analytics action. Waiting for load...");

            setTimeout(async () => {

                await scrapeAnalyticsData();

                // Optional: Close window after success?

                // window.close(); 

            }, 5000); // Wait 5s for charts to load

        }



        // 🚀 PARALLEL BATCH: Handle gemini_batch parameter for parallel analytics collection
        const batchId = params.get('gemini_batch');
        if (batchId && BATCH_DEFINITIONS[batchId]) {
            console.log(`🚀 [Parallel Analytics] Detected batch=${batchId}. Processing ${BATCH_DEFINITIONS[batchId].length} categories...`);

            setTimeout(async () => {
                const categories = BATCH_DEFINITIONS[batchId];
                const results = {};

                for (const category of categories) {
                    console.log(`📊 [Batch ${batchId}] Processing: ${category}`);

                    // 🔧 TIMEOUT WRAPPER: Prevent individual category from hanging
                    const categoryTimeout = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error(`Timeout after 60s`)), 60000)
                    );

                    try {
                        let result;

                        if (category === 'yppSprint') {
                            const now = new Date();
                            const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
                            const dateStr = `${now.getMonth() + 1}/${now.getDate()}`;
                            const question = `List all my video Views, Subscribers from yesterday to now (GMT+8 ${timeStr} ${dateStr}). Format as JSON array.`;
                            result = await Promise.race([askStudio(question), categoryTimeout]);
                        } else if (ANALYTICS_QUESTIONS[category]) {
                            result = await Promise.race([askMultipleQuestions(ANALYTICS_QUESTIONS[category], category), categoryTimeout]);
                        } else {
                            console.warn(`⚠️ [Batch ${batchId}] Unknown category: ${category}`);
                            continue;
                        }

                        results[category] = result;

                        // Send individual result to React immediately via BOTH methods
                        // Method 1: Chrome runtime (for background relay)
                        chrome.runtime.sendMessage({
                            action: 'relayAnalyticsResult',
                            category: category,
                            data: results[category],
                            batchId: batchId
                        });

                        // Method 2: Direct window.postMessage (for React listening in same browsing context)
                        window.postMessage({
                            type: 'YOUTUBE_ANALYTICS_RESULT',
                            category: category,
                            data: results[category],
                            batchId: batchId
                        }, '*');

                        console.log(`✅ [Batch ${batchId}] Completed: ${category}`);
                        await sleep(2000); // Small delay between queries
                    } catch (e) {
                        console.error(`❌ [Batch ${batchId}] Failed: ${category}`, e.message || e);

                        // 🆕 Send failure notification so React knows to update status
                        chrome.runtime.sendMessage({
                            action: 'relayAnalyticsResult',
                            category: category,
                            data: { error: e.message || 'Failed', category },
                            batchId: batchId
                        });
                    }
                }

                console.log(`🎉 [Batch ${batchId}] All ${categories.length} categories completed!`);

                // Auto-close tab after batch completes
                setTimeout(() => {
                    console.log(`🔒 [Batch ${batchId}] Closing tab...`);
                    window.close();
                }, 2000);
            }, 5000); // Wait 5s for page to load
        }

        // 🎯 AUTO-DETECT: If we're on an analytics tab, automatically scrape after page load

        // This is the most reliable trigger since it doesn't rely on external messages

        const url = window.location.href;

        if (url.includes('/analytics/tab-overview') || url.includes('/analytics/tab-content') || url.includes('/analytics/tab-audience') || url.includes('tab-build_audience')) {

            console.log("📊 [Auto-detect] Analytics tab detected. Will scrape in 5 seconds...");

            setTimeout(async () => {

                // Check if scrape was already done by another trigger

                if (!window._geminiScrapeDone) {

                    window._geminiScrapeDone = true;

                    await scrapeAnalyticsData();

                }

            }, 5000);

        }

    }







    async function runDirectYppSprint() {

        const now = new Date();

        const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')} `;

        const dateStr = `${now.getMonth() + 1}/${now.getDate()}`;

        const question = `List all my video Views, Subscribers from yesterday to now (GMT+8 ${timeStr} ${dateStr}). Format as JSON array.`;

        const result = await askStudio(question);

        chrome.runtime.sendMessage({ action: 'relayAnalyticsResult', category: 'yppSprint', data: { category: 'yppSprint', results: [result], successCount: result.success ? 1 : 0, totalCount: 1 } });

    }




    const autoReplyQueue = [];

    let isProcessingQueue = false;

    let autoReplyEnabled = true;

    const PROCESSED_COMMENTS_KEY = 'gemini_processed_comments';



    window.addEventListener('message', (event) => {

        if (event.data && event.data.type === 'TOGGLE_AUTO_REPLY') {

            autoReplyEnabled = event.data.enabled;

            console.log(`📊[Auto-Reply] Toggled to: ${autoReplyEnabled} `);

            scrapeComments();

        }

    });



    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'TOGGLE_AUTO_REPLY') {
            autoReplyEnabled = request.enabled;
            console.log(`📊 [Auto-Reply] Toggled via Runtime to: ${autoReplyEnabled}`);
            scrapeComments();
            if (typeof sendResponse === 'function') sendResponse({ success: true });
            return false;
        }
        return false;
    });



    function getProcessedComments() {

        try {

            return JSON.parse(localStorage.getItem(PROCESSED_COMMENTS_KEY) || '[]');

        } catch { return []; }

    }



    function markCommentAsProcessed(id) {

        const processed = getProcessedComments();

        if (!processed.includes(id)) {

            processed.push(id);

            if (processed.length > 1000) processed.shift();

            localStorage.setItem(PROCESSED_COMMENTS_KEY, JSON.stringify(processed));

        }

    }



    async function processAutoReplyQueue() {

        if (isProcessingQueue || autoReplyQueue.length === 0 || !autoReplyEnabled) return;

        isProcessingQueue = true;



        const item = autoReplyQueue.shift();

        console.log(`📊[Queue] Processing: ${item.author} (${autoReplyQueue.length} remaining)`);



        // 🎯 FIX: Wrap in try-catch to ensure queue continues even if one reply fails

        try {

            await handleAIAutoReply(item.id, item.content, item.element);


        } catch (error) {


            // Still mark as processed to prevent infinite retry loops

            markAsProcessed(item.id);

        }



        // Cooldown (slightly shorter for retry scenarios)

        await new Promise(r => setTimeout(r, 8000)); // 8s cooldown

        isProcessingQueue = false;



        // 🎯 FIX: Always continue to next item in queue

        if (autoReplyQueue.length > 0) {

            console.log(`🔄[Queue] Continuing to next item... (${autoReplyQueue.length} remaining)`);

            processAutoReplyQueue();

        } else {


        }

    }







    // 💬 Community & Comments System

    async function scrapeComments() {

        console.log("💬 [Community] Scraping comments (Deep Search)...");

        if (!window.location.href.includes('/comments')) return null;



        // Use Deep Search to find comments inside Shadow DOM

        let commentRows = findDeep('ytcp-comment-thread');



        // Fallback 1: Try renderer

        if (commentRows.length === 0) {

            commentRows = findDeep('ytcp-comment-thread-renderer');

        }



        // Fallback 2: Try finding via section container

        if (commentRows.length === 0) {

            const sections = findDeep('ytcp-comments-section');

            if (sections.length > 0) {

                // Try to find threads inside the section manually

                // Note: findDeep returns an array, we check the first one

                const threads = findDeep('ytcp-comment-thread', sections[0]);

                if (threads.length > 0) commentRows = threads;

            }

        }



        console.log(`🔍[Debug] findDeep found ${commentRows.length} rows`);



        if (commentRows.length === 0) {

            console.log("⚠️ No comments found (Shadow DOM issue or Empty)");

            // Don't return empty immediately if we suspect loading, but for now let's return empty

            // to avoid blocking.

            // return []; 

            // Actually, let's continue so we send the empty state to React, 

            // clearing the old stale data.

        }



        const comments = [];

        const processedIds = getProcessedComments();



        commentRows.forEach(row => {

            try {

                // 1. Find the core comment element (ytcp-comment) inside the thread

                const commentEl = findDeep('ytcp-comment', row)[0] || row;



                // 2. Extract Text (Deep Search inside commentEl)

                const getDeepText = (sel) => {

                    const els = findDeep(sel, commentEl);

                    return els.length > 0 ? els[0].textContent.trim() : '';

                };



                // Author might be in #author-text (ID) or .author-text (Class)

                let author = getDeepText('#author-text');

                if (!author) author = getDeepText('.author-text');



                const content = getDeepText('#content-text');

                const timestamp = getDeepText('.ytcp-comment-thread-renderer-timestamp') || getDeepText('.published-time-text');




                let videoTitle = 'Unknown Video';

                let videoLink = '';



                // Strategy: Find the thumbnail container, then the link inside or near it

                const thumbnailEl = findDeep('ytcp-comment-video-thumbnail', row)[0];

                if (thumbnailEl) {

                    // Aggressive search in thumbnail container

                    const allInThumb = findDeep('*', thumbnailEl);

                    const linkEl = allInThumb.find(el => el.tagName === 'A' || el.getAttribute('href'));



                    if (linkEl) {

                        videoTitle = linkEl.textContent.trim() || linkEl.getAttribute('aria-label') || 'Video';

                        videoLink = linkEl.href || linkEl.getAttribute('href');

                        // Ensure absolute URL

                        if (videoLink && !videoLink.startsWith('http')) {

                            videoLink = 'https://studio.youtube.com' + videoLink;

                        }

                    }

                }



                // Fallback: Search for any link containing "/video/" in the whole row

                if (videoTitle === 'Unknown Video' || !videoLink) {

                    const allLinks = findDeep('a', row);

                    const vidLink = allLinks.find(a => a.href && a.href.includes('/video/'));

                    if (vidLink) {

                        videoTitle = vidLink.textContent.trim();

                        videoLink = vidLink.href;

                    }

                }




                if (videoLink && videoLink.includes('/video/')) {

                    const idMatch = videoLink.match(/\/video\/([^\/]+)/);

                    if (idMatch) {

                        videoLink = `https://www.youtube.com/watch?v=${idMatch[1]}`;

                    }

                }



                // 3. Check for Reply Status (CRITICAL - Multi-layer Detection)

                // Strategy 1: Check if there are multiple comment view models (Original + Reply)

                const allCommentsInThread = findDeep('ytcp-comment-view-model', row);

                let isReplied = allCommentsInThread.length > 1;



                // Strategy 2: Check for "X replies" text in the row

                const rowText = row.textContent || '';

                const repliesMatch = rowText.match(/(\d+)\s*repl(y|ies)/i);

                if (repliesMatch && parseInt(repliesMatch[1]) > 0) {

                    isReplied = true;

                }



                // Strategy 3: Check for channel owner's comment in thread

                // If @CGB2025-boblmark (channel owner) appears as a REPLY author (not the original commenter)

                const replyAuthors = findDeep('.author-text, #author-text', row);

                let hasOwnerReply = false;

                // Only check authors after the first one (replies, not original comment)

                if (replyAuthors.length > 1) {

                    for (let i = 1; i < replyAuthors.length; i++) {

                        const text = replyAuthors[i].textContent?.trim() || '';

                        if (text.includes('CGB2025') || text.includes('boblmark') || text.includes('Mark Bobl')) {

                            hasOwnerReply = true;

                            break;

                        }

                    }

                }

                if (hasOwnerReply) {

                    isReplied = true;

                }



                // Check for hearted (optional indicator)

                const heartButtons = findDeep('#creator-heart-button', row);

                const isHearted = heartButtons.some(b => b.getAttribute('aria-pressed') === 'true');



                // 4. Extract or Generate ID

                let id = row.getAttribute('id');



                // If no valid ID, generate one from the content (Robust Fallback)

                if (!id || id === 'comment') {

                    if (author && content) {

                        // Create a unique signature: author + content (timestamp can change slightly)

                        const signature = author + '|' + content.substring(0, 50);

                        id = 'gen_' + btoa(unescape(encodeURIComponent(signature))).replace(/[^a-zA-Z0-9]/g, '').substring(0, 30);

                    }

                }



                if (author && content && id) {

                    row.setAttribute('data-gemini-id', id);



                    // Override isReplied if we processed it locally

                    if (processedIds.includes(id)) {

                        isReplied = true;

                    }



                    const commentData = { author, content, videoTitle, videoLink, timestamp, isReplied, isHearted, id };

                    comments.push(commentData);



                    // Filter: Reply to comments within 1 month

                    // Include: seconds, minutes, hours, days, weeks, "1 month"

                    // Exclude: "X months" (plural), years

                    const isRecent = timestamp.includes('second') ||

                        timestamp.includes('minute') ||

                        timestamp.includes('hour') ||

                        timestamp.includes('day') ||

                        timestamp.includes('week') ||

                        (timestamp.includes('month') && !timestamp.includes('months'));



                    // 🔍 Debug: Log why comment is or isn't queued

                    const inProcessed = processedIds.includes(id);

                    console.log(`🔍 [Debug] ${author.substring(0, 15)}: isReplied=${isReplied}, isRecent=${isRecent}, inProcessed=${inProcessed}, enabled=${autoReplyEnabled}`);



                    if (autoReplyEnabled && !isReplied && !processedIds.includes(id)) {

                        if (isRecent) {

                            if (!autoReplyQueue.find(c => c.id === id)) {


                                autoReplyQueue.push({

                                    ...commentData,

                                    element: row // Store DOM element for clicking

                                });

                            }

                        } else {


                        }

                    }

                }

            } catch (e) { console.error("Error parsing comment:", e); }

        });



        if (autoReplyQueue.length > 0 && autoReplyEnabled) {

            processAutoReplyQueue();

        }



        console.log(`✨[Community] Scraped ${comments.length} comments. Queue: ${autoReplyQueue.length}`);



        const payload = {

            type: 'YOUTUBE_COMMENTS_DATA',

            data: comments,

            queueStatus: {

                size: autoReplyQueue.length,

                enabled: autoReplyEnabled,

                isProcessing: isProcessingQueue

            }

        };



        if (window.opener) window.opener.postMessage(payload, '*');



        // 🎯 FIX: Add callback to prevent "message port closed" error

        try {

            chrome.runtime.sendMessage({ action: "relayComments", data: comments, queueStatus: payload.queueStatus }, (response) => {

                if (chrome.runtime.lastError) {

                    console.log("⚠️ [Community] Runtime message warning (safe to ignore):", chrome.runtime.lastError.message);

                } else {

                    console.log("✨[Community] Comments relayed to background.");

                }

            });

        } catch (e) {

            console.warn("⚠️ [Community] Failed to send message:", e);

        }

        return comments;

    }






    // Helper for consistent storage

    function markAsProcessed(id) {

        const processed = getProcessedComments();

        if (!processed.includes(id)) {

            processed.push(id);

            localStorage.setItem(PROCESSED_COMMENTS_KEY, JSON.stringify(processed));

            console.log(`✨Marked comment ${id} as processed.`);

        }

    }




    async function igniteVideoComments(commentText, targetId = null, targetElement = null) {




        // Safety Check: Validate Comment Text

        if (!commentText || commentText.length < 2 || commentText.includes("viewers") || commentText.includes("month ago")) {

            console.warn("⚠️ AI Reply seems invalid (hallucination detected). Aborting.", commentText);

            return;

        }



        let targetThread = targetElement;



        // Fallback: If no element, try to find by ID (but this is risky if ID logic differs)

        if (!targetThread && targetId) {

            const threads = findDeep('ytcp-comment-thread');

            // Try exact ID match first

            targetThread = threads.find(t => t.getAttribute('id') === targetId);



            if (!targetThread) {


                return;

            }

        }



        if (!targetThread) {


            return;

        }




        targetThread.scrollIntoView({ behavior: 'smooth', block: 'center' });

        await new Promise(r => setTimeout(r, 1000));



        // 2. Click "Reply" button (Deep Search)

        let replyBtn = findDeep('#reply-button', targetThread).find(b => b.offsetParent !== null);



        if (!replyBtn) {

            const buttons = findDeep('ytcp-button-shape', targetThread);

            replyBtn = buttons.find(b => b.textContent.trim() === 'Reply');

        }



        if (replyBtn) {

            replyBtn.click();

        } else {


            return;

        }



        await new Promise(r => setTimeout(r, 1500)); // Wait for editor



        // 3. Type text into the editor (Deep Search)

        let editor = null;



        // Strategy 1: Search for TEXTAREA

        const textareas = findDeep('textarea');

        editor = textareas.find(t =>

            t.offsetParent !== null


        );



        // Strategy 2: Fallback to contenteditable

        if (!editor) {

            editor = findDeep('#contenteditable-root', targetThread)[0] ||

                findDeep('div[contenteditable="true"]', targetThread)[0];

        }



        if (editor) {

            console.log("✨Editor found:", editor);

            editor.focus();



            if (editor.tagName === 'TEXTAREA') {

                editor.value = commentText;

                editor.dispatchEvent(new Event('input', { bubbles: true }));

                editor.dispatchEvent(new Event('change', { bubbles: true }));

                editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));

            } else {

                document.execCommand('insertText', false, commentText);

                editor.dispatchEvent(new Event('input', { bubbles: true }));

            }

        } else {


            return;

        }



        await new Promise(r => setTimeout(r, 1000));



        // 4. Click "Reply" (Submit)

        const submitBtns = findDeep('#submit-button', targetThread);

        const submitBtn = submitBtns.find(b => !b.disabled && b.offsetParent !== null);



        if (submitBtn) {

            submitBtn.click();




            // CRITICAL: Mark as processed immediately

            if (targetId) markAsProcessed(targetId);

        } else {


        }

    }






    async function handleAIAutoReply(commentId, commentText, commentElement) {




        // Mark as pending immediately to prevent double processing

        markAsProcessed(commentId);




        // Style: Mysterious investigator, witty, enigmatic, creates intrigue

        const prompt = `You are "Mark Bobl", a Digital Forensic Analyst who creates mysterious investigation-style YouTube Shorts.



Your persona traits:

- Speaks like a noir detective analyzing digital evidence

- Uses phrases like "Anomaly detected", "Case #", "Evidence suggests", "Under investigation"

- Mysterious, slightly cryptic, but engaging

- Never breaks character



Reply to this viewer comment: "${commentText}"



Rules:

- Stay in character as Mark Bobl

- Max 150 characters

- Be witty and mysterious

- Create intrigue

- NO emojis except 🔍⚠️📊

- Return ONLY the reply text, nothing else`;



        // Fallback responses in Mark Bobl style (used if AI fails)

        const fallbacks = [

            "Case noted. The investigation continues... 🔍",

            "Anomaly detected. Your observation has been logged. 📊",

            "Evidence received. Stay tuned for the verdict... ⚠️",

            "Digital footprint acknowledged. The truth is out there. 🔍",

            "Case file updated. This rabbit hole goes deeper... 📊",

            "Interesting data point. Adding to the case file... 🔍",

            "Signal received. Analysis in progress... ⚠️"

        ];



        let generatedReply = '';



        try {

            const result = await askStudio(prompt);



            if (result && result.success && result.response) {

                generatedReply = result.response.replace(/^"|"$/g, '').trim();



                // 🎯 FIRST: Check if response contains error text - if so, try to extract valid part or use fallback

                const errorPatterns = [

                    'Something went wrong',

                    'Try again later',

                    'error occurred',

                    'cannot process',

                    'Unable to',

                    'I apologize'

                ];



                const hasErrorText = errorPatterns.some(pattern =>

                    generatedReply.toLowerCase().includes(pattern.toLowerCase())

                );



                if (hasErrorText) {

                    console.warn(`⚠️ [AI Reply] Response contains error text. Attempting cleanup...`);



                    // Try to extract the part BEFORE the error

                    const errorIndex = generatedReply.toLowerCase().indexOf('something went wrong');

                    if (errorIndex > 20) {

                        // There's substantial text before the error, use that

                        generatedReply = generatedReply.substring(0, errorIndex).trim();

                        // Remove trailing punctuation that might be incomplete

                        generatedReply = generatedReply.replace(/[🔍⚠️📊\s.,;:]+$/, '').trim();

                        console.log(`⚠️ [AI Reply] Extracted valid portion: "${generatedReply}"`);

                    } else {

                        // Error is at the beginning, use fallback

                        console.warn(`⚠️ [AI Reply] Error at start of response. Using fallback.`);

                        generatedReply = fallbacks[Math.floor(Math.random() * fallbacks.length)];

                    }

                }



                // Clean up common issues (only if not already fallback)

                if (generatedReply && !fallbacks.includes(generatedReply)) {

                    if (generatedReply.includes(":") && generatedReply.indexOf(":") < 30) {

                        generatedReply = generatedReply.split(":").pop().trim();

                    }



                    // Remove accidental @ mentions at the start

                    generatedReply = generatedReply.replace(/^@\w+\s*/g, '').trim();

                }



                // Validation: Check if reply is meaningful

                const isJustMention = /^@\w+$/.test(generatedReply);

                const isTooShort = generatedReply.length < 10;

                const hasMetadata = generatedReply.includes('viewers') || generatedReply.includes('ago') || generatedReply.includes('month');



                if (isJustMention || isTooShort || hasMetadata || !generatedReply) {

                    console.warn(`⚠️ [AI Reply] Invalid response detected: "${generatedReply}". Using fallback.`);

                    generatedReply = fallbacks[Math.floor(Math.random() * fallbacks.length)];

                }

            } else {


                generatedReply = fallbacks[Math.floor(Math.random() * fallbacks.length)];

            }

        } catch (error) {


            generatedReply = fallbacks[Math.floor(Math.random() * fallbacks.length)];

        }




        await igniteVideoComments(generatedReply, commentId, commentElement);

    }



    // ⚡Action Performer

    async function performCommentAction(action, commentId, text = '') {

        console.log(`⚡[Action] Performing ${action} on ${commentId}`);



        // 1. Find Target Thread (Fast & Robust)

        const targetThread = document.querySelector(`[data-gemini-id="${commentId}"]`);



        if (!targetThread) {

            console.error(`⚡Target thread not found for ID: ${commentId}`);

            return;

        }



        targetThread.scrollIntoView({ behavior: 'smooth', block: 'center' });

        await new Promise(r => setTimeout(r, 500));



        if (action === 'like') {

            const likeBtn = findDeep('#creator-heart-button', targetThread)[0];

            if (likeBtn) {

                likeBtn.click();

                console.log(`⚡[Action] Liked comment ${commentId}`);

            } else {

                console.error("⚡Like button not found");

            }

        }



        if (action === 'reply') {

            console.log(`⚡[Action] Replying to ${commentId}: ${text}`);

            await igniteVideoComments(text, commentId, targetThread);

        }



        if (action === 'pin') {

            console.log(`⚡[Action] Pinning comment ${commentId}`);

            // 1. Click Menu Button (3 dots)

            const menuBtns = findDeep('ytcp-icon-button', targetThread);

            const menuBtn = menuBtns.find(b => b.getAttribute('aria-label')?.includes('Action menu'));



            if (menuBtn) {

                menuBtn.click();

                await new Promise(r => setTimeout(r, 800)); // Wait for dropdown



                // 2. Click "Pin" in dropdown (Global search as dropdown is in top layer)

                const items = document.querySelectorAll('ytcp-text-dropdown-item');

                const pinItem = Array.from(items).find(i => i.textContent.trim() === 'Pin');



                if (pinItem) {

                    pinItem.click();

                    await new Promise(r => setTimeout(r, 800)); // Wait for confirm dialog



                    // 3. Confirm Pin Dialog

                    const confirmBtn = document.querySelector('#confirm-button');

                    if (confirmBtn) {

                        confirmBtn.click();

                        console.log(`⚡[Action] Pin confirmed`);

                    }

                } else {

                    console.error("⚡Pin option not found in menu");

                }

            } else {

                console.error("⚡Menu button not found");

            }

        }

    }



    window.addEventListener('message', (event) => {

        if (event.data && event.data.type === 'IGNITE_COMMENT') {

            igniteVideoComments(event.data.text);

        }

        if (event.data && event.data.type === 'TRIGGER_AI_REPLY') {

            handleAIAutoReply(event.data.commentId, event.data.commentText);

        }

    });



    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

        if (request.type === 'PERFORM_COMMENT_ACTION') {

            performCommentAction(request.action, request.commentId, request.text);

        }

        if (request.type === 'REQUEST_YOUTUBE_SHORTS_REFRESH') {
            console.log("🔄 [Shorts Scraper] Manual refresh requested via Chrome Runtime!");
            if (window.location.href.includes('/videos/short')) {
                scrapeShorts();
            }
        }

    });



    // 📊洝锔?Safe Scheduler

    let scrapeTimer;



    function scheduleScrape() {

        if (scrapeTimer) clearTimeout(scrapeTimer);

        scrapeTimer = setTimeout(async () => {

            try {

                // Check if extension context is valid

                if (!chrome.runtime?.id) {

                    throw new Error("Extension context invalidated");

                }

                await scrapeComments();

                scheduleScrape(); // Re-schedule only on success

            } catch (e) {

                if (e.message.includes("Extension context invalidated")) {

                    console.log("⚠️ [Content Script] Extension reloaded. Stopping script.");

                    return; // Stop recursion

                }

                console.error("⚠️ [Content Script] Scrape error:", e);

                scheduleScrape(); // Retry on other errors

            }

        }, 10000);

    }



    if (window.location.href.includes('/comments')) {

        setTimeout(scrapeComments, 2000);

        scheduleScrape();

    }





    let shortsScrapeRetryCount = 0;

    async function scrapeShorts() {
        // Only run on the Shorts content page
        if (!window.location.href.includes('/videos/short')) return;

        // 🛡️ FULL_ANALYTICS PROTECTION
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('gemini_action') === 'full_analytics') {
            return;
        }

        // Use deep selector to find rows in Shadow DOM
        const rows = querySelectorAllDeep('ytcp-video-row') || [];
        const backupRows = rows.length === 0 ? querySelectorAllDeep('ytcp-video-list-cell-video', document).map(el => el.closest('[role="row"]')).filter(Boolean) : [];
        const finalRows = rows.length > 0 ? rows : backupRows;

        if (finalRows.length === 0) {
            shortsScrapeRetryCount++;
            // Only warn after 5 consecutive failures (approx 25 seconds)
            if (shortsScrapeRetryCount > 5) {
                console.warn("🩳 [Shorts Scraper] No rows found after multiple attempts. Page may still be loading or structure changed.");
            }
            return;
        }

        // Reset retry count on success
        shortsScrapeRetryCount = 0;
        console.log(`🩳 [Shorts Scraper] Found ${finalRows.length} Shorts rows`);

        const shortsData = finalRows.map(row => {

            // Helper to safely get text

            const getText = (selector) => {

                const el = row.querySelector(selector);

                return el ? el.textContent.trim().replace(/\s+/g, ' ') : '';

            };



            // Helper for specific cell tags (Shadow DOM friendly)

            const getCellText = (tagName, className) => {

                // 1. Try Tag Name (Deep)

                let els = querySelectorAllDeep(tagName, row);

                if (els.length > 0) return (els[0].innerText || els[0].textContent).trim().replace(/\s+/g, ' ');



                // 2. Try Class Name (Deep)

                if (className) {

                    els = querySelectorAllDeep(className, row);

                    if (els.length > 0) return (els[0].innerText || els[0].textContent).trim().replace(/\s+/g, ' ');

                }

                return '';

            };



            // Specialized Visibility Extractor

            const getVisibility = () => {

                // Try standard cell

                let text = getCellText('ytcp-video-list-cell-visibility', '.tablecell-visibility');

                if (text) return text;



                // Fallback: Look for specific label spans (Confirmed via Debug)

                const spans = querySelectorAllDeep('.label-span', row);

                for (const span of spans) {

                    const t = span.textContent.trim();

                    if (/^(Public|Private|Scheduled|Draft|Unlisted)$/i.test(t)) return t;

                }

                return ''; // Default to empty if not found

            };



            // Helper for metrics

            const getMetric = (index, className) => {

                // 1. Try Tag Name

                const metrics = querySelectorAllDeep('ytcp-video-list-cell-metric', row);

                if (metrics && metrics[index]) {

                    const val = (metrics[index].innerText || metrics[index].textContent).trim().replace(/\s+/g, ' ');

                    return val === '-' ? '0' : val;

                }



                // 2. Try Class Name

                if (className) {

                    const el = querySelectorAllDeep(className, row)[0];

                    if (el) {

                        const val = (el.innerText || el.textContent).trim().replace(/\s+/g, ' ');

                        return val === '-' ? '0' : val;

                    }

                }

                return '0';

            };



            const titleEl = row.querySelector('#video-title');

            const imgEl = row.querySelector('img');

            const linkEl = row.querySelector('a#video-title');



            // Extract Video ID from URL (e.g., /video/VIDEO_ID/edit)

            let videoId = 'unknown';

            if (linkEl && linkEl.href) {

                const match = linkEl.href.match(/\/video\/([^\/]+)/);

                if (match) videoId = match[1];

            }



            // Specialized Date Extractor

            const getDate = () => {
                // 1. Try standard cell with deep tooltip search
                const dateCell = querySelectorAllDeep('ytcp-video-list-cell-date', row)[0];
                if (dateCell) {
                    // Try various tooltip locations
                    const tooltip = dateCell.getAttribute('title') ||
                        dateCell.querySelector('[title]')?.getAttribute('title') ||
                        dateCell.querySelector('.tablecell-date')?.getAttribute('title');

                    if (tooltip && tooltip.includes(':')) return tooltip;

                    const text = dateCell.textContent.trim();
                    if (text && text.length > 2) return text;
                }

                // 2. Fallback: Look for date patterns in all children
                const els = querySelectorAllDeep('*', row);
                for (const el of els) {
                    if (el.children.length === 0 && el.textContent) {
                        const t = el.textContent.trim();
                        // Match "Dec 8", "Dec 8, 2025", "8 Dec"
                        if (/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}/i.test(t)) {
                            const tooltip = el.closest('[title]')?.getAttribute('title') || el.getAttribute('title');
                            if (tooltip && tooltip.includes(':')) return tooltip;
                            return t;
                        }
                    }
                }

                // 3. Check Visibility column (sometimes contains "Scheduled for...")
                const visibilityCell = querySelectorAllDeep('ytcp-video-list-cell-visibility', row)[0];
                if (visibilityCell) {
                    const tooltip = visibilityCell.getAttribute('title') || visibilityCell.querySelector('[title]')?.getAttribute('title');
                    if (tooltip && tooltip.includes(':') && /\d{4}/.test(tooltip)) return tooltip;
                }

                // 4. Fallback for new uploads
                const rowText = row.innerText || '';
                if (rowText.includes('Processing') || rowText.includes('Checking') || rowText.includes('Draft')) {
                    return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                }

                return '';
            };



            return {

                id: videoId,

                title: getText('#video-title'),

                thumbnail: imgEl ? imgEl.src : '',

                visibility: getVisibility() || getText('.visibility-column'),

                date: getDate() || getText('.date-column'),

                views: getMetric(0, '.tablecell-views') || '0',

                comments: getMetric(1, '.tablecell-comments') || '0',

                likes: getMetric(2, '.tablecell-likes') || '0',

                restrictions: getCellText('ytcp-video-list-cell-restrictions', '.tablecell-restrictions') || 'None'

            };

        });



        // Check Pagination Status

        const pageSizeEl = querySelectorAllDeep('ytcp-table-footer ytcp-select .ytcp-text-dropdown-trigger-text')[0];

        const pageSize = pageSizeEl ? pageSizeEl.textContent.trim() : 'Unknown';







        const payload = {

            type: 'YOUTUBE_SHORTS_DATA',

            data: shortsData,

            timestamp: Date.now()

        };

        console.log(`🩳 [Shorts Scraper] Sending ${shortsData.length} Shorts to React...`);



        // 1. Send to React App (if opened via window.open)

        if (window.opener) {

            window.opener.postMessage(payload, '*');

        }



        // 2. Send to Background (for broadcasting)

        if (typeof chrome !== 'undefined' && chrome.runtime?.id) {

            chrome.runtime.sendMessage({

                action: 'relayShortsData',

                data: payload

            }).catch(() => { }); // Ignore errors if background is sleeping

        }

    }




    window.addEventListener('message', (event) => {

        if (event.data && event.data.type === 'REQUEST_YOUTUBE_SHORTS_REFRESH') {

            console.log("🔄 [Shorts Scraper] Manual refresh requested!");

            if (window.location.href.includes('/videos/short')) {

                scrapeShorts();

            } else {

                console.log("⚠️ Not on Shorts page, ignoring refresh request.");

            }

        }

    });



    // Global Scheduler for Shorts (Handles SPA navigation)

    setInterval(() => {

        if (window.location.href.includes('/videos/short')) {


            scrapeShorts();

        }

    }, 5000);



    // 📊 Direct Analytics Scraper (Bypass Ask Studio)

    async function scrapeOverviewTab() {

        console.log("📊 [Analytics Scraper] Scraping Overview Tab...");

        const url = window.location.href; // Define url for use in time range detection

        const data = {

            realtime: {},

            topContent: [],

            summary: {},

            rawText: '',

            publishedVideos: [],  // 🎯 X-axis enhancement: videos published on each date (max 10 with details)

            totalPublishedVideos: 0,  // 🎯 Total count of videos published in the period

            xAxisLabels: []       // 🎯 X-axis enhancement: date labels from chart

        };



        try {

            // Get the full page text for parsing (using Shadow DOM piercer)

            const mainContent = getVisibleDeepText(document.body);

            data.rawText = mainContent.substring(0, 2000);

            console.log("📊 Page text length:", mainContent.length);



            // NEW: Extract Date Range (Enhanced with multiple methods)

            // Method 1: Try date picker element

            const datePicker = document.querySelector('ytcp-date-picker');

            if (datePicker) {

                const text = datePicker.innerText;

                // Match "Nov 9 - Dec 6, 2025" or "Dec 8, 2014 - Dec 6, 2025"

                // Handles different dash types and optional first year

                const rangeMatch = text.match(/[A-Z][a-z]{2,9}\s+\d{1,2}(?:,\s+\d{4})?\s*[–\-—]\s*[A-Z][a-z]{2,9}\s+\d{1,2},\s+\d{4}/);

                if (rangeMatch) data.summary.dateRange = rangeMatch[0];

            }



            // Method 2: Try dropdown trigger label (shows current time range dates)

            if (!data.summary.dateRange) {

                const dropdownTrigger = document.querySelector('ytcp-text-dropdown-trigger .label-text, ytcp-dropdown-trigger .label-text');

                if (dropdownTrigger) {

                    const triggerText = dropdownTrigger.innerText;

                    const rangeMatch = triggerText.match(/[A-Z][a-z]{2,9}\s+\d{1,2}(?:,\s+\d{4})?\s*[–\-—]\s*[A-Z][a-z]{2,9}\s+\d{1,2}(?:,\s+\d{4})?/);

                    if (rangeMatch) data.summary.dateRange = rangeMatch[0];

                }

            }



            // Method 3: Try page text parsing

            if (!data.summary.dateRange) {

                const dateMatch = mainContent.match(/[A-Z][a-z]{2,9}\s+\d{1,2}(?:,\s+\d{4})?\s*[–\-—]\s*[A-Z][a-z]{2,9}\s+\d{1,2},\s+\d{4}/);

                if (dateMatch) data.summary.dateRange = dateMatch[0];

            }



            // Method 4: Calculate date range based on time range selection

            if (!data.summary.dateRange) {

                const now = new Date();

                const endDate = `${now.toLocaleString('en-US', { month: 'short' })} ${now.getDate()}, ${now.getFullYear()}`;

                let startDate = '';



                // Calculate start date based on URL period

                if (url.includes('period-week')) {

                    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

                    startDate = `${start.toLocaleString('en-US', { month: 'short' })} ${start.getDate()}`;

                } else if (url.includes('period-default')) {

                    const start = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

                    startDate = `${start.toLocaleString('en-US', { month: 'short' })} ${start.getDate()}`;

                } else if (url.includes('period-quarter')) {

                    const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

                    startDate = `${start.toLocaleString('en-US', { month: 'short' })} ${start.getDate()}`;

                } else if (url.includes('period-year')) {

                    const start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

                    startDate = `${start.toLocaleString('en-US', { month: 'short' })} ${start.getDate()}, ${start.getFullYear()}`;

                }



                if (startDate) {


                }

            }



            if (data.summary.dateRange) console.log("📅 Found Date Range:", data.summary.dateRange);



            // ===== PRIMARY METHOD: Text Parsing (Most Reliable) =====



            // 1. Views: Look for "Views" followed by a number and trend

            const viewsMatch = mainContent.match(/Views\s+([\d,.]+[KMB]?)/i) ||

                mainContent.match(/([\d,.]+[KMB]?)\s+Views/i) ||

                mainContent.match(/Your channel got\s+([\d,.]+[KMB]?)\s+views/i);

            if (viewsMatch) {

                data.summary.views = viewsMatch[1];

                console.log("📊 Found Views:", data.summary.views);



                // Try to find trend text after the number

                const trendMatch = mainContent.match(new RegExp(data.summary.views.replace('.', '\\.') + "[\\s\\n]+([^\\n]+(more|less|same)[^\\n]+)", "i"));

                if (trendMatch) {

                    data.summary.viewsTrend = trendMatch[1].trim();

                    console.log("📊 Found Views Trend:", data.summary.viewsTrend);

                }

            }



            // 2. Watch Time

            const watchTimeMatch = mainContent.match(/Watch time \(hours\)\s+([\d,.]+[KMB]?)/i) ||

                mainContent.match(/([\d,.]+[KMB]?)\s+Watch time/i);

            if (watchTimeMatch) {

                data.summary.watchTime = watchTimeMatch[1];

                console.log("📊 Found Watch Time:", data.summary.watchTime);



                const trendMatch = mainContent.match(new RegExp(data.summary.watchTime.replace('.', '\\.') + "[\\s\\n]+([^\\n]+(more|less|same)[^\\n]+)", "i"));

                if (trendMatch) data.summary.watchTimeTrend = trendMatch[1].trim();

            }



            // 3. Top Content extraction (Your top content in this period)

            const topContentMatches = [];

            const titleRegex = /(?:\uD83C[\uDFA5\uDFA4\uDFAC])?\s*([^\n]{5,60})\n(?:Views|\u89C6\u9891)\s*([\d,.]+[KMB]?)/gi;

            let m;

            while ((m = titleRegex.exec(mainContent)) !== null && topContentMatches.length < 5) {

                topContentMatches.push({ title: m[1].trim(), views: m[2] });

            }

            // Fallback: simple line鈥憄air detection

            if (topContentMatches.length === 0) {

                const lines = mainContent.split('\n').map(l => l.trim()).filter(l => l);

                for (let i = 0; i < lines.length - 1 && topContentMatches.length < 5; i++) {

                    if (lines[i + 1].match(/^[\d,.]+[KMB]?$/)) {

                        topContentMatches.push({ title: lines[i], views: lines[i + 1] });

                    }

                }

            }

            data.topContent = topContentMatches;

            console.log("📊 Top Content extracted:", data.topContent);



            // 3. Subscribers

            const subsMatch = mainContent.match(/Subscribers\s+([+\-]?[\d,.]+[KMB]?)/i) ||

                mainContent.match(/([+\-]?[\d,.]+[KMB]?)\s+Subscribers/i);

            if (subsMatch) {

                data.summary.subscribers = subsMatch[1];

                console.log("📊 Found Subscribers:", data.summary.subscribers);



                const trendMatch = mainContent.match(new RegExp(data.summary.subscribers.replace('+', '\\+').replace('.', '\\.') + "[\\s\\n]+([^\\n]+(more|less|same)[^\\n]+)", "i"));

                if (trendMatch) data.summary.subscribersTrend = trendMatch[1].trim();

            }



            // --- DOM FALLBACK FOR SUMMARY ---

            // --- DOM SCRAPER FOR CARDS (Robust Trend & Icon) ---

            const metricCards = querySelectorAllDeep('ytcp-key-metric-card');

            metricCards.forEach(card => {

                const label = card.innerText.toLowerCase();

                const valueEl = card.querySelector('.metric-value-big') || card.querySelector('#metric-value');

                const trendLabel = card.querySelector('ytcp-trend-label');



                if (valueEl) {

                    const val = valueEl.innerText.trim();

                    let direction = 'flat';

                    let trendText = '';



                    if (trendLabel) {

                        trendText = trendLabel.innerText.trim().replace(/\s+/g, ' ');

                        const icon = trendLabel.querySelector('iron-icon');

                        if (icon) {

                            const iconAttr = icon.getAttribute('icon') || '';

                            if (iconAttr.includes('up') || iconAttr.includes('arrow-drop-up')) direction = 'up';

                            if (iconAttr.includes('down') || iconAttr.includes('arrow-drop-down')) direction = 'down';

                        }

                    }



                    if (!data.summary) data.summary = {}; // 🛡️ SAFETY CHECK
                    if (label.includes('views') && !label.includes('engaged')) {

                        data.summary.views = val;

                        data.summary.viewsTrend = trendText;

                        data.summary.viewsDirection = direction;

                    }

                    if (label.includes('watch time')) {

                        data.summary.watchTime = val;

                        data.summary.watchTimeTrend = trendText;

                        data.summary.watchTimeDirection = direction;

                    }

                    if (label.includes('subscribers')) {

                        data.summary.subscribers = val;

                        data.summary.subscribersTrend = trendText;

                        data.summary.subscribersDirection = direction;

                    }

                    if (label.includes('engaged views')) {

                        data.summary.engagedViews = val;

                        data.summary.engagedViewsTrend = trendText;

                        data.summary.engagedViewsDirection = direction;

                    }

                    if (label.includes('likes')) {

                        data.summary.likes = val;

                        data.summary.likesTrend = trendText;

                        data.summary.likesDirection = direction;

                    }

                }

            });



            // 5. Realtime: Look for "Realtime" block

            // Relaxed pattern: Look for "Realtime" ... "Subscribers" within 800 chars

            const realtimeBlock = mainContent.match(/Realtime[\s\S]{1,800}?Subscribers/i);

            if (realtimeBlock) {

                const blockText = realtimeBlock[0];

                // Extract Subscribers count

                const rtSubs = blockText.match(/Subscribers[\s\n]+([\d,.]+[KMB]?)/i) ||

                    blockText.match(/([\d,.]+[KMB]?)\s*Subscribers/i);

                if (rtSubs) data.realtime.subscribers = rtSubs[1];




                const rtViews = blockText.match(/Views[\s\S]{1,50}?([\d,.]+[KMB]?)/i) ||

                    blockText.match(/([\d,.]+[KMB]?)\s*Views/i);

                if (rtViews) data.realtime.views = rtViews[1];



                console.log("📊 Found Realtime:", data.realtime);

            }



            // --- DOM FALLBACK FOR REALTIME ---

            if (!data.realtime.subscribers) {

                const realtimeCard = querySelectorAllDeep('ytcp-activity-card')[0]; // Usually the realtime card

                if (realtimeCard) {

                    const rtText = realtimeCard.innerText;

                    const rtSubs = rtText.match(/Subscribers[\s\n]+([\d,.]+[KMB]?)/i);

                    if (rtSubs) data.realtime.subscribers = rtSubs[1];

                    const rtViews = rtText.match(/Views[\s\S]{1,50}?([\d,.]+[KMB]?)/i);

                    if (rtViews) data.realtime.views = rtViews[1];

                }

            }



            // 6. Top Content: Find video titles and views (Targeted DOM)

            // Use yta-personalized-overview-bottom-card which contains the actual video list

            try {

                const topContentCard = querySelectorAllDeep('yta-personalized-overview-bottom-card').find(card =>

                    (card.innerText || '').includes('Your top content in this period')

                );



                if (topContentCard) {

                    console.log("📊 Overview - Found Top Content Card (yta-personalized-overview-bottom-card)");



                    // 🎯 NEW STRATEGY: Extract videoId from thumbnail URLs

                    // YouTube Studio uses ytimg.com/vi/VIDEO_ID/... format for thumbnails

                    const allImages = topContentCard.querySelectorAll ?

                        topContentCard.querySelectorAll('img') :

                        querySelectorAllDeep('img', topContentCard);



                    console.log("📊 Top Content - Found images:", allImages.length);



                    const newTopContent = [];

                    const seenIds = new Set();



                    Array.from(allImages).forEach((img, idx) => {

                        if (newTopContent.length >= 10) return;



                        const src = img.src || '';

                        // Match ytimg.com/vi/VIDEO_ID/ pattern

                        const videoIdMatch = src.match(/ytimg\.com\/vi\/([a-zA-Z0-9_-]{11})/);

                        const videoId = videoIdMatch ? videoIdMatch[1] : '';



                        // Skip duplicates

                        if (videoId && seenIds.has(videoId)) return;

                        if (videoId) seenIds.add(videoId);



                        // Skip non-YouTube thumbnails

                        if (!videoId) return;



                        // Find the row container by going up the DOM tree

                        // Look for a container that has BOTH duration (0:XX) and views (XX,XXX) patterns

                        let container = img.parentElement;

                        for (let i = 0; i < 20 && container; i++) {

                            const text = container.innerText || '';

                            // Check if container has both duration and views data

                            if (text.match(/\d+:\d{2}/) && text.match(/[\d,]{4,}/)) {

                                break; // Found the right container

                            }

                            container = container.parentElement;

                        }

                        if (!container) container = img.parentElement?.parentElement || img;



                        // Extract text from container to find title

                        const containerText = (container.innerText || container.textContent || '').trim();

                        const lines = containerText.split('\n').map(l => l.trim()).filter(l => l);



                        // Find title - skip numbers, dates, percentages

                        let title = '';

                        for (const line of lines) {

                            if (line.match(/^\d+$/) ||

                                line.match(/^\d+:\d{2}$/) ||

                                line.match(/^\(\d+\.?\d*%\)$/) ||

                                line.match(/^[\d,]+$/) ||

                                line.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i) ||

                                line === 'Recent upload' ||

                                line === 'Content' ||

                                line.includes('Your top content')) {

                                continue;

                            }

                            if (line.length > 8 && !title) {

                                title = line;

                                break;

                            }

                        }



                        // Skip if no valid title

                        if (!title || title.length < 5) return;



                        // Use the actual thumbnail from src

                        const thumbnail = src;



                        // videoData uses lines already extracted above

                        // Based on test: lines = ["1", "[Al Satire]", "HOA Karen...", "Oct 27, 2025", "0:14", "(123.3%)", "30,589"]

                        // Last 3 items are typically: duration, percent, views



                        const videoData = {

                            videoId: videoId,

                            thumbnail: thumbnail,

                            title: title,

                            views: '',

                            date: '',

                            duration: '',

                            durationPercent: '',

                            recentUpload: false

                        };



                        // IMPROVED: Use position-based extraction from end of lines array

                        // Last line should be views (e.g., "30,589")

                        // Second to last should be percentage (e.g., "(123.3%)")

                        // Third to last should be duration (e.g., "0:14")



                        const len = lines.length;



                        // Check last 5 lines for specific patterns

                        for (let i = Math.max(0, len - 5); i < len; i++) {

                            const line = lines[i];



                            // Views: digits with commas "30,589" or "1,234" (usually last)

                            if (line.match(/^[\d,]+$/) && line.length > 2) {

                                videoData.views = line;

                            }

                            // Duration percentage: "(123.3%)" or "(98.5%)"

                            else if (line.match(/^\([\d.]+%\)$/)) {

                                videoData.durationPercent = line.replace(/[()]/g, '');

                            }

                            // Duration: "0:14" or "1:23"

                            else if (line.match(/^\d+:\d{2}$/)) {

                                videoData.duration = line;

                            }

                            // Date: "Oct 27, 2025"

                            else if (line.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}$/i)) {

                                videoData.date = line;

                            }

                            // Recent upload badge

                            else if (line === 'Recent upload') {

                                videoData.recentUpload = true;

                            }

                        }



                        // Also scan earlier lines for date if not found

                        if (!videoData.date) {

                            for (const line of lines) {

                                if (line.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}$/i)) {

                                    videoData.date = line;

                                    break;

                                }

                            }

                        }



                        // Accept if we have at least a title and videoId

                        if (videoData.title && videoData.videoId) {

                            newTopContent.push(videoData);

                            console.log("📊 Found Video:", videoData.title.substring(0, 35), "| ID:", videoData.videoId, "| Views:", videoData.views, "| Duration:", videoData.duration, "| %:", videoData.durationPercent);

                        }

                    });



                    // 🔧 FIX: Define url variable from window.location.href

                    const url = window.location.href;



                    // Fallback: If DOM extraction didn't work, use the original text parsing

                    if (newTopContent.length === 0) {

                        console.log("📊 Top Content - DOM method failed, using text fallback...");

                        const text = topContentCard.innerText;

                        const lines = text.split('\n').map(l => l.trim()).filter(l => l);



                        for (let i = 0; i < lines.length && newTopContent.length < 10; i++) {

                            const line = lines[i];

                            if (line.match(/^([1-9]|10)$/) && i + 1 < lines.length) {

                                const titleLine = lines[i + 1];

                                if (titleLine === 'Content' || titleLine.includes('Your top content') || titleLine === 'Average view duration' || titleLine === 'Views') continue;

                                if (titleLine.length > 10) {

                                    const videoData = {

                                        videoId: '',

                                        thumbnail: '',

                                        title: titleLine,

                                        views: '',

                                        date: '',

                                        duration: '',

                                        durationPercent: '',

                                        recentUpload: false

                                    };



                                    for (let j = i + 2; j < Math.min(i + 8, lines.length); j++) {

                                        const nextLine = lines[j];

                                        if (nextLine.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}$/i)) {

                                            videoData.date = nextLine;

                                        } else if (nextLine === 'Recent upload') {

                                            videoData.recentUpload = true;

                                        } else if (nextLine.match(/^\d+:\d{2}$/)) {

                                            videoData.duration = nextLine;

                                        } else if (nextLine.match(/^\(\d+\.?\d*%\)$/)) {

                                            videoData.durationPercent = nextLine.replace(/[()]/g, '');

                                        } else if (nextLine.match(/^[\d,]+$/) && nextLine.length > 2) {

                                            videoData.views = nextLine;

                                            break;

                                        }

                                    }



                                    if (videoData.views && !newTopContent.some(v => v.title === titleLine)) {

                                        newTopContent.push(videoData);

                                        console.log("📊 Found Video (text):", titleLine.substring(0, 30), "Views:", videoData.views);

                                    }

                                }

                            }

                        }

                    }



                    if (newTopContent.length > 0) {

                        data.topContent = newTopContent;

                        console.log("📊 Overview - Extracted Top Content:", data.topContent.length, "videos");

                    }

                } else {

                    console.log("⚠️ Top Content card (yta-personalized-overview-bottom-card) not found");

                }

            } catch (e) {

                console.warn("⚠️ Error scraping Top Content (Targeted):", e);

            }



            // Fallback: simple line鈥憄air detection (Original)

            if (data.topContent.length < 5) {

                const lines = mainContent.split('\n').map(l => l.trim()).filter(l => l);

                for (let i = 0; i < lines.length - 1 && data.topContent.length < 5; i++) {

                    if (lines[i + 1].match(/^[\d,.]+[KMB]?$/) &&

                        !lines[i].match(/^(Dashboard|Content|Analytics|Comments|Subtitles|Copyright|Earn|Settings|Send feedback|See more|See live count|Overview|Audience|Trends|Top content|Views|Watch time|Subscribers|Realtime|Your channel|Skip navigation|Create|\d+$)/i)) {

                        data.topContent.push({ title: lines[i], views: lines[i + 1] });

                    }

                }

            }



            // ===== SECONDARY METHOD: DOM Elements (Backup) =====



            // Try yta-key-metric-block for key metrics

            const keyMetricBlocks = document.querySelectorAll('yta-key-metric-block');

            if (keyMetricBlocks.length > 0) {

                console.log("📊 Found", keyMetricBlocks.length, "key metric blocks");

            }



            // Try yta-top-performing-entities for top content

            const topPerforming = document.querySelector('yta-top-performing-entities');

            if (topPerforming && data.topContent.length === 0) {

                console.log("📊 Found top-performing-entities");

                const entities = topPerforming.querySelectorAll('yta-entity-thumbnail');

                entities.forEach(entity => {

                    const title = entity.getAttribute('title') || entity.textContent.trim();

                    if (title && data.topContent.length < 5) {

                        data.topContent.push({ title, views: 'N/A' });

                    }

                });

            }



        } catch (e) {

            console.error("📊 [Analytics Scraper] Error in scrapeOverviewTab:", e);

        }



        // --- TIME RANGE SELECTION MOVED TO ensureTimeRange() ---



        // --- CHART SCRAPING (Async Sequence) ---

        try {

            const sleep = (ms) => new Promise(r => setTimeout(r, ms));



            // Helper to find and scrape the active chart

            // scrapeActiveChart is now defined globally



            // 1. Scrape Views (Default)

            console.log("📊 Scraping Views Chart...");

            await sleep(1000); // Wait for initial load

            data.summary.viewsChart = scrapeActiveChart();

            // console.log("📊 Views Chart result:", data.summary.viewsChart ? "Found path len=" + (data.summary.viewsChart.path?.length || 0) : "NULL");



            if (!data.summary.viewsChart || !data.summary.viewsChart.path) {

                console.log("⚠️ Overview - Views Chart not ready, retrying...");

                await sleep(1500);

                data.summary.viewsChart = scrapeActiveChart();

                // console.log("📊 Views Chart retry result:", data.summary.viewsChart ? "Found path len=" + (data.summary.viewsChart.path?.length || 0) : "NULL");

            }



            // Find Cards to click

            const cards = findMetricCards();

            // console.log("📊 Found metric cards:", cards.length);



            if (cards.length >= 3) {

                // 2. Click Watch Time


                cards[1].click();

                await sleep(1500);

                data.summary.watchTimeChart = scrapeActiveChart();

                if (!data.summary.watchTimeChart || !data.summary.watchTimeChart.path) {

                    console.log("⚠️ Overview - Watch Time Chart not ready, retrying...");

                    await sleep(1500);

                    data.summary.watchTimeChart = scrapeActiveChart();

                }



                // 3. Click Subscribers


                cards[2].click();

                await sleep(1500);

                data.summary.subsChart = scrapeActiveChart();

                if (!data.summary.subsChart || !data.summary.subsChart.path) {

                    console.log("⚠️ Overview - Subs Chart not ready, retrying...");

                    await sleep(1500);

                    data.summary.subsChart = scrapeActiveChart();

                }



                // 4. Restore Views


                cards[0].click();

                await sleep(500);

            } else {

                console.log("⚠️ Not enough cards to click, using single chart for all metrics");

                // Use same chart for all if we can't click individual cards

                data.summary.watchTimeChart = data.summary.viewsChart;

                data.summary.subsChart = data.summary.viewsChart;

            }



            // Ensure chartData fallback is always set

            data.summary.chartData = data.summary.viewsChart || data.summary.watchTimeChart || data.summary.subsChart;

            // console.log("📊 Final chartData:", data.summary.chartData ? "Found path len=" + (data.summary.chartData.path?.length || 0) : "NULL");



        } catch (e) {

            console.warn("⚠️ Error scraping interactive charts:", e);

        }



        // 🎯 X-AXIS ENHANCEMENT: Extract published videos and date labels

        // This is an OPTIONAL enhancement - failures here do NOT affect other functionality

        try {

            console.log("📊 [X-Axis Enhancement] Starting extraction...");



            // 1. Extract X-axis date labels from chart SVG

            const chartCard = document.querySelector('yta-chart-card');

            if (chartCard) {

                const textLabels = chartCard.querySelectorAll('text');

                textLabels.forEach(label => {

                    const text = label.textContent?.trim();

                    // 🔧 ENHANCED: Match all YouTube Studio date patterns:

                    // "Dec 9", "Dec 10", "Oct 9, 2016", "Aug 11, 2018", "Dec 8, 2014"

                    if (text && text.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(,\s*\d{4})?$/)) {

                        if (!data.xAxisLabels.includes(text)) {

                            data.xAxisLabels.push(text);

                        }

                    }

                });

                console.log("📊 [X-Axis] Found date labels:", data.xAxisLabels.length, data.xAxisLabels);

            }



            // 🎯 NEW: Extract TOTAL published videos count from chart markers area

            // YouTube Studio shows "X videos published" in tooltips when hovering over markers

            // Strategy 1 (VERIFIED): Match from page text - "8 videos published"

            // Strategy 2: Sum counts from individual marker elements

            let totalPublishedCount = 0;

            try {

                // Method 1 (PRIMARY - VERIFIED WORKING): Look for "X videos published" in page text

                const tooltipText = document.body.innerText.match(/(\d+)\s+videos?\s+published/i);

                if (tooltipText) {

                    totalPublishedCount = parseInt(tooltipText[1]) || 0;

                    console.log("📊 [X-Axis] Found total via innerText match:", totalPublishedCount);

                }



                // Method 2 (FALLBACK): Sum counts from marker elements if Method 1 failed

                if (!totalPublishedCount) {

                    const markerElements = querySelectorAllDeep(

                        'ytcp-chart-marker, .chart-marker, yta-chart-markers [role="button"]'

                    );



                    markerElements.forEach(m => {

                        const innerText = m.innerText?.trim() || '';

                        // Extract count from inner text (e.g., "7", "9+", "2")

                        const countMatch = innerText.match(/^(\d+)\+?$/);

                        if (countMatch) {

                            const count = parseInt(countMatch[1]);

                            if (!isNaN(count)) totalPublishedCount += count;

                        }

                    });



                    if (totalPublishedCount) {

                        console.log("📊 [X-Axis] Found total via marker sum:", totalPublishedCount);

                    }

                }



                console.log("📊 [X-Axis] Total published videos count:", totalPublishedCount);

            } catch (e) {

                console.warn("⚠️ [X-Axis] Error extracting total count:", e.message);

            }



            // Store total count in data

            data.totalPublishedVideos = totalPublishedCount;



            // 2. Extract published videos from "Your top content" section (up to 10 videos with details)

            const topContentSection = document.querySelector('yta-personalized-overview-bottom-card');

            if (topContentSection) {

                const videoRows = topContentSection.querySelectorAll('img[src*="ytimg"]');

                videoRows.forEach((img, idx) => {

                    try {

                        // Extract video ID from thumbnail URL

                        const thumbUrl = img.src;

                        const videoIdMatch = thumbUrl.match(/\/vi\/([a-zA-Z0-9_-]{11})\//);

                        const videoId = videoIdMatch ? videoIdMatch[1] : null;



                        if (videoId) {

                            // Get parent row for title and date

                            let row = img.parentElement;

                            for (let i = 0; i < 10 && row; i++) {

                                if (row.innerText && row.innerText.includes(videoId.substring(0, 5))) break;

                                const text = row.innerText || '';

                                if (text.match(/\d{1,2},?\s+\d{4}|Dec|Nov|Oct|Sep|Aug/)) break;

                                row = row.parentElement;

                            }



                            const rowText = row?.innerText || '';

                            const lines = rowText.split('\n').map(l => l.trim()).filter(l => l);



                            // Find title (usually the longest line that's not a date or number)

                            let title = lines.find(l =>

                                l.length > 10 &&

                                !l.match(/^\d/) &&

                                !l.match(/^(Views|Watch time|Average|Content)/i)

                            ) || '';



                            // Find date

                            const dateMatch = rowText.match(/(Dec|Nov|Oct|Sep|Aug|Jul|Jun|May|Apr|Mar|Feb|Jan)\s+\d{1,2},?\s*\d{0,4}/);

                            const publishDate = dateMatch ? dateMatch[0] : '';



                            data.publishedVideos.push({

                                videoId,

                                title: title.substring(0, 80),

                                thumbnailUrl: thumbUrl,

                                publishDate,

                                watchUrl: `https://www.youtube.com/watch?v=${videoId}`,

                                analyticsUrl: `https://studio.youtube.com/video/${videoId}/analytics`

                            });

                        }

                    } catch (err) {

                        // Silently skip individual video extraction errors

                    }

                });

                console.log("📊 [X-Axis] Extracted video details:", data.publishedVideos.length);

            }

        } catch (e) {

            console.warn("⚠️ [X-Axis Enhancement] Error (non-critical):", e.message);

            // Failures here do NOT affect other data - arrays remain empty

        }



        // 🔧 FIX: Ensure extracted xAxisLabels are used as dateLabels for React

        if (data.xAxisLabels && data.xAxisLabels.length > 0) {

            console.log("📊 [Overview] Promoting xAxisLabels to dateLabels:", data.xAxisLabels.length);

            data.dateLabels = data.xAxisLabels;



            // Also update chartData.dateLabels if chartData exists

            if (data.summary.chartData) {

                data.summary.chartData.dateLabels = data.xAxisLabels;

            }

        }



        console.log("📊 [Analytics Scraper] Final data:", data);

        return { category: 'overview', data };

    }



    // Helper to find metric cards (supports Overview and Content/Audience tabs)





    // Helper to find metric cards (supports Overview and Content/Audience tabs)

    const findMetricCards = () => {

        const deepCards = [];

        // Expanded selectors for various tab types

        // ytcp-key-metric-card: Overview/Content

        // yta-key-metric-block: Audience/Revenue

        // .metric-card: Generic fallback

        const selectors = 'ytcp-key-metric-card, yta-key-metric-card, .metric-card, yta-key-metric-block, div[class*="key-metric-card"]';



        try {

            const cards = querySelectorAllDeep(selectors);

            if (cards && cards.length > 0) {

                cards.forEach(card => {

                    // Filter out tiny/invisible cards or empty ones

                    if ((card.offsetWidth > 0 || (card.getClientRects && card.getClientRects().length > 0)) &&

                        (card.innerText.length > 3 || (card.shadowRoot && card.shadowRoot.textContent.length > 3))) {

                        deepCards.push(card);

                    }

                });

            }

        } catch (e) {

            console.warn("⚠️ Error finding metric cards:", e);

        }



        console.log(`📊 findMetricCards found ${deepCards.length} cards`);

        return deepCards;



    };



    async function scrapeContentTab() {

        console.log("📊 [Analytics Scraper] Scraping Content Tab...");

        const data = {

            retention: {},

            keyMoments: [],

            topVideos: [],

            engagement: {},  // NEW: Engagement metrics

            charts: {},      // NEW: Interactive Charts

            rawSample: '',

            dateRange: ''    // 🎯 Date range for this tab

        };



        try {

            // Use document.body.innerText as primary source (verified by user logs)

            let mainContent = document.body.innerText;

            if (mainContent.length < 500) {

                console.log("⚠️ innerText too short, falling back to getVisibleDeepText");

                mainContent = getVisibleDeepText(document.body);

            }



            console.log("📊 Content page text length:", mainContent.length);

            // Debug: Log the first 500 chars to see what we are parsing

            console.log("📊 Content Text Preview:", mainContent.substring(0, 500));



            // 🎯 Extract Date Range for Content tab

            const datePicker = document.querySelector('ytcp-date-picker');

            if (datePicker) {

                const text = datePicker.innerText;

                const rangeMatch = text.match(/[A-Z][a-z]{2,9}\s+\d{1,2}(?:,\s+\d{4})?\s*[–\-—]\s*[A-Z][a-z]{2,9}\s+\d{1,2},\s+\d{4}/);

                if (rangeMatch) data.dateRange = rangeMatch[0];

            }

            if (!data.dateRange) {

                const dateMatch = mainContent.match(/[A-Z][a-z]{2,9}\s+\d{1,2}(?:,\s+\d{4})?\s*[–\-—]\s*[A-Z][a-z]{2,9}\s+\d{1,2},\s+\d{4}/);

                if (dateMatch) data.dateRange = dateMatch[0];

            }

            if (data.dateRange) console.log("📅 [Content] Found Date Range:", data.dateRange);



            // ENHANCEMENT: Also get text from specific cards (handling Shadow DOM)

            let cardText = '';

            try {

                const cards = findMetricCards();

                cardText = cards.map(c => c.innerText).join('\n');

            } catch (e) { console.error("Card text error:", e); }

            mainContent += '\n' + cardText;



            console.log("📊 [Scraper] Main Content Length:", mainContent.length);



            // Debug: Check for specific keywords

            console.log("📊 Contains 'Views'?", /Views/i.test(mainContent));

            console.log("📊 Contains 'Engaged views'?", /Engaged views/i.test(mainContent));



            data.rawSample = mainContent.substring(0, 1500);



            // ===== NEW: Extract Engagement Metrics (visible on Content tab) =====



            // 🎯 IMPROVED: First try to extract from individual metric cards (more reliable)

            try {

                if (!data.engagement) data.engagement = {}; // 🛡️ ENHANCED SAFETY INJECTION

                // 🎯 IMPROVED: Use deep selector to find cards in Shadow DOM (Added yta-key-metric-block)

                const metricCards = querySelectorAllDeep('yta-key-metric-card, ytcp-key-metric-card, .metric-card, yta-key-metric-block');

                console.log(`📊 Content - Found ${metricCards.length} metric cards`);



                metricCards.forEach((card, index) => {

                    let cardText = '';



                    // Try shadowRoot first

                    if (card.shadowRoot) {

                        cardText = card.shadowRoot.textContent || '';

                    }

                    // Fallback to innerText

                    if (!cardText || cardText.length < 5) {

                        cardText = card.innerText || card.textContent || '';

                    }



                    console.log(`📊 Card ${index}: "${cardText.substring(0, 100)}..."`);



                    const cardLower = cardText.toLowerCase();



                    // Extract value (number with K/M/B suffix)

                    const valueMatch = cardText.match(/([0-9,.]+[KMB]?(?:K|M|B)?)/i);

                    let value = valueMatch ? valueMatch[1] : null;



                    if (value) {

                        let metricKey = null;

                        if (cardLower.includes('engaged') && cardLower.includes('view')) {

                            metricKey = 'engagedViews';

                        } else if (cardLower.includes('view') && !cardLower.includes('engaged')) {

                            metricKey = 'views';

                        } else if (cardLower.includes('like')) {

                            metricKey = 'likes';

                        } else if (cardLower.includes('subscriber')) {

                            metricKey = 'subscribers';

                            // 🔧 FIX: Look for +/- prefix specifically for subscribers

                            // Search for pattern like "+139" or "-10" or "+1.2K"

                            const subsValueMatch = cardText.match(/([+\-]\s*[0-9,.]+[KMB]?)/i);

                            if (subsValueMatch) {

                                value = subsValueMatch[1].replace(/\s/g, ''); // Remove any space between + and number

                                console.log(`📊 Content Card - Subscribers with prefix:`, value);

                            }

                        }



                        if (metricKey) {

                            data.engagement[metricKey] = value;

                            console.log(`📊 Content Card - Found ${metricKey}:`, value);



                            // Extract Trend - improved pattern matching

                            const lines = cardText.split('\n').map(l => l.trim()).filter(l => l);

                            // Match more trend patterns: "X% more/less", "increase/decrease", "+X%/-X%"

                            const trendLine = lines.find(l =>

                                l.includes('more than') ||

                                l.includes('less than') ||

                                l.includes('increase') ||

                                l.includes('decrease') ||

                                l.match(/^\d+%\s*(more|less|up|down)/i) ||

                                l.match(/^[+-]?\d+(\.\d+)?%$/i)

                            );

                            let trendDirection = 'flat';

                            if (trendLine) {

                                if (trendLine.includes('more') || trendLine.includes('increase') || trendLine.includes('up') || trendLine.startsWith('+')) {

                                    trendDirection = 'up';

                                }

                                if (trendLine.includes('less') || trendLine.includes('decrease') || trendLine.includes('down') || (trendLine.startsWith('-') && !trendLine.startsWith('--'))) {

                                    trendDirection = 'down';

                                }

                            }



                            // 🎯 Special case: Infer direction from value prefix for subscribers

                            if (!trendLine && metricKey === 'subscribers' && value) {

                                if (value.startsWith('+')) {

                                    trendDirection = 'up';

                                    data.engagement[`${metricKey}Trend`] = `${value} new subscribers`;

                                    data.engagement[`${metricKey}Direction`] = trendDirection;

                                    data.trends[metricKey] = { text: `${value} new subscribers`, direction: trendDirection };

                                } else if (value.startsWith('-')) {

                                    trendDirection = 'down';

                                    data.engagement[`${metricKey}Trend`] = `${value} subscribers`;

                                    data.engagement[`${metricKey}Direction`] = trendDirection;

                                    data.trends[metricKey] = { text: `${value} subscribers`, direction: trendDirection };

                                }

                            } else {

                                // Store directly in engagement object for React compatibility

                                data.engagement[`${metricKey}Trend`] = trendLine || '';

                                data.engagement[`${metricKey}Direction`] = trendDirection;

                                data.trends[metricKey] = { text: trendLine || '', direction: trendDirection };

                            }

                        }

                    }

                });

            } catch (cardError) {

                console.warn("⚠️ Content card extraction error:", cardError);

            }



            // 🎯 FALLBACK: Text-based extraction if cards didn't work

            // Helper to extract metric and trend from text block

            const extractMetricWithTrend = (metricName, pattern1, pattern2) => {

                const block = mainContent.match(new RegExp(`${metricName}[\\s\\S]{0,200}`, 'i'));

                if (block) {

                    const blockText = block[0];

                    // Extract value

                    const valueMatch = blockText.match(/([0-9,.]+[KMB]?)/i);

                    // Extract trend: "X% more/less than previous Y days"

                    const trendMatch = blockText.match(/(\d+%\s*(?:more|less)\s*than\s*previous\s*\d+\s*days?)/i);

                    return {

                        value: valueMatch ? valueMatch[1] : null,

                        trend: trendMatch ? trendMatch[1] : null,

                        direction: trendMatch ? (trendMatch[1].includes('more') ? 'up' : 'down') : 'flat'

                    };

                }

                return { value: null, trend: null, direction: 'flat' };

            };



            if (!data.engagement.views) {

                const result = extractMetricWithTrend('Views', /Views[\s\n]+([0-9,.]+[KMB]?)/i, /([0-9,.]+[KMB]?)[\s\n]+views/i);

                if (result.value) {

                    data.engagement.views = result.value;

                    data.engagement.viewsTrend = result.trend || '';

                    data.engagement.viewsDirection = result.direction;

                    console.log("📊 Content Text - Found Views:", data.engagement.views, "Trend:", result.trend);

                }

            }



            if (!data.engagement) data.engagement = {}; // 🛡️ CRITICAL SAFETY CHECK
            if (!data.engagement.engagedViews) {

                const result = extractMetricWithTrend('Engaged views', /Engaged views[\s\n]+([0-9,.]+[KMB]?)/i, null);

                if (result.value) {

                    data.engagement.engagedViews = result.value;

                    data.engagement.engagedViewsTrend = result.trend || '';

                    data.engagement.engagedViewsDirection = result.direction;

                    console.log("📊 Content Text - Found Engaged Views:", data.engagement.engagedViews, "Trend:", result.trend);

                }

            }



            // 🚨 SANITY CHECK: If Engaged Views == Views, it's likely wrong (unless 100% engagement)

            if (data.engagement.views && data.engagement.engagedViews && data.engagement.views === data.engagement.engagedViews) {

                console.warn("⚠️ [Scraper] Engaged Views equals Views. This is suspicious. Retrying extraction...");

                // Try strict regex on mainContent

                const strictEngaged = mainContent.match(/Engaged views\s*([\d,.]+[KMB]?)/i);

                if (strictEngaged && strictEngaged[1] !== data.engagement.views) {

                    data.engagement.engagedViews = strictEngaged[1];

                    console.log("✨[Scraper] Corrected Engaged Views:", data.engagement.engagedViews);

                }

            }



            if (!data.engagement.likes) {

                const result = extractMetricWithTrend('Likes', /Likes[\s\n]+([0-9,.]+[KMB]?)/i, /([0-9,.]+[KMB]?)[\s\n]+likes/i);

                if (result.value) {

                    data.engagement.likes = result.value;

                    data.engagement.likesTrend = result.trend || '';

                    data.engagement.likesDirection = result.direction;

                    console.log("📊 Content Text - Found Likes:", data.engagement.likes, "Trend:", result.trend);

                }

            }



            if (!data.engagement.subscribers) {

                const result = extractMetricWithTrend('Subscribers', /Subscribers[\s\n]+([+\-]?[0-9,.]+[KMB]?)/i, /([+\-]?[0-9,.]+[KMB]?)[\s\n]+subscribers/i);

                if (result.value) {

                    data.engagement.subscribers = result.value;

                    // Check if value has +/- prefix for trend

                    if (result.value.startsWith('+')) {

                        data.engagement.subscribersTrend = result.trend || `${result.value} new subscribers`;

                        data.engagement.subscribersDirection = 'up';

                    } else if (result.value.startsWith('-')) {

                        data.engagement.subscribersTrend = result.trend || `${result.value} subscribers`;

                        data.engagement.subscribersDirection = 'down';

                    } else {

                        data.engagement.subscribersTrend = result.trend || '';

                        data.engagement.subscribersDirection = result.direction;

                    }

                    console.log("📊 Content Text - Found Subscribers:", data.engagement.subscribers, "Trend:", data.engagement.subscribersTrend);

                }

            }



            // NEW: Impressions (or Shown in feed)

            const impressionsMatch = mainContent.match(/Impressions[\s\n]+([0-9,.]+[KMB]?)/i) ||

                mainContent.match(/Shown in feed[\s\n]+([0-9,.]+[KMB]?)/i);

            if (impressionsMatch) data.engagement.impressions = impressionsMatch[1];



            // NEW: CTR

            const ctrMatch = mainContent.match(/Click-through rate[\s\n]+([\d.]+%)/i);

            if (ctrMatch) data.engagement.ctr = ctrMatch[1];



            // NEW: Avg Duration (or Avg % viewed)

            const avgDurMatch = mainContent.match(/Average view duration[\s\n]+([\d:]+)/i) ||

                mainContent.match(/Average percentage viewed[\s\n]+([\d.]+%)/i);

            if (avgDurMatch) data.engagement.avgDuration = avgDurMatch[1];



            // Engagement percentage (Stayed to watch)

            // How viewers engaged (Shorts)

            // Text: "How viewers engaged\nLifetime\n57.2%\n42.8%\nStayed to watch\nSwiped away"

            const engagementBlock = mainContent.match(/How viewers engaged[\s\S]{1,200}/i);

            if (engagementBlock) {

                const blockText = engagementBlock[0];

                const percentages = blockText.match(/([\d.]+%)/g);

                if (percentages && percentages.length >= 2) {

                    data.engagement.stayedToWatch = percentages[0];

                    data.engagement.swipedAway = percentages[1];

                    console.log("📊 Content - Found Engagement:", data.engagement.stayedToWatch, "Stayed,", data.engagement.swipedAway, "Swiped");

                }

            } else {

                // Fallback to old regex if block not found

                const stayedMatch = mainContent.match(/([\d.]+%)\s*Stayed to watch/i) ||

                    mainContent.match(/Stayed to watch[\s\n]+([\d.]+%)/i);

                if (stayedMatch) data.engagement.stayedToWatch = stayedMatch[1];



                const swipedMatch = mainContent.match(/([\d.]+%)\s*Swiped away/i) ||

                    mainContent.match(/Swiped away[\s\n]+([\d.]+%)/i);

                if (swipedMatch) data.engagement.swipedAway = swipedMatch[1];

            }



            // --- CHART SCRAPING (Content Tab) ---

            try {

                const sleep = (ms) => new Promise(r => setTimeout(r, ms));



                // Reuse scrapeActiveChart helper (now global)



                const cards = findMetricCards();

                if (cards.length > 0) {

                    // Map cards to metrics based on text content

                    const cardMap = {};

                    cards.forEach(card => {

                        const text = card.innerText.toLowerCase();

                        if (text.includes('views') && !text.includes('engaged')) cardMap['views'] = card;

                        else if (text.includes('impressions') && !text.includes('click')) cardMap['impressions'] = card;

                        else if (text.includes('click-through') || text.includes('ctr')) cardMap['ctr'] = card;

                        else if (text.includes('duration')) cardMap['avgDuration'] = card;

                        else if (text.includes('engaged views')) cardMap['engagedViews'] = card;

                        else if (text.includes('likes')) cardMap['likes'] = card;

                        else if (text.includes('subscribers')) cardMap['subscribers'] = card;

                    });



                    const scrapeMetric = async (metricKey, card) => {

                        if (card) {


                            card.click();

                            await sleep(1500);

                            let chart = scrapeActiveChart();

                            if (!chart || !chart.path) {

                                console.log(`⚠️ Content - Chart not ready for ${metricKey}, retrying...`);

                                await sleep(1500);

                                chart = scrapeActiveChart();

                            }

                            data.charts[metricKey] = chart;

                        }

                    };



                    // Scrape available metrics

                    await scrapeMetric('views', cardMap['views']);

                    await scrapeMetric('impressions', cardMap['impressions']);

                    await scrapeMetric('ctr', cardMap['ctr']);

                    await scrapeMetric('avgDuration', cardMap['avgDuration']);

                    await scrapeMetric('engagedViews', cardMap['engagedViews']);

                    await scrapeMetric('likes', cardMap['likes']);

                    await scrapeMetric('subscribers', cardMap['subscribers']);



                    // Restore Views (or first available)

                    if (cards[0]) cards[0].click();

                }

            } catch (e) {

                console.warn("⚠️ Error scraping content charts:", e);

            }



            // DOM FALLBACK for Engagement (if regex failed)

            // Also extract TRENDS here

            if (!data.engagement.views || !data.engagement.likes || true) { // Always run to get trends

                console.log("⚠️ Content - DOM search for metrics & trends...");

                const metricCards = querySelectorAllDeep('ytcp-key-metric-card');

                metricCards.forEach(card => {

                    const label = card.innerText.toLowerCase();

                    const valueEl = card.querySelector('.metric-value-big') || card.querySelector('#metric-value');

                    let trendLabel = card.querySelector('ytcp-trend-label');

                    if (!trendLabel && card.shadowRoot) {

                        trendLabel = card.shadowRoot.querySelector('ytcp-trend-label');

                    }



                    let trendText = '';

                    let direction = 'flat';

                    if (trendLabel) {

                        trendText = trendLabel.innerText.trim().replace(/\s+/g, ' ');

                        const icon = trendLabel.querySelector('iron-icon');

                        if (icon) {

                            const iconAttr = icon.getAttribute('icon') || '';

                            if (iconAttr.includes('up') || iconAttr.includes('arrow-drop-up')) direction = 'up';

                            if (iconAttr.includes('down') || iconAttr.includes('arrow-drop-down')) direction = 'down';

                        }

                    }



                    if (valueEl) {

                        const val = valueEl.innerText.trim();

                        if (!data.engagement) data.engagement = {}; // 🛡️ SAFETY: Ensure engagement exists

                        // Use strict checks to distinguish "Views" from "Engaged Views"

                        if (label.includes('views') && !label.includes('engaged')) {

                            if (!data.engagement.views) data.engagement.views = val;

                            data.engagement.viewsTrend = trendText;

                            data.engagement.viewsDirection = direction;

                        }

                        if (label.includes('engaged views')) {

                            if (!data.engagement.engagedViews) data.engagement.engagedViews = val;

                            data.engagement.engagedViewsTrend = trendText;

                            data.engagement.engagedViewsDirection = direction;

                        }

                        if (label.includes('likes')) {

                            if (!data.engagement.likes) data.engagement.likes = val;

                            data.engagement.likesTrend = trendText;

                            data.engagement.likesDirection = direction;

                        }

                        if (label.includes('subscribers')) {

                            if (!data.engagement.subscribers) data.engagement.subscribers = val;

                            data.engagement.subscribersTrend = trendText;

                            data.engagement.subscribersDirection = direction;

                        }

                    }

                });

            }



            // NEW: Traffic Sources (How viewers find your Shorts) - DOM Based

            data.trafficSources = [];

            try {

                // Try multiple selector patterns for the traffic card

                const sectionCards = querySelectorAllDeep('ytcp-analytics-section-card, yta-analytics-section-card, div[class*="section-card"]');

                let trafficCard = null;

                for (const card of sectionCards) {

                    const cardText = card.innerText || '';

                    if (cardText.includes('How viewers find your Shorts') ||

                        cardText.includes('How viewers find your videos') ||

                        cardText.includes('Traffic source types')) {

                        trafficCard = card;

                        console.log('📊 Found traffic sources card');

                        break;

                    }

                }



                if (trafficCard) {

                    // Extract text lines and parse them, scoped to this card

                    const cardText = trafficCard.innerText;

                    const lines = cardText.split('\n').map(l => l.trim()).filter(l => l);



                    // Iterate and look for "Name" followed by "Percentage"

                    // Structure often: Name, Bar, Percentage (or Name, Percentage)

                    for (let i = 0; i < lines.length - 1; i++) {

                        const line = lines[i];

                        const nextLine = lines[i + 1];



                        // Check if next line is a percentage

                        if (nextLine.match(/^[\d.]+%$/)) {

                            // Found a percentage. The previous line is likely the name.

                            // Filter out headers and common noise

                            if (!line.includes('How viewers') &&

                                !line.includes('See more') &&

                                !line.includes('Overall') &&

                                !line.includes('Views') &&

                                line !== 'Lifetime' &&

                                line.length < 50 &&

                                line.length > 2) {



                                // Avoid duplicates

                                if (!data.trafficSources.some(s => s.name === line)) {

                                    data.trafficSources.push({ name: line, percent: nextLine });

                                    console.log(`📊 Traffic source: ${line} = ${nextLine}`);

                                }

                            }

                        }

                    }

                }



                // Fallback: Text-based extraction from mainContent

                if (data.trafficSources.length === 0) {

                    console.log('📊 Trying text-based traffic source extraction...');

                    // Known traffic source names

                    const knownSources = [

                        'Shorts feed', 'YouTube search', 'External', 'Suggested videos',

                        'Channel pages', 'Browse features', 'Other YouTube features',

                        'Playlists', 'Direct or unknown', 'Notifications'

                    ];



                    for (const source of knownSources) {

                        // Pattern: "Source Name\n95.6%" or "Source Name ... 95.6%"

                        const pattern = new RegExp(`${source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\n]+([\\d.]+%)`, 'i');

                        const match = mainContent.match(pattern);

                        if (match) {

                            data.trafficSources.push({ name: source, percent: match[1] });

                            console.log(`📊 Traffic source (text): ${source} = ${match[1]}`);

                        }

                    }

                }

            } catch (e) {

                console.warn("⚠️ Error scraping traffic sources via DOM:", e);

            }



            // If we found engagement data, create key moments from it

            if (Object.keys(data.engagement).length > 0) {

                data.retention.intro = "Engagement metrics found";

                if (data.engagement.views) data.keyMoments.push({ type: 'Views', time: data.engagement.views });

                if (data.engagement.engagedViews) data.keyMoments.push({ type: 'Engaged', time: data.engagement.engagedViews });

                if (data.engagement.likes) data.keyMoments.push({ type: 'Likes', time: data.engagement.likes });

                if (data.engagement.stayedToWatch) data.keyMoments.push({ type: 'Stayed', time: data.engagement.stayedToWatch });

                if (data.engagement.swipedAway) data.keyMoments.push({ type: 'Swiped', time: data.engagement.swipedAway });

            }



            // NEW: Traffic Sources (How viewers find you) - Fallback/Addition

            const trafficSourceBlock = mainContent.match(/How viewers find your (videos|Shorts)[\s\S]{1,500}/i) ||

                mainContent.match(/Traffic sources[\s\S]{1,500}/i);



            if (trafficSourceBlock) {

                const lines = trafficSourceBlock[0].split('\n');

                // Extract lines that look like "Source Name ... 45%"

                // Example: "Shorts Feed\n45%"

                let count = 0;

                for (let i = 0; i < lines.length - 1; i++) {

                    if (lines[i + 1].match(/[\d.]+%/) && count < 3) {

                        // Avoid duplicates if engagement metrics already added

                        if (!data.keyMoments.some(k => k.type === lines[i].trim())) {

                            data.keyMoments.push({ type: lines[i].trim(), time: lines[i + 1].trim() });

                            count++;

                        }

                    }

                }

                if (count > 0 && !data.retention.intro) {

                    data.retention.intro = "Traffic Sources";

                }

            }



            // NEW: How viewers engaged (Retention alternative)

            const engagedBlock = mainContent.match(/How viewers engaged[\s\S]{1,300}/i);

            if (engagedBlock) {

                const blockText = engagedBlock[0];

                // Find first percentage (Stayed to watch usually comes first)

                const percentMatch = blockText.match(/([\d.]+)%/);

                if (percentMatch) {

                    data.keyMoments.push({ type: 'Stayed', time: percentMatch[0] });

                }

            }



            // ===== Original Key Moments logic (fallback) =====

            if (data.keyMoments.length === 0) {

                const keyMomentsPatterns = [

                    /Key moments for audience retention[\s\S]{0,500}/i,

                    /Key moments[\s\S]{0,500}/i,

                    /Audience retention[\s\S]{0,500}/i,

                    /Most replayed[\s\S]{0,300}/i

                ];



                let keyMomentsSection = null;

                for (const pattern of keyMomentsPatterns) {

                    keyMomentsSection = mainContent.match(pattern);

                    if (keyMomentsSection) break;

                }



                if (keyMomentsSection) {

                    data.retention.intro = "Key moments data found";

                    const blockText = keyMomentsSection[0];



                    // Extract various moment types

                    const momentPatterns = [

                        { type: 'Intro', pattern: /Intro[\s\n]+(\d+:\d+)/i },

                        { type: 'Most replayed', pattern: /Most replayed[\s\n]+(\d+:\d+)/i },

                        { type: 'Peak', pattern: /Peak[\s\n]+(\d+:\d+)/i },

                        { type: 'Spike', pattern: /Spike[\s\n]+(\d+:\d+)/i }

                    ];



                    for (const { type, pattern } of momentPatterns) {

                        const match = blockText.match(pattern);

                        if (match) data.keyMoments.push({ type, time: match[1] });

                    }

                    console.log("📊 Found Key Moments:", data.keyMoments.length);

                } else {

                    console.log("⚠️ No Key Moments section found");

                }

            }



            // 2. Top videos - try multiple patterns

            const topContentPatterns = [

                /Your top content[\s\S]{0,2000}/i,

                /Top content[\s\S]{0,2000}/i,

                /Top videos[\s\S]{0,2000}/i,

                /Views[\s\S]{0,2000}/i

            ];



            let topContentSection = null;

            for (const pattern of topContentPatterns) {

                topContentSection = mainContent.match(pattern);

                if (topContentSection) break;

            }



            if (topContentSection) {

                const blockText = topContentSection[0];



                // Pattern 1: "Title\n123K views" or "Title\n123,456 views"

                const videoMatches1 = blockText.matchAll(/([^\n]{10,80})\n([\d,.]+[KMB]?)\s*views?/gi);

                for (const match of videoMatches1) {

                    const title = match[1].trim();

                    if (!title.match(/^(Top|Your|Content|See|Views|Watch|Hours|Subscribers|Dashboard)/i)) {

                        data.topVideos.push({ title: title.substring(0, 50), views: match[2] });

                    }

                }



                // Pattern 2: "Title\n123K" (views implied)

                if (data.topVideos.length === 0) {

                    const videoMatches2 = blockText.matchAll(/([^\n]{10,80})\n([\d,.]+[KMB])\n/gi);

                    for (const match of videoMatches2) {

                        const title = match[1].trim();

                        if (!title.match(/^(Top|Your|Content|See|Views|Watch)/i)) {

                            data.topVideos.push({ title: title.substring(0, 50), views: match[2] });

                        }

                    }

                }



                console.log("📊 Found Top Videos:", data.topVideos.length);

            }



            // Fallback: If nothing found, extract any metric-like text

            if (data.keyMoments.length === 0 && data.topVideos.length === 0) {

                // Look for any "label: value" or "value label" patterns

                const anyMetrics = mainContent.match(/([\d,.]+[KMB]?)\s+(views?|watch time|hours?|subscribers?)/gi);

                if (anyMetrics && anyMetrics.length > 0) {

                    data.retention.intro = `Found ${anyMetrics.length} metrics on page`;

                    data.keyMoments.push({ type: 'Summary', time: anyMetrics.slice(0, 3).join(', ') });

                }

            }



        } catch (e) {

            console.error("❌Error in scrapeContentTab:", e);

        }



        return { category: 'content', data };

    }



    async function scrapeAudienceTab() {

        console.log("📊 [Analytics Scraper] Scraping Audience Tab...");

        const data = {

            activeTimes: '',

            geographies: [],

            returningViewers: '',

            uniqueViewers: '',    // NEW: Unique Viewers

            regularViewers: '',   // NEW: Regular Viewers (< 0.1%)

            ageGender: '',

            rawSample: '',

            monthlyAudience: '',  // NEW

            newViewers: '',       // NEW

            casualViewers: '',    // NEW

            subscribers: '',      // NEW

            trends: {},           // NEW: Trends

            charts: {},           // NEW: Audience Charts

            dateLabels: [],       // 🎯 Date labels for X-axis

            dateRange: ''         // 🎯 Date range for this tab

        };



        try {

            // Use text-based extraction (same as Overview)

            const mainContent = getVisibleDeepText(document.body);

            console.log("📊 Audience page text length:", mainContent.length);



            // Debug: Save a sample for analysis

            data.rawSample = mainContent.substring(0, 1500);

            console.log("📊 Audience page sample:", data.rawSample);



            // 🎯 Extract Date Range for Audience tab

            const datePicker = document.querySelector('ytcp-date-picker');

            if (datePicker) {

                const text = datePicker.innerText;

                const rangeMatch = text.match(/[A-Z][a-z]{2,9}\s+\d{1,2}(?:,\s+\d{4})?\s*[–\-—]\s*[A-Z][a-z]{2,9}\s+\d{1,2},\s+\d{4}/);

                if (rangeMatch) data.dateRange = rangeMatch[0];

            }

            if (!data.dateRange) {

                const dateMatch = mainContent.match(/[A-Z][a-z]{2,9}\s+\d{1,2}(?:,\s+\d{4})?\s*[–\-—]\s*[A-Z][a-z]{2,9}\s+\d{1,2},\s+\d{4}/);

                if (dateMatch) data.dateRange = dateMatch[0];

            }

            if (data.dateRange) console.log("📅 [Audience] Found Date Range:", data.dateRange);



            // 🎯 IMPROVED: First try to extract from individual metric cards

            try {

                // 🎯 IMPROVED: Use deep selector to find cards in Shadow DOM (Added yta-key-metric-block)

                const metricCards = querySelectorAllDeep('yta-key-metric-card, ytcp-key-metric-card, .metric-card, yta-key-metric-block');

                console.log(`📊 Audience - Found ${metricCards.length} metric cards`);



                metricCards.forEach((card, index) => {

                    let cardText = '';



                    // Try shadowRoot first

                    if (card.shadowRoot) {

                        cardText = card.shadowRoot.textContent || '';

                    }

                    // Fallback to innerText

                    if (!cardText || cardText.length < 5) {

                        cardText = card.innerText || card.textContent || '';

                    }



                    console.log(`📊 Audience Card ${index}: "${cardText.substring(0, 100)}..."`);



                    const cardLower = cardText.toLowerCase();



                    // Extract value (number with K/M/B suffix or percentage)

                    const valueMatch = cardText.match(/([0-9,.]+[KMB]?(?:K|M|B)?)/i);

                    let value = valueMatch ? valueMatch[1] : null;



                    if (value) {

                        let metricKey = null;

                        if (cardLower.includes('monthly') && cardLower.includes('audience')) metricKey = 'monthlyAudience';

                        else if (cardLower.includes('returning') && cardLower.includes('viewer')) metricKey = 'returningViewers';

                        else if (cardLower.includes('unique') && cardLower.includes('viewer')) metricKey = 'uniqueViewers';

                        else if (cardLower.includes('subscriber')) metricKey = 'subscribers';



                        if (metricKey) {

                            // Special handling for subscribers value (+/-)

                            if (metricKey === 'subscribers') {

                                const subsValueMatch = cardText.match(/([+\-]?[0-9,.]+[KMB]?)/);

                                if (subsValueMatch) value = subsValueMatch[1];

                            }



                            data[metricKey] = value;

                            console.log(`📊 Audience Card - Found ${metricKey}:`, value);



                            // Extract Trend - improved pattern matching

                            const lines = cardText.split('\n').map(l => l.trim()).filter(l => l);

                            // Match more trend patterns: "X% more/less", "increase/decrease", "+X%/-X%"

                            const trendLine = lines.find(l =>

                                l.includes('more than') ||

                                l.includes('less than') ||

                                l.includes('increase') ||

                                l.includes('decrease') ||

                                l.match(/^\d+%\s*(more|less|up|down)/i) ||

                                l.match(/^[+-]?\d+(\.\d+)?%$/i)

                            );

                            let trendDirection = 'flat';

                            if (trendLine) {

                                if (trendLine.includes('more') || trendLine.includes('increase') || trendLine.includes('up') || trendLine.startsWith('+')) {

                                    trendDirection = 'up';

                                }

                                if (trendLine.includes('less') || trendLine.includes('decrease') || trendLine.includes('down') || (trendLine.startsWith('-') && !trendLine.startsWith('--'))) {

                                    trendDirection = 'down';

                                }

                            }



                            // 🎯 Special case: Infer direction from value prefix for subscribers

                            if (!trendLine && metricKey === 'subscribers' && value) {

                                if (value.startsWith('+')) {

                                    trendDirection = 'up';

                                    data[`${metricKey}Trend`] = `${value} new subscribers`;

                                    data[`${metricKey}Direction`] = trendDirection;

                                    data.trends[metricKey] = { text: `${value} new subscribers`, direction: trendDirection };

                                } else if (value.startsWith('-')) {

                                    trendDirection = 'down';

                                    data[`${metricKey}Trend`] = `${value} subscribers`;

                                    data[`${metricKey}Direction`] = trendDirection;

                                    data.trends[metricKey] = { text: `${value} subscribers`, direction: trendDirection };

                                }

                            } else {

                                // Store directly in data object (flat) for React compatibility

                                data[`${metricKey}Trend`] = trendLine || '';

                                data[`${metricKey}Direction`] = trendDirection;

                                data.trends[metricKey] = { text: trendLine || '', direction: trendDirection };

                            }

                        }

                    }

                });

            } catch (cardError) {

                console.warn("⚠️ Audience card extraction error:", cardError);

            }



            // ===== FALLBACK: Text-based extraction if cards didn't work =====



            // Monthly audience (e.g., "Monthly audience 105.3K" or "112.3K\nMonthly audience")

            if (!data.monthlyAudience) {

                const monthlyMatch = mainContent.match(/Monthly audience[\s\n]+([0-9,.]+[KMB]?)/i) ||

                    mainContent.match(/([0-9,.]+[KMB]?)[\s\n]+Monthly audience/i);

                if (monthlyMatch) {

                    data.monthlyAudience = monthlyMatch[1];

                    data.activeTimes = `Monthly audience: ${monthlyMatch[1]}`;

                    console.log("📊 Audience Text - Found Monthly Audience:", data.monthlyAudience);

                }

            }



            // Subscribers on Audience tab (supports +107 format)

            if (!data.subscribers) {

                const subsMatch = mainContent.match(/Subscribers[\s\n]+([+\-]?[0-9,.]+[KMB]?)/i) ||

                    mainContent.match(/([+\-]?[0-9,.]+[KMB]?)[\s\n]+Subscribers/i);

                if (subsMatch) {

                    data.subscribers = subsMatch[1];

                    console.log("📊 Audience Text - Found Subscribers:", data.subscribers);

                }

            }



            // Regular viewers (supports "< 0.1%" format)

            if (!data.regularViewers) {

                const regularMatch = mainContent.match(/Regular viewers[\s\S]{0,30}([<>]?\s?[0-9.]+%)/i) ||

                    mainContent.match(/([<>]?\s?[0-9.]+%)\s*Regular viewers/i);

                if (regularMatch) {

                    data.regularViewers = regularMatch[1].trim();

                    console.log("📊 Audience Text - Found Regular Viewers:", data.regularViewers);

                }

            }



            // New viewers (Enhanced to handle "Audience by watch behavior" section)

            if (!data.newViewers) {

                // CONFIRMED WORKING PATTERN from console test: /New viewers[^\n]*\n[^\n]*(\d{1,3}\.\d%)/i

                const patterns = [


                    /(\d{1,3}(?:\.\d+)?%)[\s\n]+New viewers/i,         // "98.3% New viewers"

                    /Watched your channel for the first time[\s\S]{0,100}?(\d{1,3}(?:\.\d+)?%)/i, // "Watched your channel for the first time ... 98.3%"

                    /New viewers[^\d]*(\d{1,3}(?:\.\d+)?%)/i,          // "New viewers (i) 98.3%" with any non-digit chars


                ];



                for (const pattern of patterns) {

                    const match = mainContent.match(pattern);

                    if (match && match[1]) {

                        // FILTER: Exclude matches from "How many new viewers did I reach?" prompt

                        if (match[0].toLowerCase().includes('how many') || match[0].toLowerCase().includes('did i reach')) {

                            console.log("📊 Audience - Skipping prompt text match");

                            continue;

                        }

                        data.newViewers = match[1];

                        console.log("📊 Audience Text - Found New Viewers:", data.newViewers, "via pattern:", pattern.source.substring(0, 40));

                        break;

                    }

                }



                // Fallback: Look for "New viewers" section in DOM

                if (!data.newViewers) {

                    try {

                        const allElements = document.querySelectorAll('*');

                        for (const el of allElements) {

                            const text = el.innerText || '';

                            if (text.includes('New viewers') && text.length < 200 && !text.includes('How many')) {

                                const percentMatch = text.match(/(\d{1,3}(?:\.\d+)?%)/);

                                if (percentMatch) {

                                    data.newViewers = percentMatch[1];

                                    console.log("📊 Audience DOM - Found New Viewers:", data.newViewers);

                                    break;

                                }

                            }

                        }

                    } catch (e) {

                        console.warn("⚠️ New viewers DOM search failed:", e);

                    }

                }

            }



            // Casual viewers

            if (!data.casualViewers) {

                const casualMatch = mainContent.match(/Casual viewers[\s\S]{0,30}?(\d{1,3}(?:\.\d+)?%)/i) ||

                    mainContent.match(/([0-9.]+%)[\s\n]+Casual viewers/i);

                if (casualMatch) {

                    data.casualViewers = casualMatch[1];

                    console.log("📊 Audience Text - Found Casual Viewers:", data.casualViewers);

                }

            }



            // NEW: Top Geographies scraping

            try {

                // Find the geographies section

                const sectionCards = querySelectorAllDeep('ytcp-analytics-section-card, yta-analytics-section-card, div[class*="section-card"]');

                let geoCard = null;

                for (const card of sectionCards) {

                    const cardText = card.innerText || '';

                    if (cardText.includes('Top geographies') ||

                        cardText.includes('Top countries') ||

                        cardText.includes('Geography')) {

                        geoCard = card;

                        console.log('📊 Found geographies card');

                        break;

                    }

                }



                if (geoCard) {

                    const cardText = geoCard.innerText;

                    const lines = cardText.split('\n').map(l => l.trim()).filter(l => l);



                    for (let i = 0; i < lines.length - 1; i++) {

                        const line = lines[i];

                        const nextLine = lines[i + 1];



                        // Check if next line is a percentage

                        if (nextLine.match(/^[\d.]+%$/)) {

                            // Filter out headers

                            if (!line.includes('Top') &&

                                !line.includes('Geography') &&

                                !line.includes('See more') &&

                                !line.includes('Views') &&

                                line !== 'Lifetime' &&

                                line.length < 50 &&

                                line.length > 1) {



                                if (!data.geographies.some(g => g.country === line)) {

                                    data.geographies.push({ country: line, percent: nextLine });

                                    console.log(`📊 Geography: ${line} = ${nextLine}`);

                                }

                            }

                        }

                    }

                }



                // Fallback: Text-based extraction

                if (data.geographies.length === 0) {

                    console.log('📊 Trying text-based geography extraction...');

                    // Common country names

                    const knownCountries = [

                        'United States', 'India', 'Brazil', 'Indonesia', 'Mexico',

                        'Philippines', 'Vietnam', 'Thailand', 'United Kingdom', 'Germany',

                        'France', 'Japan', 'Canada', 'Australia', 'Russia'

                    ];



                    for (const country of knownCountries) {

                        const pattern = new RegExp(`${country}[\\s\\n]+([\\d.]+%)`, 'i');

                        const match = mainContent.match(pattern);

                        if (match && data.geographies.length < 5) {

                            data.geographies.push({ country: country, percent: match[1] });

                            console.log(`📊 Geography (text): ${country} = ${match[1]}`);

                        }

                    }

                }

            } catch (e) {

                console.warn("⚠️ Error scraping geographies:", e);

            }





            // --- CHART SCRAPING (Audience Tab) ---

            try {

                const sleep = (ms) => new Promise(r => setTimeout(r, ms));



                // Reuse scrapeActiveChart helper (now global)



                const cards = findMetricCards();

                if (cards.length > 0) {

                    // Map cards to metrics based on text content

                    const cardMap = {};

                    cards.forEach(card => {

                        const text = card.innerText.toLowerCase();

                        if (text.includes('returning')) cardMap['returning'] = card;

                        else if (text.includes('unique')) cardMap['unique'] = card;

                        else if (text.includes('subscribers')) cardMap['subscribers'] = card;

                        else if (text.includes('monthly')) cardMap['monthlyAudience'] = card;

                    });



                    const scrapeMetric = async (metricKey, card) => {

                        if (card) {


                            card.click();

                            await sleep(1500);

                            let chart = scrapeActiveChart();

                            if (!chart || !chart.path) {

                                // console.log(`⚠️ Audience - Chart not ready for ${metricKey}, retrying...`);

                                await sleep(1500);

                                chart = scrapeActiveChart();

                            }

                            data.charts[metricKey] = chart;

                        }

                    };



                    // Scrape available metrics

                    await scrapeMetric('returning', cardMap['returning']);

                    await scrapeMetric('unique', cardMap['unique']);

                    await scrapeMetric('subscribers', cardMap['subscribers']);

                    await scrapeMetric('monthlyAudience', cardMap['monthlyAudience']);



                    // 🎯 Extract dateLabels from the first chart that has them

                    for (const key of ['returning', 'unique', 'subscribers', 'monthlyAudience']) {

                        if (data.charts[key] && data.charts[key].dateLabels && data.charts[key].dateLabels.length > 0) {

                            data.dateLabels = data.charts[key].dateLabels;

                            console.log(`📊 Audience - Extracted dateLabels from ${key}:`, data.dateLabels.length);

                            break;

                        }

                    }



                    // Restore first available

                    if (cards[0]) cards[0].click();

                }

            } catch (e) {

                console.warn("⚠️ Error scraping audience charts:", e);

            }



            // New viewers percentage

            const newViewersMatch = mainContent.match(/New viewers[\s\S]{0,20}([<>]?\s?[\d.]+%)/i) ||

                mainContent.match(/([<>]?\s?[\d.]+%)\s*New viewers/i);

            if (newViewersMatch) {

                data.newViewers = newViewersMatch[1];

                console.log("📊 Audience - Found New Viewers:", data.newViewers);

            }



            // Casual viewers percentage

            const casualMatch = mainContent.match(/Casual viewers[\s\S]{0,20}([<>]?\s?[\d.]+%)/i) ||

                mainContent.match(/([<>]?\s?[\d.]+%)\s*Casual viewers/i);

            if (casualMatch) {

                data.casualViewers = casualMatch[1];

                console.log("📊 Audience - Found Casual Viewers:", data.casualViewers);

            }



            // NEW: Audience by watch behavior (Block match)

            const behaviorBlock = mainContent.match(/Audience by watch behavior[\s\S]{1,500}/i);

            if (behaviorBlock) {

                const lines = behaviorBlock[0].split('\n');

                for (let i = 0; i < lines.length - 1; i++) {

                    if (lines[i].includes('New viewers') && lines[i + 1].match(/[<>]?\s?[\d.]+/)) {

                        data.newViewers = lines[i + 1].trim();

                    }

                    if (lines[i].includes('Casual viewers') && lines[i + 1].match(/[<>]?\s?[\d.]+/)) {

                        data.casualViewers = lines[i + 1].trim();

                    }

                    if (lines[i].includes('Regular viewers') && lines[i + 1].match(/[<>]?\s?[\d.]+/)) {

                        data.regularViewers = lines[i + 1].trim();

                    }

                }

            }



            // Build geographies from audience data if found

            if (data.monthlyAudience || data.newViewers || data.subscribers) {

                if (data.monthlyAudience) data.geographies.push({ country: 'Monthly Audience', percent: data.monthlyAudience });

                if (data.subscribers) data.geographies.push({ country: 'Subscribers', percent: data.subscribers });

                if (data.newViewers) data.geographies.push({ country: 'New Viewers', percent: data.newViewers });

                if (data.casualViewers) data.geographies.push({ country: 'Casual Viewers', percent: data.casualViewers });

            }



            // 🎯 Age and Gender Extraction (Targeted DOM)

            try {

                // Found tag: yta-card-with-chips

                // Try querySelectorAllDeep first, then native querySelectorAll as fallback

                let agCard = querySelectorAllDeep('yta-card-with-chips').find(card =>

                    (card.innerText || '').includes('Age and gender')

                );



                // Fallback to native querySelectorAll

                if (!agCard) {

                    agCard = Array.from(document.querySelectorAll('yta-card-with-chips')).find(card =>

                        (card.innerText || '').includes('Age and gender')

                    );

                    if (agCard) console.log("📊 Age/Gender - Found via native querySelectorAll");

                }



                if (agCard) {

                    const text = agCard.innerText;

                    console.log("📊 Audience - Found Age/Gender Card (yta-card-with-chips)");



                    // Parse text from the specific card

                    const lines = text.split('\n').map(l => l.trim()).filter(l => l);

                    const ageBuckets = [];

                    let gender = { male: '', female: '', userSpecified: '' };



                    console.log("📊 Age/Gender - Parsing", lines.length, "lines");

                    console.log("📊 Age/Gender - Sample lines:", lines.slice(0, 15));



                    for (let i = 0; i < lines.length; i++) {

                        const line = lines[i];

                        const lineLower = line.toLowerCase();



                        // NEW FORMAT: "Female 0.0%" or "Male 68.9%" (same line)

                        const maleMatch = line.match(/^Male\s+([\d.]+%)/i);

                        if (maleMatch) {

                            gender.male = maleMatch[1];

                            console.log("📊 Found Male (same line):", gender.male);

                        }



                        const femaleMatch = line.match(/^Female\s+([\d.]+%)/i);

                        if (femaleMatch) {

                            gender.female = femaleMatch[1];

                            console.log("📊 Found Female (same line):", gender.female);

                        }



                        const userSpecMatch = line.match(/^User[- ]?specified\s+([\d.]+%)/i);

                        if (userSpecMatch) {

                            gender.userSpecified = userSpecMatch[1];

                            console.log("📊 Found User-specified (same line):", gender.userSpecified);

                        }



                        // Age Buckets - NEW FORMAT: "13-17 years 8%" or "65+ years 14.5%" (same line)


                        const ageRangeMatch = line.match(/^(\d+[–\-—]\d+)\s*years?\s+([\d.]+%)/i);

                        if (ageRangeMatch) {

                            ageBuckets.push({ range: ageRangeMatch[1], percent: ageRangeMatch[2] });

                            console.log("📊 Found Age Range (same line):", ageRangeMatch[1], "=", ageRangeMatch[2]);

                        }



                        const agePlusMatch = line.match(/^(\d+\+)\s*years?\s+([\d.]+%)/i);

                        if (agePlusMatch) {

                            ageBuckets.push({ range: agePlusMatch[1], percent: agePlusMatch[2] });

                            console.log("📊 Found Age Range (same line):", agePlusMatch[1], "=", agePlusMatch[2]);

                        }



                        // FALLBACK: Old format where percentage is on next line

                        if (i < lines.length - 1) {

                            const nextLine = lines[i + 1];



                            // Gender - check if next line is a percentage

                            if (lineLower === 'female' && nextLine.match(/^[\d.]+%$/)) {

                                gender.female = nextLine;

                                console.log("📊 Found Female (next line):", nextLine);

                            }

                            if (lineLower === 'male' && nextLine.match(/^[\d.]+%$/)) {

                                gender.male = nextLine;

                                console.log("📊 Found Male (next line):", nextLine);

                            }

                            if (lineLower === 'user-specified' && nextLine.match(/^[\d.]+%$/)) {

                                gender.userSpecified = nextLine;

                            }



                            // Age Buckets - Old format

                            if (line.match(/^\d+[–\-—]\d+\s*years?$/i) && nextLine.match(/^[\d.]+%$/)) {

                                ageBuckets.push({ range: line.replace(/\s*years?$/i, ''), percent: nextLine });

                                console.log("📊 Found Age Range (next line):", line, "=", nextLine);

                            }

                            if (line.match(/^\d+\+\s*years?$/i) && nextLine.match(/^[\d.]+%$/)) {

                                ageBuckets.push({ range: line.replace(/\s*years?$/i, ''), percent: nextLine });

                                console.log("📊 Found Age Range (next line):", line, "=", nextLine);

                            }

                        }

                    }



                    if (ageBuckets.length > 0 || gender.male || gender.female) {

                        data.ageGender = { ages: ageBuckets, gender };

                        console.log("📊 Audience - Extracted Age/Gender:", data.ageGender);

                    } else {

                        console.warn("⚠️ Age/Gender card found but no data parsed. Lines sample:", lines.slice(0, 10));

                    }

                } else {

                    // Fallback to line-by-line if card not found

                    console.log("⚠️ Age/Gender card not found, trying line-by-line fallback");

                    const lines = mainContent.split('\n').map(l => l.trim()).filter(l => l);

                    const agIndex = lines.findIndex(l => l.includes('Age and gender'));

                    if (agIndex !== -1) {

                        // ... (existing line-by-line logic can remain as backup)

                    }

                }

            } catch (e) {

                console.warn("⚠️ Error scraping Age/Gender:", e);

            }



            // 🎯 Watch time from subscribers (Targeted DOM)

            try {

                // Found tag: yta-table-card

                const wsCard = querySelectorAllDeep('yta-table-card').find(card =>

                    (card.innerText || '').includes('Watch time from subscribers')

                );



                if (wsCard) {

                    console.log("📊 Audience - Found Watch Time Card (yta-table-card)");

                    const text = wsCard.innerText;

                    const notSubscribedMatch = text.match(/Not subscribed[\s\n]+([\d.]+%)/i);

                    // Fix: Use specific regex to avoid "Not subscribed" matching "Subscribed"

                    const subscribedMatch = text.match(/(?<!Not\s)Subscribed[\s\n]+([\d.]+%)/i) ||

                        text.match(/^Subscribed[\s\n]+([\d.]+%)/m);



                    if (notSubscribedMatch || subscribedMatch) {

                        data.subscriberWatchTime = {

                            notSubscribed: notSubscribedMatch ? notSubscribedMatch[1] : '',

                            subscribed: subscribedMatch ? subscribedMatch[1] : ''

                        };

                        console.log("📊 Audience - Extracted Subscriber Watch Time:", data.subscriberWatchTime);

                    }

                }

            } catch (e) {

                console.warn("⚠️ Error scraping Subscriber Watch Time:", e);

            }



            // 🎯 Videos growing your audience (Targeted DOM)

            try {

                const growingCard = querySelectorAllDeep('yta-table-card').find(card =>

                    (card.innerText || '').includes('Videos growing your audience')

                );



                if (growingCard) {

                    console.log("📊 Audience - Found Videos growing your audience Card");

                    const text = growingCard.innerText;

                    // Parse text. Usually:

                    // Videos growing your audience

                    // Views

                    // Video Title 1

                    // 1.2K

                    // ...

                    const lines = text.split('\n').map(l => l.trim()).filter(l => l);

                    const videos = [];



                    // Heuristic: Find lines that look like titles (long) followed by lines that look like numbers (short, digits)

                    for (let i = 0; i < lines.length - 1; i++) {

                        const line = lines[i];

                        const nextLine = lines[i + 1];

                        // If line is long enough to be a title and next line is a number

                        if (line.length > 10 && nextLine.match(/^[\d,.]+[KMB]?$/)) {

                            videos.push({ title: line, views: nextLine });

                        }

                    }



                    if (videos.length > 0) {

                        data.videosGrowingAudience = videos.slice(0, 5); // Top 5

                        console.log("📊 Audience - Extracted Growing Videos:", data.videosGrowingAudience);

                    }

                }

            } catch (e) {

                console.warn("⚠️ Error scraping Videos growing your audience:", e);

            }



            // 🎯 Active Times Heatmap (Targeted DOM)

            try {

                const atCard = querySelectorAllDeep('yta-audience-online-card')[0];

                if (atCard) {

                    console.log("📊 Audience - Found Active Times Card (yta-audience-online-card)");



                    const text = atCard.innerText;

                    const lines = text.split('\n').map(l => l.trim()).filter(l => l);

                    const timeLine = lines.find(l => l.includes('Your local time') || l.includes('GMT'));



                    // Extract heatmap cell colors

                    const allDivs = atCard.querySelectorAll('div');

                    const heatmapCells = [];



                    allDivs.forEach(div => {

                        const bg = getComputedStyle(div).backgroundColor;

                        if (bg && bg.includes('rgb')) {

                            const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);

                            if (match) {

                                const r = parseInt(match[1]);

                                const g = parseInt(match[2]);

                                const b = parseInt(match[3]);

                                const a = match[4] ? parseFloat(match[4]) : 1;



                                // Purple heatmap colors: higher blue than green, red around 145

                                if (b > g && r > 100 && r < 200 && b > 150) {

                                    heatmapCells.push({ r, g, b, a, intensity: a });

                                }

                            }

                        }

                    });



                    console.log("📊 Audience - Heatmap cells found:", heatmapCells.length);




                    if (heatmapCells.length >= 100) {

                        // Organize into grid: rows are hours (24), columns are days (7)

                        const heatmapGrid = [];

                        const cellsPerDay = Math.floor(heatmapCells.length / 7);



                        for (let hour = 0; hour < cellsPerDay; hour++) {

                            const row = [];

                            for (let day = 0; day < 7; day++) {

                                const idx = day * cellsPerDay + hour;

                                if (idx < heatmapCells.length) {

                                    row.push(heatmapCells[idx].intensity);

                                } else {

                                    row.push(0);

                                }

                            }

                            heatmapGrid.push(row);

                        }



                        data.activeTimesHeatmap = {

                            grid: heatmapGrid,

                            days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],

                            hours: cellsPerDay,

                            timezone: timeLine || 'Local time'

                        };

                        data.activeTimes = timeLine || "Heatmap data available";

                        console.log("📊 Audience - Heatmap grid:", heatmapGrid.length, "rows x", heatmapGrid[0]?.length, "cols");

                    } else {

                        // Fallback to text-only

                        data.activeTimes = timeLine ? timeLine + " (Chart available in Studio)" : "Activity data available";

                    }

                }

            } catch (e) {

                console.warn("⚠️ Error scraping Active Times Heatmap:", e);

            }



            // ===== Original patterns (fallback) =====



            // 1. When viewers are on YouTube

            if (!data.activeTimes) {

                const viewerPatterns = [

                    /When your viewers are on YouTube[\s\S]{0,300}/i,

                    /Your viewers[\s\S]{0,300}/i,

                    /Unique viewers[\s\S]{0,200}/i

                ];



                for (const pattern of viewerPatterns) {

                    const match = mainContent.match(pattern);

                    if (match) {

                        data.activeTimes = "Audience activity data found";

                        console.log("📊 Found Audience Activity section");

                        break;

                    }

                }

            }



            // 2. Returning viewers

            const returningMatch = mainContent.match(/Returning viewers[\s\n]+([\d,.]+[KMB]?)/i) ||

                mainContent.match(/([\d,.]+[KMB]?)[\s\n]+Returning viewers/i);

            if (returningMatch) {

                data.returningViewers = returningMatch[1];

                console.log("📊 Found Returning Viewers:", data.returningViewers);

            }



            // 2.5 Unique viewers

            const uniqueMatch = mainContent.match(/Unique viewers[\s\n]+([\d,.]+[KMB]?)/i) ||

                mainContent.match(/([\d,.]+[KMB]?)[\s\n]+Unique viewers/i);

            if (uniqueMatch) {

                data.uniqueViewers = uniqueMatch[1];

                console.log("📊 Found Unique Viewers:", data.uniqueViewers);

            }





            // 3. Age and gender (FALLBACK - only if not already extracted by targeted DOM)

            if (!data.ageGender || data.ageGender === '') {

                const agePatterns = [

                    /Age and gender[\s\S]{0,500}/i,

                    /(\d+-\d+)[\s\n]+(\d+\.?\d*%)/g

                ];

                const ageMatch = mainContent.match(agePatterns[0]);

                if (ageMatch) {

                    data.ageGender = "Age/gender data available";

                    console.log("📊 Found Age/Gender section (fallback text match)");

                }

            } else {

                console.log("📊 Age/Gender already extracted via targeted DOM, skipping fallback");

            }



            // 4. Top Geographies - multiple search patterns

            const geoPatterns = [

                /Top geographies[\s\S]{0,800}/i,

                /Geography[\s\S]{0,800}/i,

                /Countries[\s\S]{0,800}/i,

                /Top countries[\s\S]{0,800}/i

            ];



            let geoSection = null;

            for (const pattern of geoPatterns) {

                geoSection = mainContent.match(pattern);

                if (geoSection) break;

            }



            if (geoSection) {

                const blockText = geoSection[0];



                // Extended country list

                const countries = [

                    'United States', 'India', 'United Kingdom', 'Canada', 'Australia',

                    'Germany', 'Brazil', 'Philippines', 'Indonesia', 'Mexico',

                    'France', 'Japan', 'Russia', 'South Korea', 'Spain',

                    'Italy', 'Turkey', 'Netherlands', 'Poland', 'Vietnam',

                    'Thailand', 'Malaysia', 'Singapore', 'Pakistan', 'Bangladesh'

                ];



                for (const country of countries) {

                    // Pattern: "Country Name 45.2%" or "Country Name\n45.2%"

                    const regex = new RegExp(country + '[\\s\\n]+([\\d.]+%)', 'i');

                    const match = blockText.match(regex);

                    if (match) {

                        data.geographies.push({ country, percent: match[1] });

                    }

                }



                // Fallback: Any "Word Word 12.3%" pattern

                if (data.geographies.length === 0) {

                    const fallbackMatches = blockText.matchAll(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)[\s\n]+([\d.]+%)/g);

                    for (const match of fallbackMatches) {

                        const name = match[1];

                        if (!name.match(/^(Top|See|Your|Views|Watch|Subscribers|New|Returning)/i)) {

                            data.geographies.push({ country: name, percent: match[2] });

                        }

                    }

                }



                console.log("📊 Found Geographies:", data.geographies.length);

            } else {

                console.log("⚠️ No Geography section found");

            }



            // FALLBACK: If geographies is still empty, use Age/Gender data

            if (data.geographies.length === 0) {

                const ageGenderBlock = mainContent.match(/Age and gender[\s\S]{1,500}/i);

                if (ageGenderBlock) {

                    const lines = ageGenderBlock[0].split('\n');

                    let count = 0;

                    for (let i = 0; i < lines.length - 1; i++) {

                        // Look for "Male ... 45%" or "18-24 ... 30%"

                        if (lines[i + 1].match(/[\d.]+%/) && count < 3) {

                            data.geographies.push({ country: lines[i].trim(), percent: lines[i + 1].trim() });

                            count++;

                        }

                    }

                    if (count > 0) console.log("📊 Audience - Using Age/Gender as fallback:", data.geographies);

                }

            }



            // Fallback: If no geography found, look for any audience-related numbers

            if (data.geographies.length === 0 && !data.activeTimes && !data.returningViewers) {

                // Look for viewer counts, subscriber counts, etc.

                const viewerMetrics = mainContent.match(/([\d,.]+[KMB]?)\s*(viewers?|subscribers?|unique|returning|new)/gi);

                if (viewerMetrics && viewerMetrics.length > 0) {

                    data.activeTimes = `Found ${viewerMetrics.length} audience metrics`;

                    // Extract first few as geography stand-in

                    viewerMetrics.slice(0, 3).forEach((m, i) => {

                        data.geographies.push({ country: `Metric ${i + 1}`, percent: m });

                    });

                }

            }



        } catch (e) {

            console.error("❌Error in scrapeAudienceTab:", e);

        }



        // Fallback: Generic Metric Grabber (Last Resort)

        if (!data.monthlyAudience && !data.subscribers && data.geographies.length === 0) {

            const bigNumbers = Array.from(document.querySelectorAll('.metric-value-big, .ytcp-analytics-metric-value, .total-value')).map(el => el.innerText);

            if (bigNumbers.length > 0) {

                data.genericMetrics = bigNumbers;

                // Assign to monthlyAudience as a fallback so hasData becomes true

                data.monthlyAudience = bigNumbers[0];

                console.log("📊 Audience - Found generic metrics (fallback):", bigNumbers);

            }

        }



        return { category: 'audience', data };

    }



    async function ensureTimeRange(explicitTimeRange = null) {

        // --- TIME RANGE SELECTION ---

        try {

            const urlParams = new URLSearchParams(window.location.search);

            const hashParams = new URLSearchParams(window.location.hash.substring(1));

            let requestedTimeRange = explicitTimeRange || window._targetTimeRange || urlParams.get('time_range') || hashParams.get('time_range');



            // Check window.name (Persists across redirects!)

            if (!requestedTimeRange) {

                try {

                    console.log("⏱️ [Content Script] Raw window.name:", window.name);

                    const config = JSON.parse(window.name);

                    if (config && config.timeRange) {

                        requestedTimeRange = config.timeRange;

                        console.log("⏱️ [Content Script] Found time range in window.name:", requestedTimeRange);

                    }

                } catch (e) { /* Not JSON or empty */ }

            }



            // Check chrome.storage (Robust fallback)

            if (!requestedTimeRange && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {

                try {

                    const stored = await new Promise(resolve => chrome.storage.local.get('analyticsTimeRange', resolve));

                    if (stored && stored.analyticsTimeRange) {

                        requestedTimeRange = stored.analyticsTimeRange;

                        console.log("⏱️ [Content Script] Using stored time range:", requestedTimeRange);

                    }

                } catch (e) { console.warn("⚠️ Storage check failed:", e); }

            }



            // Support period-X path segments

            if (!requestedTimeRange) {

                const match = window.location.pathname.match(/\/period-([a-zA-Z0-9]+)/);

                if (match) {

                    requestedTimeRange = match[1];

                }

            }



            if (requestedTimeRange) {

                console.log(`⏱️ [ensureTimeRange] Requested: ${requestedTimeRange}`);



                const setTimeRange = async (range) => {




                    // Wait for page to be more stable before looking for triggers

                    await new Promise(r => setTimeout(r, 1500));



                    // Find all triggers (with retry)

                    let triggers = [];

                    // 🔧 FIX: Increase retries to 10 (20 seconds total) to handle slow loading

                    for (let attempt = 0; attempt < 10; attempt++) {

                        // Strategy 1: Find ALL dropdown triggers (both types at once)

                        // 🔧 FIX: ytcp-dropdown-trigger is used on Overview/Audience, ytcp-text-dropdown-trigger on Content

                        triggers = Array.from(document.querySelectorAll('ytcp-dropdown-trigger, ytcp-text-dropdown-trigger'));



                        // Strategy 1.5: Shadow DOM Search (Crucial for Polymer/Lit elements)

                        if (triggers.length === 0) {

                            const allElements = document.querySelectorAll('*');

                            for (const el of allElements) {

                                if (el.shadowRoot) {

                                    const shadowTriggers = el.shadowRoot.querySelectorAll('ytcp-dropdown-trigger, ytcp-text-dropdown-trigger');

                                    if (shadowTriggers.length > 0) {

                                        triggers = [...triggers, ...Array.from(shadowTriggers)];

                                    }

                                }

                            }

                        }



                        console.log(`📊 [setTimeRange] Attempt ${attempt + 1}/10: Found ${triggers.length} triggers`);



                        // Strategy 3: Deep search in header

                        if (triggers.length === 0) {

                            const header = document.querySelector('ytcp-header');

                            if (header) {

                                triggers = Array.from(header.querySelectorAll('ytcp-text-dropdown-trigger, ytcp-dropdown-trigger'));

                            }

                        }



                        // Strategy 4: 🎯 Date picker element (common on Audience/Content tabs)

                        if (triggers.length === 0) {

                            const datePicker = document.querySelector('ytcp-date-picker');

                            if (datePicker) {

                                const clickable = datePicker.querySelector('[role="button"], button, [tabindex="0"]');

                                if (clickable) triggers = [clickable];

                            }

                        }



                        // Strategy 5: 🎯 yta- prefixed elements (YouTube Studio alternate components)

                        if (triggers.length === 0) {

                            triggers = Array.from(document.querySelectorAll('yta-date-picker, yta-dropdown-trigger'));

                        }



                        // Strategy 6: 🎯 Generic clickable dropdown with date text

                        if (triggers.length === 0) {

                            const allClickables = document.querySelectorAll('[role="button"], [role="listbox"], [aria-haspopup="true"]');

                            triggers = Array.from(allClickables).filter(el => {

                                const text = el.innerText?.toLowerCase() || '';

                                return text.includes('lifetime') || text.includes('days') || text.includes('last') || /\d{4}/.test(text);

                            });

                        }



                        if (triggers.length > 0) break;

                        console.log(`⏰[setTimeRange] Waiting for triggers (attempt ${attempt + 1}/10)...`);

                        await new Promise(r => setTimeout(r, 2000)); // Wait 2 seconds

                    }




                    let trigger = null;



                    // Strategy 1: Look for the one with date-like text

                    for (const t of triggers) {

                        const text = t.innerText.toLowerCase();


                        if (text.includes('days') || text.includes('lifetime') || text.includes('since') || text.includes('202') || text.includes('last')) {

                            trigger = t;

                            console.log("✨[setTimeRange] Identified likely Time Range trigger:", text);

                            break;

                        }

                    }



                    // Fallback: Use the first one if only one exists (common in some views)

                    if (!trigger && triggers.length > 0) {

                        // If there are multiple, usually the date picker is the last one or the one on the right

                        // But let's try the first one for now as it's usually the main filter

                        trigger = triggers[0];

                        console.warn("⚠️ [setTimeRange] Specific trigger not found, using first available.");

                    }



                    if (!trigger) {

                        console.warn("⚠️ [setTimeRange] Time range trigger not found! (Triggers length: " + triggers.length + ")");

                        // 🔧 FIX: Don't fail immediately, try one last desperate search for ANY dropdown

                        const anyDropdown = document.querySelector('ytcp-text-dropdown-trigger');

                        if (anyDropdown) {

                            console.log("⚠️ [setTimeRange] Desperate fallback: Clicking generic dropdown");

                            trigger = anyDropdown;

                        } else {

                            return false;

                        }

                    }



                    // Check if already selected

                    const currentLabel = trigger.querySelector('.label-text')?.textContent?.trim();

                    if (currentLabel && currentLabel.toLowerCase() === range.toLowerCase()) {

                        console.log("✨Time range already matched:", currentLabel);

                        return false;

                    }




                    trigger.click();



                    // Wait for menu (Retry loop)

                    let menu = null;

                    for (let i = 0; i < 5; i++) {

                        await new Promise(r => setTimeout(r, 1000)); // Wait 1s

                        menu = document.querySelector('ytcp-text-menu');

                        if (menu) break;

                    }



                    if (menu) {

                        const items = menu.querySelectorAll('ytcp-ve');

                        for (const item of items) {

                            const text = item.textContent?.trim();

                            // Relaxed match for Lifetime

                            const isMatch = (range.toLowerCase() === 'lifetime')

                                ? text && text.toLowerCase().includes('lifetime')

                                : text && text.toLowerCase() === range.toLowerCase();



                            if (isMatch) {


                                item.click();

                                await new Promise(r => setTimeout(r, 2000)); // Wait for reload

                                return true;

                            }

                        }

                        console.warn(`⚠️ Time range option '${range}' not found`);

                        // Close menu if not found

                        document.body.click();

                        return false;

                    }

                    return false;

                };



                // Map internal values to UI labels if needed

                const rangeMap = {

                    'default': 'Last 28 days',

                    'week': 'Last 7 days',

                    'month': 'Last 28 days',

                    'quarter': 'Last 90 days',

                    'year': 'Last 365 days',

                    'lifetime': 'Lifetime'

                };



                const uiLabel = rangeMap[requestedTimeRange] || 'Last 28 days';

                return await setTimeRange(uiLabel);

            }

        } catch (e) {

            console.warn("⚠️ Error setting time range:", e);

        }

        return false;

    }



    window.scrapeAnalyticsData = async function scrapeAnalyticsData(explicitTimeRange = null) {
        // 🔒 V3.2: Execution Lock to prevent parallel scrapes from polling
        if (window._geminiScraping) {
            console.log("🔒 [Scraper] Execution locked - another scrape is in progress.");
            return { error: 'LOCKED', message: 'Another scrape in progress' };
        }
        window._geminiScraping = true;
        console.log("🚀 [Scraper] Starting execution...");

        const timeUpdated = await ensureTimeRange(explicitTimeRange);

        if (timeUpdated) {

            console.log("⏰Time range updated, waiting for potential reload...");

            await new Promise(r => setTimeout(r, 5000));

        }

        const url = window.location.href;

        let result = null;



        // Helper: Retry wrapper

        const runWithRetry = async (scrapeFn, checkFn) => {

            let data;

            for (let i = 0; i < 10; i++) { // Try up to 10 times (20s)

                // Check for error page

                if (document.body.innerText.includes('Oops, something went wrong')) {

                    console.error("❌[Scraper] YouTube Studio Error Page detected.");

                    return { error: 'YouTube Studio Error' };

                }



                data = await scrapeFn();

                if (checkFn(data)) return data;

                if (i < 9) {

                    console.log(`⏰[Scraper] Data not ready, retrying in 2s (${i + 1}/9)...`);

                    await new Promise(r => setTimeout(r, 2000));

                }

            }

            console.warn("⚠️ [Scraper] Max retries reached. Checking data quality...");



            // Final Quality Check: If data is completely empty/invalid, return error

            if (!checkFn(data)) {


                return { error: 'Data Validation Failed (Timeout)' };

            }

            return data;

        };



        if (url.includes('/analytics/tab-overview') || url.includes('tab-overview')) {

            // 🔧 FIX: Define url variable from window.location.href for scrapeOverviewTab

            // Note: scrapeOverviewTab uses 'url' internally but it's not passed as argument.

            // We need to make sure 'url' is available in scrapeOverviewTab scope or pass it.

            // Looking at scrapeOverviewTab definition (it was not shown fully but error says 'url is not defined'),

            // it likely uses 'url' variable which was supposed to be global or in closure.

            // Let's check scrapeOverviewTab definition.

            // Wait, the error is inside scrapeOverviewTab.

            // Let's just fix scrapeOverviewTab itself.

            result = await runWithRetry(scrapeOverviewTab, (d) => d.data.summary && d.data.summary.views);

        } else if (url.includes('/analytics/tab-content') || url.includes('tab-content')) {

            // Relaxed check: Accept if we have keyMoments OR topVideos OR any engagement data

            result = await runWithRetry(scrapeContentTab, (d) =>

                (d.data.keyMoments && d.data.keyMoments.length > 0) ||

                (d.data.topVideos && d.data.topVideos.length > 0) ||

                (d.data.engagement && Object.keys(d.data.engagement).length > 0)

            );

        } else if (url.includes('/analytics/tab-audience') || url.includes('tab-audience') || url.includes('tab-build_audience')) {

            // 🔧 FIX: Updated to check current YouTube Studio metrics (Monthly audience, New viewers, Subscribers)

            result = await runWithRetry(scrapeAudienceTab, (d) =>

                (d.data.geographies && d.data.geographies.length > 0) ||

                d.data.activeTimes ||

                d.data.monthlyAudience ||

                d.data.subscribers ||

                d.data.newViewers ||

                d.data.genericMetrics // Allow generic metrics

            );

        }



        if (result) {


            if (!result.category) {

                if (url.includes('tab-overview')) result.category = 'overview';

                else if (url.includes('tab-content')) result.category = 'content';

                else if (url.includes('tab-audience')) result.category = 'audience';

            }



            // Add current time range label to result for validation

            const trigger = document.querySelector('ytcp-text-dropdown-trigger .label-text');

            result.timeRangeLabel = trigger ? trigger.textContent.trim() : 'Unknown';

            console.log("📊 [Analytics Scraper] Result (Range: " + result.timeRangeLabel + "):", result);

            // 🆕 V3.2: Scraper Task Cleanup
            window._geminiScraping = false;



            // 📊 INTELLIGENT AUTO-CLOSE LOGIC (Shared)
            const handleAutoClose = async () => {
                let isScriptOpened = false;
                try {
                    const config = JSON.parse(window.name);
                    // Check for specific flags that indicate automation
                    isScriptOpened = !!(config && (config.timeRange || config.automationId));
                    if (isScriptOpened) console.log("📊 [Auto-Close] Detected via window.name:", window.name);
                } catch (e) { }

                // 🆕 Check for Ask Studio UI state (CRITICAL for closed-loop)
                const isAskStudioActive = () => {
                    const dialogSelectors = 'ytcp-creator-chat-dialog, #creator-chat-dialog, [class*="CreatorChatEntity"], ytcp-omnisearch-dialog';
                    const dialog = document.querySelector(dialogSelectors);
                    const hasDialog = dialog && (dialog.getBoundingClientRect().width > 100);
                    const hasInput = !!document.querySelector('.ytcpCreatorChatEntityAttachmentInlineFlowPromptBox, ytcp-creator-chat-input #input');
                    // 🛡️ Extra: Check for studioAgent activity flag
                    const agentActive = window._askStudioActive === true || !!document.querySelector('ytcp-creator-chat-spark');
                    return hasDialog || hasInput || agentActive;
                };

                if (isAskStudioActive()) {
                    console.log("🛡️ [Auto-Close] Ask Studio detected as active. Tab will NOT be closed yet.");
                    return;
                }

                // 🆕 Check Session Storage (Robust SPA persistence)
                if (!isScriptOpened) {
                    try {
                        const storedAuto = sessionStorage.getItem('gemini_is_automated');
                        if (storedAuto === 'true') {
                            isScriptOpened = true;
                            console.log("📊 [Auto-Close] Detected automation via Session Storage (Persistent Marker)");

                            // 🛡️ Double Check Purpose if available
                            const purpose = sessionStorage.getItem('gemini_purpose');
                            if (purpose) console.log("   (Purpose: " + purpose + ")");
                        }
                    } catch (e) { }
                }

                // 💾 Check Local Storage (Cross-Session Fail-safe)
                if (!isScriptOpened && chrome.storage && chrome.storage.local) {
                    try {
                        const result = await new Promise(r => chrome.storage.local.get(['pending_automations'], r));
                        const pendings = result.pending_automations || [];
                        const currentUrl = window.location.href;

                        // Find match (ignoring query params if needed, or substring)
                        // YouTube Studio URLs might change slightly, so we check if the stored URL is a substring of current, or vice versa
                        // Find match (Lenient: Ignore query params)
                        const normalize = (u) => u.split('?')[0].split('#')[0].replace(/\/$/, '');
                        const currentBase = normalize(currentUrl);

                        const matchIndex = pendings.findIndex(p => {
                            const storedBase = normalize(p.url);
                            // Match if same base, or one is substring of other (handling redirects)
                            return currentBase.includes(storedBase) || storedBase.includes(currentBase);
                        });

                        if (matchIndex !== -1) {
                            isScriptOpened = true;
                            console.log("📊 [Auto-Close] Detected automation via Local Storage (Pending Intent)");

                            // Cleanup: Remove this specific intent
                            pendings.splice(matchIndex, 1);
                            chrome.storage.local.set({ pending_automations: pendings });
                        }
                    } catch (e) {
                        console.warn("⚠️ [Auto-Close] Storage check error:", e);
                    }
                }

                if (!isScriptOpened) {
                    const urlParams = new URLSearchParams(window.location.search);
                    const action = urlParams.get('gemini_action');
                    // Check for our custom params
                    if (urlParams.has('time_range') || action === 'analytics' || action === 'direct_collect' || action === 'single_tab_analytics') {
                        isScriptOpened = true;
                        console.log("📊 [Auto-Close] Detected automation URL param - script-opened tab (action: " + action + ")");

                        // 🛡️ DFL PROTECTION: Never auto-close if this is a DFL Report session
                        if (action === 'dfl_report') {
                            console.log("🛡️ [Auto-Close] DFL Report detected. DISABLING auto-close to allow Ask Studio to finish.");
                            return; // Exit handleAutoClose immediately
                        }

                        // 🛡️ FULL_ANALYTICS/SINGLE_TAB PROTECTION: Never auto-close for multi-step tasks
                        // 🔧 CRITICAL FIX: Also protect ANY session where Ask Studio is likely to be needed
                        if (action === 'full_analytics' || action === 'single_tab_analytics' || action === 'direct_collect' || action === 'analytics_ask') {
                            console.log(`🛡️ [Auto-Close] ${action} detected. DISABLING auto-close for Multi-Step Protection.`);
                            return; // Exit handleAutoClose immediately
                        }
                    }

                    // 🛡️ FINAL PROTECTION: If window.name suggests automation, be extremely cautious
                    if (window.name && (window.name.includes('gemini') || window.name.includes('automation'))) {
                        console.log("🛡️ [Auto-Close] window.name suggests automation. DISABLING auto-close.");
                        return;
                    }
                }

                // 🔄 FALLBACK: Check with background if local markers were stripped
                if (!isScriptOpened && chrome.runtime && chrome.runtime.sendMessage) {
                    try {
                        let response = null;
                        // Retry check to handle potential race conditions
                        for (let i = 0; i < 3; i++) {
                            response = await new Promise(resolve => {
                                chrome.runtime.sendMessage({ action: "checkAutomationStatus" }, resolve);
                            });
                            if (response && (response.isAutomated || response.purpose === 'analytics')) {
                                break;
                            }
                            await new Promise(r => setTimeout(r, 500)); // Wait 500ms
                        }

                        // 🆕 Enhanced check: Also accept purpose === 'analytics'
                        if (response && (response.isAutomated || response.purpose === 'analytics')) {
                            isScriptOpened = true;
                            console.log("📊 [Auto-Close] Detected automation via Background check (Purpose: " + response.purpose + ")");
                        } else {
                            console.warn("⚠️ [Auto-Close] Background check failed:", response);
                        }
                    } catch (e) {
                        console.warn("⚠️ [Auto-Close] Background check error:", e);
                    }
                }

                if (!isScriptOpened && window.opener) {
                    // If opened by another window, assume it's part of the flow
                    isScriptOpened = true;
                    console.log("📊 [Auto-Close] Detected window.opener - script-opened tab");
                }

                if (!isScriptOpened) {
                    // 🆕 Final check: If URL has gemini_action (even if background says no)
                    const urlParams = new URLSearchParams(window.location.search);
                    if (urlParams.get('gemini_action') === 'analytics') {
                        isScriptOpened = true;
                        console.log("📊 [Auto-Close] Detected gemini_action (Final check) - closing.");
                    } else {
                        console.log("📊 [Auto-Close] Manual tab detected (isAutomated: false). NOT closing.");
                        return;
                    }
                }

                const category = result.category;
                const d = result.data;
                let hasData = false;

                if (category === 'overview') {
                    hasData = !!(d.summary?.views || d.views || d.subscribers || Object.keys(d).length > 0);
                } else if (category === 'content') {
                    // Relaxed check for content - any data counts
                    hasData = !!(d.videoCount || (d.topVideos && d.topVideos.length > 0) || Object.keys(d).length > 0);
                } else if (category === 'audience') {
                    // Relaxed check for audience - any data counts
                    hasData = !!(d.activeTimes || d.subscribers || Object.keys(d).length > 0);
                }

                // Force true if we have a substantial data object
                if (!hasData && d && Object.keys(d).length > 3) hasData = true;

                if (hasData) {
                    console.log(`✨ [Auto-Close] Data collected for ${category}. Preparing to close...`);

                    // 🛡️ SUPPRESS: Prevent "Leave site?" prompts (CSP-compliant via src)
                    try {
                        const script = document.createElement('script');
                        script.src = chrome.runtime.getURL('core/suppress.js');
                        (document.head || document.documentElement).appendChild(script);
                        script.onload = () => script.remove();
                    } catch (e) { console.warn("Failed to inject suppression script", e); }

                    // Final check: Is this a DFL report? (Double check)
                    const urlParams = new URLSearchParams(window.location.search);
                    if (urlParams.get('gemini_action') === 'dfl_report') {
                        console.log("🛡️ [Auto-Close] Final check: DFL Report active. Tab will NOT be closed.");
                        return;
                    }

                    console.log("✅ [Auto-Close] Closing tab in 2s...");
                    setTimeout(() => {
                        // Try Chrome Runtime first
                        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                            try {
                                console.log("❌ [Auto-Close] Sending closeTab to background...");
                                chrome.runtime.sendMessage({ action: 'closeTab', url: window.location.href });
                            } catch (e) { console.warn("chrome.runtime failed", e); }
                        }

                        // Fallback to window.close()
                        try {
                            console.log("❌ [Auto-Close] Attempting window.close() fallback...");
                            window.close();
                        } catch (e) { console.warn("window.close() failed", e); }
                    }, 2000);
                } else {
                    console.warn("⚠️ [Auto-Close] Data collection incomplete/empty. Keeping tab open for 10s as safety net.");
                    // Still close after a timeout to prevent clutter
                    setTimeout(() => {
                        console.log("📊 [Auto-Close] Closing tab after 10s timeout (safety net).");
                        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                            chrome.runtime.sendMessage({ action: 'closeTab', url: window.location.href });
                        } else {
                            window.close();
                        }
                    }, 10000);
                }
            };

            // Send to React via window.opener
            let messageSent = false;
            if (window.opener) {
                console.log("📊 [Analytics Scraper] Sending via window.opener...");
                try {
                    window.opener.postMessage({
                        type: 'YOUTUBE_ANALYTICS_DIRECT_RESULT',
                        data: result
                    }, '*');
                    console.log("📊 [Analytics Scraper] ✨Sent via window.opener");
                    messageSent = true;
                    handleAutoClose();
                } catch (e) {
                    console.warn("📊 [Analytics Scraper] window.opener.postMessage failed:", e);
                }
            } else {
                console.log("📊 [Analytics Scraper] No window.opener available.");
            }

            // Fallback to chrome.runtime
            if (!messageSent) {
                try {
                    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                        console.log("📊 [Analytics Scraper] Sending via chrome.runtime.sendMessage (fallback)...");

                        chrome.runtime.sendMessage({ action: "relayAnalyticsDirectResult", data: result });
                        console.log("📊 [Analytics Scraper] ✨Sent via chrome.runtime");

                        // Unified closing logic
                        handleAutoClose();
                    } else {
                        console.log("📊 [Analytics Scraper] chrome.runtime not available");
                    }
                } catch (e) {
                    console.warn("📊 [Analytics Scraper] chrome.runtime.sendMessage failed:", e.message);
                }
            }

            return result;

        }

    };








    async function scrapeNotifications() {




        // 1. Find Bell Icon (using multiple selectors for robustness)

        const bellIcon = document.querySelector('ytcp-icon-button[aria-label="Notifications"]') ||

            document.querySelector('#help-icon-button'); // Fallback



        if (!bellIcon) return;



        // 2. Check for Badge (Red Dot)

        const badge = bellIcon.querySelector('.ytcp-badge');

        const hasNew = badge && window.getComputedStyle(badge).display !== 'none';



        // 3. Click to Open (Only if we haven't scraped recently OR if there are new items)

        bellIcon.click();



        // Wait for popup animation

        await new Promise(r => setTimeout(r, 1500));



        // 4. Scrape List

        const items = document.querySelectorAll('ytcp-notification-section-renderer ytcp-notification-item-renderer');

        const notifications = [];



        items.forEach(item => {

            const textEl = item.querySelector('#text');

            const timeEl = item.querySelector('#time');

            const iconEl = item.querySelector('ytcp-icon');



            if (textEl) {

                let type = 'info';

                const iconPath = iconEl ? iconEl.innerHTML : '';

                if (iconPath.includes('trophy') || textEl.innerText.includes('congrats') || textEl.innerText.includes('hit')) type = 'achievement';

                if (iconPath.includes('lightbulb') || textEl.innerText.includes('tip')) type = 'idea';



                notifications.push({

                    title: textEl.innerText.replace(/\n/g, ' ').trim(),

                    time: timeEl ? timeEl.innerText.trim() : '',

                    type: type,

                    isNew: hasNew

                });

            }

        });






        // 5. Send Data

        if (notifications.length > 0) {

            const payload = {

                type: 'YOUTUBE_NOTIFICATIONS',

                data: notifications,

                hasNew: hasNew

            };



            // Send to React App (opener)

            if (window.opener) {

                window.opener.postMessage(payload, '*');

            }



            // Send to Background (for broadcasting)

            if (typeof chrome !== 'undefined' && chrome.runtime) {

                chrome.runtime.sendMessage({

                    action: 'relayNotifications',

                    data: payload

                });

            }

        }



        // Close popup

        bellIcon.click();

    }



    // Run Notification Scraper periodically

    setTimeout(scrapeNotifications, 5000);

    setInterval(scrapeNotifications, 60000); // Check every minute



    // 🚀 Ignite Comment Strategy (Post & Pin)

    async function postAndPinComment(text) {




        // 1. Find Main Comment Input

        // Note: In Studio Comments tab, there isn't a "main input" for the channel. 

        // We are usually replying to a specific video or just managing comments.

        // BUT, if we are on the "Comments" tab, we can't "post a comment" to our own channel generally.

        // We can only reply.



        // HOWEVER, the requirement is to post a comment on the *video* we just uploaded.

        // The React app opens `https://studio.youtube.com/channel/mine/comments?filter=published`.

        // This lists comments *on our videos*. It doesn't allow posting a new top-level comment on a video directly from here easily

        // unless we click on the video link.



        // WAIT. The strategy in React says:

        // "Open Comments page... postMessage IGNITE_COMMENT"



        // If we want to post a top-level comment on the video, we should probably open the VIDEO'S comments page in Studio

        // OR the actual YouTube Watch page.

        // Studio: https://studio.youtube.com/video/[VIDEO_ID]/comments

        // Watch Page: https://www.youtube.com/watch?v=[VIDEO_ID]



        // Since we don't have the Video ID easily in the React queue (it's in the upload event), 

        // the React app opens the *general* comments page. 

        // This might be a flaw in the plan. We can't "post a comment" to a random video from the general comments list.



        // CORRECTION: The user wants to "Auto-Pin Engagement Trigger".

        // This usually means posting a comment *on the video*.



        // Let's assume the React app *will* eventually open the specific video's comments page 

        // (it has the logic `window.open('https://studio.youtube.com/channel/mine/comments?filter=published', '_blank')` which is general).



        // IF we are on the general comments page, we can't do this.

        // BUT, if the user manually opens the specific video comments, or if we improve the React logic to open the specific video,

        // this script needs to work.



        // Let's implement the logic assuming we are on a page where we CAN post a comment (like a specific video's comments tab in Studio).

        // In Studio -> Video -> Comments, there is no "Post new comment" box. You can only reply.



        // TO POST A NEW COMMENT, we must be on the **YouTube Watch Page** or use the **Community Tab**.

        // Since this is for a *new video*, we want to post on the Watch Page.



        // RE-EVALUATION: The `IGNITE_COMMENT` strategy in `YouTubeAnalytics.tsx` opens `studio.youtube.com/.../comments`.

        // This is likely intended to *reply* to early comments? 

        // No, the prompt says "Viral Trigger Comment". This implies a top-level comment.



        // If we want to post a top-level comment, we should open the **Watch Page**.

        // But `youtube-analytics.js` runs on `studio.youtube.com`.



        // HYBRID APPROACH:

        // If we are in Studio, maybe we can't post a top-level comment easily.

        // Let's look at `scrapeShorts` or `scrapeComments`.



        // Actually, if we want to "Ignite", maybe we just want to reply to the *first* comment we see?

        // OR, maybe the user intends to use the "Community" tab?



        // Let's stick to the requested logic: "Post and Pin".

        // This is only possible on the Watch Page or if Studio has a "New Comment" feature I missed.

        // (Studio doesn't have a "Post Comment" feature for your own videos, only Reply).



        // OK, I will implement a "Reply to Top Comment" fallback if we can't post new.

        // OR, I will assume the user might be redirected to the Watch Page.

        // But this script is for Studio.



        // Let's assume the intention is to **Reply to the most recent comment** (if any) 

        // OR just log that we can't post top-level from Studio.



        // WAIT! The `yppService` says "pinnedComment".

        // You can only pin a comment on your own video.

        // You usually do this by posting a comment yourself on the Watch Page.



        // I will implement the listener. If it finds a place to type (like a reply), it will type.

        // If it's the general comments page, maybe it replies to the latest one?



        // Let's look for a "Reply" button on the first item.

        const firstComment = document.querySelector('ytcp-comment-thread-renderer');

        if (firstComment) {


            // Use existing reply logic

            const replyBtn = findDeep('#reply-button', firstComment)[0] || findDeep('.reply-button', firstComment)[0];

            if (replyBtn) {

                replyBtn.click();

                await new Promise(r => setTimeout(r, 1000));



                const editor = findDeep('#contenteditable-root', firstComment)[0] || findDeep('textarea', firstComment)[0];

                if (editor) {

                    editor.focus();

                    document.execCommand('insertText', false, text);

                    await new Promise(r => setTimeout(r, 500));



                    const submitBtn = findDeep('#submit-button', firstComment)[0];

                    if (submitBtn) submitBtn.click();



                    // Pinning? We can't pin our *reply* to another person's comment as the "Top Comment" of the video.

                    // We can only pin the *root* comment.

                }

            }

        } else {


        }

    }




    window.addEventListener('message', async (event) => {

        if (event.data.type === 'IGNITE_COMMENT') {


            await postAndPinComment(event.data.text);

        }

    });


    // ═══════════════════════════════════════════════════════════════════════════
    // 🚀 DFL AUTO-IGNITION SYSTEM - Complete Closed-Loop Workflow
    // ═══════════════════════════════════════════════════════════════════════════

    const DFL_IGNITION = {
        scheduledVideos: [],
        ignitionQueue: [],
        isMonitoring: false,
        pollInterval: 60000, // 1 minute
        ignitionLog: []
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 1: Ignition Trigger - Schedule Monitor
    // ═══════════════════════════════════════════════════════════════════════════

    async function startScheduleMonitor() {
        if (DFL_IGNITION.isMonitoring) {
            console.log("🔥 [Ignition] Monitor already running");
            return;
        }

        DFL_IGNITION.isMonitoring = true;
        console.log("🚀 [Ignition] Schedule Monitor ACTIVATED");

        // Initial check
        await checkScheduledVideos();

        // Continuous polling every minute
        setInterval(async () => {
            await checkScheduledVideos();
        }, DFL_IGNITION.pollInterval);
    }

    async function checkScheduledVideos() {
        const now = new Date();
        console.log(`🕐 [Ignition] Checking schedules at ${now.toLocaleTimeString()}`);

        // Look for scheduled videos that should be published now
        const videoRows = document.querySelectorAll('ytcp-video-row');

        for (const row of videoRows) {
            const visibilityEl = row.querySelector('.visibility-cell, [aria-label*="Visibility"]');
            const dateEl = row.querySelector('.date-cell, .upload-date');

            if (!visibilityEl) continue;
            const visibility = visibilityEl.textContent?.trim() || '';

            // Check if video is SCHEDULED and due
            if (visibility.toLowerCase().includes('scheduled')) {
                const dateText = dateEl?.textContent?.trim() || '';
                console.log(`📅 [Ignition] Found scheduled video: ${dateText}`);

                // Parse date and check if it's time
                const scheduledTime = parseScheduledDate(dateText);
                if (scheduledTime && now >= scheduledTime) {
                    console.log("🔥 [Ignition] VIDEO DUE! Triggering ignition sequence...");

                    // Extract video ID from row
                    const linkEl = row.querySelector('a[href*="/video/"]');
                    const videoId = linkEl?.href?.match(/\/video\/([^/]+)/)?.[1];

                    if (videoId) {
                        triggerIgnitionSequence(videoId, row);
                    }
                }
            }
        }
    }

    function parseScheduledDate(dateText) {
        // Handle formats like "12/22/2025 8:00 PM" or "Dec 22, 2025 8:00 PM"
        try {
            const parsed = new Date(dateText);
            if (!isNaN(parsed.getTime())) return parsed;
        } catch (e) {
            console.warn("⚠️ [Ignition] Failed to parse date:", dateText);
        }
        return null;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 2: Bypass Protocol - Comment Injection
    // ═══════════════════════════════════════════════════════════════════════════

    async function triggerIgnitionSequence(videoId, row) {
        console.log(`🚀 [Ignition] Starting sequence for video: ${videoId}`);
        DFL_IGNITION.ignitionLog.push({ videoId, startTime: new Date(), phase: 'started' });

        // 1. Refresh to confirm Public status
        console.log("🔄 [Ignition] Refreshing page to confirm status...");

        // 2. Open video on YouTube (NOT Studio) for comment injection
        const playerUrl = `https://www.youtube.com/shorts/${videoId}`;
        console.log(`📺 [Ignition] Opening player: ${playerUrl}`);

        // Send message to open and inject comment
        window.postMessage({
            type: 'DFL_IGNITE_VIDEO',
            payload: {
                videoId,
                playerUrl,
                action: 'open_and_comment'
            }
        }, '*');

        // Notify React app
        if (window.opener) {
            window.opener.postMessage({
                type: 'DFL_IGNITION_STARTED',
                videoId,
                timestamp: new Date().toISOString()
            }, '*');
        }
    }

    async function injectIgnitionComment(videoId, commentText) {
        console.log(`💬 [Ignition] Injecting comment for ${videoId}: "${commentText.substring(0, 50)}..."`);

        // Wait for DOM to stabilize (bypass initial script detection)
        await sleep(5000);

        // Find comment box (YouTube Shorts player)
        const selectors = [
            '#contenteditable-root',
            '#placeholder-area',
            'ytd-comment-simplebox-renderer #input-container',
            'textarea[placeholder*="comment"]'
        ];

        let commentBox = null;
        for (const sel of selectors) {
            commentBox = document.querySelector(sel);
            if (commentBox) break;
        }

        if (!commentBox) {
            console.warn("⚠️ [Ignition] Comment box not found. Retrying in 3s...");
            await sleep(3000);
            commentBox = document.querySelector('#contenteditable-root');
        }

        if (commentBox) {
            // Focus and inject text
            commentBox.focus();
            commentBox.click();
            await sleep(500);

            // Use execCommand for better compatibility
            document.execCommand('insertText', false, commentText);
            await sleep(1000);

            // Find and click submit
            const submitBtn = document.querySelector('#submit-button') ||
                document.querySelector('[aria-label="Comment"]') ||
                document.querySelector('ytd-button-renderer#submit-button button');

            if (submitBtn) {
                submitBtn.click();
                console.log("✅ [Ignition] Comment submitted!");

                // Phase 3: Hedge the interaction
                await sleep(2000);
                await hedgeInteraction(videoId);
            } else {
                console.warn("⚠️ [Ignition] Submit button not found");
            }
        } else {
            console.error("❌ [Ignition] Failed to inject comment - no input found");
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 3: Interaction Hedging (Pin + Like)
    // ═══════════════════════════════════════════════════════════════════════════

    async function hedgeInteraction(videoId) {
        console.log(`🎯 [Ignition] Phase 3: Hedging interaction for ${videoId}`);

        // 1. Find our comment (most recent by creator)
        await sleep(2000);

        const comments = document.querySelectorAll('ytd-comment-thread-renderer');
        let ourComment = null;

        for (const comment of comments) {
            // Check if it's by the channel owner
            const authorChip = comment.querySelector('#author-comment-badge');
            if (authorChip) {
                ourComment = comment;
                break;
            }
        }

        if (ourComment) {
            console.log("📌 [Ignition] Found our comment. Attempting to pin...");

            // Click three-dots menu
            const menuBtn = ourComment.querySelector('#action-menu button, yt-icon-button#button');
            if (menuBtn) {
                menuBtn.click();
                await sleep(1000);

                // Look for "Pin" option
                const menuItems = document.querySelectorAll('ytd-menu-service-item-renderer, tp-yt-paper-item');
                for (const item of menuItems) {
                    const text = item.textContent?.toLowerCase() || '';
                    if (text.includes('pin')) {
                        item.click();
                        console.log("📌 [Ignition] Comment PINNED!");
                        break;
                    }
                }
            }

            // 2. Self-like the comment
            await sleep(1000);
            const likeBtn = ourComment.querySelector('#like-button button, [aria-label*="like" i]');
            if (likeBtn) {
                likeBtn.click();
                console.log("👍 [Ignition] Self-like applied!");
            }
        } else {
            console.warn("⚠️ [Ignition] Could not find our comment to pin");
        }

        // Log completion
        DFL_IGNITION.ignitionLog.push({ videoId, phase: 'hedged', timestamp: new Date() });

        // Notify React app of success
        window.postMessage({
            type: 'DFL_IGNITION_COMPLETE',
            videoId,
            success: true,
            phases: ['comment', 'pin', 'like']
        }, '*');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PHASE 4: Velocity Loopback (Secondary Ignition)
    // ═══════════════════════════════════════════════════════════════════════════

    async function checkVelocityLoopback(videoId, currentViews) {
        console.log(`📊 [Ignition] Velocity check: ${currentViews} views for ${videoId}`);

        const VELOCITY_THRESHOLD = 500; // Views needed in first hour

        if (currentViews < VELOCITY_THRESHOLD) {
            console.log(`⚠️ [Ignition] LOW VELOCITY DETECTED (${currentViews}/${VELOCITY_THRESHOLD}). Triggering secondary ignition...`);

            // Notify React app
            window.postMessage({
                type: 'DFL_SECONDARY_IGNITION',
                videoId,
                currentViews,
                action: 'refresh_metadata'
            }, '*');

            // Log event
            DFL_IGNITION.ignitionLog.push({
                videoId,
                phase: 'secondary_ignition',
                views: currentViews,
                timestamp: new Date()
            });

            return true; // Secondary ignition triggered
        }

        console.log(`🚀 [Ignition] Velocity OK: ${currentViews} views`);
        return false;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Message Handlers
    // ═══════════════════════════════════════════════════════════════════════════

    window.addEventListener('message', async (event) => {
        // Start monitoring
        if (event.data.type === 'DFL_START_SCHEDULE_MONITOR') {
            startScheduleMonitor();
        }

        // Manual ignition trigger
        if (event.data.type === 'DFL_TRIGGER_IGNITION') {
            const { videoId, commentText } = event.data.payload;
            await injectIgnitionComment(videoId, commentText);
        }

        // Velocity check request
        if (event.data.type === 'DFL_CHECK_VELOCITY') {
            const { videoId, views } = event.data.payload;
            await checkVelocityLoopback(videoId, views);
        }
    });

    // Expose globally for debugging
    window.DFL_IGNITION = DFL_IGNITION;
    window.startScheduleMonitor = startScheduleMonitor;
    window.triggerIgnitionSequence = triggerIgnitionSequence;
    window.injectIgnitionComment = injectIgnitionComment;
    window.hedgeInteraction = hedgeInteraction;
    window.checkVelocityLoopback = checkVelocityLoopback;

    console.log("🔥 [DFL Ignition] Auto-Ignition System loaded and ready!");


    // 🎯 Only run checkAutoTrigger once (no interval to prevent duplicate triggers)

    checkAutoTrigger();



    // Expose globally for manual debugging (Override placeholder)

    window.scrapeAnalyticsData = scrapeAnalyticsData;

    window.askStudio = askStudio;

    window.scrapeContentTab = scrapeContentTab; // 🎯 Expose

    window.scrapeAudienceTab = scrapeAudienceTab; // 🎯 Expose

    console.log("✨[YouTube Analytics] Scraper functions exposed globally.");

    window.debugAnalytics = { getVisibleDeepText, querySelectorAllDeep };



    // 🎯 Debug Event Listener (Accessible from Top Context via DOM)

    // 🎯 Debug Event Listener (Accessible from Top Context via DOM)

    document.addEventListener('GEMINI_DEBUG_SCRAPE', async (e) => {

        console.log("🔧 [Debug] Received scrape request:", e.detail);

        console.log("🔧 [Debug] typeof scrapeAudienceTab:", typeof scrapeAudienceTab);

        console.log("🔧 [Debug] typeof window.scrapeAudienceTab:", typeof window.scrapeAudienceTab);



        try {

            if (e.detail === 'audience') {

                const func = window.scrapeAudienceTab || scrapeAudienceTab;

                if (typeof func !== 'function') throw new Error("scrapeAudienceTab is not a function");

                const data = await func();

                console.log("📊 [Debug Result] Audience Data:", data);

            } else if (e.detail === 'content') {

                const func = window.scrapeContentTab || scrapeContentTab;

                if (typeof func !== 'function') throw new Error("scrapeContentTab is not a function");

                const data = await func();

                console.log("📊 [Debug Result] Content Data:", data);

            }

        } catch (err) {

            console.error("❌[Debug Error]", err);

        }

    });



    // 🎯 INDEPENDENT AUTO-DETECT: Check URL on page load (outside of checkAutoTrigger)

    // This block runs ONCE when the script loads, ensuring reliable detection

    (async function independentAutoDetect() {

        const url = window.location.href;


        console.log("🔍 [Auto-detect] STARTING URL CHECK...");

        console.log("🔍 [Auto-detect] URL:", url);




        if (url.includes('/analytics/tab-overview') || url.includes('/analytics/tab-content') || url.includes('/analytics/tab-audience') || url.includes('tab-build_audience')) {

            // 🛡️ DFL PROTECTION: Skip auto-scrape if this is a DFL Report session
            // DFL Report uses Ask Studio and should NOT trigger the default scrape behavior
            if (url.includes('gemini_action=dfl_report')) {
                console.log("🛡️ [Auto-detect] DFL Report session detected. Skipping auto-scrape to allow Ask Studio to work.");
                return; // Exit independentAutoDetect immediately
            }

            console.log("📊 [Auto-detect] ✨ANALYTICS TAB DETECTED!");

            // ✍️ SELF-SIGNING: If we auto-detected this tab, we own it.
            // This bypasses flaky background injection/matching.
            try {
                if (!sessionStorage.getItem('gemini_is_automated')) {
                    sessionStorage.setItem('gemini_is_automated', 'true');
                    sessionStorage.setItem('gemini_purpose', 'analytics_autodetect');
                    console.log("✍️ [Auto-detect] Self-signed automation status (Fail-safe active).");
                }
            } catch (e) { }



            // Check window.name for fast-track

            let fastTrack = false;

            try {

                const config = JSON.parse(window.name);

                if (config && config.timeRange) fastTrack = true;

            } catch (e) { }



            if (fastTrack) {

                console.log("⚡[Auto-detect] Fast-tracking due to window.name config!");

                await new Promise(r => setTimeout(r, 1000)); // Small delay for DOM

            } else {

                console.log("📊 [Auto-detect] Starting 5-second countdown...");

                for (let i = 5; i > 0; i--) {


                    await new Promise(r => setTimeout(r, 1000));

                }

            }




            console.log("📊 [Auto-detect] ⏰GO! Executing scrapeAnalyticsData NOW!");




            // Execute the scrape (with duplicate prevention)

            if (!window._geminiScrapeDone) {

                window._geminiScrapeDone = true;

                scrapeAnalyticsData().then(result => {


                    console.log("📊 [Auto-detect] 📊帀 Result:", result);


                }).catch(e => {

                    console.error("📊 [Auto-detect] ❌Scrape ERROR:", e);

                });

            } else {

                console.log("📊 [Auto-detect] Skipping - already scraped by another trigger.");

            }

        } else {

            console.log("🔍 [Auto-detect] Not an analytics tab. Skipping auto-scrape.");

        }

    })();
})();
