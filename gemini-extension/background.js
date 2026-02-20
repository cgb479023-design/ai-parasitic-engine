// ═══════════════════════════════════════════════════════════════════════════
// background.js - Service Worker for Chrome Extension
// Version: 3.4 (Map Storage)
// 
// 📋 SECTION INDEX (see code_dependencies.md for full documentation):
// ├─ Lines 1-40: Initialization & Global Variables
// ├─ Lines 41-86: Keep-Alive & Health Check
// ├─ Lines 88-135: Video Data Storage (pendingUploads)
// ├─ Lines 138-208: Video Reschedule
// ├─ Lines 210-297: Auto-Comment System
// ├─ Lines 299-464: Google Vids Data Management
// ├─ Lines 466-570: Google Flow Tab Queue
// ├─ Lines 572-750: Google Vids Tab Management
// ├─ Lines 751-805: Download Proxy
// ├─ Lines 808-926: Google Vids/Flow Complete Handler (CRITICAL)
// ├─ Lines 929-1013: Ask Studio Plan Generation (CRITICAL)
// ├─ Lines 1015-1095: Analytics Relay
// ├─ Lines 1097-1199: Direct Analytics Result Relay
// └─ Lines 1200-1320: Plan & Comment Relay
//
// ⚠️ BEFORE MODIFYING: Read .agent/workflows/code_dependencies.md
// ═══════════════════════════════════════════════════════════════════════════

importScripts('core/constants.js');
importScripts('background/tabManager.js');
importScripts('background/downloadService.js');
importScripts('background/scheduler.js');

console.log("🚀 [GeminiGen Background] Service Worker Loaded (v4.5.1-build-20260111-1)");
console.log("✅ [Modules] Loaded: TabManager, DownloadService, Scheduler");

const TAB_PUSH_STORAGE_KEY = 'gemini_tab_push_jobs';
let tabPushJobsCache = null;

// sleep is defined in scheduler.js



const pExecuteScript = (tabId, func, args = [], world) => new Promise((resolve, reject) => {
    const options = {
        target: { tabId },
        func,
        args
    };
    if (world) options.world = world;
    chrome.scripting.executeScript(options, (results) => {
        const err = chrome.runtime?.lastError;
        if (err) return reject(err);
        resolve(results);
    });
});

async function extractPlayableVideoUrlFromYouTubeTab(tabId) {
    for (let i = 0; i < 50; i++) {
        try {
            const results = await pExecuteScript(tabId, () => {
                const pickFromPerformance = () => {
                    try {
                        const entries = performance.getEntriesByType?.('resource') || [];
                        const urls = [];
                        for (const e of entries) {
                            const name = e?.name;
                            if (typeof name !== 'string') continue;
                            if (!name.includes('googlevideo.com') || !name.includes('videoplayback')) continue;
                            urls.push(name);
                        }
                        if (urls.length === 0) return null;
                        urls.sort((a, b) => b.length - a.length);
                        const mp4 = urls.find(u => u.includes('mime=video%2Fmp4')) || urls[0];
                        return mp4 || null;
                    } catch {
                        return null;
                    }
                };

                const pickFromPlayerResponse = () => {
                    const findUrl = (obj) => {
                        try {
                            const formats = obj?.streamingData?.formats || [];
                            const adaptive = obj?.streamingData?.adaptiveFormats || [];
                            const all = [...formats, ...adaptive];
                            const direct = all.find(f => typeof f?.url === 'string' && f.url.includes('googlevideo.com') && f.url.includes('videoplayback'));
                            if (direct) return direct.url;
                        } catch { }
                        return null;
                    };
                    const candidates = [
                        (window).ytInitialPlayerResponse,
                        (window).ytplayer?.config?.args?.raw_player_response,
                        (window).ytplayer?.config?.args?.player_response
                    ];
                    for (const c of candidates) {
                        const url = findUrl(c);
                        if (url) return url;
                    }
                    return null;
                };

                const ensurePlaying = () => {
                    const v = document.querySelector('video');
                    if (!v) return;
                    try {
                        v.muted = true;
                        v.play?.().catch(() => { });
                    } catch { }
                };

                ensurePlaying();
                const fromPerf = pickFromPerformance();
                if (fromPerf) return fromPerf;

                const fromResp = pickFromPlayerResponse();
                if (fromResp) return fromResp;

                const v = document.querySelector('video');
                const src = v?.currentSrc || v?.src || null;
                if (typeof src === 'string' && src.includes('googlevideo.com') && src.includes('videoplayback')) return src;
                return null;
            });
            const url = results?.[0]?.result;
            if (typeof url === 'string' && url.includes('googlevideo.com') && url.includes('videoplayback')) {
                return url;
            }
        } catch { }
        await sleep(400);
    }
    return null;
}

async function fetchAsDataUrl(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`FETCH_FAILED_${resp.status}`);
    const blob = await resp.blob();
    return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('FILEREADER_FAILED'));
        reader.readAsDataURL(blob);
    });
}

async function resolveYouTubePublishedVideoData(sourceYouTubeUrl, youtubeVideoId) {
    if (!sourceYouTubeUrl) return null;
    let tab = null;
    try {
        tab = await pTabsCreate({ url: sourceYouTubeUrl, active: false });
        if (!tab?.id) return null;
        const playableUrl = await extractPlayableVideoUrlFromYouTubeTab(tab.id);
        if (!playableUrl) return null;

        try {
            const head = await fetch(playableUrl, { method: 'HEAD' });
            const len = Number(head.headers.get('content-length') || '0');
            if (Number.isFinite(len) && len > 80 * 1024 * 1024) {
                return null;
            }
        } catch { }

        const dataUrl = await fetchAsDataUrl(playableUrl);
        if (typeof dataUrl === 'string') {
            const uploads = await getPendingUploads();
            const key = youtubeVideoId || 'latest';
            uploads[key] = { ...(uploads[key] || {}), videoData: dataUrl, source: 'youtube_published', storedAt: Date.now() };
            uploads['latest'] = uploads[key];
            await savePendingUploads(uploads);
            return dataUrl;
        }
        return null;
    } catch {
        return null;
    } finally {
        if (tab?.id) await pTabsRemove(tab.id);
    }
}

function loadTabPushJobs() {
    if (tabPushJobsCache) return Promise.resolve(tabPushJobsCache);
    return new Promise((resolve) => {
        chrome.storage.local.get([TAB_PUSH_STORAGE_KEY], (result) => {
            tabPushJobsCache = result[TAB_PUSH_STORAGE_KEY] || {};
            resolve(tabPushJobsCache);
        });
    });
}

function saveTabPushJobs(jobs) {
    tabPushJobsCache = jobs || {};
    return new Promise((resolve) => {
        chrome.storage.local.set({ [TAB_PUSH_STORAGE_KEY]: tabPushJobsCache }, () => resolve());
    });
}

async function upsertTabPushJob(tabId, job) {
    const jobs = await loadTabPushJobs();
    jobs[String(tabId)] = job;
    await saveTabPushJobs(jobs);
}

async function removeTabPushJob(tabId) {
    const jobs = await loadTabPushJobs();
    delete jobs[String(tabId)];
    await saveTabPushJobs(jobs);
}

async function resolveTikTokVideoData(job) {
    if (job?.videoData) return job.videoData;
    const youtubeVideoId = job?.youtubeVideoId;
    const uploads = await getPendingUploads();
    const cachedVideo = (youtubeVideoId && uploads[youtubeVideoId]) || uploads['latest'];
    return cachedVideo?.videoData || null;
}

chrome.tabs.onUpdated.addListener((tabId, info) => {
    if (info.status !== 'complete') return;
    loadTabPushJobs().then(async (jobs) => {
        const job = jobs[String(tabId)];
        if (!job) return;

        if (job.platform === 'tiktok') {
            const videoData = await resolveTikTokVideoData(job);
            const payload = {
                action: 'tiktokUpload',
                youtubeVideoId: job.youtubeVideoId,
                videoData: videoData,
                metadata: job.metadata,
                sourceYouTubeUrl: job.sourceYouTubeUrl
            };

            chrome.tabs.sendMessage(tabId, payload, { frameId: 0 }, async () => {
                await removeTabPushJob(tabId);
            });
        }
    }).catch(() => { });
});

// Force activation on install
chrome.runtime.onInstalled.addListener(() => {
    console.log("✅ [Background] Extension Installed/Updated");
});

// 🔒 Global state for Google Flow tab queue (to prevent multiple tabs)
let googleFlowState = {
    inProgress: false,
    queue: [],
    activeTabId: null,
    pendingScheduleTime: null  // 🆕 Store scheduleTime from URL params
};

// 🆕 V4.5: Helper to manage persistent storage for pending uploads
async function getPendingUploads() {
    return new Promise(resolve => {
        chrome.storage.local.get(['pendingUploads'], (result) => {
            resolve(result.pendingUploads || {});
        });
    });
}

async function savePendingUploads(uploads) {
    return new Promise(resolve => {
        chrome.storage.local.set({ pendingUploads: uploads }, resolve);
    });
}

