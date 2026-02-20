/**
 * Scheduled Comment Monitor Module
 * 
 * Monitors scheduled videos and automatically posts comments when they become public.
 * Integrates with DFL system for periodic checks.
 * 
 * @module platforms/youtube/scheduledCommentMonitor
 * @version 1.0.0
 * @date 2025-12-26
 */

/**
 * Scheduled Comment Monitor Class
 */
class ScheduledCommentMonitor {
    constructor() {
        this.pendingScheduledComments = new Map(); // videoId -> { url, text, pin, scheduledTime }
        this.checkInterval = null;
        this.CHECK_INTERVAL_MS = 2 * 60 * 1000; // 🔧 V7.1: Check every 2 minutes (was 5)
        this.isRunning = false;
        console.log('📅 [ScheduledMonitor] Instance created, check interval: 2 minutes');
    }


    /**
     * Stores a scheduled comment to be posted when video becomes public.
     * 
     * @param {string} videoUrl - URL of the scheduled video
     * @param {string} text - Comment text
     * @param {boolean} pin - Whether to pin the comment
     * @param {string} scheduledTime - ISO string of scheduled publish time
     */
    storeScheduledComment(videoUrl, text, pin = true, scheduledTime) {
        const videoId = this.extractVideoId(videoUrl);
        if (!videoId) {
            console.error('❌ [ScheduledMonitor] Invalid video URL:', videoUrl);
            return null;
        }

        const data = {
            url: videoUrl,
            text,
            pin,
            scheduledTime: scheduledTime || null,
            scheduledTimestamp: scheduledTime ? new Date(scheduledTime).getTime() : null,
            createdAt: Date.now(),
            attempts: 0,
            maxAttempts: 10,
            lastCheck: null,
            status: 'pending' // pending, checking, posted, failed
        };

        this.pendingScheduledComments.set(videoId, data);
        this.saveToStorage();

        console.log(`📅 [ScheduledMonitor] Stored scheduled comment for video ${videoId}`);
        console.log(`   Scheduled time: ${scheduledTime || 'Unknown'}`);
        console.log(`   Comment: "${text.substring(0, 50)}..."`);

        // Start monitoring if not already running
        this.startMonitoring();

        return data;
    }

