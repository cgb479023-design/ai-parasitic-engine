/**
 * Extension Keep-Alive Module
 * 
 * Maintains persistent connection between content script and background service worker.
 * Prevents Chrome from terminating the extension.
 * 
 * @module core/keepAlive
 * @version 1.0.0
 * @date 2026-01-05
 */

(function () {
    'use strict';

    console.log("💓 [KeepAlive] Module loaded - Initializing...");

    let keepAlivePort = null;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 10;

    // ═══════════════════════════════════════════════════════════════════════════
    // PORT CONNECTION
    // ═══════════════════════════════════════════════════════════════════════════

    function connectKeepAlive() {
        if (typeof chrome === 'undefined' || !chrome.runtime) {
            console.warn("⚠️ [KeepAlive] Chrome runtime not available");
            return;
        }

        try {
            keepAlivePort = chrome.runtime.connect({ name: 'keep-alive' });

            keepAlivePort.onDisconnect.addListener(() => {
                const error = chrome.runtime.lastError?.message;
                console.log("🔌 [KeepAlive] Port disconnected:", error || 'No error');

                keepAlivePort = null;
                reconnectAttempts++;

                if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
                    console.log(`🔄 [KeepAlive] Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
                    setTimeout(connectKeepAlive, delay);
                } else {
                    console.error("❌ [KeepAlive] Max reconnection attempts reached");
                }
            });

            keepAlivePort.onMessage.addListener((message) => {
                if (message.type === 'keep-alive') {
                    console.log("💓 [KeepAlive] Heartbeat received");
                }
            });

            reconnectAttempts = 0;
            console.log("✅ [KeepAlive] Port connected successfully");


        } catch (e) {
            const isInvalidated = e.message.includes('context invalidated');


            if (isInvalidated) {
                console.log("ℹ️ [KeepAlive] Extension context invalidated. Please refresh the page to restore connection.");
                return; // Stop retrying
            }

            console.error("❌ [KeepAlive] Connection failed:", e.message);

            // Retry with delay
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                setTimeout(connectKeepAlive, 5000);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // HEARTBEAT
    // ═══════════════════════════════════════════════════════════════════════════

    function sendHeartbeat() {
        if (keepAlivePort) {
            try {
                keepAlivePort.postMessage({ type: 'ping', timestamp: Date.now() });
            } catch (e) {
                console.warn("⚠️ [KeepAlive] Heartbeat failed:", e.message);
            }
        }
    }

    // Send heartbeat every 25 seconds
    setInterval(sendHeartbeat, 25000);

    // ═══════════════════════════════════════════════════════════════════════════
    // BACKUP MECHANISM
    // ═══════════════════════════════════════════════════════════════════════════

    const BACKUP_KEYS = {
        PENDING_VIDEO: 'gemini_backup_video',
        PENDING_UPLOAD: 'gemini_backup_upload',
        PENDING_SCHEDULE: 'gemini_backup_schedule',
        LAST_STATE: 'gemini_last_state'
    };

    const BACKUP_TTL = 30 * 60 * 1000; // 30 minutes

    /**
     * Backup pending data to localStorage
     */
    function geminiBackup(key, data) {
        try {
            const payload = {
                data: data,
                timestamp: Date.now()
            };
            localStorage.setItem(key, JSON.stringify(payload));
            console.log(`💾 [KeepAlive] Backed up: ${key}`);
        } catch (e) {
            console.error(`❌ [KeepAlive] Backup failed: ${key}`, e);
        }
    }

    /**
     * Recover pending data from localStorage
     */
    function geminiRecover(key) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;

            const payload = JSON.parse(raw);
            const age = Date.now() - payload.timestamp;

            if (age > BACKUP_TTL) {
                console.log(`⏰ [KeepAlive] Backup expired: ${key} (${Math.round(age / 60000)} mins old)`);
                localStorage.removeItem(key);
                return null;
            }

            console.log(`🔄 [KeepAlive] Recovered: ${key} (${Math.round(age / 60000)} mins old)`);
            return payload.data;
        } catch (e) {
            console.error(`❌ [KeepAlive] Recovery failed: ${key}`, e);
            return null;
        }
    }

    /**
     * Clear backup after successful completion
     */
    function geminiClearBackup(key) {
        localStorage.removeItem(key);
        console.log(`🧹 [KeepAlive] Cleared backup: ${key}`);
    }

    /**
     * Exponential backoff retry
     */
    async function geminiRetry(fn, maxAttempts = 3, baseDelay = 1000) {
        for (let i = 0; i < maxAttempts; i++) {
            try {
                return await fn();
            } catch (e) {
                if (i === maxAttempts - 1) throw e;
                const delay = baseDelay * Math.pow(2, i);
                console.log(`🔄 [KeepAlive] Retry ${i + 1}/${maxAttempts} in ${delay}ms`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════════════════

    // Connect immediately
    connectKeepAlive();

    // Export for global access
    window.geminiBackup = geminiBackup;
    window.geminiRecover = geminiRecover;
    window.geminiClearBackup = geminiClearBackup;
    window.geminiRetry = geminiRetry;

    window.KeepAlive = {
        connect: connectKeepAlive,
        sendHeartbeat,
        BACKUP_KEYS
    };

    console.log("✅ [KeepAlive] Module initialized!");

})();