// 🆕 V7.4: Helper to extract video ID from YouTube URLs
function extractVideoIdFromUrl(url) {
    if (!url) return null;
    try {
        if (url.includes('/shorts/')) {
            // 🔧 V2.6: Support 10-12 char video IDs
            return url.match(/shorts\/([a-zA-Z0-9_-]{10,12})/)?.[1];
        }
        if (url.includes('watch?v=')) {
            return new URL(url).searchParams.get('v');
        }
        if (url.includes('youtu.be/')) {
            // 🔧 V2.6: Support 10-12 char video IDs
            return url.match(/youtu\.be\/([a-zA-Z0-9_-]{10,12})/)?.[1];
        }
    } catch (e) {
        console.warn('[Background] Failed to extract video ID:', e.message);
    }
    return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// ██ SECTION: KEEP-ALIVE MECHANISM
// ██ Purpose: Maintain Service Worker active via heartbeat
// ██ Dependencies: None
// ██ Safe to modify: Yes (isolated)
// ═══════════════════════════════════════════════════════════════════════════

chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "keep-alive") {
        console.log("🔌 [Background] Keep-Alive Port Connected");

        port.onMessage.addListener((msg) => {
            if (msg.type === "ping") {
                // Responding to the message resets the service worker's idle timer
                // console.log("💓 [Background] Ping received"); 
                port.postMessage({ type: "pong" });
            }
        });

        port.onDisconnect.addListener(() => {
            console.log("🔌 [Background] Keep-Alive Port Disconnected");
        });
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!request) return false;


    // 🛡️ [Security Pillar: State Synchronization]
    if (request.action === 'syncIntentState') {
        const backendUrl = 'http://localhost:51122/api/intents/sync';
        fetch(backendUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request.payload)
        })
            .then(() => console.log(`🔮 [Background] Intent ${request.payload?.id} synced to backend.`))
            .catch(err => console.error("❌ [Background] Sync failed:", err.message));
        return false;
    }

    // 📡 [Pillar 2: EvoMap Search]
    if (request.action === 'evomapSearch') {
        const backendUrl = 'http://localhost:51122/api/evomap/search';
        console.log(`📡 [Background] Searching EvoMap for: ${request.payload?.query}`);

        fetch(backendUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: request.payload.query,
                error: request.payload.error
            })
        })
            .then(res => res.json())
            .then(data => {
                sendResponse({ success: data.success, solution: data.solution });
            })
            .catch(err => {
                console.error("❌ [Background] EvoMap fetch failed:", err);
                sendResponse({ success: false, error: err.message });
            });
        return true;
    }

    console.log("📨 [Background] Message received:", request.action || request.type);

    // 1. Health Checks (React UI & Content Script)
    if (request.action === "ping" || request.action === "checkStatus") {
        const statusResponse = {
            success: true,
            status: 'connected',
            message: "pong",
            version: chrome.runtime.getManifest().version
        };

        sendResponse(statusResponse);

        // If it's a checkStatus from React, also broadcast to ensure all tabs are in sync
        if (request.action === "checkStatus") {
            chrome.tabs.query({ url: ["http://localhost:*/*", "http://127.0.0.1:*/*"] }, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, {
                        type: 'EXTENSION_STATUS_RESULT',
                        status: 'connected',
                        version: chrome.runtime.getManifest().version
                    }).catch(() => { });
                });
            });
        }
        return false; // Sync response, close port
    }

    // 🆕 V4.6: Open Options Page
    if (request.action === "openOptionsPage") {
        console.log("⚙️ [Background] Opening Options Page");
        chrome.runtime.openOptionsPage(() => {
            const err = chrome.runtime.lastError;
            if (err) {
                console.error("❌ [Background] Failed to open options page:", err.message);
                sendResponse({ success: false, error: err.message });
            } else {
                sendResponse({ success: true });
            }
        });
        return true; // Async response
    }

    // 🚀 Open Tab (Unified handler)


    // 🔍 V3.0: Check Automation Status (Used by content scripts to self-verify)
    if (request.action === "checkAutomationStatus") {
        const tabId = sender.tab?.id;
        let isAutomated = TabManager.activeTabs.has(tabId);
        let info = TabManager.activeTabs.get(tabId);

        // 🔄 Fuzzy Match Fallback: If ID mismatch, check for matching URL
        if (!isAutomated && sender.tab?.url) {
            for (const [id, tabInfo] of TabManager.activeTabs.entries()) {
                // Check if URLs are "close enough" (ignore query params if needed, or exact match)
                if (tabInfo.url === sender.tab.url || sender.tab.url.startsWith(tabInfo.url)) {
                    console.log(`🕵️ [Background] Fuzzy match found for Tab ${tabId} (matched stored Tab ${id})`);
                    isAutomated = true;
                    info = tabInfo;
                    break;
                }
            }
        }

        console.log(`🕵️ [Background] Automation check for Tab ${tabId}: ${isAutomated}`, {
            inMap: isAutomated,
            activeKeys: Array.from(TabManager.activeTabs.keys()),
            purpose: info?.purpose
        });

        sendResponse({ isAutomated, purpose: info?.purpose });
        return false;
    }

    // 🌐 V3.0: Universal Tab Opener (Tracks purpose)
    if (request.action === "openTab") {
        console.log(`🌐 [Background] Opening tab for URL: ${request.url} (Purpose: ${request.purpose})`);

        TabManager.create({
            url: request.url,
            active: true,
            purpose: request.purpose
        }).then(tab => {
            console.log(`✅ [Background] Tab opened successfully: ${tab.id}`);

            // 💉 INJECT MARKER: Persist automation status via Session Storage
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (purpose) => {
                    sessionStorage.setItem('gemini_is_automated', 'true');
                    sessionStorage.setItem('gemini_purpose', purpose || 'general');
                },
                args: [request.purpose]
            }).catch(() => { });

            // 💾 PERSIST INTENT: Save to local storage as fail-safe
            chrome.storage.local.get(['pending_automations'], (result) => {
                const pendings = result.pending_automations || [];
                // Clean old entries (>10 mins)
                const now = Date.now();
                const freshPendings = pendings.filter(p => now - p.timestamp < 600000);

                freshPendings.push({
                    url: request.url,
                    purpose: request.purpose,
                    timestamp: now
                });
                chrome.storage.local.set({ pending_automations: freshPendings });
                console.log("💾 [Background] Persisted automation intent:", request.url);
            });

            sendResponse({ success: true, tabId: tab.id });
        }).catch(error => {
            console.error('❌ [Background] Failed to open tab:', error);
            sendResponse({ success: false, error: error.message });
        });
        return true; // Async response
    }

    // 🔒 Close Tab (Safety wrapper)
    if (request.action === "closeTab") {
        const tabId = sender.tab?.id;
        if (tabId) {
            console.log("🔒 [Background] Closing tab:", tabId);
            chrome.tabs.remove(tabId, () => {
                const err = chrome.runtime.lastError;
                if (err) console.warn("⚠️ [Background] Close tab warning:", err.message);
            });
            sendResponse({ success: true });
        } else {
            console.warn("⚠️ [Background] closeTab blocked: No sender tab ID");
            sendResponse({ success: false, error: "No sender tab" });
        }
        return false;
    }

    // 🔥 PRIORITY: Download Video (GeminiGen CORS proxy) - Must be early!
    if (request.action === "downloadVideo") {
        console.log("📥 [Background] [PRIORITY] Delegate to DownloadService");

        DownloadService.downloadVideo(request.url)
            .then(base64 => {
                sendResponse({ success: true, data: base64 });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.toString() });
            });

        return true; // Async response
    }

    // 🆕 Scheduled Publish Trigger (from Scheduler Service)
    if (request.action === "TRIGGER_SCHEDULED_PUBLISH") {
        console.log("📅 [Background] Scheduled publish triggered:", request.payload);
        handleScheduledPublish(request.payload)
            .then(result => sendResponse({ success: true, ...result }))
            .catch(error => {
                console.error("❌ [Background] Scheduled publish error:", error);
                sendResponse({ success: false, error: error.message });
            });
        return true; // Async response
    }

    // 🆕 Get Scheduled Video Data
    if (request.action === "GET_SCHEDULED_VIDEO_DATA") {
        const { itemId } = request.payload || {};
        console.log("📋 [Background] Getting video data for:", itemId);

        // 🔄 MIGRATION: Use chrome.storage.local exclusively (better reliability than localStorage)
        chrome.storage.local.get([`videoData_${itemId}`], (data) => {
            const videoData = data[`videoData_${itemId}`];
            if (videoData) {
                sendResponse({ success: true, data: videoData, source: 'chrome.storage.local' });
            } else {
                console.error("❌ [Background] Video data not found for:", itemId);
                sendResponse({ success: false, error: 'Not found' });
            }
        });
        return true; // Async response
    }

    if (request.action === "TIKTOK_FILL_DESCRIPTION_ALL_FRAMES") {
        const tabId = sender?.tab?.id;
        const text = request.text || '';
        if (!tabId || !text) {
            sendResponse({ success: false });
            return false;
        }

        chrome.scripting.executeScript({
            target: { tabId, allFrames: true },
            args: [text],
            func: (value) => {
                const queryAllDeep = (selector, root = document) => {
                    const out = [];
                    try {
                        if (!root || typeof root.querySelectorAll !== 'function') return out;
                        out.push(...root.querySelectorAll(selector));
                        for (const n of root.querySelectorAll('*')) {
                            if (n && n.shadowRoot) out.push(...queryAllDeep(selector, n.shadowRoot));
                        }
                    } catch { }
                    return out;
                };

                const isVisible = (el) => {
                    try {
                        const st = getComputedStyle(el);
                        if (st.display === 'none' || st.visibility === 'hidden') return false;
                        return el.offsetParent !== null;
                    } catch {
                        return false;
                    }
                };

                const setTextarea = (el, v) => {
                    const proto = Object.getPrototypeOf(el);
                    const desc = Object.getOwnPropertyDescriptor(proto, 'value') || Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
                    if (desc?.set) desc.set.call(el, v);
                    else el.value = v;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                };

                const setContentEditable = (el, v) => {
                    el.focus?.({ preventScroll: true });
                    try {
                        const sel = document.getSelection?.();
                        sel?.removeAllRanges();
                        const r = document.createRange();
                        r.selectNodeContents(el);
                        sel?.addRange(r);
                    } catch { }
                    try { document.execCommand('delete'); } catch { }
                    try { document.execCommand('insertText', false, v); } catch { }
                    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: v }));
                };

                const matchPlaceholder = (textValue) => {
                    const ph = String(textValue || '').toLowerCase();
                    if (!ph) return false;
                    if (ph.includes('hashtags') || ph.includes('mention')) return false;
                    return ph.includes('share more') || ph.includes('description');
                };

                const pickDescriptionTextarea = () => {
                    const tas = queryAllDeep('textarea[placeholder]');
                    for (const ta of tas) {
                        if (!isVisible(ta)) continue;
                        const ph = ta.getAttribute?.('placeholder') || '';
                        if (matchPlaceholder(ph)) return ta;
                    }
                    return null;
                };

                const pickByPlaceholder = () => {
                    const list = queryAllDeep('textarea,[contenteditable="true"],div[role="textbox"]');
                    for (const el of list) {
                        if (!isVisible(el)) continue;
                        const role = (el.getAttribute?.('role') || '').toLowerCase();
                        if (role === 'combobox') continue;
                        const ph = (el.getAttribute?.('placeholder') || '').toLowerCase();
                        const aria = (el.getAttribute?.('aria-label') || '').toLowerCase();
                        if (ph.includes('share more') || ph.includes('description') || aria.includes('description')) return el;
                    }
                    return null;
                };

                const pickByTextNode = () => {
                    const needles = ['share more about your video', 'share more'];
                    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
                    let node = walker.nextNode();
                    while (node) {
                        const t = (node.nodeValue || '').toLowerCase();
                        if (needles.some(n => t.includes(n))) {
                            const host = node.parentElement;
                            const el = host?.closest?.('textarea,[contenteditable="true"],div[role="textbox"]') || host;
                            if (el && isVisible(el)) return el;
                        }
                        node = walker.nextNode();
                    }
                    return null;
                };

                const chosen = pickDescriptionTextarea() || pickByPlaceholder() || pickByTextNode();
                if (!chosen) return { ok: false, reason: 'NO_CANDIDATE' };

                const meta = {
                    tag: chosen.tagName,
                    role: chosen.getAttribute?.('role') || '',
                    placeholder: chosen.getAttribute?.('placeholder') || '',
                    ariaLabel: chosen.getAttribute?.('aria-label') || ''
                };

                if (chosen instanceof HTMLTextAreaElement) {
                    setTextarea(chosen, value);
                    const verified = String(chosen.value || '').includes(value);
                    return { ok: verified, kind: 'textarea', verified, ...meta };
                }

                if (chosen.isContentEditable) {
                    setContentEditable(chosen, value);
                    const verified = String(chosen.textContent || '').includes(value);
                    return { ok: verified, kind: 'contenteditable', verified, ...meta };
                }

                const role = (chosen.getAttribute?.('role') || '').toLowerCase();
                if (role === 'combobox') return { ok: false, reason: 'COMBOBOX', ...meta };

                const innerTextarea = chosen.querySelector?.('textarea');
                if (innerTextarea instanceof HTMLTextAreaElement && isVisible(innerTextarea)) {
                    setTextarea(innerTextarea, value);
                    const verified = String(innerTextarea.value || '').includes(value);
                    return { ok: verified, kind: 'textarea_inner', verified, ...meta };
                }

                const innerEditable = chosen.querySelector?.('[contenteditable="true"],div[role="textbox"]');
                const editable = innerEditable && innerEditable.isContentEditable ? innerEditable : chosen;
                setContentEditable(editable, value);
                const verified = String(editable.textContent || '').includes(value);
                return { ok: verified, kind: 'generic', verified, ...meta };
            }
        }, (results) => {
            const err = chrome.runtime?.lastError;
            if (err) {
                sendResponse({ success: false, error: err.message });
                return;
            }
            sendResponse({ success: true, results: results || [] });
        });

        return true;
    }

    if (request.action === "GET_TIKTOK_VIDEO_DATA") {
        (async () => {
            try {
                const youtubeVideoId = request.youtubeVideoId;
                const uploads = await getPendingUploads();
                const cachedVideo = (youtubeVideoId && uploads[youtubeVideoId]) || uploads['latest'];
                let videoData = cachedVideo?.videoData || null;
                if (!videoData && request.sourceYouTubeUrl) {
                    videoData = await resolveYouTubePublishedVideoData(request.sourceYouTubeUrl, youtubeVideoId);
                }
                sendResponse({
                    success: true,
                    videoData: videoData || null,
                    debug: {
                        cachedHit: !!cachedVideo?.videoData,
                        usedSourceYouTubeUrl: !!request.sourceYouTubeUrl,
                        hasYouTubeVideoId: !!youtubeVideoId,
                        videoDataLength: typeof videoData === 'string' ? videoData.length : 0
                    }
                });
            } catch (e) {
                sendResponse({ success: false, error: e?.message || String(e) });
            }
        })();
        return true;
    }

    // 🆕 V2.1: Relay TikTok Upload Status to React App
    if (request.action === "TIKTOK_UPLOAD_COMPLETE") {
        console.log(`📢 [Background] Relaying TIKTOK_UPLOAD_COMPLETE: ${request.status}`);

        chrome.tabs.query({
            url: [
                "http://localhost:3000/*",
                "http://localhost:3001/*",
                "http://localhost:5173/*",
                "http://localhost:4000/*",
                "http://127.0.0.1:3000/*",
                "http://127.0.0.1:5173/*",
                "http://127.0.0.1:4000/*"
            ]
        }, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'TIKTOK_UPLOAD_RESULT',
                    status: request.status,
                    error: request.error,
                    caption: request.caption,
                    timestamp: request.timestamp
                }).catch(() => { });
            });
        });

        sendResponse({ success: true });
        return false;
    }

    // 1.1 Relay to All Tabs (Broadcast)
    if (request.action === "relayToAllTabs") {
        console.log("📡 [Background] Broadcasting message to all tabs:", request.message?.type || request.message?.action);
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                try {
                    chrome.tabs.sendMessage(tab.id, request.message).catch(() => {
                        // Ignore errors for tabs that don't have our content script
                    });
                } catch (e) { }
            });
        });
        sendResponse({ success: true });
        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ██ SECTION: GOOGLE FLOW ALL-IN-ONE UPLOAD
    // ██ Purpose: Download video, store data, and open YouTube Studio in one action
    // ██ Dependencies: pendingUploads (global)
    // ██ Safe to modify: Yes (new action)
    // ═══════════════════════════════════════════════════════════════════════

    if (request.action === "googleFlowUpload") {
        const { videoUrl, uploadData } = request;
        const videoId = uploadData?.id || 'googleflow_' + Date.now();

        console.log(`🚀 [Background] Google Flow Upload - Starting for ID: ${videoId}`);
        console.log(`   Video URL: ${videoUrl?.substring(0, 60)}...`);

        // Step 1: Download the video
        fetch(videoUrl)
            .then(response => response.arrayBuffer())
            .then(buffer => {
                // Convert to base64
                const bytes = new Uint8Array(buffer);
                let binary = '';
                for (let i = 0; i < bytes.byteLength; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                const base64 = btoa(binary);

                console.log(`✅ [Background] Video downloaded: ${base64.length} chars`);

                // Step 2: Store the data
                const videoData = {
                    id: videoId,
                    videoData: `data:video/mp4;base64,${base64}`,
                    title: uploadData?.title || 'Google Flow Video',
                    description: uploadData?.description || '',
                    tags: uploadData?.tags || '',
                    fileName: 'google_flow_video.mp4',
                    scheduleDate: uploadData?.scheduleDate || '',
                    scheduleTime: uploadData?.scheduleTime || '',
                    scheduleTimeOnly: uploadData?.scheduleTimeOnly || '',
                    isShorts: true,
                    pinnedComment: uploadData?.pinnedComment || ''
                };

                // 🆕 V4.5: Use persistent storage
                getPendingUploads().then(uploads => {
                    uploads[videoId] = videoData;
                    uploads['latest'] = videoData;
                    savePendingUploads(uploads).then(() => {
                        console.log(`📦 [Background] Video data stored for ID: ${videoId} (Persistent)`);

                        // Step 3: Open YouTube Studio
                        const uploadUrl = `https://studio.youtube.com/channel/mine/videos/upload?d=${Date.now()}&gemini_id=${videoId}`;
                        chrome.tabs.create({ url: uploadUrl, active: true }, (tab) => {
                            console.log(`✅ [Background] YouTube Studio opened: Tab ${tab?.id}`);
                        });
                    });
                });
            })
            .catch(error => {
                console.error(`❌ [Background] Google Flow Upload failed:`, error);
            });

        sendResponse({ success: true, videoId });
        return false;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ██ SECTION: GEMINIGEN VIDEO DOWNLOAD & RELAY
    // ██ Purpose: Download video from URL and relay to YouTube Studio
    // ██ Dependencies: pendingUploads (global)
    // ██ Upstream: platforms/geminiGen/autoPilot.js → processFoundVideo
    // ██ Safe to modify: ⚠️ CAUTION - affects GeminiGen upload workflow
    // ═══════════════════════════════════════════════════════════════════════

    // 🔧 V8.2: downloadVideo handler moved to PRIORITY section (line ~471) for reliability

    // 🔧 V8.3: Legacy relayGeminiVideoResult handler REMOVED. 
    // It was causing a race condition by triggering upload before React could provide metadata.
    // The correct handler is now at line ~1199 (relayGeminiVideoResult) which relays to React first.


    // 🆕 V2.7: Force open YouTube Studio with stored video data (for Google Flow blob videos)
    if (request.action === "forceOpenYouTubeStudio") {
        const videoId = request.videoId;
        console.log(`🚀 [Background] Force opening YouTube Studio for video: ${videoId}`);

        getPendingUploads().then(uploads => {
            const videoData = uploads[videoId] || uploads['latest'];

            if (videoData) {
                // Ensure 'latest' also points to this video
                uploads['latest'] = videoData;
                savePendingUploads(uploads).then(() => {
                    // Open YouTube Studio upload page
                    const uploadUrl = `https://studio.youtube.com/channel/mine/videos/upload?d=${Date.now()}&gemini_id=${videoId}`;
                    chrome.tabs.create({ url: uploadUrl, active: true }, (tab) => {
                        console.log(`✅ [Background] YouTube Studio opened: Tab ${tab?.id}`);
                        sendResponse({ success: true, tabId: tab?.id });
                    });
                });
            } else {
                console.error(`❌ [Background] No video data found for: ${videoId}`);
                // Open YouTube Studio anyway for manual upload
                chrome.tabs.create({ url: "https://studio.youtube.com/channel/mine/videos/upload", active: true });
                sendResponse({ success: false, error: "No video data found" });
            }
        });

        return true; // Async response
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ██ SECTION: COMMENT AUTOMATION HANDLERS
    // ██ Purpose: Handle comment posting and status sync
    // ██ Dependencies: chrome.storage.local
    // ██ Downstream: commentAutomation.js, scheduledCommentMonitor.js
    // ██ Safe to modify: ⚠️ CAUTION - affects scheduled comments
    // ═══════════════════════════════════════════════════════════════════════

    // 🔧 V8.2: relayCommentPosted handler moved to line ~1575 (complete version with scheduler update)

    // 🆕 V2.7: Trigger auto comment (open YouTube video page with pending comment)
    if (request.action === "triggerAutoComment") {
        console.log(`💬 [Background] Triggering auto comment for: ${request.url}`);

        // Store comment data for pickup by commentAutomation.js
        chrome.storage.local.set({
            'pending_auto_comment': JSON.stringify({
                videoUrl: request.url,
                text: request.text,
                pin: request.pin,
                videoId: request.videoId,
                timestamp: Date.now()
            })
        }, () => {
            // Open the YouTube video page
            chrome.tabs.create({ url: request.url, active: true }, (tab) => {
                console.log(`✅ [Background] Opened YouTube for auto comment: Tab ${tab?.id}`);
                sendResponse({ success: true, tabId: tab?.id });
            });
        });

        return true; // Async response
    }

    // 🆕 V2.7: Relay video now public (scheduled → published status)
    if (request.action === "relayVideoNowPublic") {
        console.log(`📢 [Background] Video now public: ${request.videoId}`);

        // Broadcast to React app
        chrome.tabs.query({ url: ["*://localhost/*", "*://127.0.0.1/*"] }, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'VIDEO_NOW_PUBLIC',
                    videoId: request.videoId,
                    videoUrl: request.videoUrl,
                    timestamp: new Date().toISOString()
                }).catch(() => { });
            });
        });

        sendResponse({ success: true });
        return false;
    }

    // 🆕 V2.7: Ignite sockpuppet comment queue
    if (request.action === "IGNITE_SOCKPUPPET") {
        console.log(`🔥 [Background] Ignite sockpuppet triggered for: ${request.videoUrl}`);
        console.log(`   Comments: ${request.comments?.length}, Accounts: ${request.accounts?.length}`);

        // Store the Ignite queue in storage for execution
        const igniteQueue = {
            videoUrl: request.videoUrl,
            comments: request.comments || [],
            accounts: request.accounts || [],
            autoTriggered: request.autoTriggered || false,
            createdAt: Date.now(),
            currentIndex: 0
        };

        chrome.storage.local.set({ 'ignite_queue': igniteQueue }, () => {
            console.log(`🔥 [Background] Ignite queue stored: ${igniteQueue.comments.length} comments`);

            // Notify React about Ignite queue
            chrome.tabs.query({ url: ["*://localhost/*", "*://127.0.0.1/*"] }, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, {
                        type: 'IGNITE_QUEUE_STARTED',
                        videoUrl: request.videoUrl,
                        queueSize: igniteQueue.comments.length
                    }).catch(() => { });
                });
            });

            sendResponse({ success: true, queueSize: igniteQueue.comments.length });
        });

        return true; // Async response
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ██ SECTION: VIDEO DATA STORAGE
    // ██ Purpose: Store video data for YouTube upload
    // ██ Dependencies: pendingUploads (global)
    // ██ Downstream: studioUploader.js → getVideoData
    // ██ Safe to modify: ⚠️ CAUTION - affects all upload workflows
    // ═══════════════════════════════════════════════════════════════════════

    if (request.action === "storeVideoData") {
        const id = request.data.id !== undefined ? request.data.id : request.data.videoId;
        console.log(`📦 [Background] Storing video data for ID: ${id} (Persistent)`);
        if (id !== undefined) {
            getPendingUploads().then(uploads => {
                uploads[id] = request.data;
                uploads['latest'] = request.data;
                savePendingUploads(uploads).then(() => {
                    sendResponse({ success: true });
                });
            }).catch(e => {
                sendResponse({ success: false, error: e.message });
            });
            return true; // Keep channel open for async response
        } else {
            console.error("❌ [Background] Cannot store data without ID!");
            sendResponse({ success: false, error: "Missing ID" });
            return false;
        }
    }

    // 2. Retrieve Data (from YouTube)
    if (request.action === "getVideoData") {
        let id = request.videoId || 'latest';

        if (id === 'latest' && sender.tab && sender.tab.url) {
            try {
                const url = new URL(sender.tab.url);
                const urlId = url.searchParams.get('gemini_id');
                if (urlId) id = urlId;
            } catch (e) {
                console.warn("[Background] Failed to parse sender URL:", e.message);
            }
        }

        console.log(`🔍 [Background] Retrieving video data for ID: ${id} (Persistent)`);

        getPendingUploads().then(uploads => {
            const data = uploads[id] || uploads['latest'];
            if (data) {
                console.log(`✅ [Background] Found data for ID: ${id} (Title: ${data.title})`);
                sendResponse({ success: true, data: data });
            } else {
                console.warn(`⚠️ [Background] No data found for ID: ${id}`);
                sendResponse({ success: false, error: "No data found" });
            }
        });
        return true; // Keep channel open for async response
    }

    // 2.5 Clear Data
    if (request.action === "clearVideoData") {
        const reqId = request.videoId;
        console.log(`🧹 [Background] Clearing video data for ID: ${reqId || 'all'}...`);

        getPendingUploads().then(uploads => {
            if (reqId && uploads[reqId]) {
                delete uploads[reqId];
            }
            if (uploads['latest']) {
                console.log(`🧹 [Background] Also clearing 'latest' entry`);
                delete uploads['latest'];
            }
            savePendingUploads(uploads).then(() => {
                sendResponse({ success: true });
            });
        });
        return true; // Keep channel open for async response
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ██ SECTION: VIDEO RESCHEDULE
    // ██ Purpose: Handle video reschedule requests from React
    // ██ Dependencies: pendingUploads (global)
    // ██ Safe to modify: Yes (isolated)
    // ═══════════════════════════════════════════════════════════════════════

    if (request.action === "rescheduleVideo") {
        const { videoUrl, scheduleDate, scheduleTime, title } = request.data;
        console.log(`🔄 [Background] Rescheduling video: "${title}"`);
        console.log(`   Video URL: ${videoUrl}`);
        console.log(`   New Schedule: ${scheduleDate} ${scheduleTime}`);

        // Extract video ID from various YouTube URL formats
        let videoId = null;
        try {
            if (videoUrl.includes('youtube.com/shorts/')) {
                videoId = videoUrl.match(/shorts\/([a-zA-Z0-9_-]+)/)?.[1];
            } else if (videoUrl.includes('youtube.com/watch')) {
                const url = new URL(videoUrl);
                videoId = url.searchParams.get('v');
            } else if (videoUrl.includes('youtu.be/')) {
                videoId = videoUrl.match(/youtu\.be\/([a-zA-Z0-9_-]+)/)?.[1];
            }
        } catch (e) {
            console.error("❌ [Background] Failed to parse video ID:", e);
        }

        if (!videoId) {
            console.error("❌ [Background] Cannot extract video ID from URL:", videoUrl);
            sendResponse({ success: false, error: "Invalid video URL" });
            return false;
        }

        console.log(`   Video ID: ${videoId}`);

        // Store the reschedule data for the content script to pick up
        const rescheduleData = {
            action: 'reschedule',
            videoId: videoId,
            scheduleDate: scheduleDate,
            scheduleTime: scheduleTime,
            title: title
        };

        getPendingUploads().then(uploads => {
            uploads[`reschedule_${videoId}`] = rescheduleData;

            // Construct YouTube Studio video edit URL
            const studioEditUrl = `https://studio.youtube.com/video/${videoId}/edit`;
            console.log(`   Opening: ${studioEditUrl}`);

            // Open YouTube Studio edit page
            chrome.tabs.create({ url: studioEditUrl, active: true }, (tab) => {
                console.log(`✅ [Background] YouTube Studio edit page opened: Tab ${tab.id}`);

                // Store tab info for tracking
                uploads[`reschedule_tab_${tab.id}`] = rescheduleData;
                savePendingUploads(uploads).then(() => {
                    sendResponse({ success: true, videoId: videoId });
                });
            });
        });

        return true; // Keep channel open for async response
    }

    // 🆕 V8.2: Open GeminiGen Tab (Fix for broken message chain)
    if (request.action === 'openGeminiGenTab') {
        const url = request.url || 'https://geminigen.ai/';
        console.log(`🤖 [Background] Opening GeminiGen Tab: ${url.substring(0, 80)}...`);

        chrome.tabs.create({ url: url, active: true }, (tab) => {
            console.log(`✅ [Background] GeminiGen Tab opened: ${tab.id}`);
            sendResponse({ success: true, tabId: tab.id });
        });

        return true; // Async response
    }

    // 🆕 V8.0: Relay LMArena Response to React (Fix for broken message chain)
    if (request.action === 'relayLMArenaResponse') {
        console.log(`🏟️ [Background] Relaying LMARENA_RESPONSE_RESULT to React tabs`);

        chrome.tabs.query({
            url: [
                "http://localhost:*/*",
                "http://127.0.0.1:*/*"
            ]
        }, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'LMARENA_RESPONSE_RESULT',
                    data: request.data,
                    source: 'lmarena'
                }).catch(() => { });
            });
        });

        sendResponse({ success: true });
        return false;
    }

    // 🆕 V9.0: Relay Plan Response from Studio Agent to React (Strategy Generation)
    // 🔧 Consolidated Handler (V10.0)
    if (request.action === 'relayPlanResponse' || request.action === 'relayLMArenaResponse') {
        const isAskStudio = request.action === "relayPlanResponse";
        const payloadData = request.payload || request.data;
        console.log(`📋 [Background] Relaying ${isAskStudio ? 'Ask Studio' : 'LMArena'} response to React tabs (len: ${payloadData?.length || 0})`);

        chrome.tabs.query({
            url: [
                "*://localhost/*",
                "*://127.0.0.1/*",
                "http://localhost:*/*",
                "http://127.0.0.1:*/*"
            ]
        }, (tabs) => {
            console.log(`📡 [Background] Broadcasting plan response to ${tabs.length} local tabs`);
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'YPP_PLAN_RESULT',
                    payload: payloadData,
                    source: isAskStudio ? 'ask_studio' : 'lmarena',
                    isHeartbeat: request.isHeartbeat // 🎯 Pass heartbeat flag to React
                }).catch(() => { });
            });
        });

        // 🚀 AUTO-CLOSE: Only close if it's an LMArena tab
        if (sender.tab && sender.tab.id && sender.tab.url && sender.tab.url.includes('lmarena.ai')) {
            console.log("❌ [Background] Auto-closing LMArena tab:", sender.tab.id);
            setTimeout(() => {
                chrome.tabs.remove(sender.tab.id).catch(() => { });
            }, 2000);
        }

        if (typeof sendResponse === 'function') sendResponse({ success: true });
        return true; // ALWAYS return true for tabs.query callback
    }

    // 🆕 V8.1: Relay GeminiGen Video Result to React (Fix for broken video message chain)
    if (request.action === 'relayGeminiVideoResult' || request.action === EXT_CONSTANTS.ACTIONS.RELAY_GEMINI_VIDEO_RESULT) {
        console.log(`🎬 [Background] Relaying GEMINI_VIDEO_RESULT to React tabs (payload: ${request.payload?.length || 0} chars)`);

        chrome.tabs.query({
            url: [
                "http://localhost:*/*",
                "http://127.0.0.1:*/*"
            ]
        }, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'GEMINI_VIDEO_RESULT',
                    payload: request.payload,
                    status: request.status || 'download_complete',
                    source: 'geminiGen'
                }).catch(() => { });
            });
        });

        sendResponse({ success: true });
        return false;
    }

    if (request.action === 'relayAnalyticsDirectResult') {
        console.log(`📊 [Background] Relaying Direct Analytics Result`);
        chrome.tabs.query({
            url: [
                "http://localhost:*/*",
                "http://127.0.0.1:*/*"
            ]
        }, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'YOUTUBE_ANALYTICS_DIRECT_RESULT',
                    data: request.data
                }).catch(() => { });
            });
        });
        sendResponse({ success: true });
        return false;
    }

    // 🔧 V8.2: Duplicate relayYouTubeUploadComplete removed - see line ~3110 for complete version with scheduled comment handling

    // 🔧 V8.2: Duplicate relayCommentPosted removed - see line ~1554 for complete version with scheduler update

    // 🆕 V8.1: Relay X (Twitter) Post Result to React
    if (request.action === 'xPostResult') {
        console.log(`🐦 [Background] Relaying X_POST_RESULT to React tabs`);

        chrome.tabs.query({
            url: [
                "http://localhost:*/*",
                "http://127.0.0.1:*/*"
            ]
        }, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'X_POST_RESULT',
                    success: request.success,
                    postUrl: request.postUrl,
                    error: request.error,
                    timestamp: Date.now()
                }).catch(() => { });
            });
        });

        sendResponse({ success: true });
        return false;
    }

    // 💎 Pillar 4 & 3: Intent/Effect Bridge (V10.0)
    if (request.action === 'processIntent') {
        const { intentType, payload } = request;
        console.log(`🔮 [Background] Processing Intent: ${intentType}`);

        // Logic for specific intents
        if (intentType === 'INTENT_START_UPLOAD') {
            const videoData = payload.payload || payload;
            chrome.storage.local.set({ 'pendingVideoUpload': videoData }, () => {
                console.log("✅ [Background] Intent Handled: Video data stored.");
                const uploadUrl = `https://studio.youtube.com/channel/mine/videos/upload?d=ud&gemini_id=${videoData.id || Date.now()}`;
                chrome.tabs.create({ url: uploadUrl });
            });
        }

        sendResponse({ success: true, processed: true });
        return false;
    }

    // 🆕 V7.9/V9.0: Relay Analytics/Plan Request to Studio Agent (Forwarding)
    // 🔧 Consolidated Handler (V10.0)
    if (request.action === 'performAnalyticsAsk' || request.action === 'ASK_STUDIO_GENERATE_PLAN' || request.type === 'ASK_STUDIO_GENERATE_PLAN' || request.action === 'relayAskStudioGeneratePlan') {
        const promptFromRequest = request.prompt || request.payload?.directPrompt || request.payload?.prompt;
        console.log(`🤖 [Background] Forwarding Ask Studio request. Prompt length: ${promptFromRequest?.length || 0}`);

        chrome.tabs.query({ url: "*://studio.youtube.com/*" }, (tabs) => {
            const studioTab = tabs.find(t => t.url.includes('/channel/')) || tabs[0];

            if (studioTab) {
                console.log(`   ✅ Forwarding to Studio tab: ${studioTab.id}`);
                chrome.tabs.update(studioTab.id, { active: true });
                chrome.tabs.sendMessage(studioTab.id, request, (response) => {
                    if (chrome.runtime.lastError) {
                        console.warn("   ⚠️ Forward failed, falling back to storage:", chrome.runtime.lastError.message);
                        chrome.storage.local.set({ 'pendingAnalyticsRequest': request.payload || request });
                        chrome.tabs.reload(studioTab.id);
                    }
                });
                if (typeof sendResponse === 'function') sendResponse({ success: true, forwarded: true });
            } else {
                console.warn("   ⚠️ Studio tab not found! Opening new one...");
                chrome.storage.local.set({ 'pendingAnalyticsRequest': request.payload || request });
                // 🔧 V10.1: Open Analytics page directly with protection parameter
                const url = "https://studio.youtube.com/channel/mine/analytics?gemini_action=single_tab_analytics";
                chrome.tabs.create({ url: url, active: true }, (newTab) => {
                    if (typeof sendResponse === 'function') sendResponse({ success: true, forwarded: false, message: "Opening new tab" });
                });
            }
        });

        return true; // MUST be true for tabs.query callback
    }
    // 🆕 Fast Connect: Handle START_DIRECT_COLLECT message from React
    if (request.type === 'START_DIRECT_COLLECT') {
        console.log('🚀 [Background] Handling START_DIRECT_COLLECT:', request.payload);
        const { action, channelId } = request.payload || {};

        // Construct a comprehensive prompt for the "Full Report"
        const fullReportPrompt = `Generate a comprehensive analysis of my channel for the last 28 days.
CRITICAL: You MUST output ONLY valid JSON. No markdown, no explanations, no code blocks.
Use this EXACT structure with specific numbers:
{
  "yppSprint": { "views_48h": 0, "subs_48h": 0, "summary": "Brief 48h trend" },
  "channelOverview": { "total_views": 0, "watch_time_hours": 0, "subs_gained": 0, "avg_view_duration": "0:00" },
  "retention": { "avg_percentage": "0%", "typical_drop_point": "0:30" },
  "velocity": { "views_last_60min": 0, "trend_status": "stable" },
  "videoPerformance": { "top_video_title": "", "top_video_views": 0 },
  "audience": { "top_geographies": [], "peak_activity_time": "" },
  "traffic": { "shorts_feed_percentage": 0, "search_percentage": 0 },
  "engagement": { "likes": 0, "comments": 0, "shares": 0 },
  "monetization": { "rpm": 0, "cpm": 0 },
  "recommendations": ["Actionable tip 1", "Actionable tip 2"]
}
CRITICAL: Escape all double quotes within strings (e.g. \\"text\\"). Do not use trailing commas.`;

        // Store the request in storage so studioAgent.js picks it up on load
        chrome.storage.local.set({
            'pendingAnalyticsRequest': {
                directPrompt: fullReportPrompt,
                category: 'full_report',
                isPlan: false
            }
        }, () => {
            console.log("💾 [Background] Stored pendingAnalyticsRequest for Fast Connect");

            // Open YouTube Studio Videos page with gemini_action parameter
            // Using /videos/short based on user's actual URL format
            const studioUrl = `https://studio.youtube.com/channel/${channelId || 'mine'}/videos/short?gemini_action=single_tab_analytics`;
            console.log(`🌐 [Background] Opening YouTube Studio Videos page: ${studioUrl}`);

            TabManager.create({
                url: studioUrl,
                active: true,
                purpose: 'fast_connect'
            }).then(tab => {
                console.log(`✅ [Background] YouTube Studio opened for Fast Connect: Tab ${tab.id}`);
                sendResponse({ success: true, tabId: tab.id });
            }).catch(error => {
                console.error('❌ [Background] Failed to open YouTube Studio:', error);
                sendResponse({ success: false, error: error.message });
            });
        });

        return true; // Async response
    }

    // 🆕 Relay Direct Analytics Result to React App
    if (request.action === "relayAnalyticsDirectResult") {
        console.log("📊 [Background] Relaying Direct Analytics Result to React:", request.data?.category);

        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                if (tab.url && (tab.url.includes('localhost') || tab.url.includes('127.0.0.1'))) {
                    chrome.tabs.sendMessage(tab.id, {
                        type: 'YOUTUBE_ANALYTICS_DIRECT_RESULT',
                        data: request.data
                    }).catch(() => { });
                }
            });
        });

        sendResponse({ success: true });
        return false;
    }

    // 🆕 V7.9: Relay Standard Analytics Result
    if (request.action === 'relayAnalyticsResult') {
        console.log(`📊 [Background] Relaying YOUTUBE_ANALYTICS_RESULT to React tabs`);

        chrome.tabs.query({
            url: [
                "http://localhost:*/*",
                "http://127.0.0.1:*/*"
            ]
        }, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'YOUTUBE_ANALYTICS_RESULT',
                    category: request.category,
                    data: request.data
                }).catch(() => { });
            });
        });

        sendResponse({ success: true });
        return false;
    }

    // 🔄 V6.2: Get Reschedule Data by Tab ID
    if (request.action === "getRescheduleForTab") {
        const tabId = sender.tab?.id;
        console.log(`🚀 [Background] Retrieving reschedule data for Tab ID: ${tabId}...`);

        getPendingUploads().then(uploads => {
            if (tabId && uploads[`reschedule_tab_${tabId}`]) {
                const data = uploads[`reschedule_tab_${tabId}`];
                console.log("✅ [Background] Found reschedule data for tab:", tabId);
                sendResponse({ success: true, data: data });
            } else {
                sendResponse({ success: false, error: "No reschedule data for this tab" });
            }
        });
        return true; // Keep channel open for async response
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ██ SECTION: AUTO-COMMENT SYSTEM
    // ██ Purpose: Handle comment posting and status relay
    // ██ Dependencies: chrome.storage.local
    // ██ Downstream: commentAutomation.js, scheduledCommentMonitor.js
    // ██ Safe to modify: ⚠️ CAUTION - affects scheduled comments
    // ═══════════════════════════════════════════════════════════════════════

    if (request.action === "openYouTubeVideoTab") {
        const url = request.url;
        console.log(`🎬 [Background] Opening YouTube video for auto-comment: ${url?.substring(0, 60)}...`);

        chrome.tabs.create({ url: url, active: true }, (tab) => {
            console.log(`✅ [Background] YouTube video tab opened: Tab ${tab.id}`);
        });

        sendResponse({ success: true });
        return false;
    }

    // 🆕 V7.5: Trigger Auto-Comment (from React "Post Now" button)
    // 🔧 V2.3: Added duplicate prevention
    if (request.action === "triggerAutoComment") {
        const { url, text, pin, videoId } = request;
        console.log(`🔥 [Background] Triggering auto-comment for: ${url?.substring(0, 60)}...`);
        console.log(`   Comment: "${text?.substring(0, 50)}..."`);

        if (!url || !text) {
            console.error("❌ [Background] Missing url or text for triggerAutoComment");
            sendResponse({ success: false, error: "Missing url or text" });
            return false;
        }

        // 🛡️ V2.3: Prevent duplicate triggers using in-memory debounce
        const debounceKey = `autoComment_${videoId || url}`;
        if (!self.autoCommentDebounce) self.autoCommentDebounce = {};

        const lastTrigger = self.autoCommentDebounce[debounceKey];
        const now = Date.now();

        if (lastTrigger && (now - lastTrigger) < 30000) { // 30 second debounce
            console.warn(`⚠️ [Background] Duplicate trigger blocked for ${videoId || url}. Last trigger was ${(now - lastTrigger) / 1000}s ago.`);
            sendResponse({ success: false, error: "Duplicate trigger blocked" });
            return false;
        }

        self.autoCommentDebounce[debounceKey] = now;

        // 🆕 V7.9: Setup Ignite Queue if sockpuppet comments are provided
        if (sockpuppetComments && sockpuppetComments.length > 0) {
            // Get Ignite config (or defaults)
            const config = typeof EXT_CONSTANTS !== 'undefined' && EXT_CONSTANTS.IGNITE_CONFIG
                ? EXT_CONSTANTS.IGNITE_CONFIG
                : { SOCKPUPPET_ACCOUNTS: ['CCTV Debunker', 'c hao', 'chi rimmon'], COMMENT_DELAY_MIN: 60000, COMMENT_DELAY_MAX: 120000, FIRST_COMMENT_DELAY: 5000 };

            const accounts = config.SOCKPUPPET_ACCOUNTS;

            const scriptedQueue = sockpuppetComments.map((commentText, index) => {
                const delay = index === 0
                    ? config.FIRST_COMMENT_DELAY
                    : (config.COMMENT_DELAY_MIN + Math.random() * (config.COMMENT_DELAY_MAX - config.COMMENT_DELAY_MIN));

                return {
                    text: commentText,
                    account: accounts[index % accounts.length] || null,
                    delay: delay,
                    pinFirst: false // Sockpuppets shouldn't pin
                };
            });

            // Store Ignite queue
            chrome.storage.local.set({
                ignite_script_queue: JSON.stringify({
                    videoUrl: url,
                    queue: scriptedQueue,
                    accounts: accounts,
                })
            }, () => {
                console.log(`🔥 [Background] Ignite script queue stored: ${scriptedQueue.length} comments`);
            });
        }

        // Store comment data for content script
        chrome.storage.local.set({
            'pending_auto_comment': JSON.stringify({
                videoUrl: url,
                text: text,
                pin: pin,
                videoId: videoId,
                timestamp: Date.now()
            })
        }, () => {
            // Open YouTube video page
            chrome.tabs.create({ url: url, active: true }, (tab) => {
                console.log(`✅ [Background] YouTube video opened for auto-comment: Tab ${tab.id}`);
                sendResponse({ success: true, tabId: tab.id });
            });
        });

        return true; // Async response
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ██ SECTION: GOOGLE VIDS DATA MANAGEMENT
    // ██ Purpose: Handle Google Vids upload workflow
    // ██ Dependencies: chrome.storage.local, pendingUploads
    // ██ Safe to modify: ⚠️ CAUTION - affects Google Vids uploads
    // ═══════════════════════════════════════════════════════════════════════


    if (request.action === EXT_CONSTANTS.ACTIONS.STORE_GOOGLE_VIDS_DATA) {
        const id = request.data?.id || 'googlevids_' + Date.now();
        console.log(`📦 [Background] Storing Google Vids upload data for ID: ${id} (Persistent)`);

        const uploadData = {
            ...request.data,
            id: id,
            source: 'googlevids',
            storedAt: Date.now()
        };

        getPendingUploads().then(uploads => {
            uploads[id] = uploadData;
            uploads['latest_googlevids'] = uploadData;
            uploads['latest'] = uploadData;

            savePendingUploads(uploads).then(() => {
                console.log(`✅ [Background] Google Vids data persisted to storage`);
            });
        });

        // 🔧 FIX: Store to BOTH keys - the per-ID key AND the key the download interceptor expects
        chrome.storage.local.set({
            [`googlevids_upload_${id}`]: uploadData,
            [EXT_CONSTANTS.STORAGE.GOOGLE_VIDS_UPLOAD_DATA]: uploadData  // ← This is what download interceptor checks!
        }, () => {
            console.log(`✅ [Background] Google Vids data persisted to storage (both keys)`);
        });

        // 🆕 V7.4: Store scheduled comment if pinnedComment provided
        if (uploadData.pinnedComment && uploadData.pinnedComment.trim()) {
            console.log(`📝 [Background] Storing scheduled comment for pre-upload video...`);
            console.log(`   Comment: "${uploadData.pinnedComment.substring(0, 50)}..."`);
            console.log(`   Schedule: ${uploadData.scheduleTime || 'immediate'}`);

            // Parse schedule time
            let scheduledTimestamp = Date.now();
            if (uploadData.scheduleDate && uploadData.scheduleTimeOnly) {
                // Combine date + time: "2026/01/05" + "3:00 PM"
                const combined = `${uploadData.scheduleDate} ${uploadData.scheduleTimeOnly}`;
                const parsed = new Date(combined);
                if (!isNaN(parsed.getTime())) {
                    scheduledTimestamp = parsed.getTime();
                }
            } else if (uploadData.scheduleTime) {
                const parsed = new Date(uploadData.scheduleTime);
                if (!isNaN(parsed.getTime())) {
                    scheduledTimestamp = parsed.getTime();
                }
            }

            // We don't have YouTube video ID yet (upload hasn't happened),
            // so store with temp ID and update later when upload completes
            chrome.storage.local.get(['gemini_scheduled_comments'], (result) => {
                const scheduledComments = result.gemini_scheduled_comments || {};
                // Use uploadData.id as temporary key (will be null until YouTube assigns real video ID)
                const tempId = `pending_${id}`;
                scheduledComments[tempId] = {
                    url: null,  // Will be updated after upload
                    text: uploadData.pinnedComment,
                    pin: true,
                    uploadId: id,  // Link back to upload data
                    scheduledTime: uploadData.scheduleTime || null,
                    scheduledTimestamp: scheduledTimestamp,
                    createdAt: Date.now(),
                    attempts: 0,
                    maxAttempts: 10,
                    lastCheck: null,
                    status: 'pending_upload'  // Not yet uploaded
                };
                chrome.storage.local.set({ 'gemini_scheduled_comments': scheduledComments }, () => {
                    console.log(`✅ [Background] Scheduled comment pre-stored with temp ID: ${tempId}`);
                });
            });
        }

        sendResponse({ success: true, id: id });
        return false;
    }

    // 🆕 V7.1: Google Vids - Check if YouTube Studio was opened
    if (request.action === EXT_CONSTANTS.ACTIONS.CHECK_STUDIO_OPENED) {
        const videoId = request.videoId;
        console.log(`🔍 [Background] Checking if YouTube Studio opened for video: ${videoId}`);

        // Check if we have a record of opening YouTube Studio for this video
        const key = EXT_CONSTANTS.STORAGE.YOUTUBE_STUDIO_OPENED_PREFIX + videoId;
        chrome.storage.local.get([key], (result) => {
            if (result[key]) {
                sendResponse({ opened: true });
            } else {
                sendResponse({ opened: false });
            }
        });
        return true; // Async response
    }

    // 🆕 V7.1: Google Vids - Force open YouTube Studio (fallback)
    if (request.action === EXT_CONSTANTS.ACTIONS.FORCE_OPEN_STUDIO) {
        const videoId = request.videoId;
        console.log(`🚀 [Background] Force opening YouTube Studio for video: ${videoId} (Persistent)`);

        getPendingUploads().then(uploads => {
            const uploadData = uploads[videoId] || uploads['latest'] || uploads['latest_googlevids'];
            console.log(`📦 [Background] Upload data found:`, !!uploadData);

            if (uploadData) {
                // Store for YouTube upload page to pick up
                uploads['latest'] = uploadData;
                savePendingUploads(uploads).then(() => {
                    // Open YouTube Studio upload page
                    const uploadUrl = `https://studio.youtube.com/channel/mine/videos/upload?d=${Date.now()}&gemini_id=${videoId}`;
                    chrome.tabs.create({ url: uploadUrl, active: true }, (tab) => {
                        console.log(`✅ [Background] YouTube Studio opened: Tab ${tab.id}`);

                        // Mark as opened
                        const key = EXT_CONSTANTS.STORAGE.YOUTUBE_STUDIO_OPENED_PREFIX + videoId;
                        chrome.storage.local.set({
                            [key]: true
                        });
                    });
                    sendResponse({ success: true });
                });
            } else {
                console.error(`❌ [Background] No upload data found for video: ${videoId}`);

                // Open YouTube Studio anyway for manual upload
                chrome.tabs.create({
                    url: "https://studio.youtube.com/channel/mine/videos/upload",
                    active: true
                });

                sendResponse({ success: false, error: "No upload data found" });
            }
        });
        return true; // Async response
    }

    // 🆕 V7.1: Google Vids - Relay status to React app
    if (request.action === EXT_CONSTANTS.ACTIONS.RELAY_VIDS_STATUS) {
        console.log(`📡 [Background] Relaying Google Vids status:`, request.status);

        // Find localhost tab and send status
        chrome.tabs.query({ url: "*://localhost:*/*" }, (tabs) => {
            if (tabs.length > 0) {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, {
                        type: 'GOOGLE_VIDS_STATUS',
                        status: request.status,
                        message: request.message,
                        videoId: request.videoId
                    }).catch(() => { });
                });
            }
        });

        // Also try 127.0.0.1
        chrome.tabs.query({ url: "*://127.0.0.1:*/*" }, (tabs) => {
            if (tabs.length > 0) {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, {
                        type: 'GOOGLE_VIDS_STATUS',
                        status: request.status,
                        message: request.message,
                        videoId: request.videoId
                    }).catch(() => { });
                });
            }
        });

        sendResponse({ success: true });
        return false;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ██ SECTION: GOOGLE FLOW TAB QUEUE
    // ██ Purpose: Manage Google Flow tab opening with queuing
    // ██ Dependencies: googleFlowState (global)
    // ██ Safe to modify: Yes (isolated, has lock)
    // ═══════════════════════════════════════════════════════════════════════

    if (request.action === "openGoogleFlowTab") {

        const url = request.url;
        const purpose = request.purpose || 'general'; // Support purpose passing
        console.log(`🌐 [Background] Received openTab request: ${url} (Purpose: ${purpose})`);


        // 🆕 Extract scheduleTime from URL params
        try {
            const urlObj = new URL(url);
            const scheduleTime = urlObj.searchParams.get('scheduleTime');
            if (scheduleTime) {
                googleFlowState.pendingScheduleTime = decodeURIComponent(scheduleTime);
                console.log("📅 [Background] Extracted scheduleTime:", googleFlowState.pendingScheduleTime);
            }
        } catch (e) {
            console.warn("⚠️ [Background] Failed to parse scheduleTime from URL:", e);
        }
        console.log("🔒 [Background] Current lock state:", { inProgress: googleFlowState.inProgress, queueLength: googleFlowState.queue.length });

        // DUPLICATE CHECK: Prevent same URL from being queued multiple times
        if (googleFlowState.queue.includes(url) || (googleFlowState.activeUrl === url && googleFlowState.inProgress)) {
            console.log("⚠️ [Background] Duplicate URL detected, ignoring:", url?.substring(0, 50));
            sendResponse({ success: true, queued: false, reason: 'duplicate' });
            return true;
        }

        const processQueue = () => {
            if (googleFlowState.queue.length > 0) {
                const nextUrl = googleFlowState.queue.shift();
                console.log("🌊 [Background] Processing next in queue:", nextUrl?.substring(0, 50));
                openFlowTab(nextUrl);
            } else {
                console.log("🌊 [Background] Queue empty. All tasks done.");
                googleFlowState.inProgress = false;
                googleFlowState.activeTabId = null;
                googleFlowState.activeUrl = null;
            }
        };

        const openFlowTab = (targetUrl) => {
            googleFlowState.inProgress = true;
            googleFlowState.activeUrl = targetUrl;

            chrome.tabs.create({ url: targetUrl, active: true }, (tab) => {
                console.log("✅ [Background] Google Flow tab opened:", tab.id);
                googleFlowState.activeTabId = tab.id;

                // Listen for tab close
                const onRemoved = (removedTabId) => {
                    if (removedTabId === tab.id) {
                        chrome.tabs.onRemoved.removeListener(onRemoved);
                        console.log("🌊 [Background] Google Flow tab closed. Checking queue...");
                        googleFlowState.activeTabId = null;
                        googleFlowState.activeUrl = null;

                        // Add a small delay before processing next to ensure cleanup
                        setTimeout(processQueue, 1000);
                    }
                };
                chrome.tabs.onRemoved.addListener(onRemoved);
            });
        };

        if (googleFlowState.inProgress) {
            console.log("🔒 [Background] Google Flow already in progress. Queuing:", url?.substring(0, 50));
            googleFlowState.queue.push(url);
            sendResponse({ success: true, queued: true });
        } else {
            openFlowTab(url);
            sendResponse({ success: true, queued: false });
        }
        return true;
    }

    // 2.6 Open Tab
    if (request.action === "openTab") {
        console.log("🌐 [Background] Opening tab:", request.url);
        try {
            chrome.tabs.create({ url: request.url }, (tab) => {
                if (chrome.runtime.lastError) {
                    console.warn("⚠️ [Background] Tab create error:", chrome.runtime.lastError.message);
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    console.log("✅ [Background] Tab opened:", tab.id);
                    sendResponse({ success: true, tabId: tab.id });
                }
            });
        } catch (err) {
            console.warn("⚠️ [Background] Failed to open tab (user may be dragging):", err.message);
            sendResponse({ success: false, error: err.message });
        }
        return true; // Async response
    }

    // 2.7 Upload Google Flow Result
    if (request.action === "uploadGoogleFlowResult") {
        console.log("🎬 [Background] Received Google Flow upload request");
        let payload = request.payload;

        // 🆕 Merge stored scheduleTime into payload if missing
        if (googleFlowState.pendingScheduleTime && (!payload.scheduleDate || !payload.scheduleTime)) {
            console.log("📅 [Background] Merging stored scheduleTime into payload:", googleFlowState.pendingScheduleTime);

            // Parse "2025/12/20 21:00" format
            const match = googleFlowState.pendingScheduleTime.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/);
            if (match) {
                const [, year, month, day, hour, minute] = match;
                const mm = parseInt(month);
                const dd = parseInt(day);
                const hh = parseInt(hour);
                const min = parseInt(minute);

                // Format date as MM/DD/YYYY
                payload.scheduleDate = `${mm}/${dd}/${year}`;

                // Format time as H:MM AM/PM
                const period = hh >= 12 ? 'PM' : 'AM';
                const hours12 = hh % 12 || 12;
                payload.scheduleTime = `${hours12}:${min.toString().padStart(2, '0')} ${period}`;

                console.log("✅ [Background] Parsed schedule:", payload.scheduleDate, payload.scheduleTime);
            }

            // Clear after use
            googleFlowState.pendingScheduleTime = null;
        }

        // Store data for YouTube upload script to retrieve (as 'latest')
        getPendingUploads().then(uploads => {
            uploads['latest'] = payload;
            savePendingUploads(uploads).then(() => {
                // Open YouTube Upload Tab
                const uploadUrl = "https://studio.youtube.com/channel/*/videos/upload?d=ud";
                chrome.tabs.create({ url: uploadUrl }, (tab) => {
                    console.log("✅ [Background] Opened YouTube Upload tab:", tab.id);
                });
            });
        });

        sendResponse({ success: true });
        return true; // Keep channel open for async
    }

    // 2.65 Ensure YouTube Studio Tab (Auto-Open for DFL)
    if (request.action === "ensureYouTubeStudioTab") {
        console.log("📺 [Background] Ensuring YouTube Studio tab is open...");

        // Check if a YouTube Studio tab already exists
        chrome.tabs.query({ url: "*://studio.youtube.com/*" }, (tabs) => {
            if (chrome.runtime.lastError) {
                console.error("📺 [Background] Query error:", chrome.runtime.lastError.message);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
                return;
            }

            if (tabs && tabs.length > 0) {
                // Tab already exists, just focus it
                console.log("📺 [Background] YouTube Studio tab already open. Tab ID:", tabs[0].id);
                chrome.tabs.update(tabs[0].id, { active: true }, () => {
                    sendResponse({ success: true, tabId: tabs[0].id, wasOpen: true });
                });
            } else {
                // No tab exists, create one
                console.log("📺 [Background] Opening new YouTube Studio tab...");
                chrome.tabs.create({ url: "https://studio.youtube.com/", active: false }, (tab) => {
                    if (chrome.runtime.lastError) {
                        console.error("📺 [Background] Tab create error:", chrome.runtime.lastError.message);
                        sendResponse({ success: false, error: chrome.runtime.lastError.message });
                    } else {
                        console.log("✅ [Background] New YouTube Studio tab opened. Tab ID:", tab.id);
                        sendResponse({ success: true, tabId: tab.id, wasOpen: false });
                    }
                });
            }
        });
        return true; // Async response
    }

    // 2.7 Store Google Vids Request
    if (request.action === "storeGoogleVidsRequest") {
        console.log("🎬 [Background] Storing Google Vids Request");

        // 🔧 FIX: Content.js sends data nested in request.data, background.js was reading from request directly
        // Support both formats for compatibility
        const data = request.data || request;
        const prompt = data.prompt;
        const aspectRatio = data.aspectRatio || '9:16';
        const uploadData = data.uploadData;

        console.log(`🎬 [Background] Prompt length: ${prompt?.length}, Aspect: ${aspectRatio}`);
        // 🔍 DEBUG: Log uploadData to verify scheduleTime is present
        console.log(`📅 [Background] uploadData received in storeGoogleVidsRequest:`, JSON.stringify(uploadData, null, 2));
        console.log(`📅 [Background] uploadData.scheduleTime: "${uploadData?.scheduleTime}"`);
        console.log(`📅 [Background] uploadData.scheduleDate: "${uploadData?.scheduleDate}"`);

        chrome.storage.local.set({
            googleVidsRequest: {
                prompt: prompt,
                aspectRatio: aspectRatio,
                uploadData: uploadData,
                timestamp: Date.now()
            }
        }, () => {
            console.log("✅ [Background] Google Vids request stored with uploadData");
            sendResponse({ success: true });
        });
        return true; // Async response
    }

    // 2.8 Get Google Vids Request (for automation on Google Vids page)
    if (request.action === "getGoogleVidsRequest") {
        console.log("🎬 [Background] Retrieving Google Vids Request");
        chrome.storage.local.get("googleVidsRequest", (result) => {
            if (result.googleVidsRequest) {
                // 🔍 DEBUG: Log what's being returned
                console.log(`📅 [Background] getGoogleVidsRequest - uploadData:`, JSON.stringify(result.googleVidsRequest.uploadData, null, 2));
                console.log(`📅 [Background] getGoogleVidsRequest - scheduleTime: "${result.googleVidsRequest.uploadData?.scheduleTime}"`);
                sendResponse({ success: true, data: result.googleVidsRequest });
            } else {
                console.warn("⚠️ [Background] getGoogleVidsRequest - No pending request found!");
                sendResponse({ success: false, error: "No pending request" });
            }
        });
        return true; // Async response
    }

    // 2.9 Open Google Vids Tab (Singleton)
    if (request.action === "openGoogleVidsTab") {
        console.log("🎬 [Background] Opening Google Vids Tab (Singleton Check)");
        // 🔧 FIX: Use /u/1/ to target the 'cgb2025' account which has Veo access
        const createUrl = 'https://docs.google.com/videos/u/1/create';

        chrome.tabs.query({ url: "*://docs.google.com/videos/*" }, (tabs) => {
            if (tabs.length > 0) {
                // Tab exists
                const tab = tabs[0];
                console.log("🎬 [Background] Found existing Google Vids tab:", tab.id, tab.url);

                // 🔧 FIX: ALWAYS navigate to create URL (even if on edit page)
                // This ensures we get a fresh creation dialog, not an existing video
                if (tab.url.includes('/create')) {
                    console.log("🎬 [Background] Tab is already on create page, reloading...");
                    chrome.tabs.update(tab.id, { active: true }, () => {
                        chrome.tabs.reload(tab.id);
                        sendResponse({ success: true, tabId: tab.id, reused: true });
                    });
                } else {
                    // We are on dashboard or EDIT page - navigate to create
                    console.log("🎬 [Background] Tab is on dashboard/edit, navigating to create...");
                    chrome.tabs.update(tab.id, { url: createUrl, active: true }, () => {
                        sendResponse({ success: true, tabId: tab.id, reused: true });
                    });
                }
            } else {
                // No tab, create new one
                console.log("🎬 [Background] Creating new Google Vids tab");
                chrome.tabs.create({ url: createUrl }, (tab) => {
                    sendResponse({ success: true, tabId: tab.id, reused: false });
                });
            }
        });
        return true; // Async response
    }

    // 2.10 Open Google Flow Tab (Singleton)
    if (request.action === "openGoogleFlowTab") {
        console.log("🌊 [Background] Opening Google Flow Tab");
        const flowUrl = request.url || 'https://labs.google/fx/tools/flow';

        chrome.tabs.query({ url: "*://labs.google/*" }, (tabs) => {
            if (tabs.length > 0) {
                // Tab exists - navigate to the new URL
                const tab = tabs[0];
                console.log("🌊 [Background] Found existing Google Flow tab:", tab.id);
                chrome.tabs.update(tab.id, { url: flowUrl, active: true }, () => {
                    sendResponse({ success: true, tabId: tab.id, reused: true });
                });
            } else {
                // No tab, create new one
                console.log("🌊 [Background] Creating new Google Flow tab");
                chrome.tabs.create({ url: flowUrl }, (tab) => {
                    sendResponse({ success: true, tabId: tab.id, reused: false });
                });
            }
        });
        return true; // Async response
    }

    // 2.11 Open GeminiGen Tab (Singleton)
    if (request.action === "openGeminiGenTab") {
        console.log("🤖 [Background] Opening GeminiGen Tab (Singleton Check)");
        const genUrl = request.url || 'https://geminigen.ai/';

        chrome.tabs.query({ url: "*://geminigen.ai/*" }, (tabs) => {
            if (tabs.length > 0) {
                // Tab exists
                const tab = tabs[0];
                console.log("🤖 [Background] Found existing GeminiGen tab:", tab.id);
                chrome.tabs.update(tab.id, { url: genUrl, active: true }, () => {
                    sendResponse({ success: true, tabId: tab.id, reused: true });
                });
            } else {
                // No tab, create new one
                console.log("🤖 [Background] Creating new GeminiGen tab");
                chrome.tabs.create({ url: genUrl }, (tab) => {
                    sendResponse({ success: true, tabId: tab.id, reused: false });
                });
            }
        });
        return true; // Async response
    }

    // 2.12 Search and Scrape Viral Video (爆款仿写)
    if (request.action === "searchAndScrapeViralVideo") {
        const theme = request.theme || "viral shorts";
        console.log("🚀 [Background] Searching for viral video for theme:", theme);

        // Sort by View Count: sp=CAM%253D
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(theme)}&sp=CAM%253D`;

        chrome.tabs.create({ url: searchUrl, active: false }, (tab) => {
            const tabId = tab.id;

            // Helper to wait for tab load
            const waitForLoad = (targetTabId, callback) => {
                const listener = (updatedTabId, info) => {
                    if (updatedTabId === targetTabId && info.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener);
                        callback();
                    }
                };
                chrome.tabs.onUpdated.addListener(listener);
            };

            waitForLoad(tabId, () => {
                console.log("🚀 [Background] Search page loaded, extracting top video...");

                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: () => {
                        const firstVideo = document.querySelector('ytd-video-renderer a#video-title, ytd-grid-video-renderer a#video-title');
                        return {
                            url: firstVideo ? firstVideo.href : null,
                            title: firstVideo ? firstVideo.innerText : null
                        };
                    }
                }, (results) => {
                    const videoData = results?.[0]?.result;
                    if (!videoData || !videoData.url) {
                        console.error("❌ [Background] No viral video found");
                        chrome.tabs.remove(tabId);
                        sendResponse({ success: false, error: "No viral video found" });
                        return;
                    }

                    console.log("🚀 [Background] Found viral video:", videoData.title, videoData.url);

                    // Navigate to video
                    chrome.tabs.update(tabId, { url: videoData.url }, () => {
                        waitForLoad(tabId, () => {
                            console.log("🚀 [Background] Video page loaded, scraping transcript...");

                            // Give it a moment to stabilize
                            setTimeout(() => {
                                chrome.tabs.sendMessage(tabId, { type: 'SCRAPE_TRANSCRIPT' }, (response) => {
                                    const transcript = response?.text;
                                    console.log("🚀 [Background] Transcript scraped, length:", transcript?.length || 0);

                                    // Close the tab
                                    chrome.tabs.remove(tabId);

                                    sendResponse({
                                        success: true,
                                        transcript: transcript,
                                        title: videoData.title,
                                        url: videoData.url
                                    });
                                });
                            }, 3000);
                        });
                    });
                });
            });
        });
        return true; // Async response
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ██ SECTION: DOWNLOAD PROXY
    // ██ Purpose: Download videos via Service Worker (CORS bypass)
    // ██ Dependencies: None
    // ██ Safe to modify: Yes (isolated utility)
    // ═══════════════════════════════════════════════════════════════════════

    if (request.action === "downloadVideo") {
        console.log("📥 [Background] Fetching video from URL:", request.url);

        fetch(request.url)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.arrayBuffer();
            })
            .then(buffer => {
                const len = buffer.byteLength;
                console.log("✅ [Background] Video fetched successfully, size:", (len / 1024 / 1024).toFixed(2), "MB");

                // 🔧 V7.3: More efficient binary to base64 conversion
                // Using a chunked approach to avoid string size limits and memory issues
                const bytes = new Uint8Array(buffer);
                let binary = '';
                const chunkSize = 8192;
                for (let i = 0; i < bytes.length; i += chunkSize) {
                    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
                }
                const base64 = btoa(binary);

                console.log("✅ [Background] Base64 conversion complete");
                sendResponse({ success: true, data: base64 });
            })
            .catch(error => {
                console.error("❌ [Background] Fetch failed:", error);
                sendResponse({ success: false, error: error.toString() });
            });

        return true; // Indicates we will respond asynchronously
    }

    // 🆕 V7.1: Fetch URL (CORS-free) - Used by ScheduledCommentMonitor
    if (request.action === "fetchUrl") {
        console.log("📡 [Background] Fetching URL (CORS-free):", request.url?.substring(0, 80));

        fetch(request.url)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return response.text();
            })
            .then(data => {
                console.log("✅ [Background] Fetch successful, data length:", data.length);
                sendResponse({ success: true, data: data });
            })
            .catch(error => {
                console.warn("⚠️ [Background] Fetch failed:", error.message);
                sendResponse({ success: false, error: error.toString() });
            });

        return true; // Async response
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ██ SECTION: GOOGLE VIDS/FLOW COMPLETE HANDLER
    // ██ Purpose: Handle video generation completion, store data, open YouTube
    // ██ Dependencies: pendingUploads (global)
    // ██ Upstream: workflow.js → relayGoogleVidsComplete
    // ██ Downstream: studioUploader.js → getVideoData
    // ██ 
    // ██ ⚠️⚠️⚠️ CRITICAL SECTION - DO NOT MODIFY WITHOUT TESTING FULL FLOW ⚠️⚠️⚠️
    // ██ This section handles schedule parsing (scheduleDate, scheduleTime)
    // ██ and opens YouTube Studio with the correct video data.
    // ██ 
    // ██ Safe to modify: ❌ NO - EXTREME CAUTION REQUIRED
    // ═══════════════════════════════════════════════════════════════════════

    if (request.action === "relayGoogleVidsComplete") {
        console.log("🎬 [Background] Google Vids/Flow Complete. URL:", request.videoUrl ? request.videoUrl.substring(0, 50) : "Direct Data");
        const { videoUrl, videoData, uploadData } = request;

        const finalizeUpload = (base64) => {
            // 🔍 DEBUG: Log full uploadData received
            console.log(`📅 [Background] Full uploadData received:`, JSON.stringify(uploadData, null, 2));

            // Parse Schedule - Prefer pre-extracted values from React
            // React now sends: scheduleDate (MM/DD/YYYY), scheduleTimeOnly (HH:MM AM/PM), scheduleTime (full string)
            let scheduleDate = uploadData?.scheduleDate;
            let scheduleTime = uploadData?.scheduleTimeOnly; // 🔧 FIX: Use Only the time part

            const rawScheduleStr = uploadData?.scheduleTime || '';
            console.log(`📅 [Background] Raw schedule string: "${rawScheduleStr}"`);
            console.log(`📅 [Background] Initial scheduleDate: "${scheduleDate}", scheduleTime: "${scheduleTime}"`);

            // If we are missing either part, try to parse from the full string
            if ((!scheduleDate || !scheduleTime) && rawScheduleStr) {
                console.log(`📅 [Background] Missing schedule parts, attempting to parse from rawScheduleStr...`);

                const usFormatMatch = rawScheduleStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)/i);
                console.log(`📅 [Background] US Format Match:`, usFormatMatch);

                if (usFormatMatch) {
                    const [_, m, d, y, h, min, ampm] = usFormatMatch;
                    scheduleDate = `${m}/${d}/${y}`;
                    scheduleTime = `${h}:${min} ${ampm.toUpperCase()}`;
                    console.log(`✅ [Background] Parsed US format: Date=${scheduleDate}, Time=${scheduleTime}`);
                } else {
                    const isoMatch = rawScheduleStr.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})[T\s](\d{1,2}):(\d{2})/);
                    console.log(`📅 [Background] ISO Format Match:`, isoMatch);

                    if (isoMatch) {
                        const [_, y, m, d, h, min] = isoMatch;
                        scheduleDate = `${parseInt(m)}/${parseInt(d)}/${y}`;
                        let hours = parseInt(h);
                        const ampm = hours >= 12 ? 'PM' : 'AM';
                        hours = hours % 12 || 12;
                        scheduleTime = `${hours}:${min} ${ampm}`;
                        console.log(`✅ [Background] Parsed ISO format: Date=${scheduleDate}, Time=${scheduleTime}`);
                    } else {
                        const dateObj = new Date(rawScheduleStr);
                        console.log(`📅 [Background] Date constructor result:`, dateObj, `isNaN: ${isNaN(dateObj.getTime())}`);

                        if (!isNaN(dateObj.getTime())) {
                            scheduleDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;
                            let hours = dateObj.getHours();
                            const minutes = dateObj.getMinutes().toString().padStart(2, '0');
                            const ampm = hours >= 12 ? 'PM' : 'AM';
                            hours = hours % 12 || 12;
                            scheduleTime = `${hours}:${minutes} ${ampm}`;
                            console.log(`✅ [Background] Parsed via Date constructor: Date=${scheduleDate}, Time=${scheduleTime}`);
                        } else {
                            console.error(`❌ [Background] Failed to parse schedule string: "${rawScheduleStr}"`);
                        }
                    }
                }
            }

            const videoIdFromReact = uploadData?.videoIndex;
            const finalVideoId = (videoIdFromReact !== undefined && videoIdFromReact !== null) ? videoIdFromReact : 'googlevids_' + Date.now();

            const finalData = {
                id: finalVideoId,
                videoId: finalVideoId,
                videoData: base64,
                fileName: 'googlevids_generated.mp4',
                title: uploadData?.title || 'Google Vids Generated',
                description: uploadData?.description || 'Generated by Veo',
                tags: uploadData?.tags || [],
                scheduleDate: scheduleDate,
                scheduleTime: scheduleTime,
                pinnedComment: uploadData?.pinnedComment,
                visibility: 'private',
                isShorts: true
            };

            // 🔍 DEBUG: Log the final schedule values
            console.log(`📅 [Background] Final Schedule - Date: "${scheduleDate}", Time: "${scheduleTime}"`);
            console.log(`📅 [Background] Original uploadData.scheduleTime: "${uploadData?.scheduleTime}"`);

            getPendingUploads().then(uploads => {
                uploads[finalData.id] = finalData;
                uploads['latest'] = finalData;
                savePendingUploads(uploads).then(() => {
                    console.log("📦 [Background] Stored Google Vids/Flow data (Persistent). ID:", finalData.id);
                    console.log(`📅 [Background] Final Schedule - Date: "${scheduleDate}", Time: "${scheduleTime}"`);

                    const uploadUrl = 'https://studio.youtube.com/channel/mine/videos/upload?d=ud&gemini_id=' + finalData.id;
                    chrome.tabs.create({ url: uploadUrl }, (tab) => {
                        console.log("🚀 [Background] Opened YouTube Upload Tab:", tab.id);
                        if (sender.tab && sender.tab.id) {
                            setTimeout(() => { chrome.tabs.remove(sender.tab.id); }, 2000);
                        }
                    });
                });
            });
        };

        if (videoData) {
            finalizeUpload(videoData);
        } else if (videoUrl) {
            fetch(videoUrl)
                .then(res => res.arrayBuffer())
                .then(buffer => {
                    // Robust base64 conversion for large files in Service Worker
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

    // ═══════════════════════════════════════════════════════════════════════

    // 🆕 V7.8: Ensure YouTube Studio tab is open
    if (request.action === "ensureYouTubeStudioTab") {
        console.log("📺 [Background] Ensuring YouTube Studio tab is open...");
        chrome.tabs.query({ url: "*://studio.youtube.com/*" }, (tabs) => {
            if (tabs.length > 0) {
                console.log("✅ [Background] YouTube Studio tab already exists. Focusing...");
                chrome.tabs.update(tabs[0].id, { active: true });
                sendResponse({ success: true, tabId: tabs[0].id });
            } else {
                console.log("📺 [Background] Opening new YouTube Studio tab...");
                chrome.tabs.create({ url: "https://studio.youtube.com/", active: true }, (tab) => {
                    sendResponse({ success: true, tabId: tab.id });
                });
            }
        });
        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ██ SECTION: ANALYTICS RELAY
    // ██ Purpose: Relay analytics requests between React and YouTube Studio
    // ██ Dependencies: chrome.storage.local (pendingAnalyticsRequest)
    // ██ Safe to modify: ⚠️ CAUTION - affects data collection
    // ═══════════════════════════════════════════════════════════════════════

    if (request.action === "relayAnalyticsRequest") {
        console.log("🔄 [Background] Relaying Analytics Request to YouTube Studio:", request.payload);

        chrome.tabs.query({ url: "*://studio.youtube.com/*" }, async (tabs) => {
            if (tabs.length > 0) {
                console.log(`📡 [Background] Sending analytics request to ${tabs.length} YouTube Studio tabs`);
                const targetTab = tabs[0];

                // 🆕 V2.1: Validate tab exists before sending
                try {
                    const tab = await chrome.tabs.get(targetTab.id);
                    if (!tab || tab.status !== 'complete') {
                        console.warn(`⚠️ [Background] Tab ${targetTab.id} not ready, storing request for pickup`);
                        chrome.storage.local.set({ pendingAnalyticsRequest: request.payload });
                        return;
                    }
                } catch (e) {
                    console.warn(`⚠️ [Background] Tab ${targetTab.id} no longer exists, storing request`);
                    chrome.storage.local.set({ pendingAnalyticsRequest: request.payload });
                    return;
                }

                chrome.tabs.sendMessage(targetTab.id, {
                    type: "REQUEST_YOUTUBE_ANALYTICS",
                    payload: request.payload
                }).then(() => {
                    console.log(`✅ [Background] Analytics request sent to tab ${targetTab.id}`);
                }).catch(err => {
                    // 🔧 V2.1: Downgrade to warn since this is expected when content script isn't loaded
                    console.warn(`⚠️ [Background] Tab ${targetTab.id} not ready:`, err.message);

                    // 🆕 AUTO-REFRESH: Store request and automatically reload the tab
                    chrome.storage.local.set({ pendingAnalyticsRequest: request.payload }, () => {
                        console.log("📦 [Background] Stored analytics request for pickup after refresh.");

                        // Auto-refresh the YouTube Studio tab
                        console.log("🔄 [Background] Auto-refreshing YouTube Studio tab for analytics...");
                        chrome.tabs.reload(targetTab.id, { bypassCache: true }, () => {
                            if (chrome.runtime.lastError) {
                                console.error("❌ [Background] Failed to reload tab:", chrome.runtime.lastError.message);
                            } else {
                                console.log("✅ [Background] YouTube Studio tab refreshed for analytics.");
                            }
                        });
                    });
                });

                sendResponse({ success: true, message: `Relayed to ${tabs.length} tabs` });
            } else {
                console.warn("⚠️ [Background] YouTube Studio tab not found. Opening one...");
                chrome.tabs.create({ url: "https://studio.youtube.com/", active: false }, (tab) => {
                    // The content script will handle the request once loaded via storage
                    chrome.storage.local.set({ pendingAnalyticsRequest: request.payload });
                });
                sendResponse({ success: true, message: "Opening YouTube Studio tab" });
            }
        });
        return true; // Keep channel open for async response
    }

    // 5. Relay Analytics Result (YouTube -> Localhost)
    if (request.action === "relayAnalyticsResult") {
        console.log("🔄 [Background] Relaying Analytics Result (Category: " + request.category + ")");

        chrome.tabs.query({ url: ["*://localhost/*", "*://127.0.0.1/*"] }, (tabs) => {
            console.log(`📡 [Background] Broadcasting analytics result to ${tabs.length} local tabs`);
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: "YOUTUBE_ANALYTICS_RESULT",
                    data: request.data,
                    category: request.category
                }).catch(err => console.log(`⚠️ [Background] Failed to send to local tab ${tab.id}:`, err.message));
            });
        });
        sendResponse({ success: true });
        return false;
    }

    // 5.5 Relay Direct Analytics Result (YouTube -> Localhost) - NEW!
    // 🔧 FIX: Only send to ONE tab to avoid duplicate processing
    if (request.action === "relayAnalyticsDirectResult") {
        // 🛡️ DFL PROTECTION: Skip EVERYTHING for DFL Report tabs (early exit)
        const senderUrl = sender.tab?.url || '';
        if (senderUrl.includes('gemini_action=dfl_report')) {
            console.log("🛡️ [Background] DFL Report tab detected in relayAnalyticsDirectResult. IGNORING this message completely.", sender.tab?.id);
            sendResponse({ success: true, skipped: true });
            return false;
        }

        console.log("📊 [Background] Relaying Direct Analytics Result:", request.data?.category);

        chrome.tabs.query({ url: ["*://localhost/*", "*://127.0.0.1/*"] }, (tabs) => {
            if (tabs.length > 0) {
                // 🔧 FIX: Sort by lastAccessed descending and send to ONLY the most recent tab
                const sortedTabs = tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
                const targetTab = sortedTabs[0];
                console.log(`📡 [Background] Sending direct analytics to ONE localhost tab (ID: ${targetTab.id})`);
                chrome.tabs.sendMessage(targetTab.id, {
                    action: "relayAnalyticsDirectResult",
                    type: "YOUTUBE_ANALYTICS_DIRECT_RESULT",
                    data: request.data
                }).catch(err => console.log(`⚠️ [Background] Failed to send direct analytics to localhost ${targetTab.id}:`, err.message));
            } else {
                console.warn("⚠️ [Background] No localhost tabs found to relay direct analytics");
            }
        });

        // 🚀 AUTO-CLOSE: Close the tab that sent this data (Direct Collect)
        // 🛡️ DFL PROTECTION: Do NOT close if this is a DFL Report session
        // 🛡️ FULL_ANALYTICS PROTECTION: Do NOT close if this is a Fast Collect session
        if (sender.tab && sender.tab.id) {
            const senderUrl = sender.tab.url || '';
            if (senderUrl.includes('gemini_action=dfl_report')) {
                console.log("🛡️ [Background] DFL Report session detected. NOT auto-closing tab:", sender.tab.id);
            } else if (senderUrl.includes('gemini_action=full_analytics')) {
                console.log("🛡️ [Background] Full Analytics session detected. NOT auto-closing tab:", sender.tab.id);
            } else if (senderUrl.includes('gemini_action=direct_collect') || senderUrl.includes('gemini_action=single_tab_analytics')) {
                console.log("🛡️ [Background] Direct Collect / Single Tab session detected. NOT auto-closing tab:", sender.tab.id);
            } else if (senderUrl.includes('localhost') || senderUrl.includes('127.0.0.1')) {
                console.warn("🛡️ [Background] CRITICAL: Attempted to auto-close LOCALHOST tab! BLOCKED.", sender.tab.id);
            } else {
                console.log("❌ [Background] Auto-closing Direct Collect tab:", sender.tab.id);
                setTimeout(() => { // Small delay to ensure message is sent
                    chrome.tabs.remove(sender.tab.id).catch(err => console.warn("⚠️ Failed to close tab:", err.message));
                }, 2000);
            }
        }

        sendResponse({ success: true });
        return false;
    }

    // 6. Close Tab
    if (request.action === "closeTab") {
        const sourceUrl = request.url || (sender.tab ? sender.tab.url : 'unknown');
        console.log(`❌ [Background] closeTab request from: ${sourceUrl}`);

        if (sender.tab && sender.tab.id) {
            console.log(`❌ [Background] Closing sender tab ID: ${sender.tab.id} (${sender.tab.url})`);
            chrome.tabs.remove(sender.tab.id, () => {
                if (chrome.runtime.lastError) {
                    console.warn(`⚠️ [Background] Failed to close sender tab ${sender.tab.id}:`, chrome.runtime.lastError.message);
                } else {
                    console.log(`✅ [Background] Sender tab ${sender.tab.id} closed successfully`);
                }
            });
            sendResponse({ success: true });
        } else if (request.url) {
            // 🛡️ LOCALHOST PROTECTION: NEVER close React app tabs via URL pattern
            if (request.url.includes('localhost') || request.url.includes('127.0.0.1')) {
                console.warn("🛡️ [Background] BLOCKED: Refusing to close localhost tab via URL pattern!");
                sendResponse({ success: false, error: 'localhost tabs are protected' });
                return false;
            }

            console.log("🔍 [Background] sender.tab.id missing. Trying to close by URL:", request.url);
            // 🔧 FIX: Use wildcard pattern for URL matching (ignore query params)
            const urlBase = request.url.split('?')[0] + '*';
            console.log("🔍 [Background] Using URL pattern:", urlBase);
            chrome.tabs.query({ url: urlBase }, (tabs) => {
                if (tabs.length > 0) {
                    // Close first matching tab
                    const tabId = tabs[0].id;
                    chrome.tabs.remove(tabId, () => {
                        if (chrome.runtime.lastError) {
                            console.warn("❌ [Background] Failed to close tab:", chrome.runtime.lastError.message);
                        } else {
                            console.log("✅ [Background] Closed tab by URL:", tabId);
                        }
                    });
                } else {
                    console.warn("❌ [Background] No tabs found with URL pattern:", urlBase);
                }
            });
        } else {
            console.warn("⚠️ [Background] closeTab called but sender tab ID is missing and no URL provided");
        }
        sendResponse({ success: true });
        return true; // Keep channel open for async
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ██ SECTION: PLAN & COMMENT RELAY
    // ██ Purpose: Relay AI responses and comment status to React
    // ██ Dependencies: None
    // ██ Upstream: studioAgent.js (relayPlanResponse)
    // ██ Downstream: React (YPP_PLAN_RESULT handler)
    // ██ Safe to modify: ⚠️ CAUTION - affects plan display in React
    // ═══════════════════════════════════════════════════════════════════════


    // 6.5 Relay YPP Data (YouTube Studio -> Localhost)
    if (request.action === "relayYPPData") {
        console.log("🎯 [Background] Relaying YPP Data:", request.data);
        chrome.tabs.query({ url: ["*://localhost/*", "*://127.0.0.1/*"] }, (tabs) => {
            console.log(`📡 [Background] Broadcasting YPP data to ${tabs.length} local tabs`);
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: "YPP_REALTIME_DATA",
                    data: request.data
                }).catch(err => console.log(`⚠️ [Background] Failed to send YPP to local tab ${tab.id}:`, err.message));
            });
        });
        sendResponse({ success: true });
        return false;
    }

    // 7. Relay Comment Action (Localhost -> YouTube Studio)
    if (request.action === "relayCommentAction") {
        console.log("💬 [Background] Relaying Comment Action:", request.actionType, request.commentId);

        chrome.tabs.query({ url: "*://studio.youtube.com/*" }, (tabs) => {
            if (tabs.length > 0) {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, {
                        type: "EXECUTE_COMMENT_ACTION",
                        payload: request
                    }).catch(err => console.log(`⚠️ [Background] Failed to send to tab ${tab.id}:`, err.message));
                });
                sendResponse({ success: true, message: `Relayed to ${tabs.length} tabs` });
            } else {
                console.error("❌ [Background] YouTube Studio tab not found!");
                sendResponse({ success: false, error: "YouTube Studio tab not found" });
            }
        });
        return true;
    }

    // 7. Relay YouTube Upload Complete (YouTube -> Localhost)
    if (request.action === "relayYouTubeUploadComplete" || request.action === "uploadComplete") {
        console.log("🎉 [Background] Relaying Upload Complete:", request.videoId, "Status:", request.status);

        const actualVideoId = request.videoId || extractVideoIdFromUrl(request.videoUrl);

        // 🆕 V7.4: Store scheduled comment if pinnedComment provided OR update pending comment
        chrome.storage.local.get(['gemini_scheduled_comments'], (result) => {
            const scheduledComments = result.gemini_scheduled_comments || {};
            let modified = false;

            // Method 1: Direct pinnedComment in request (from old content script)
            if (request.pinnedComment && request.videoUrl && actualVideoId) {
                console.log(`📝 [Background] Storing scheduled comment for video ${actualVideoId}...`);
                console.log(`   Comment: "${request.pinnedComment.substring(0, 50)}..."`);

                scheduledComments[actualVideoId] = {
                    url: request.videoUrl,
                    text: request.pinnedComment,
                    pin: true,
                    scheduledTime: request.scheduleTime || null,
                    scheduledTimestamp: request.scheduleTime ? new Date(request.scheduleTime).getTime() : Date.now(),
                    createdAt: Date.now(),
                    attempts: 0,
                    maxAttempts: 10,
                    lastCheck: null,
                    status: 'pending'
                };
                modified = true;
                console.log(`✅ [Background] Scheduled comment stored for video ${actualVideoId}`);
            }

            // Method 2: Look for pending_ prefixed comment that matches this upload
            // This handles the case where comment was pre-stored in STORE_GOOGLE_VIDS_DATA
            const dbId = request.dbId || request.videoId;
            const pendingKey = `pending_${dbId}`;

            if (scheduledComments[pendingKey] && request.videoUrl && actualVideoId) {
                console.log(`📝 [Background] Updating pre-stored scheduled comment: ${pendingKey} -> ${actualVideoId}`);

                // Copy pending comment to real video ID with actual URL
                scheduledComments[actualVideoId] = {
                    ...scheduledComments[pendingKey],
                    url: request.videoUrl,
                    status: 'pending'  // Now ready to be posted
                };

                // Remove the pending entry
                delete scheduledComments[pendingKey];
                modified = true;
                console.log(`✅ [Background] Scheduled comment updated for video ${actualVideoId}`);
            }

            if (modified) {
                chrome.storage.local.set({ 'gemini_scheduled_comments': scheduledComments }, () => {
                    // 🆕 V7.5: If video is published (not scheduled), trigger immediate check
                    if (request.status === 'completed' || !request.scheduleTime) {
                        console.log("🚀 [Background] Video published immediately. Triggering immediate comment check...");
                        setTimeout(checkScheduledComments, 3000);
                    }
                });
            }
        });

        chrome.tabs.query({ url: ["*://localhost/*", "*://127.0.0.1/*"] }, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: "YOUTUBE_UPLOAD_COMPLETE",
                    videoUrl: request.videoUrl,
                    videoId: request.dbId || request.videoId, // Use DB ID for React matching
                    youtubeId: request.videoId, // Pass real YouTube ID as well
                    status: request.status || 'completed',
                    // 🆕 V3.1: Add missing fields for scheduled/published status detection
                    title: request.title,
                    isScheduled: !!request.scheduleTime,
                    scheduleTime: request.scheduleTime
                }).catch(err => console.log(`⚠️ [Background] Failed to send to local tab ${tab.id}:`, err.message));
            });
        });
        sendResponse({ success: true });
        return false;
    }

    // 🆕 V6.1: Relay Comment Posted Status (YouTube Watch Page -> Localhost)
    if (request.action === "relayCommentPosted") {
        console.log(`💬 [Background] Relaying Comment Posted: ${request.status} for video ${request.videoId}`);
        chrome.tabs.query({ url: ["*://localhost/*", "*://127.0.0.1/*"] }, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: "COMMENT_POSTED",
                    videoUrl: request.videoUrl,
                    videoId: request.videoId,
                    status: request.status,
                    error: request.error || null,
                    timestamp: request.timestamp
                }).catch(err => console.log(`⚠️ [Background] Failed to send comment status to local tab ${tab.id}:`, err.message));
            });
        });
        sendResponse({ success: true });
        return false;
    }

    // 8. Relay Notifications (YouTube Studio -> Localhost)
    if (request.action === "relayNotifications") {
        console.log("🔔 [Background] Relaying Notifications:", request.data.data.length);
        chrome.tabs.query({ url: ["*://localhost/*", "*://127.0.0.1/*"] }, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: "YOUTUBE_NOTIFICATIONS",
                    data: request.data.data,
                    hasNew: request.data.hasNew
                }).catch(err => console.log(`⚠️ [Background] Failed to send notifications to local tab ${tab.id}:`, err.message));
            });
        });
        sendResponse({ success: true });
        return false;
    }

    // 8. Store LMArena Prompt
    if (request.action === "storeLMArenaPrompt") {
        console.log("📦 [Background] Storing LMArena prompt...");
        chrome.storage.local.set({ 'pendingLMArenaPrompt': request.prompt }, () => {
            console.log("✅ [Background] Prompt stored in local storage");
            sendResponse({ success: true });
        });
        return true;
    }

    // 9. Get LMArena Prompt
    if (request.action === "getLMArenaPrompt") {
        chrome.storage.local.get(['pendingLMArenaPrompt'], (result) => {
            console.log("📤 [Background] Retrieving prompt:", result.pendingLMArenaPrompt ? "Found" : "Empty");
            sendResponse({ prompt: result.pendingLMArenaPrompt });
        });
        return true;
    }

    // 🆕 V7.6: Fetch URL (Proxy for oEmbed checks to avoid CORS)
    if (request.action === "fetchUrl") {
        console.log("📥 [Background] Fetching URL:", request.url);
        fetch(request.url)
            .then(res => res.text())
            .then(text => {
                sendResponse({ success: true, data: text });
            })
            .catch(err => {
                console.error("❌ [Background] Fetch URL failed:", err);
                sendResponse({ success: false, error: err.message });
            });
        return true;
    }
    // (Duplicate closeTab handler removed - already handled above at line 202)

    // 11. Relay Comments (YouTube Studio -> Localhost)
    if (request.action === "relayComments") {
        console.log("💬 [Background] Relaying Comments:", request.data.length);
        chrome.tabs.query({ url: ["*://localhost/*", "*://127.0.0.1/*"] }, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: "YOUTUBE_COMMENTS_DATA",
                    data: request.data,
                    queueStatus: request.queueStatus
                }).catch(err => console.log(`⚠️ [Background] Failed to send comments to local tab ${tab.id}:`, err.message));
            });
        });
        sendResponse({ success: true });
        return false;
    }

    // 12. Relay Toggle Auto-Reply (Localhost -> YouTube Studio)
    if (request.action === "relayToggleAutoReply") {
        console.log("🔄 [Background] Relaying Toggle Auto-Reply:", request.enabled);
        chrome.tabs.query({ url: "*://studio.youtube.com/*" }, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: "TOGGLE_AUTO_REPLY",
                    enabled: request.enabled
                }).catch(err => console.log(`⚠️ [Background] Failed to send toggle to Studio ${tab.id}:`, err.message));
            });
        });
        sendResponse({ success: true });
        return false;
    }

    // (Duplicate relayCommentAction handler removed - already handled above at line 272)

    // 14. Relay Shorts Data (YouTube Studio -> Localhost)
    if (request.action === "relayShortsData") {
        console.log("🩳 [Background] Relaying Shorts Data:", request.data.data.length);
        chrome.tabs.query({ url: ["*://localhost/*", "*://127.0.0.1/*"] }, (tabs) => {
            console.log(`🩳 [Background] Found ${tabs.length} localhost/127.0.0.1 tabs`);
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: "YOUTUBE_SHORTS_DATA",
                    data: request.data.data,
                    timestamp: request.data.timestamp
                }).catch(err => console.log(`⚠️ [Background] Failed to send shorts data to localhost ${tab.id}:`, err.message));
            });
        });
        sendResponse({ success: true });
        return false;
    }

    // 15. Open Video and Ignite Comment (Robust)
    if (request.action === "openAndIgnite") {
        console.log("🔥 [Background] Opening video to ignite comment:", request.url);
        chrome.tabs.create({ url: request.url }, (tab) => {
            const listener = (tabId, changeInfo, tabInfo) => {
                if (tabId === tab.id && changeInfo.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    console.log("✅ [Background] Video page loaded. Waiting 5s before igniting...");

                    setTimeout(() => {
                        console.log("🚀 [Background] Sending IGNITE_COMMENT to tab", tab.id);
                        chrome.tabs.sendMessage(tab.id, {
                            type: "IGNITE_COMMENT",
                            text: request.text,
                            pin: request.pin
                        }).catch(err => console.error("❌ [Background] Failed to ignite:", err));
                    }, 5000);
                }
            };
            chrome.tabs.onUpdated.addListener(listener);
        });
        sendResponse({ success: true });
        return true;
    }

    // 16. Relay Gemini Video Result (GeminiGen -> Localhost)
    if (request.action === EXT_CONSTANTS.ACTIONS.RELAY_GEMINI_VIDEO_RESULT) {
        console.log("🎥 [Background] Relaying Gemini Video Result with Metadata");
        chrome.tabs.query({ url: ["*://localhost/*", "*://127.0.0.1/*"] }, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: "GEMINI_VIDEO_RESULT",
                    payload: request.payload,
                    metadata: request.metadata,
                    source: request.source
                }).catch(err => console.log(`⚠️ [Background] Failed to send video result to local tab ${tab.id}:`, err.message));
            });
        });
        sendResponse({ success: true });
        return false;
    }

    // 17. Relay Analytics Log (Content Script -> Localhost)
    if (request.action === "relayAnalyticsLog") {
        // console.log("📝 [Background] Relaying Log:", request.message); 
        chrome.tabs.query({ url: ["*://localhost/*", "*://127.0.0.1/*"] }, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: "ANALYTICS_LOG",
                    message: request.message
                }).catch(err => console.log(`⚠️ [Background] Failed to send log to local tab ${tab.id}:`, err.message));
            });
        });
        sendResponse({ success: true });
        return false;
    }

});

// ============================================
// 📅 SCHEDULED COMMENT MONITOR (Precise Timing)
// ============================================
// Checks every minute if any scheduled videos have gone live

const SCHEDULED_COMMENT_CHECK_INTERVAL = 60000; // 1 minute

async function checkScheduledVideoPublishTime() {
    try {
        const result = await chrome.storage.local.get(['pending_scheduled_comments']);
        const pendingList = result.pending_scheduled_comments || [];

        if (pendingList.length === 0) return;

        const now = new Date();
        console.log(`📅 [Scheduler] Checking ${pendingList.length} pending comments at ${now.toLocaleTimeString()}`);

        for (const task of pendingList) {
            // Check if scheduled time has passed
            if (task.scheduledTime) {
                const scheduledDate = new Date(task.scheduledTime);
                const timeDiff = now - scheduledDate;

                // If scheduled time is now or in the past (within last 5 minutes)
                if (timeDiff >= 0 && timeDiff < 300000) { // 5 minutes window
                    console.log(`🎯 [Scheduler] Video ${task.videoId} should be live now!`);
                    console.log(`   Scheduled: ${scheduledDate.toLocaleString()}`);
                    console.log(`   Now: ${now.toLocaleString()}`);

                    // Open the video page to trigger the comment
                    const videoUrl = task.videoUrl || `https://www.youtube.com/shorts/${task.videoId}`;
                    chrome.tabs.create({ url: videoUrl, active: false }, (tab) => {
                        console.log(`✅ [Scheduler] Opened tab ${tab.id} for video ${task.videoId}`);

                        // Set a flag that this video needs auto-comment
                        chrome.storage.local.set({
                            [EXT_CONSTANTS.STORAGE.PENDING_AUTO_COMMENT]: JSON.stringify({
                                videoId: task.videoId,
                                text: task.text,
                                videoUrl: videoUrl
                            })
                        });
                    });
                } else if (timeDiff < 0) {
                    // Still in the future
                    const minsUntil = Math.round(-timeDiff / 60000);
                    console.log(`⏰ [Scheduler] Video ${task.videoId} scheduled in ${minsUntil} minutes`);
                } else if (timeDiff >= 300000) {
                    // More than 5 minutes past scheduled time, log warning
                    console.warn(`⚠️ [Scheduler] Video ${task.videoId} passed scheduled time by ${Math.round(timeDiff / 60000)} minutes`);
                }
            } else {
                console.log(`📝 [Scheduler] Task ${task.videoId} has no scheduledTime, will use passive detection`);
            }
        }
    } catch (error) {
        console.error('❌ [Scheduler] Error:', error);
    }
}