    /**
     * Extracts video ID from YouTube URL.
     */
    extractVideoId(url) {
        try {
            const urlObj = new URL(url);
            if (urlObj.hostname.includes('youtube.com')) {
                return urlObj.searchParams.get('v');
            }
            if (urlObj.hostname.includes('youtu.be')) {
                return urlObj.pathname.slice(1);
            }
        } catch (e) {
            const match = url.match(/(?:v=|youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
            return match ? match[1] : null;
        }
        return null;
    }

    /**
     * Starts the monitoring interval.
     */
    startMonitoring() {
        if (this.isRunning) {
            console.log('📅 [ScheduledMonitor] Already running');
            return;
        }

        if (this.pendingScheduledComments.size === 0) {
            console.log('📅 [ScheduledMonitor] No scheduled comments to monitor');
            return;
        }

        this.isRunning = true;
        console.log(`📅 [ScheduledMonitor] Starting monitoring (${this.pendingScheduledComments.size} pending)`);

        // Check immediately
        this.checkAllScheduledVideos();

        // Set up interval
        this.checkInterval = setInterval(() => {
            this.checkAllScheduledVideos();
        }, this.CHECK_INTERVAL_MS);
    }

    /**
     * Stops the monitoring interval.
     */
    stopMonitoring() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        this.isRunning = false;
        console.log('📅 [ScheduledMonitor] Stopped monitoring');
    }

    /**
     * Checks all scheduled videos for public status.
     */
    async checkAllScheduledVideos() {
        const now = Date.now();
        console.log(`📅 [ScheduledMonitor] Checking ${this.pendingScheduledComments.size} scheduled videos...`);

        for (const [videoId, data] of this.pendingScheduledComments) {
            // Skip if scheduled time hasn't passed yet
            if (data.scheduledTimestamp && data.scheduledTimestamp > now) {
                const remainingMs = data.scheduledTimestamp - now;
                const remainingMins = Math.round(remainingMs / 60000);
                console.log(`   ⏰ Video ${videoId}: ${remainingMins} minutes until scheduled time`);
                continue;
            }

            // Skip if recently checked (within 1 minute)
            if (data.lastCheck && now - data.lastCheck < 60000) {
                continue;
            }

            // Check if video is now public
            const isPublic = await this.checkVideoIsPublic(videoId);
            data.lastCheck = now;
            data.attempts++;

            if (isPublic) {
                console.log(`✅ [ScheduledMonitor] Video ${videoId} is now PUBLIC!`);
                await this.triggerCommentPost(videoId, data);
            } else if (data.attempts >= data.maxAttempts) {
                console.log(`❌ [ScheduledMonitor] Video ${videoId} max attempts reached, removing`);
                data.status = 'failed';
                this.pendingScheduledComments.delete(videoId);
            } else {
                console.log(`   ⏳ Video ${videoId}: Still not public (attempt ${data.attempts}/${data.maxAttempts})`);
            }
        }

        this.saveToStorage();

        // Stop monitoring if no more pending
        if (this.pendingScheduledComments.size === 0) {
            this.stopMonitoring();
        }
    }

    /**
     * Checks if a video is publicly available.
     * Uses YouTube oEmbed API which only returns data for public videos.
     * 
     * @param {string} videoId - YouTube video ID
     * @returns {Promise<boolean>}
     */
    async checkVideoIsPublic(videoId) {
        console.log(`📅 [ScheduledMonitor] Checking if video ${videoId} is public...`);

        // Method 1: Use background.js to fetch (avoids CORS)
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            try {
                return await new Promise((resolve) => {
                    chrome.runtime.sendMessage({
                        action: 'fetchUrl',
                        url: `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.warn(`⚠️ [ScheduledMonitor] Background fetch failed:`, chrome.runtime.lastError.message);
                            resolve(false);
                            return;
                        }

                        if (response && response.success && response.data) {
                            try {
                                const data = JSON.parse(response.data);
                                if (data.title) {
                                    console.log(`✅ [ScheduledMonitor] Video ${videoId} is PUBLIC (title: ${data.title.substring(0, 30)}...)`);
                                    resolve(true);
                                    return;
                                }
                            } catch (e) {
                                // JSON parse error
                            }
                        }

                        console.log(`⏳ [ScheduledMonitor] Video ${videoId} not yet public (oEmbed check)`);
                        resolve(false);
                    });

                    // Timeout after 10 seconds
                    setTimeout(() => resolve(false), 10000);
                });
            } catch (e) {
                console.warn(`⚠️ [ScheduledMonitor] Background oEmbed check error:`, e.message);
            }
        }

        // Method 2: Direct fetch (may fail due to CORS on some pages)
        try {
            const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;

            const response = await fetch(oembedUrl, {
                method: 'GET',
                mode: 'cors'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.title) {
                    console.log(`✅ [ScheduledMonitor] Video ${videoId} is PUBLIC via direct fetch`);
                    return true;
                }
            }

            return false;
        } catch (e) {
            console.warn(`⚠️ [ScheduledMonitor] Direct oEmbed check failed for ${videoId}:`, e.message);

            // Method 3: Fallback - Try to load video thumbnail
            return await this.checkVideoThumbnail(videoId);
        }
    }


    /**
     * Alternative check using video thumbnail.
     */
    async checkVideoThumbnail(videoId) {
        return new Promise((resolve) => {
            const img = new Image();

            // Use maxresdefault thumbnail - only exists for public videos
            img.src = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;

            img.onload = () => {
                // If image loads and is not the default placeholder (120x90)
                if (img.width > 120) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            };

            img.onerror = () => {
                resolve(false);
            };

            // Timeout after 5 seconds
            setTimeout(() => resolve(false), 5000);
        });
    }

    /**
     * Triggers comment posting for a video that is now public.
     * 🔧 V2.1: Fixed duplicate tab issue - now uses only ONE method
     */
    async triggerCommentPost(videoId, data) {
        console.log(`🔥 [ScheduledMonitor] Triggering comment post for video ${videoId}`);

        // 🛡️ V2.1: Prevent duplicate triggers
        if (data.status === 'posting' || data.status === 'posted') {
            console.log(`⚠️ [ScheduledMonitor] Video ${videoId} already in ${data.status} status, skipping`);
            return;
        }

        data.status = 'posting';
        this.saveToStorage();

        // ONLY use chrome.runtime.sendMessage to open tab via background.js
        // This prevents duplicate tabs from multiple trigger methods
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            try {
                chrome.runtime.sendMessage({
                    action: 'triggerAutoComment',
                    url: data.url,
                    text: data.text,
                    pin: data.pin,
                    videoId: videoId // 🆕 Include videoId for tracking
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('❌ [ScheduledMonitor] Failed to trigger auto comment:', chrome.runtime.lastError.message);
                        data.status = 'failed';
                        this.saveToStorage();
                        return;
                    }
                    console.log('✅ [ScheduledMonitor] Auto-comment triggered via background');
                    data.status = 'posted';
                    this.saveToStorage();

                    // 🆕 V2.8: Notify React that video is now PUBLIC (status: scheduled → published)
                    chrome.runtime.sendMessage({
                        action: 'relayVideoNowPublic',
                        videoId: videoId,
                        videoUrl: data.url
                    });

                    // 🔥 V2.2: Auto-trigger Ignite 2.0 sockpuppet comments after first comment
                    this.autoTriggerIgnite(videoId, data.url);
                });
            } catch (e) {
                console.error('❌ [ScheduledMonitor] Extension communication error:', e);
                data.status = 'failed';
            }
        } else {
            console.error('❌ [ScheduledMonitor] Chrome runtime not available');
            data.status = 'failed';
        }

        // Remove from pending scheduled comments (already triggered)
        this.pendingScheduledComments.delete(videoId);
        this.saveToStorage();

        console.log(`✅ [ScheduledMonitor] Comment post triggered for ${videoId}`);
    }

    /**
     * 🔥 V2.2: Auto-trigger Ignite 2.0 after first comment is posted
     * Generates sockpuppet comments automatically based on DFL config
     */
    async autoTriggerIgnite(videoId, videoUrl) {
        console.log(`🔥 [ScheduledMonitor] Auto-Ignite check for video ${videoId}...`);

        // Check if auto-Ignite is enabled
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            // 🆕 V3.0: Get video-specific sockpuppet comments from scheduled comment data
            chrome.storage.local.get(['ignite_auto_enabled', 'ignite_default_comments', 'gemini_scheduled_comments'], (result) => {
                const autoEnabled = result.ignite_auto_enabled !== false; // Default ON

                // 🆕 V3.0: Try to get video-specific comments first
                const scheduledComments = result.gemini_scheduled_comments || {};
                const videoData = scheduledComments[videoId];
                const videoSpecificComments = videoData?.sockpuppetComments;

                // Use video-specific comments if available, else fallback to defaults
                const comments = (videoSpecificComments && videoSpecificComments.length > 0)
                    ? videoSpecificComments
                    : (result.ignite_default_comments || [
                        '👀 Did anyone else notice this?',
                        'This is exactly what I was thinking!',
                        'No way, I need to see this again 🔥',
                        '🤯 Mind blown'
                    ]);

                if (!autoEnabled) {
                    console.log('⏭️ [ScheduledMonitor] Auto-Ignite disabled, skipping');
                    return;
                }

                if (comments.length === 0) {
                    console.log('⚠️ [ScheduledMonitor] No sockpuppet comments available, skipping Ignite');
                    return;
                }

                console.log(`🔥 [ScheduledMonitor] Auto-Ignite ENABLED!`);
                console.log(`   📦 Source: ${videoSpecificComments?.length ? 'Video-specific comments' : 'Default comments'}`);
                console.log(`   💬 Triggering ${comments.length} sockpuppet comments...`);

                // Get accounts from config
                const accounts = typeof EXT_CONSTANTS !== 'undefined' && EXT_CONSTANTS.IGNITE_CONFIG
                    ? EXT_CONSTANTS.IGNITE_CONFIG.SOCKPUPPET_ACCOUNTS.slice(1) // Skip main account
                    : ['CCTV Debunker', 'c hao', 'chi rimmon'];

                // Trigger Ignite via background.js
                chrome.runtime.sendMessage({
                    action: 'IGNITE_SOCKPUPPET',
                    videoUrl: videoUrl,
                    comments: comments,
                    accounts: accounts,
                    autoTriggered: true // Flag for logging
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('❌ [ScheduledMonitor] Auto-Ignite failed:', chrome.runtime.lastError.message);
                    } else if (response?.success) {
                        console.log(`🔥 [ScheduledMonitor] Auto-Ignite triggered: ${response.queueSize} comments queued`);
                    }
                });
            });
        }
    }

    /**
     * Gets all pending scheduled comments.
     */
    getPendingComments() {
        return Array.from(this.pendingScheduledComments.entries()).map(([videoId, data]) => ({
            videoId,
            ...data
        }));
    }

    /**
     * Removes a scheduled comment.
     */
    removeScheduledComment(videoId) {
        if (this.pendingScheduledComments.has(videoId)) {
            this.pendingScheduledComments.delete(videoId);
            this.saveToStorage();
            console.log(`📅 [ScheduledMonitor] Removed scheduled comment for ${videoId}`);
            return true;
        }
        return false;
    }

    /**
     * Saves to chrome.storage.local (cross-domain).
     */
    saveToStorage() {
        try {
            const data = {};
            for (const [videoId, commentData] of this.pendingScheduledComments) {
                data[videoId] = commentData;
            }

            // Use chrome.storage.local for cross-domain persistence
            // 🔧 V8.0: Check if extension context is still valid
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && chrome.runtime?.id) {
                chrome.storage.local.set({ 'gemini_scheduled_comments': data }, () => {
                    if (chrome.runtime.lastError) {
                        console.warn('⚠️ [ScheduledMonitor] Failed to save to chrome.storage:', chrome.runtime.lastError.message);
                    } else {
                        console.log(`📅 [ScheduledMonitor] Saved ${Object.keys(data).length} scheduled comments to chrome.storage`);
                    }
                });
            } else {
                // Fallback to localStorage
                localStorage.setItem('gemini_scheduled_comments', JSON.stringify(data));
            }
        } catch (e) {
            console.warn('⚠️ [ScheduledMonitor] Failed to save to storage:', e.message);
        }
    }

    /**
     * Loads from chrome.storage.local (cross-domain).
     */
    loadFromStorage() {
        try {
            // Use chrome.storage.local for cross-domain persistence
            // 🔧 V8.0: Check if extension context is still valid
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local && chrome.runtime?.id) {
                chrome.storage.local.get(['gemini_scheduled_comments'], (result) => {
                    if (chrome.runtime.lastError) {
                        console.warn('⚠️ [ScheduledMonitor] Failed to load from chrome.storage:', chrome.runtime.lastError.message);
                        return;
                    }

                    const data = result.gemini_scheduled_comments || {};
                    for (const [videoId, commentData] of Object.entries(data)) {
                        // Only load if less than 7 days old
                        if (Date.now() - commentData.createdAt < 7 * 24 * 60 * 60 * 1000) {
                            this.pendingScheduledComments.set(videoId, commentData);
                        }
                    }
                    console.log(`📅 [ScheduledMonitor] Loaded ${this.pendingScheduledComments.size} scheduled comments from chrome.storage`);

                    // Auto-start if there are pending comments
                    if (this.pendingScheduledComments.size > 0) {
                        this.startMonitoring();
                    }
                });
            } else {
                // Fallback to localStorage
                const raw = localStorage.getItem('gemini_scheduled_comments');
                if (raw) {
                    const data = JSON.parse(raw);
                    for (const [videoId, commentData] of Object.entries(data)) {
                        if (Date.now() - commentData.createdAt < 7 * 24 * 60 * 60 * 1000) {
                            this.pendingScheduledComments.set(videoId, commentData);
                        }
                    }
                    console.log(`📅 [ScheduledMonitor] Loaded ${this.pendingScheduledComments.size} scheduled comments from localStorage`);

                    if (this.pendingScheduledComments.size > 0) {
                        this.startMonitoring();
                    }
                }
            }
        } catch (e) {
            console.warn('⚠️ [ScheduledMonitor] Failed to load from storage:', e.message);
        }
    }

    /**
     * Manual trigger to check all videos now.
     */
    async checkNow() {
        console.log('📅 [ScheduledMonitor] Manual check triggered');
        await this.checkAllScheduledVideos();
    }

    /**
     * Gets status summary.
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            pendingCount: this.pendingScheduledComments.size,
            checkIntervalMs: this.CHECK_INTERVAL_MS,
            comments: this.getPendingComments()
        };
    }
}

// Create singleton instance
const scheduledCommentMonitor = new ScheduledCommentMonitor();

// Load persisted scheduled comments
scheduledCommentMonitor.loadFromStorage();

// Export
window.ScheduledCommentMonitor = scheduledCommentMonitor;

console.log('📦 [Module] platforms/youtube/scheduledCommentMonitor.js loaded');
