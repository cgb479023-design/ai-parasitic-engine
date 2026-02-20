/**
 * React App Message Bridge Module
 * 
 * Handles communication between Chrome extension and React application.
 * Bridges window.postMessage <-> chrome.runtime.sendMessage
 * 
 * @module core/reactBridge
 * @version 1.1.0
 * @date 2026-01-16
 * 
 * Only active on localhost/development servers
 */

(function () {
    'use strict';

    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

    if (!isLocalhost) {
        return;
    }

    console.log("🌉 [ReactBridge] Module loaded - Localhost detected!");

    // ═══════════════════════════════════════════════════════════════════════════
    // SAFE MESSAGING UTILITIES
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Safely send a message to the background script with error handling
     */
    const safeSendMessage = (message, callback) => {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
            try {
                chrome.runtime.sendMessage(message, (response) => {
                    const error = chrome.runtime.lastError;
                    if (error) {
                        console.warn("⚠️ [ReactBridge] SendMessage failed (likely background inactive):", error.message);
                        if (callback) callback({ success: false, error: error.message });
                    } else {
                        if (callback) callback(response || { success: true });
                    }
                });
            } catch (e) {
                console.error("❌ [ReactBridge] Critical error in sendMessage:", e);
                if (callback) callback({ success: false, error: e.message });
            }
        } else {
            console.warn("⚠️ [ReactBridge] Chrome runtime not available for sendMessage");
            if (callback) callback({ success: false, error: 'Runtime unavailable' });
        }
    };

    /**
     * Safely post a message to the React window
     */
    const safePostMessage = (message) => {
        try {
            window.postMessage({ ...message, source: 'extension_bridge' }, '*');
        } catch (e) {
            console.error("❌ [ReactBridge] Failed to postMessage to React:", e);
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // CHROME → REACT BRIDGE
    // ═══════════════════════════════════════════════════════════════════════════

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log("📡 [ReactBridge] Chrome → React:", message.type || message.action);

            // Relay YouTube Upload Complete
            if (message.type === 'YOUTUBE_UPLOAD_COMPLETE') {
                safePostMessage({
                    type: 'YOUTUBE_UPLOAD_COMPLETE',
                    videoId: message.videoId,
                    videoUrl: message.videoUrl,
                    status: message.status || 'published'
                });
                sendResponse({ success: true });
                return false;
            }

            // Relay LMArena Response
            if (message.type === 'LMARENA_RESPONSE_RESULT') {
                console.log("🏟️ [ReactBridge] Relaying LMArena response");
                safePostMessage({
                    type: 'LMARENA_RESPONSE_RESULT',
                    data: message.data
                });
                sendResponse({ success: true });
                return false;
            }

            // Relay YPP Realtime Data
            if (message.type === 'YPP_REALTIME_DATA') {
                safePostMessage({
                    type: 'YPP_REALTIME_DATA',
                    data: message.data
                });
                sendResponse({ success: true });
                return false;
            }

            // Relay Gemini Video Result
            if (message.type === 'GEMINI_VIDEO_RESULT') {
                console.log("🎥 [ReactBridge] Relaying video result:", {
                    hasPayload: !!message.payload,
                    payloadLength: message.payload?.length
                });
                safePostMessage({
                    type: 'GEMINI_VIDEO_RESULT',
                    payload: message.payload,
                    status: message.status || 'published'
                });
                sendResponse({ success: true });
                return false;
            }

            // Relay Analytics Data
            if (message.type === 'ANALYTICS_DATA') {
                safePostMessage({
                    type: 'ANALYTICS_DATA',
                    category: message.category,
                    data: message.data
                });
                sendResponse({ success: true });
                return false;
            }

            // 🆕 V7.8: Relay YouTube Analytics Result (Fast Collect data)
            if (message.type === 'YOUTUBE_ANALYTICS_RESULT') {
                console.log(`📊 [ReactBridge] Relaying YOUTUBE_ANALYTICS_RESULT: category=${message.category}`);
                safePostMessage({
                    type: 'YOUTUBE_ANALYTICS_RESULT',
                    category: message.category,
                    data: message.data
                });
                sendResponse({ success: true });
                return false;
            }

            // 🆕 V7.9: Relay YPP Plan Result (Ask Studio/LMArena response)
            if (message.type === 'YPP_PLAN_RESULT' || message.type === 'ASK_STUDIO_PLAN_RESULT') {
                console.log(`📋 [ReactBridge] Relaying ${message.type} from ${message.source || 'unknown'}`);
                safePostMessage({
                    type: 'YPP_PLAN_RESULT', // Always relay as standardized type
                    payload: message.payload || message.plan,
                    source: message.source,
                    error: message.error,
                    isHeartbeat: message.isHeartbeat // 🎯 Relay heartbeat flag to React window
                });
                sendResponse({ success: true });
                return false;
            }

            // 🆕 V2.4: Relay COMMENT_POSTED from extension to React app
            if (message.type === 'COMMENT_POSTED') {
                console.log(`💬 [ReactBridge] Relaying COMMENT_POSTED for video: ${message.videoId}`);
                safePostMessage({
                    type: 'COMMENT_POSTED',
                    videoId: message.videoId,
                    videoUrl: message.videoUrl,
                    status: message.status,
                    commentText: message.commentText,
                    pinned: message.pinned,
                    timestamp: message.timestamp
                });
                sendResponse({ success: true });
                return false;
            }

            // 📟 SYSLOG_ENTRY relay
            if (message.type === 'SYSLOG_ENTRY') {
                window.postMessage({
                    type: 'SYSLOG_ENTRY',
                    payload: message.payload
                }, '*');
                sendResponse({ success: true });
                return false;
            }


            // Generic relay for other message types
            if (message.type) {
                safePostMessage({ ...message, source: 'background' });
                sendResponse({ success: true });
                return true;
            }
        });

        console.log("📡 [ReactBridge] Chrome → React listener ACTIVE");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // REACT → CHROME BRIDGE (via window.postMessage)
    // ═══════════════════════════════════════════════════════════════════════════

    window.addEventListener('message', (event) => {
        // Only process messages from same window
        if (event.source !== window) return;
        if (!event.data || !event.data.type) return;

        const data = event.data;

        // Skip messages already from background or bridge
        if (data.source === 'background' || data.source === 'extension_bridge') return;

        // 🆕 V1.1: Heartbeat check
        if (data.type === 'CHECK_EXTENSION_STATUS') {
            safePostMessage({
                type: 'EXTENSION_STATUS_RESULT',
                status: 'connected',
                source: 'extension_bridge',
                version: '1.1.0',
                timestamp: Date.now()
            });
            return;
        }

        // 🆕 V7.8: ENSURE_YOUTUBE_STUDIO_TAB - Ensure tab is open
        if (data.type === 'ENSURE_YOUTUBE_STUDIO_TAB') {
            console.log("📺 [ReactBridge] Ensuring YouTube Studio tab is open");
            safeSendMessage({
                action: 'ensureYouTubeStudioTab',
                payload: data.payload
            });
        }

        // REQUEST_IGNITE - Trigger auto-comment
        if (data.type === 'REQUEST_IGNITE') {
            console.log("🔥 [ReactBridge] Ignite request for:", data.url);
            safeSendMessage({
                action: 'triggerAutoComment',
                url: data.url,
                text: data.text,
                pin: data.pin,
                sockpuppetComments: data.sockpuppetComments // 🆕 V7.9: Pass Ignite comments
            });
        }

        // 🆕 V7.9: REQUEST_YOUTUBE_ANALYTICS - Relay to background
        if (data.type === 'REQUEST_YOUTUBE_ANALYTICS') {
            console.log("📊 [ReactBridge] Relaying analytics request:", data.payload?.action || 'custom query');
            safeSendMessage({
                action: 'performAnalyticsAsk',
                payload: data.payload
            });
        }

        // 🆕 V7.9: ASK_STUDIO_GENERATE_PLAN - Relay to background
        if (data.type === 'ASK_STUDIO_GENERATE_PLAN') {
            console.log("🤖 [ReactBridge] Relaying Ask Studio plan generation request. Prompt length:", data.prompt?.length);
            safeSendMessage({
                action: 'ASK_STUDIO_GENERATE_PLAN',
                type: 'ASK_STUDIO_GENERATE_PLAN',
                prompt: data.prompt,
                payload: {
                    ...(data.payload || {}),
                    directPrompt: data.prompt,
                    isPlan: true
                }
            });
        }

        // 🆕 V7.9: RESCHEDULE_VIDEO - Relay to background
        if (data.type === 'RESCHEDULE_VIDEO') {
            console.log("📅 [ReactBridge] Relaying reschedule request for:", data.payload?.title);
            safeSendMessage({
                action: 'rescheduleVideo',
                data: data.payload
            });
        }

        // 🌐 V2.0: CROSS_PLATFORM_DISTRIBUTE - Orchestrate multi-platform posting
        if (data.type === 'CROSS_PLATFORM_DISTRIBUTE') {
            const requestId = data.requestId || `dist_${Date.now()}`;
            console.log(`🌐 [ReactBridge] Relaying cross-platform distribution (${requestId})`);

            // 📟 Trace Intent
            safeSendMessage({
                action: 'SYSLOG_ENTRY',
                payload: {
                    type: 'INTENT_TRACE',
                    intentId: requestId,
                    action: 'CROSS_PLATFORM_DISTRIBUTE',
                    timestamp: Date.now(),
                    status: 'relayed',
                    source: 'brain'
                }
            });

            safeSendMessage({
                action: 'crossPlatformDistribute',
                payload: data.payload,
                requestId: requestId
            }, (response) => {
                safePostMessage({
                    type: 'CROSS_PLATFORM_DISTRIBUTE_RESULT',
                    requestId: requestId,
                    payload: response
                });
            });
        }

        // 📱 X_POST_REQUEST - Direct X posting
        if (data.type === 'X_POST_REQUEST') {
            console.log("🐦 [ReactBridge] Relaying X post request");
            safeSendMessage({
                action: 'xPost',
                text: data.payload.text,
                youtubeLink: data.payload.youtubeLink
            });
        }

        // 🎵 TIKTOK_UPLOAD_REQUEST - Direct TikTok upload
        if (data.type === 'TIKTOK_UPLOAD_REQUEST') {
            console.log("🎵 [ReactBridge] Relaying TikTok upload request");
            safeSendMessage({
                action: 'tiktokUpload',
                videoData: data.payload.videoData,
                metadata: data.payload
            });
        }

        // 🔮 Pillar 3: SYNC_INTENT_STATE - Relay to background -> backend
        if (data.type === 'SYNC_INTENT_STATE') {
            console.log(`🔮 [ReactBridge] Syncing intent state: ${data.payload?.id} (${data.payload?.status})`);
            safeSendMessage({
                action: 'syncIntentState',
                payload: data.payload
            });
        }

        // 🤖 SYNC_DFL_AUTO_MODE - Synchronize DFL status to background storage
        if (data.type === 'SYNC_DFL_AUTO_MODE') {
            console.log(`🤖 [ReactBridge] Syncing DFL Auto Mode: ${data.enabled}`);
            safeSendMessage({
                action: 'syncDflAutoMode',
                enabled: data.enabled
            });
        }
    });

    console.log("📡 [ReactBridge] React → Chrome listener ACTIVE");


    // ═══════════════════════════════════════════════════════════════════════════
    // 🧪 NATIVE AI STUDIO BRIDGE (window.aistudio)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Injects the aistudio object that the React application expects for API Key management.
     * This bridges the gap between the isolated extension context and the page context.
     */
    const injectAIStudioBridge = () => {
        if (window.aistudio) return;

        console.log("🚀 [ReactBridge] Injecting window.aistudio bridge...");

        window.aistudio = {
            /**
             * Check if an API key is already configured in the extension
             */
            hasSelectedApiKey: () => {
                return new Promise((resolve) => {
                    safeSendMessage({ action: 'checkStatus' }, (response) => {
                        // If we can communicate and the extension has a key (or is simply connected)
                        resolve(!!(response && response.success));
                    });
                });
            },

            /**
             * Command the extension to open its key selection interface (options page)
             */
            openSelectKey: () => {
                return new Promise((resolve, reject) => {
                    safeSendMessage({ action: 'openOptionsPage' }, (response) => {
                        if (response && response.success) resolve();
                        else reject(new Error(response?.error || 'Failed to open options'));
                    });
                });
            }
        };
    };

    // Initialize bridge if on localhost
    if (isLocalhost) {
        injectAIStudioBridge();
    }

    // Export for debugging
    window.ReactBridge = {
        sendToChrome: (action, data) => safeSendMessage({ action, ...data }),
        postToReact: (type, data) => safePostMessage({ type, ...data }),
        reinject: injectAIStudioBridge
    };

    console.log("✅ [ReactBridge] Module initialized!");

})();