// Start the scheduler
setInterval(checkScheduledVideoPublishTime, SCHEDULED_COMMENT_CHECK_INTERVAL);
console.log('📅 [Background] Scheduled Comment Monitor Started (checks every 1 minute)');

// Also run once on startup
setTimeout(checkScheduledVideoPublishTime, 5000);

// ============================================
// 🤖 24/7 AUTO-ANALYTICS & PLAN SCHEDULER (DFL 2.0)
// ============================================
// This module enables fully autonomous operation without human intervention.
// PRIMARY PURPOSE: Frequent data collection to detect VIRAL SIGNALS quickly.
// When extreme signals are detected, Viral Queue Jumping auto-triggers content generation.

const AUTO_ANALYTICS_INTERVAL = 1 * 60 * 60 * 1000; // 1 HOUR - Fast viral signal detection
const AUTO_PLAN_INTERVAL = 8 * 60 * 60 * 1000; // 8 hours - Backup scheduled plan (primary is reactive)

let lastAutoAnalyticsTime = 0;
let lastAutoPlanTime = 0;

// Load last run times from storage
chrome.storage.local.get(['lastAutoAnalyticsTime', 'lastAutoPlanTime', 'dflAutoEnabled'], (result) => {
    // 🔧 FIX: Add null check to prevent TypeError
    if (result) {
        lastAutoAnalyticsTime = result.lastAutoAnalyticsTime || 0;
        lastAutoPlanTime = result.lastAutoPlanTime || 0;
        const enabled = result.dflAutoEnabled !== false; // Default to true
        console.log(`🤖 [DFL Auto] Loaded state: Analytics=${new Date(lastAutoAnalyticsTime).toLocaleString()}, Plan=${new Date(lastAutoPlanTime).toLocaleString()}, Enabled=${enabled}`);
    } else {
        console.log(`🤖 [DFL Auto] No stored state found, using defaults.`);
    }
});

// 📟 SysLog Helper for Background Activity
function sysLog(message, level = 'info') {
    chrome.tabs.query({ url: ['http://localhost:*/*', 'http://127.0.0.1:*/*'] }, (tabs) => {
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, {
                type: 'SYSLOG_ENTRY',
                payload: {
                    id: `log_ext_${Date.now()}_${Math.random().toString(36).substring(2)}`,
                    timestamp: Date.now(),
                    level,
                    source: 'EXT',
                    message
                }
            }).catch(() => { }); // Silently fail if tab not ready
        });
    });
}

// -----------------------------------------------------------------------------
// DFL 24/7 AUTO-SCHEDULER (V8.0)
// -----------------------------------------------------------------------------
async function runDFLAutoScheduler() {
    try {
        const res = await chrome.storage.local.get(['dflAutoEnabled', 'lastAutoAnalyticsTime', 'lastAutoPlanTime']);
        if (res.dflAutoEnabled === false) return;

        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        const eightHours = 8 * oneHour;

        // 1. Analytics Collection (1h)
        if (!res.lastAutoAnalyticsTime || (now - res.lastAutoAnalyticsTime > oneHour)) {
            sysLog('Triggering Scheduled Analytics Collection (1h)', 'success');
            chrome.tabs.query({ url: ['http://localhost:*/*', 'http://127.0.0.1:*/*'] }, (tabs) => {
                tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_AUTO_ANALYTICS' }));
            });
            await chrome.storage.local.set({ lastAutoAnalyticsTime: now });
        }

        // 2. Plan Generation (8h)
        if (!res.lastAutoPlanTime || (now - res.lastAutoPlanTime > eightHours)) {
            sysLog('Triggering Scheduled Plan Generation (8h)', 'success');
            chrome.tabs.query({ url: ['http://localhost:*/*', 'http://127.0.0.1:*/*'] }, (tabs) => {
                tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_AUTO_PLAN' }));
            });
            await chrome.storage.local.set({ lastAutoPlanTime: now });
        }
    } catch (error) {
        console.error('❌ [DFL Auto] Scheduler Error:', error);
        sysLog(`Scheduler Error: ${error.message}`, 'error');
    }
}

// Run DFL Auto Scheduler every 5 minutes (to check if it's time for analytics/plan)
setInterval(runDFLAutoScheduler, 5 * 60 * 1000);
console.log('🤖 [Background] DFL 24/7 Auto-Scheduler Started (checks every 5 minutes)');

// Also run once shortly after startup
setTimeout(runDFLAutoScheduler, 30000); // 30 seconds after load

// ================================
// 🎬 GOOGLE VIDS DOWNLOAD INTERCEPTOR
// ================================
// Automatically intercepts video downloads from Google Vids,
// reads the file, converts to base64, and triggers YouTube upload

let pendingGoogleVidsDownload = null;

// Listen for download creation - log ALL downloads for debugging
chrome.downloads.onCreated.addListener((downloadItem) => {
    console.log(`📥 [Download Interceptor] ===== NEW DOWNLOAD DETECTED =====`);
    console.log(`📥 [Download Interceptor] ID: ${downloadItem.id}`);
    console.log(`📥 [Download Interceptor] URL: ${downloadItem.url?.substring(0, 150)}`);
    console.log(`📥 [Download Interceptor] Filename: ${downloadItem.filename}`);
    console.log(`📥 [Download Interceptor] MIME: ${downloadItem.mime}`);

    // Check if this is from Google Vids - more permissive matching
    const url = downloadItem.url || '';
    const filename = downloadItem.filename || '';
    const mime = downloadItem.mime || '';

    const isGoogleVids = url.includes('docs.google.com/videos') ||
        url.includes('docs.google.com') ||
        url.includes('googleusercontent.com') ||
        url.includes('contribution.usercontent') ||
        // 🔧 V6.2: Add GeminiGen/Cloudflare R2 detection
        url.includes('cloudflarestorage.com') ||
        url.includes('r2.cloudflarestorage') ||
        url.includes('geminigen') ||
        url.includes('gmicloud') ||
        filename.toLowerCase().includes('vids') ||
        filename.toLowerCase().endsWith('.mp4') ||
        filename.toLowerCase().endsWith('.webm') ||
        mime.includes('video');

    if (isGoogleVids) {
        console.log(`🎬 [Download Interceptor] *** GOOGLE VIDS VIDEO DETECTED! ***`);
        console.log(`🔍 [Download Interceptor] Full URL: ${url}`);

        // Store download info for later processing
        pendingGoogleVidsDownload = {
            id: downloadItem.id,
            url: url,
            filename: filename,
            startTime: Date.now()
        };

        console.log(`📝 [Download Interceptor] Stored pending download, waiting for completion...`);
    } else {
        console.log(`⚠️ [Download Interceptor] Not a Google Vids video, skipping.`);
    }
});

// Listen for download completion
chrome.downloads.onChanged.addListener(async (downloadDelta) => {
    // Check if download completed
    if (downloadDelta.state && downloadDelta.state.current === 'complete') {
        console.log(`✅ [Download Interceptor] Download completed: ID ${downloadDelta.id}`);

        // Check if this is our pending Google Vids download
        if (pendingGoogleVidsDownload && pendingGoogleVidsDownload.id === downloadDelta.id) {
            console.log(`🎬 [Download Interceptor] Google Vids video download complete!`);

            try {
                // Get the downloaded file info
                const downloads = await chrome.downloads.search({ id: downloadDelta.id });
                if (downloads && downloads.length > 0) {
                    const downloadInfo = downloads[0];
                    const filePath = downloadInfo.filename;
                    const originalUrl = pendingGoogleVidsDownload.url;

                    console.log(`📂 [Download Interceptor] File saved at: ${filePath}`);
                    console.log(`🔗 [Download Interceptor] Original URL: ${originalUrl?.substring(0, 80)}...`);

                    // Notify React app
                    chrome.tabs.query({ url: ['http://localhost:*/*', 'http://127.0.0.1:*/*'] }, (tabs) => {
                        tabs.forEach(tab => {
                            chrome.tabs.sendMessage(tab.id, {
                                type: 'GOOGLE_VIDS_DOWNLOAD_COMPLETE',
                                filePath: filePath,
                                fileName: filePath.split(/[\\\/]/).pop(),
                                downloadId: downloadDelta.id
                            }).catch(err => console.log(`⚠️ Could not notify tab:`, err.message));
                        });
                    });

                    // 🔧 KEY: Now fetch the video from original URL (download is complete, won't conflict)
                    chrome.storage.local.get([EXT_CONSTANTS.STORAGE.GOOGLE_VIDS_UPLOAD_DATA], async (result) => {
                        const uploadData = result[EXT_CONSTANTS.STORAGE.GOOGLE_VIDS_UPLOAD_DATA];
                        if (uploadData) {
                            console.log(`📦 [Download Interceptor] Found pending upload data, preparing YouTube upload...`);

                            if (originalUrl && originalUrl.startsWith('http')) {
                                try {
                                    console.log(`📥 [Download Interceptor] Fetching video from URL for base64...`);
                                    const response = await fetch(originalUrl);
                                    if (!response.ok) throw new Error(`HTTP ${response.status}`);

                                    const blob = await response.blob();
                                    console.log(`✅ [Download Interceptor] Got blob: ${blob.size} bytes, type: ${blob.type}`);

                                    // Convert to base64
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                        const base64Data = reader.result;
                                        console.log(`📦 [Download Interceptor] Converted to base64: ${base64Data.length} chars`);

                                        // Add video data
                                        uploadData.videoData = base64Data;
                                        uploadData.fileName = `googlevids_${Date.now()}.mp4`;

                                        // Store for processUpload
                                        const videoId = uploadData.id || 'googlevids_' + Date.now();
                                        getPendingUploads().then(uploads => {
                                            uploads[videoId] = uploadData;
                                            uploads['latest'] = uploadData;
                                            savePendingUploads(uploads).then(() => {
                                                console.log(`✅ [Download Interceptor] Video data stored for ID: ${videoId} (Persistent)`);
                                                console.log(`📅 [Download Interceptor] Schedule: ${uploadData.scheduleDate} ${uploadData.scheduleTime}`);

                                                // Open YouTube Studio
                                                const uploadUrl = `https://studio.youtube.com/channel/mine/videos/upload?d=${Date.now()}&gemini_id=${videoId}`;
                                                chrome.tabs.create({ url: uploadUrl }, (tab) => {
                                                    console.log(`🚀 [Download Interceptor] YouTube Studio opened! Tab: ${tab.id}`);
                                                });
                                            });
                                        });
                                    };
                                    reader.onerror = (err) => {
                                        console.error(`❌ [Download Interceptor] FileReader error:`, err);
                                        // Fallback: open YouTube with file path info
                                        openYouTubeWithFilePath(uploadData, filePath);
                                    };
                                    reader.readAsDataURL(blob);

                                } catch (fetchErr) {
                                    console.error(`❌ [Download Interceptor] Fetch failed:`, fetchErr);
                                    // Fallback: open YouTube with file path info
                                    openYouTubeWithFilePath(uploadData, filePath);
                                }
                            } else {
                                // No URL, use file path fallback
                                openYouTubeWithFilePath(uploadData, filePath);
                            }
                        } else {
                            console.error(`❌ [Download Interceptor] No upload data found!`);
                        }
                    });
                }
            } catch (err) {
                console.error(`❌ [Download Interceptor] Error processing download:`, err);
            }

            // Clear pending download
            pendingGoogleVidsDownload = null;
        }
    }
});

// Helper: Open YouTube Studio with file path (fallback when fetch fails)
function openYouTubeWithFilePath(uploadData, filePath) {
    console.log(`📁 [Download Interceptor] Using file path fallback...`);

    chrome.storage.local.set({
        'pendingVideoFilePath': filePath,
        'pendingVideoUploadData': uploadData
    }, () => {
        console.log(`✅ [Download Interceptor] Video path stored. Ready for YouTube upload.`);

        // Open YouTube Studio upload page
        const videoId = uploadData.id || 'googlevids_' + Date.now();
        const uploadUrl = `https://studio.youtube.com/channel/mine/videos/upload?d=${Date.now()}&gemini_id=${videoId}`;

        chrome.tabs.create({ url: uploadUrl }, (tab) => {
            console.log(`🚀 [Download Interceptor] YouTube Studio upload page opened!`);
        });
    });
}

// Handle storing Google Vids upload data for later use
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'storeGoogleVidsUploadData') {
        console.log(`📦 [Download Interceptor] Storing Google Vids upload data...`);
        chrome.storage.local.set({ 'googleVidsUploadData': request.data }, () => {
            console.log(`✅ [Download Interceptor] Upload data stored successfully`);
            console.log(`📅 [Download Interceptor] Schedule: ${request.data.scheduleDate} ${request.data.scheduleTime}`);
            sendResponse({ success: true });
        });
        return true; // Keep message channel open for async response
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ██ SECTION: X/TWITTER TRENDS SCRAPING
    // ██ Purpose: Store and retrieve X.com trends scraped via content script
    // ██ Dependencies: xTrendsScraper.js
    // ═══════════════════════════════════════════════════════════════════════

    // Store scraped X trends
    if (request.action === 'xTrendsScraped') {
        console.log(`📱 [Background] X Trends scraped: ${request.trends?.length || 0} trends`);
        chrome.storage.local.set({
            'xTrends': request.trends,
            'xTrendsTimestamp': request.timestamp
        }, () => {
            console.log('✅ [Background] X Trends stored');
            sendResponse({ success: true });
        });
        return true;
    }

    // 🤖 SYNC DFL AUTO MODE - External trigger from React UI
    if (request.action === 'syncDflAutoMode') {
        console.log(`🤖 [Background] Syncing DFL Auto Mode to storage: ${request.enabled}`);
        chrome.storage.local.set({ 'dflAutoEnabled': request.enabled }, () => {
            console.log(`✅ [Background] DFL Auto Mode storage updated: ${request.enabled}`);
            sendResponse({ success: true });
        });
        return true;
    }

    // Request scrape from X.com tab
    if (request.action === 'requestXTrends') {
        chrome.storage.local.get(['xTrends', 'xTrendsTimestamp'], (data) => {
            const now = Date.now();
            const timestamp = data.xTrendsTimestamp ? new Date(data.xTrendsTimestamp).getTime() : 0;
            const isFresh = (now - timestamp) < 5 * 60 * 1000; // 5 minutes cache

            chrome.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] }, (tabs) => {
                if (tabs.length === 0 || isFresh) {
                    // No X.com tab OR data is already fresh, return cached
                    console.log(`📱 [Background] Returning ${isFresh ? 'fresh' : 'cached'} X Trends`);
                    sendResponse({
                        success: !!data.xTrends,
                        trends: data.xTrends || [],
                        timestamp: data.xTrendsTimestamp,
                        cached: true
                    });
                } else {
                    // Data is stale and X tab exists, request fresh scrape
                    console.log(`📱 [Background] X Trends stale, requesting fresh scrape from tab ${tabs[0].id}`);
                    chrome.tabs.sendMessage(tabs[0].id, { action: 'scrapeXTrends' }, (response) => {
                        if (chrome.runtime.lastError || !response) {
                            console.warn(`⚠️ [Background] Fresh scrape failed, falling back to cached`);
                            sendResponse({
                                success: !!data.xTrends,
                                trends: data.xTrends || [],
                                timestamp: data.xTrendsTimestamp,
                                cached: true
                            });
                        } else {
                            sendResponse(response);
                        }
                    });
                }
            });
        });
        return true;
    }

    if (request.action === 'checkYouTubeStudioOpened') {
        const videoId = request.videoId;
        chrome.tabs.query({ url: '*://studio.youtube.com/*' }, (tabs) => {
            const hasUploadTab = tabs.some(tab =>
                tab.url?.includes('videos/upload') && tab.url?.includes('gemini_id')
            );
            sendResponse({ opened: hasUploadTab });
        });
        return true;
    }

    // 🆕 V6.1: Force open YouTube Studio as fallback
    if (request.action === 'forceOpenYouTubeStudio') {
        console.log(`🔧 [Background] Force opening YouTube Studio for video: ${request.videoId}`);

        chrome.storage.local.get(['googleVidsUploadData'], (result) => {
            if (result.googleVidsUploadData) {
                const uploadData = result.googleVidsUploadData;
                const videoId = request.videoId || uploadData.id || 'googlevids_' + Date.now();

                console.log(`📦 [Background] Found upload data: ${uploadData.title}`);

                // Store in pendingUploads (even without video data - user will manually select file)
                getPendingUploads().then(uploads => {
                    uploads[videoId] = {
                        ...uploadData,
                        id: videoId,
                        videoId: videoId,
                        needsManualUpload: true // Flag for manual file selection
                    };
                    uploads['latest'] = uploads[videoId];

                    savePendingUploads(uploads).then(() => {
                        // Check if YouTube Studio is already open
                        chrome.tabs.query({ url: '*://studio.youtube.com/*/videos/upload*' }, (existingTabs) => {
                            if (existingTabs.length > 0) {
                                console.log(`✅ [Background] YouTube Studio already open, focusing...`);
                                chrome.tabs.update(existingTabs[0].id, { active: true });
                                sendResponse({ success: true, tabId: existingTabs[0].id });
                            } else {
                                const uploadUrl = `https://studio.youtube.com/channel/mine/videos/upload?d=${Date.now()}&gemini_id=${videoId}`;
                                chrome.tabs.create({ url: uploadUrl }, (tab) => {
                                    console.log(`🚀 [Background] YouTube Studio opened! Tab: ${tab.id}`);
                                    sendResponse({ success: true, tabId: tab.id });
                                });
                            }
                        });
                    });
                });
            } else {
                console.error(`❌ [Background] No upload data found for forceOpen!`);
                sendResponse({ success: false, error: 'No upload data' });
            }
        });
        return true;
    }

    // 🔧 NEW: Handle direct video upload from content script
    if (request.action === 'storeAndOpenYouTube') {
        console.log(`🎬 [Background] Received video data from content script!`);
        const data = request.data;

        console.log(`📦 [Background] Video: ${data.title?.substring(0, 50)}...`);
        console.log(`📦 [Background] Base64 length: ${data.videoData?.length || 0} chars`);
        console.log(`📅 [Background] Schedule: ${data.scheduleDate} ${data.scheduleTime}`);

        // Store in pendingUploads
        const videoId = data.id || 'googlevids_' + Date.now();
        getPendingUploads().then(uploads => {
            uploads[videoId] = data;
            uploads['latest'] = data;
            savePendingUploads(uploads).then(() => {
                console.log(`✅ [Background] Video stored with ID: ${videoId} (Persistent)`);

                // Open YouTube Studio upload page
                const uploadUrl = `https://studio.youtube.com/channel/mine/videos/upload?d=${Date.now()}&gemini_id=${videoId}`;
                chrome.tabs.create({ url: uploadUrl }, (tab) => {
                    console.log(`🚀 [Background] YouTube Studio opened! Tab: ${tab.id}`);
                    sendResponse({ success: true, tabId: tab.id });
                });
            });
        });

        return true; // Keep channel open for async
    }

    if (request.action === 'relayGoogleVidsStatus') {
        console.log(`📡 [Download Interceptor] Relaying Google Vids status: ${request.status}`);
        // Relay to React tabs
        chrome.tabs.query({ url: ['http://localhost:*/*', 'http://127.0.0.1:*/*'] }, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'YOUTUBE_UPLOAD_STATUS',
                    status: request.message || request.status,
                    videoId: request.videoIndex
                }).catch(err => { });
            });
        });
        sendResponse({ success: true });
        return false;
    }
});

console.log('🎬 [Background] Google Vids Download Interceptor Active');

// ═══════════════════════════════════════════════════════════════════════════
// 📅 SCHEDULED COMMENT MONITOR (Background Service Worker)
// ═══════════════════════════════════════════════════════════════════════════
// This runs in the background and checks for scheduled comments that are now due.
// When a scheduled video goes live, it opens the video page to trigger comment posting.

const SCHEDULED_CHECK_INTERVAL = 2 * 60 * 1000; // Check every 2 minutes

async function checkScheduledComments() {
    console.log('📅 [BG-ScheduledMonitor] Checking for due scheduled comments...');

    try {
        const result = await chrome.storage.local.get(['gemini_scheduled_comments']);
        const scheduledComments = result.gemini_scheduled_comments || {};
        const now = Date.now();
        let modified = false;
        let processedOneVideo = false; // 🆕 V3.4: Only process ONE video per cycle

        for (const [videoId, data] of Object.entries(scheduledComments)) {
            // 🆕 V3.4: Stop after processing one video to prevent multiple tabs
            if (processedOneVideo) {
                console.log(`   ⏸️ Skipping remaining videos (one per cycle limit)`);
                break;
            }

            // Skip if scheduled time hasn't passed yet
            // 🆕 V3.5: If video is ALREADY public (detected via oEmbed), trigger even if time hasn't reached
            // This fixes the case where video is published manually or earlier than planned
            const isDue = now >= data.scheduledTimestamp;
            let shouldCheckPublic = isDue;

            if (!isDue) {
                // Only check oEmbed for future videos once every 10 minutes to save API quota
                const lastCheck = data.lastCheck || 0;
                if (now - lastCheck > 10 * 60 * 1000) {
                    shouldCheckPublic = true;
                    console.log(`🔍 [BG-ScheduledMonitor] Video ${videoId} is future-scheduled but checking if already public...`);
                }
            }

            if (!shouldCheckPublic) {
                const remainingMins = Math.round((data.scheduledTimestamp - now) / 60000);
                console.log(`   ⏰ Video ${videoId}: ${remainingMins} minutes until scheduled time`);
                continue;
            }

            // Skip if recently checked (within 1 minute)
            if (data.lastCheck && now - data.lastCheck < 60000) {
                continue;
            }

            // Skip if already posted or hit max attempts
            if (data.status === 'posted' || data.attempts >= (data.maxAttempts || 10)) {
                continue;
            }

            console.log(`📅 [BG-ScheduledMonitor] Video ${videoId} is DUE! Checking if public...`);

            // Check if video is public using oEmbed API
            const isPublic = await checkVideoIsPublic(videoId);
            data.lastCheck = now;
            data.checkAttempts = (data.checkAttempts || 0) + 1; // 🆕 V3.7: Increment check attempts
            modified = true;

            if (isPublic) {
                // 🆕 V3.4: Check global lock FIRST to prevent duplicate tabs
                const lockKey = `comment_lock_${videoId}`;
                const lockResult = await chrome.storage.local.get([lockKey]);

                if (lockResult[lockKey]) {
                    const lockTime = lockResult[lockKey];
                    const elapsed = now - lockTime;
                    if (elapsed < 600000) { // 🆕 V3.6: 10 minute lock (increased from 5 min)
                        console.log(`🔒 [BG-ScheduledMonitor] Lock active for ${videoId}, skipping (${Math.round(elapsed / 1000)}s old)`);
                        continue;
                    }
                }

                // 🆕 V3.6: Check global YouTube tab limit (Max 3)
                const tabs = await new Promise(resolve => chrome.tabs.query({ url: "*://www.youtube.com/*" }, resolve));
                if (tabs.length >= 3) {
                    console.warn(`⚠️ [BG-ScheduledMonitor] Too many YouTube tabs open (${tabs.length}), skipping ${videoId} for now.`);
                    continue;
                }

                // 🆕 V3.6: Check if THIS video already has an open tab
                const existingTab = tabs.find(t => t.url && t.url.includes(videoId));
                if (existingTab) {
                    console.log(`✅ [BG-ScheduledMonitor] Tab already open for ${videoId} (Tab ${existingTab.id}), skipping creation.`);
                    continue;
                }

                console.log(`✅ [BG-ScheduledMonitor] Video ${videoId} is PUBLIC! Opening tab to post comment...`);

                // 🆕 V3.4: Set lock BEFORE opening tab to prevent race condition
                await chrome.storage.local.set({ [lockKey]: now });

                // Store comment in pending_auto_comment for the video page to pick up
                await chrome.storage.local.set({
                    'pending_auto_comment': JSON.stringify({
                        text: data.text,
                        videoId: videoId,
                        videoUrl: data.url,
                        timestamp: Date.now()
                    })
                });

                // Open the video page
                chrome.tabs.create({ url: data.url, active: true }, (tab) => {
                    console.log(`✅ [BG-ScheduledMonitor] Opened video page: Tab ${tab.id}`);
                });

                // ❌ V3.5: DO NOT mark as posted here. Wait for relayCommentPosted message.
                // data.status = 'posted'; 

                // 🆕 V3.4: Mark that we processed one video - stop for this cycle
                processedOneVideo = true;
            } else {
                console.log(`   ⏳ Video ${videoId}: Still not public (attempt ${data.attempts}/${data.maxAttempts || 10})`);
            }
        }

        // Save updated data
        if (modified) {
            await chrome.storage.local.set({ 'gemini_scheduled_comments': scheduledComments });
        }

        // Log summary
        const pendingCount = Object.values(scheduledComments).filter(d => d.status !== 'posted').length;
        console.log(`📅 [BG-ScheduledMonitor] Check complete. ${pendingCount} comments still pending.`);

    } catch (error) {
        console.error('❌ [BG-ScheduledMonitor] Error:', error);
    }

}

async function checkVideoIsPublic(videoId) {
    try {
        const response = await fetch(
            `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
            { method: 'GET' }
        );

        if (response.ok) {
            const data = await response.json();
            return !!data.title;
        }
        return false;
    } catch (error) {
        console.warn(`⚠️ [BG-ScheduledMonitor] oEmbed check failed for ${videoId}:`, error.message);
        return false;
    }
}

// Start the monitor using chrome.alarms (more reliable than setInterval in service workers)
chrome.alarms.create('scheduledCommentCheck', { periodInMinutes: 2 });

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'scheduledCommentCheck') {
        checkScheduledComments();
    }
});

// Also check immediately when extension loads
setTimeout(checkScheduledComments, 5000);

console.log('📅 [Background] Scheduled Comment Monitor Active (checking every 2 minutes)');

// ===========================================
// 🎭 SCRIPTED ARGUMENT ORCHESTRATOR
// ===========================================

let scriptedArgumentState = {
    active: false,
    videoId: null,
    steps: [],
    currentStepIndex: 0
};

function processNextScriptStep() {
    if (!scriptedArgumentState.active) return;

    const step = scriptedArgumentState.steps[scriptedArgumentState.currentStepIndex];
    if (!step) {
        console.log("🎭 [ScriptRunner] Script complete!");
        scriptedArgumentState.active = false;
        return;
    }

    console.log("🎭 [ScriptRunner] Processing Step " + (scriptedArgumentState.currentStepIndex + 1) + ":", step);

    // Find the tab
    chrome.tabs.query({ url: "*://www.youtube.com/watch?v=" + scriptedArgumentState.videoId + "*" }, (tabs) => {
        if (tabs.length === 0) {
            console.error("❌ [ScriptRunner] Video tab not found");
            return;
        }
        const tabId = tabs[0].id;

        const executeAction = () => {
            console.log("🎭 [ScriptRunner] Executing action:", step.type);

            if (step.type === 'comment') {
                chrome.tabs.sendMessage(tabId, {
                    type: 'IGNITE_COMMENT',
                    text: step.text,
                    pin: false
                });
            } else if (step.type === 'reply') {
                chrome.tabs.sendMessage(tabId, {
                    type: 'REPLY_COMMENT',
                    parentText: step.parentText,
                    replyText: step.text
                });
            } else if (step.type === 'like') {
                chrome.tabs.sendMessage(tabId, {
                    type: 'LIKE_COMMENT',
                    text: step.text // Text of comment to like
                });
            } else if (step.type === 'like_video') {
                chrome.tabs.sendMessage(tabId, {
                    type: 'LIKE_VIDEO'
                });
            } else if (step.type === 'subscribe') {
                chrome.tabs.sendMessage(tabId, {
                    type: 'SUBSCRIBE_CHANNEL'
                });
            } else if (step.type === 'bait') {
                // Algorithm Baiting: Like Video -> Subscribe -> Comment
                console.log("🎭 [ScriptRunner] Executing Algorithm Baiting Sequence...");

                // 1. Like Video
                chrome.tabs.sendMessage(tabId, { type: 'LIKE_VIDEO' });

                setTimeout(() => {
                    // 2. Subscribe
                    chrome.tabs.sendMessage(tabId, { type: 'SUBSCRIBE_CHANNEL' });

                    setTimeout(() => {
                        // 3. Comment
                        chrome.tabs.sendMessage(tabId, {
                            type: 'IGNITE_COMMENT',
                            text: step.text || "Great video! Subscribed.",
                            pin: false
                        });
                    }, 2000);
                }, 2000);
            }

            // Move to next step after delay (allow overriding delay)
            const nextDelay = step.delay || 15000;
            setTimeout(() => {
                scriptedArgumentState.currentStepIndex++;
                processNextScriptStep();
            }, nextDelay); // Variable delay
        };

        if (step.accountName) {
            console.log("🎭 [ScriptRunner] Switching account to:", step.accountName);
            chrome.tabs.sendMessage(tabId, {
                type: 'SWITCH_ACCOUNT',
                accountName: step.accountName
            });

            // Wait for switch (page might reload or soft nav)
            setTimeout(() => {
                executeAction();
            }, 8000);
        } else {
            executeAction();
        }
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "startScriptedArgument") {
        console.log("🎭 [Background] Starting Scripted Argument for video:", request.videoId);
        scriptedArgumentState = {
            active: true,
            videoId: request.videoId
        };


        sendResponse({ success: true });
        return false;
    }

    // 🌐 V2.0: CROSS_PLATFORM_DISTRIBUTE - Orchestrate multi-platform posting
    if (request.action === 'crossPlatformDistribute') {
        const { payload, requestId } = request;
        console.log(`🌐 [Background] Orchestrating cross-platform distribution (${requestId})`);

        // 📟 Trace Intent Start
        const logIntent = (status) => {
            chrome.tabs.query({ url: ["http://localhost:*/*", "http://127.0.0.1:*/*"] }, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, {
                        type: 'SYSLOG_ENTRY',
                        payload: {
                            type: 'INTENT_TRACE',
                            intentId: requestId,
                            action: 'CROSS_PLATFORM_DISTRIBUTE',
                            timestamp: Date.now(),
                            status: status,
                            source: 'extension_bg'
                        }
                    }).catch(() => { });
                });
            });
        };

        logIntent('executing');

        const results = { x: 'pending', tiktok: 'pending' };

        // 1. Post to X
        if (payload.x) {
            console.log("📱 [Background] Triggering X post...");
            chrome.runtime.sendMessage({
                action: 'xPost',
                text: payload.x.text,
                youtubeLink: payload.x.youtubeLink,
                requestId: requestId
            });
            results.x = 'triggered';
        } else {
            results.x = 'skipped';
        }

        // 2. Upload to TikTok
        if (payload.tiktok) {
            console.log("🎵 [Background] Triggering TikTok upload...");
            chrome.runtime.sendMessage({
                action: 'tiktokUpload',
                videoData: payload.tiktok.videoData,
                metadata: payload.tiktok,
                requestId: requestId
            });
            results.tiktok = 'triggered';
        } else {
            results.tiktok = 'skipped';
        }

        sendResponse({ success: true, state: results, requestId });
        return false;
    }

    // 🎵 TikTok Upload (direct request)
    if (request.action === "tiktokUpload") {
        const { videoData, metadata, requestId } = request;
        console.log(`🎵 [Background] TikTok Upload Request (${requestId || 'direct'})`);

        chrome.tabs.create({
            url: 'https://www.tiktok.com/tiktokstudio/upload',
            active: true
        }, (tab) => {
            // Wait for TikTok Upload page to load, then send data
            setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'tiktokUpload',
                    videoData: videoData,
                    metadata: metadata,
                    requestId: requestId
                }).catch(err => console.warn("⚠️ [Background] Failed to send to TikTok tab:", err.message));
            }, 6000); // 6s to be safe
        });

        sendResponse({ success: true });
        return false;
    }

    // 📱 X Post (direct request)
    if (request.action === "xPost") {
        const { text, youtubeLink, requestId } = request;
        console.log(`📱 [Background] X Post Request (${requestId || 'direct'})`);

        chrome.tabs.create({
            url: 'https://x.com/compose/post',
            active: true
        }, (tab) => {
            setTimeout(() => {
                chrome.tabs.sendMessage(tab.id, {
                    action: 'xPost',
                    text: text,
                    youtubeLink: youtubeLink,
                    requestId: requestId
                }).catch(err => console.warn("⚠️ [Background] Failed to send to X tab:", err.message));
            }, 5000);
        });
        sendResponse({ success: true });
        return false;
    }

    // 📊 Get Cross-Platform Status
    if (request.action === "getCrossPlatformStatus") {
        sendResponse({ success: true, state: crossPlatformState });
        return false;
    }

    // 📱 X Post Complete (relay from content script)
    if (request.action === "X_POST_COMPLETE") {
        const { status, error, requestId } = request;
        console.log(`📱 [Background] X Post Complete: ${status} (${requestId || 'no-id'})`);

        // 📟 Trace Intent Outcome
        if (requestId) {
            chrome.tabs.query({ url: ["http://localhost:*/*", "http://127.0.0.1:*/*"] }, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, {
                        type: 'SYSLOG_ENTRY',
                        payload: {
                            type: 'INTENT_TRACE',
                            intentId: requestId,
                            action: 'X_POST',
                            timestamp: Date.now(),
                            status: status === 'success' ? 'completed' : 'failed',
                            error: error,
                            source: 'extension_bg'
                        }
                    }).catch(() => { });
                });
            });
        }

        // Relay to React for UI feedback
        chrome.tabs.query({ url: ['http://localhost:*/*', 'http://127.0.0.1:*/*'] }, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'X_POST_RESULT',
                    payload: { success: status === 'success', error: error, requestId: requestId }
                }).catch(() => { });
            });
        });
        return false;
    }

    // 🎵 TikTok Upload Complete (relay from content script)
    if (request.action === "TIKTOK_UPLOAD_COMPLETE") {
        const { status, error, requestId } = request;
        console.log(`🎵 [Background] TikTok Upload Complete: ${status} (${requestId || 'no-id'})`);

        // 📟 Trace Intent Outcome
        if (requestId) {
            chrome.tabs.query({ url: ["http://localhost:*/*", "http://127.0.0.1:*/*"] }, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, {
                        type: 'SYSLOG_ENTRY',
                        payload: {
                            type: 'INTENT_TRACE',
                            intentId: requestId,
                            action: 'TIKTOK_UPLOAD',
                            timestamp: Date.now(),
                            status: status === 'success' ? 'completed' : 'failed',
                            error: error,
                            source: 'extension_bg'
                        }
                    }).catch(() => { });
                });
            });
        }

        // Relay to React for UI feedback
        chrome.tabs.query({ url: ['http://localhost:*/*', 'http://127.0.0.1:*/*'] }, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'TIKTOK_UPLOAD_RESULT',
                    payload: { success: status === 'success', error: error, requestId: requestId }
                }).catch(() => { });
            });
        });
        return false;
    }
});

console.log("🌐 [Background] Cross-Platform Distribution Orchestrator loaded");

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 V2.0: CLOSED-LOOP FEEDBACK SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * External Platform Analytics Storage
 * Used to feed performance data back to DFL engine
 */
let externalAnalyticsStore = {
    x: {
        posts: [],
        lastScraped: null,
        profile: null
    },
    tiktok: {
        videos: [],
        lastScraped: null,
        summary: null
    }
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // 📊 X Analytics Scraped (auto-sent from xAnalyticsScraper)
    if (request.action === "xAnalyticsScraped") {
        console.log("📊 [Background] X Analytics received:", request.data?.posts?.length, "posts");

        externalAnalyticsStore.x = {
            posts: request.data.posts || [],
            profile: request.data.profile || null,
            lastScraped: request.data.timestamp
        };

        // Store in chrome.storage for persistence
        chrome.storage.local.set({
            external_analytics_x: externalAnalyticsStore.x
        });

        // Relay to React app if any localhost tabs exist
        relayToReact({
            type: 'EXTERNAL_ANALYTICS_UPDATE',
            platform: 'x',
            data: externalAnalyticsStore.x
        });

        return false;
    }

    // 📊 TikTok Analytics Scraped (auto-sent from tiktokAnalyticsScraper)
    if (request.action === "tiktokAnalyticsScraped") {
        console.log("📊 [Background] TikTok Analytics received:", request.data?.videos?.length, "videos");

        externalAnalyticsStore.tiktok = {
            videos: request.data.videos || [],
            summary: request.data.summary || null,
            lastScraped: request.data.timestamp
        };

        // Store in chrome.storage for persistence
        chrome.storage.local.set({
            external_analytics_tiktok: externalAnalyticsStore.tiktok
        });

        // Relay to React app
        relayToReact({
            type: 'EXTERNAL_ANALYTICS_UPDATE',
            platform: 'tiktok',
            data: externalAnalyticsStore.tiktok
        });

        return false;
    }

    // 📊 Get All External Analytics
    if (request.action === "getExternalAnalytics") {
        console.log("📊 [Background] External analytics requested");

        // Try to load from storage first
        chrome.storage.local.get(['external_analytics_x', 'external_analytics_tiktok'], (result) => {
            sendResponse({
                success: true,
                data: {
                    x: result.external_analytics_x || externalAnalyticsStore.x,
                    tiktok: result.external_analytics_tiktok || externalAnalyticsStore.tiktok
                }
            });
        });


        return true; // Async response
    }

    // 🆕 V9.0: Close Tab Handler (Fix for Direct Collect tabs remaining open)
    if (request.action === 'closeTab') {
        const url = request.url;
        const tabId = sender.tab ? sender.tab.id : null;
        console.log(`❌ [Background] Received closeTab request for Tab ${tabId} (${url})`);

        if (tabId) {
            TabManager.remove(tabId); // Use TabManager for proper cleanup
            sendResponse({ success: true });
        } else {
            // Fallback: Query tabs by URL if sender.tab is missing
            chrome.tabs.query({ url: url }, (tabs) => {
                if (tabs && tabs.length > 0) {
                    tabs.forEach(t => TabManager.remove(t.id));
                    sendResponse({ success: true, count: tabs.length });
                } else {
                    sendResponse({ success: false, error: "Tab not found" });
                }
            });
        }
        return true;
    }

    // 🆕 V9.0: Check Automation Status
    if (request.action === 'checkAutomationStatus') {
        // Simple logic: If the tab was created by our extension with a specific purpose
        const tabId = sender.tab ? sender.tab.id : null;
        if (tabId && TabManager.activeTabs.has(tabId)) {
            const info = TabManager.activeTabs.get(tabId);
            sendResponse({ isAutomated: true, purpose: info.purpose });
        } else {
            // Also check if URL indicates automation
            const url = sender.tab ? sender.tab.url : '';
            if (url && (url.includes('gemini_action=') || url.includes('automation=true'))) {
                sendResponse({ isAutomated: true, purpose: 'unknown_automation' });
            } else {
                sendResponse({ isAutomated: false });
            }
        }
        return false;
    }

    // 🆕 V9.0: Relay Direct Analytics Result
    if (request.action === 'relayAnalyticsDirectResult') {
        console.log(`📊 [Background] Relaying YOUTUBE_ANALYTICS_DIRECT_RESULT to React tabs`);
        chrome.tabs.query({
            url: [
                "http://localhost:*/*",
                "http://127.0.0.1:*/*"
            ]
        }, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'YOUTUBE_ANALYTICS_DIRECT_RESULT',
                    data: request.data
                }).catch(() => { });
            });
        });
        sendResponse({ success: true });
        return false;
    }

    // 🆕 Placeholder for Shorts Refresh (prevent Port Closed error)
    if (request.action === 'REQUEST_YOUTUBE_SHORTS_REFRESH') {
        console.log("🔄 [Background] Shorts refresh requested (Placeholder)");
        sendResponse({ success: true, message: "Refresh triggered" });
        return false;
    }

    // Default fallback to prevent port closure warnings
    if (typeof sendResponse === 'function') {
        sendResponse({ success: false, error: "UNHANDLED_ACTION", action: request.action });
    }
    return false;
});

