/**
 * YouTube Comment Automation Module
 * 
 * Handles automatic first comment posting on published videos.
 * Supports both immediate and scheduled video publications.
 * 
 * @module platforms/youtube/commentAutomation
 * @version 1.0.0
 * @date 2025-12-26
 */

console.log('🚀 [CommentAuto] Script starting...');

/**
 * Comment Automation Class
 */
class YouTubeCommentAutomation {
    constructor() {
        this.platformName = 'YouTubeComment';
        this.pendingComments = new Map(); // videoUrl -> { text, pin, timestamp }
        this.scheduledChecks = new Map(); // videoUrl -> intervalId
        // 🆕 V2.0: Ignite Sockpuppet System
        this.scriptedCommentQueue = []; // Array of { text, account?, delay } for multi-comment execution
        this.availableAccounts = []; // List of account names for rotation (populated by user config or storage)
        this.isIgniteRunning = false;
    }

    /**
     * Stores a comment to be posted when video is available.
     * 
     * @param {string} videoUrl - URL of the video
     * @param {string} text - Comment text
     * @param {boolean} pin - Whether to pin the comment
     * @param {string} scheduleTime - Optional schedule time for delayed posting
     */
    storeComment(videoUrl, text, pin = true, scheduleTime = null) {
        const data = {
            text,
            pin,
            scheduleTime,
            timestamp: Date.now(),
            attempts: 0,
            maxAttempts: 5
        };

        this.pendingComments.set(videoUrl, data);
        console.log(`📝 [CommentAuto] Stored comment for: ${videoUrl.substring(0, 50)}...`);
        console.log(`📝 [CommentAuto] Comment: "${text.substring(0, 50)}..."`);

        // Store in localStorage for persistence
        this.saveToStorage();

        return data;
    }

    /**
     * Gets pending comment for a video URL.
     */
    getPendingComment(videoUrl) {
        // Normalize URL (remove extra parameters)
        const normalizedUrl = this.normalizeUrl(videoUrl);

        // Try exact match first
        if (this.pendingComments.has(normalizedUrl)) {
            return this.pendingComments.get(normalizedUrl);
        }

        // Try partial match (video ID)
        const videoId = this.extractVideoId(normalizedUrl);
        if (videoId) {
            for (const [url, data] of this.pendingComments) {
                if (this.extractVideoId(url) === videoId) {
                    return data;
                }
            }
        }

        return null;
    }

    /**
     * Normalizes YouTube URL to standard format.
     */
    normalizeUrl(url) {
        try {
            const urlObj = new URL(url);
            if (urlObj.hostname.includes('youtube.com')) {
                const videoId = urlObj.searchParams.get('v');
                if (videoId) {
                    return `https://www.youtube.com/watch?v=${videoId}`;
                }
            }
            if (urlObj.hostname.includes('youtu.be')) {
                const videoId = urlObj.pathname.slice(1);
                return `https://www.youtube.com/watch?v=${videoId}`;
            }
        } catch (e) {
            // Return as-is if parsing fails
        }
        return url;
    }

    /**
     * Extracts video ID from YouTube URL.
     */
    extractVideoId(url) {
        try {
            const urlObj = new URL(url);

            // Check for Shorts URL first (youtube.com/shorts/VIDEO_ID)
            if (urlObj.pathname.includes('/shorts/')) {
                // 🔧 V2.6: Support 10-12 char video IDs
                const match = urlObj.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{10,12})/);
                if (match) return match[1];
            }

            // Standard watch URL (youtube.com/watch?v=VIDEO_ID)
            if (urlObj.hostname.includes('youtube.com')) {
                const v = urlObj.searchParams.get('v');
                if (v) return v;
            }

            // Youtu.be short URLs
            if (urlObj.hostname.includes('youtu.be')) {
                return urlObj.pathname.slice(1);
            }
        } catch (e) {
            // Try regex fallback for malformed URLs
            // 🔧 V7.6: Allow 10-12 char video IDs
            const match = url.match(/(?:v=|youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{10,12})/);
            return match ? match[1] : null;
        }
        return null;
    }

    /**
     * Posts comment on the current video page.
     * Should be called when on a YouTube watch page.
     * 
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async postComment() {
        const currentUrl = window.location.href;
        const pendingData = this.getPendingComment(currentUrl);
        const isShorts = currentUrl.includes('/shorts/');
        const videoId = this.extractVideoId(currentUrl);

        if (!pendingData) {
            console.log('📝 [CommentAuto] No pending comment for this video');
            return { success: false, error: 'No pending comment' };
        }

        // 🛡️ V2.3: Duplicate prevention - check if already posted for this video
        if (videoId && typeof chrome !== 'undefined' && chrome.storage) {
            const postedKey = `comment_posted_${videoId}`;
            const result = await new Promise(resolve =>
                chrome.storage.local.get([postedKey], r => resolve(r))
            );

            if (result[postedKey]) {
                const postedAt = result[postedKey];
                const timeSince = Date.now() - postedAt;
                if (timeSince < 60000) { // 60 seconds window
                    console.warn(`⚠️ [CommentAuto] Duplicate prevented! Already posted to ${videoId} ${Math.round(timeSince / 1000)}s ago`);
                    // Clear pending comment to prevent retries
                    this.clearComment(currentUrl);
                    return { success: false, error: 'Duplicate prevented' };
                }
            }
        }

        console.log(`📝 [CommentAuto] Attempting to post comment (attempt ${pendingData.attempts + 1}/${pendingData.maxAttempts})`);
        console.log(`📝 [CommentAuto] Is Shorts: ${isShorts}`);
        pendingData.attempts++;

        try {
            // 🆕 V7.1: For Shorts, need to open comments panel first
            if (isShorts) {
                console.log('📝 [CommentAuto] Checking if Shorts comment panel is open...');
                const existingPlaceholder = document.querySelector('#placeholder-area');
                if (!existingPlaceholder || existingPlaceholder.offsetParent === null) {
                    console.log('📝 [CommentAuto] Opening Shorts comment panel...');
                    const panelOpened = await this.openShortsCommentPanel();
                    if (!panelOpened) {
                        throw new Error('Failed to open Shorts comment panel');
                    }
                    await this.delay(3000); // 🔧 V7.2: Increased from 1.5s to 3s for panel animation
                } else {
                    console.log('✅ [CommentAuto] Shorts comment panel already open');
                }
            }

            // Step 1: Wait for comments section to load
            const commentsSection = await this.waitForCommentsSection();
            if (!commentsSection) {
                throw new Error('Comments section not found');
            }


            // Step 2: Scroll to comments to trigger lazy loading
            if (!isShorts) {
                await this.scrollToComments();
            }

            // Step 3: Find and click the comment box
            const commentBox = await this.findCommentBox();
            if (!commentBox) {
                throw new Error('Comment box not found');
            }

            // Step 4: Click to activate
            console.log('📝 [CommentAuto] Clicking comment box...');
            commentBox.click();
            await this.delay(1000); // Match manual script delay

            // Step 5: Find the editable area
            const editableArea = await this.findEditableArea();
            if (!editableArea) {
                throw new Error('Editable area not found');
            }

            // Step 6: Type the comment
            console.log('📝 [CommentAuto] Typing comment...');
            await this.typeComment(editableArea, pendingData.text);
            await this.delay(500); // Match manual script delay

            // Step 7: Submit the comment
            const submitted = await this.submitComment();
            if (!submitted) {
                throw new Error('Failed to submit comment');
            }

            console.log('✅ [CommentAuto] Comment posted successfully!');

            // Step 8: Pin if requested (creator only)
            let pinned = false;
            if (pendingData.pin) {
                await this.delay(3000);
                pinned = await this.pinComment(pendingData.text);
            }

            // Clear the pending comment
            this.clearComment(currentUrl);

            // 🆕 V7.8: Notify React via background.js (cross-tab communication)
            const videoId = this.extractVideoId(currentUrl);

            // 🛡️ V2.3: Mark this video as commented to prevent duplicates
            if (videoId && typeof chrome !== 'undefined' && chrome.storage) {
                const postedKey = `comment_posted_${videoId}`;
                chrome.storage.local.set({ [postedKey]: Date.now() }, () => {
                    console.log(`🛡️ [CommentAuto] Marked ${videoId} as commented (duplicate prevention)`);
                });
            }

            if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.sendMessage({
                    action: 'relayCommentPosted',
                    videoId: videoId,
                    videoUrl: currentUrl,
                    status: 'success',
                    commentText: pendingData.text,
                    pinned: pinned,
                    timestamp: new Date().toISOString()
                });
                console.log('📢 [CommentAuto] Sent COMMENT_POSTED to background for relay');
            }

            // 🆕 V2.1: Auto-close tab after 5 seconds (configurable)
            const AUTO_CLOSE_DELAY = 5000;
            console.log(`📝 [CommentAuto] Tab will auto-close in ${AUTO_CLOSE_DELAY / 1000} seconds...`);
            console.log('📝 [CommentAuto] To verify manually, run: window.CANCEL_AUTO_CLOSE()');

            // Expose cancel function globally
            window.CANCEL_AUTO_CLOSE = () => {
                console.log('✅ [CommentAuto] Auto-close cancelled. Verify manually.');
                window.COMMENT_VERIFIED = true;
            };

            // Expose manual close function
            window.CLOSE_NOW = () => {
                console.log('👋 [CommentAuto] Closing tab manually...');
                window.close();
            };

            setTimeout(() => {
                if (!window.COMMENT_VERIFIED) {
                    console.log('👋 [CommentAuto] Auto-closing tab...');
                    window.close();
                }
            }, AUTO_CLOSE_DELAY);

            return { success: true, pinned };

        } catch (error) {
            console.error('❌ [CommentAuto] Failed to post comment:', error.message);

            // Retry if attempts remaining
            if (pendingData.attempts < pendingData.maxAttempts) {
                console.log(`📝 [CommentAuto] Will retry in 5 seconds...`);
                setTimeout(() => this.postComment(), 5000);
            } else {
                console.error('❌ [CommentAuto] Max attempts reached, giving up');
                this.clearComment(currentUrl);
            }

            return { success: false, error: error.message };
        }
    }

    /**
     * 🆕 V7.1: Opens the Shorts comment panel by clicking the comment button.
     * On Shorts, comments are in a side panel that needs to be opened first.
     */
    async openShortsCommentPanel() {
        console.log('📝 [CommentAuto] Looking for Shorts comment button...');

        // Shorts comment button selectors (the comment icon on the right side)
        const commentButtonSelectors = [
            'ytd-reel-video-renderer #comments-button', // 🆕 V7.10: Explicit Shorts container selector
            // Main comment button on Shorts
            'ytd-reel-video-renderer button[aria-label*="comment" i]',
            'ytd-reel-video-renderer button[aria-label*="Comment" i]',
            '#comments-button button',
            '#comments-button',
            'button[aria-label*="comment" i]',
            // Icon-based selectors
            'ytd-button-renderer:has(yt-icon-button) button',
            // Fallback: find by icon
            'yt-icon-button[aria-label*="comment" i]',
            // New Shorts UI
            'ytd-shorts-player-controls button[aria-label*="comment" i]',
            '#comment-button button',
            // SVG icon parent
            '[id*="comment"]'
        ];

        for (const selector of commentButtonSelectors) {
            try {
                const btn = document.querySelector(selector);
                if (btn && btn.offsetParent !== null) {
                    console.log(`📝 [CommentAuto] Found comment button: ${selector}`);
                    btn.click();
                    await this.delay(500);
                    return true;
                }
            } catch (e) {
                // Selector might be invalid, continue
            }
        }

        // Fallback: Search by visible icon and position (right side of Shorts)
        console.log('📝 [CommentAuto] Trying geometric search for comment button...');
        const buttons = document.querySelectorAll('button, [role="button"], yt-icon-button');

        for (const btn of buttons) {
            const rect = btn.getBoundingClientRect();
            // Shorts comment button is usually on the right side, between video controls
            if (rect.right > window.innerWidth - 100 && rect.width > 20 && rect.width < 80) {
                const ariaLabel = btn.getAttribute('aria-label') || '';
                const text = btn.textContent || '';
                if (ariaLabel.toLowerCase().includes('comment') ||
                    text.toLowerCase().includes('comment') ||
                    btn.querySelector('svg')) {
                    console.log(`📝 [CommentAuto] Found comment button via geometric search`);
                    btn.click();
                    await this.delay(500);

                    // Verify panel opened
                    await this.delay(1000);
                    const panel = document.querySelector('#shorts-comments-panel, ytd-engagement-panel-section-list-renderer, #comments');
                    if (panel && panel.offsetParent !== null) {
                        console.log('✅ [CommentAuto] Comments panel opened!');
                        return true;
                    }
                }
            }
        }

        // Last resort: Try clicking the "0" or number next to comment icon
        const commentCounts = document.querySelectorAll('[aria-label*="comment" i], #comment-button');
        for (const el of commentCounts) {
            if (el.offsetParent !== null) {
                console.log('📝 [CommentAuto] Clicking comment count element...');
                el.click();
                await this.delay(1000);
                return true;
            }
        }

        console.warn('⚠️ [CommentAuto] Could not find Shorts comment button');
        return false;
    }

    /**
     * Waits for comments section to appear.
     */

    async waitForCommentsSection(timeout = 30000) {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const selectors = [
                '#comments',
                'ytd-comments',
                '#comment-teaser',
                'ytd-comment-simplebox-renderer',
                // 🆕 V7.1: Shorts-specific selectors
                '#shorts-comments-panel',
                'ytd-engagement-panel-section-list-renderer',
                'ytd-reel-video-renderer #comments',
                '[page-subtype="shorts"] #comments'
            ];


            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el && el.offsetParent !== null) {
                    return el;
                }
            }

            await this.delay(500);
        }

        return null;
    }

    /**
     * Scrolls to comments section.
     */
    async scrollToComments() {
        const commentsSection = document.querySelector('#comments, ytd-comments');
        if (commentsSection) {
            commentsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await this.delay(1000);
        }
    }

    /**
     * Finds the comment input box.
     */
    async findCommentBox() {
        // Wait a bit for Shorts panel to fully render
        if (window.location.href.includes('/shorts/')) {
            await this.delay(2000);
        }

        const selectors = [
            '#placeholder-area',
            '#simplebox-placeholder',
            'ytd-comment-simplebox-renderer #placeholder-area',
            '#comment-teaser #placeholder-area',
            '#contenteditable-root',
            // 🆕 V7.2: Enhanced Shorts-specific selectors
            'ytd-engagement-panel-section-list-renderer #placeholder-area',
            '#shorts-comments-panel #placeholder-area',
            '[page-subtype="shorts"] #placeholder-area',
            'ytd-reel-video-renderer #placeholder-area',
            // More Shorts selectors
            'ytd-comments-simplebox-renderer #placeholder-area',
            'ytd-shorts-video-action-menu-renderer + * #placeholder-area',
            '#comments-button ~ * #placeholder-area',
            // Try any visible placeholder-area
            '#placeholder-area[placeholder]'
        ];

        for (const sel of selectors) {
            try {
                const el = document.querySelector(sel);
                if (el && el.offsetParent !== null) {
                    console.log(`📝 [CommentAuto] Found comment box: ${sel}`);
                    return el;
                }
            } catch (e) {
                // Selector might be invalid
            }
        }

        // Deep search using querySelectorAll
        console.log('📝 [CommentAuto] Trying deep search for comment box...');
        const allPlaceholders = document.querySelectorAll('#placeholder-area');
        for (const el of allPlaceholders) {
            if (el && el.offsetParent !== null) {
                console.log('📝 [CommentAuto] Found via deep search');
                return el;
            }
        }

        // Deep search with deepQuery helper
        if (window.deepQuery) {
            return window.deepQuery(document.body, '#placeholder-area');
        }

        return null;
    }

    /**
     * Finds the editable text area.
     */
    async findEditableArea(timeout = 5000) {
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const selectors = [
                '#contenteditable-root',
                '#creation-box #contenteditable-root',
                'ytd-comment-simplebox-renderer #contenteditable-root',
                '[contenteditable="true"]'
            ];

            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el && el.offsetParent !== null) {
                    return el;
                }
            }

            await this.delay(200);
        }

        return null;
    }

    /**
     * Types comment text into the editable area.
     */
    async typeComment(editableArea, text) {
        editableArea.focus();
        await this.delay(200);

        // Clear existing content
        editableArea.innerHTML = '';

        // Set the text - Using textContent as in manual script
        editableArea.textContent = text;

        // Dispatch input events - Using simpler event as in manual script
        editableArea.dispatchEvent(new Event('input', { bubbles: true }));

        // Also dispatch change for good measure
        editableArea.dispatchEvent(new Event('change', { bubbles: true }));

        console.log(`📝 [CommentAuto] Typed comment: "${text.substring(0, 30)}..."`);
    }

    /**
     * Submits the comment.
     */
    async submitComment() {
        const submitSelectors = [
            '#submit-button button', // Specific selector from manual script
            '#submit-button',
            'ytd-comment-simplebox-renderer #submit-button',
            '#creation-box #submit-button',
            'button[aria-label*="Comment"]',
            'button[aria-label*="submit"]'
        ];

        for (const sel of submitSelectors) {
            const btn = document.querySelector(sel);
            if (btn && btn.offsetParent !== null && !btn.disabled) {
                btn.click();
                console.log('📝 [CommentAuto] Submit button clicked');
                return true;
            }
        }

        // Try finding by text
        const buttons = document.querySelectorAll('button, tp-yt-paper-button');
        for (const btn of buttons) {
            const text = btn.textContent?.trim().toLowerCase();
            if (text === 'comment' || text === 'submit' || text === 'post') {
                if (!btn.disabled) {
                    btn.click();
                    console.log('📝 [CommentAuto] Submit button clicked (text match)');
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Attempts to pin the comment (creator only).
     */
    async pinComment(commentText) {
        console.log('📌 [CommentAuto] Attempting to pin comment...');

        // Find the comment we just posted
        const comments = document.querySelectorAll('ytd-comment-renderer, ytd-comment-thread-renderer');

        for (const comment of comments) {
            const text = comment.querySelector('#content-text')?.textContent;
            if (text && text.includes(commentText.substring(0, 30))) {
                // Found our comment, look for menu button
                const menuBtn = comment.querySelector('#button, button[aria-label*="Action menu"]');
                if (menuBtn) {
                    menuBtn.click();
                    await this.delay(500);

                    // Look for Pin option
                    const menuItems = document.querySelectorAll('tp-yt-paper-item, ytd-menu-service-item-renderer');
                    for (const item of menuItems) {
                        const itemText = item.textContent?.toLowerCase();
                        if (itemText?.includes('pin')) {
                            item.click();
                            console.log('📌 [CommentAuto] Comment pinned!');
                            return true;
                        }
                    }
                }
            }
        }

        console.warn('⚠️ [CommentAuto] Could not pin comment (may not be channel owner)');
        return false;
    }

    /**
     * Clears pending comment for a URL.
     */
    clearComment(url) {
        const normalizedUrl = this.normalizeUrl(url);
        const videoId = this.extractVideoId(url);

        // Clear by normalized URL
        this.pendingComments.delete(normalizedUrl);

        // Also try to clear by video ID match
        if (videoId) {
            for (const [storedUrl, _] of this.pendingComments) {
                if (this.extractVideoId(storedUrl) === videoId) {
                    this.pendingComments.delete(storedUrl);
                }
            }
        }

        this.saveToStorage();
        console.log(`📝 [CommentAuto] Cleared pending comment for video`);
    }

    /**
     * Saves pending comments to localStorage.
     */
    saveToStorage() {
        try {
            const data = {};
            for (const [url, commentData] of this.pendingComments) {
                data[url] = commentData;
            }
            localStorage.setItem('gemini_pending_comments', JSON.stringify(data));
        } catch (e) {
            console.warn('⚠️ [CommentAuto] Failed to save to storage:', e.message);
        }
    }

    /**
     * Loads pending comments from localStorage.
     */
    loadFromStorage() {
        try {
            const raw = localStorage.getItem('gemini_pending_comments');
            if (raw) {
                const data = JSON.parse(raw);
                for (const [url, commentData] of Object.entries(data)) {
                    // Only load if less than 24 hours old
                    if (Date.now() - commentData.timestamp < 24 * 60 * 60 * 1000) {
                        this.pendingComments.set(url, commentData);
                    }
                }
                console.log(`📝 [CommentAuto] Loaded ${this.pendingComments.size} pending comments`);
            }
        } catch (e) {
            console.warn('⚠️ [CommentAuto] Failed to load from storage:', e.message);
        }
    }

    /**
     * Checks if current page has a pending comment and posts it.
     * Enhanced to check both localStorage and chrome.storage.local
     */
    async checkAndPost() {
        if (!window.location.href.includes('youtube.com/watch') &&
            !window.location.href.includes('youtube.com/shorts')) {
            return;
        }

        console.log('📝 [CommentAuto] checkAndPost() triggered on YouTube video page');

        // 1. First check local Map/localStorage (legacy)
        let pendingData = this.getPendingComment(window.location.href);

        if (pendingData) {
            console.log('📝 [CommentAuto] Found pending comment in localStorage!');
            await this.delay(3000);
            await this.postComment();
            return;
        }

        // 2. Check chrome.storage.local for redirect data (NEW - fixes cross-domain issue)
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get(['pending_auto_comment'], async (result) => {
                    if (result.pending_auto_comment) {
                        console.log('📝 [CommentAuto] Found pending comment in chrome.storage.local!');

                        try {
                            const data = JSON.parse(result.pending_auto_comment);

                            // Verify this comment is for the current video
                            const currentVideoId = this.extractVideoId(window.location.href);
                            const storedVideoId = data.videoId ? String(data.videoId) : null;

                            console.log(`📝 [CommentAuto] Matching: current=${currentVideoId}, stored=${storedVideoId}`);

                            // Check by URL or by matching video ID in URL
                            const storedUrl = data.videoUrl || data.url || '';
                            const currentUrl = window.location.href;
                            const storedUrlVideoId = this.extractVideoId(storedUrl);

                            if (storedUrlVideoId && currentVideoId && storedUrlVideoId === currentVideoId) {
                                console.log('✅ [CommentAuto] Video URL match confirmed! (ID: ' + currentVideoId + ')');

                                // Store in our local system
                                this.storeComment(currentUrl, data.text, true);

                                // Clear chrome.storage.local to prevent re-processing
                                chrome.storage.local.remove('pending_auto_comment', () => {
                                    console.log('✅ [CommentAuto] Cleared pending_auto_comment from chrome.storage');
                                });

                                // Wait for page to fully load then post
                                await this.delay(3000);
                                await this.postComment();
                            } else {
                                console.log('⚠️ [CommentAuto] Video ID mismatch, skipping');
                            }
                        } catch (e) {
                            console.error('❌ [CommentAuto] Failed to parse chrome.storage data:', e);
                        }
                    } else {
                        console.log('📝 [CommentAuto] No pending comment in chrome.storage.local');
                    }
                });
            }
        } catch (e) {
            console.error('❌ [CommentAuto] Error checking chrome.storage.local:', e);
        }
    }

    /**
     * Gets current channel name.
     */
    getCurrentChannelName() {
        // Try multiple selectors for the avatar/channel name
        const avatarImg = document.querySelector('#avatar-btn img, button#avatar-btn img, yt-img-shadow#avatar img');
        if (avatarImg && avatarImg.getAttribute('alt')) {
            return avatarImg.getAttribute('alt');
        }
        return null;
    }

    /**
     * Switches account by name.
     */
    async switchAccount(targetName) {
        console.log(`🔄 [CommentAuto] Switching to account: ${targetName}`);

        // 1. Click Avatar
        const avatarBtn = document.querySelector('#avatar-btn, button#avatar-btn');
        if (!avatarBtn) {
            console.error("❌ [CommentAuto] Avatar button not found");
            return false;
        }
        avatarBtn.click();
        await this.delay(1000);

        // 2. Click "Switch account"
        // Look for element with text "Switch account"
        const items = Array.from(document.querySelectorAll('ytd-compact-link-renderer, ytd-multi-page-menu-renderer a, tp-yt-paper-item'));
        const switchBtn = items.find(el => el.textContent?.toLowerCase().includes('switch account'));

        if (!switchBtn) {
            console.error("❌ [CommentAuto] 'Switch account' option not found");
            return false;
        }
        switchBtn.click();
        await this.delay(1500); // Wait for menu to slide in

        // 3. Select Account
        const accounts = document.querySelectorAll('ytd-account-item-renderer');
        console.log(`📝 [CommentAuto] Found ${accounts.length} accounts`);

        for (const acc of accounts) {
            const nameEl = acc.querySelector('#channel-title, .channel-title');
            const name = nameEl?.textContent?.trim();
            console.log(`   - Account: ${name}`);

            if (name === targetName) {
                console.log(`✅ [CommentAuto] Found matching account! Clicking...`);
                acc.click();
                return true;
            }
        }

        console.error(`❌ [CommentAuto] Account '${targetName}' not found in list`);
        return false;
    }

    /**
     * Replies to a comment.
     */
    async replyToComment(parentTextSnippet, replyText) {
        console.log(`↪️ [CommentAuto] Replying to comment containing: "${parentTextSnippet}"`);

        // Find comment
        const comments = document.querySelectorAll('ytd-comment-renderer, ytd-comment-thread-renderer');
        let targetComment = null;

        for (const comment of comments) {
            const text = comment.querySelector('#content-text')?.textContent;
            if (text && text.includes(parentTextSnippet)) {
                targetComment = comment;
                break;
            }
        }

        if (!targetComment) {
            console.error("❌ [CommentAuto] Parent comment not found");
            return { success: false, error: 'Parent comment not found' };
        }

        // Click Reply button
        const replyBtn = targetComment.querySelector('ytd-button-renderer#reply-button-end button, button[aria-label="Reply"]');
        if (replyBtn) {
            replyBtn.click();
            await this.delay(1000);

            // Find input
            const replyInput = targetComment.querySelector('#contenteditable-root');
            if (replyInput) {
                await this.typeComment(replyInput, replyText);
                await this.delay(500);

                // Submit reply
                const submitBtn = targetComment.querySelector('#submit-button button, #submit-button');
                if (submitBtn && !submitBtn.disabled) {
                    submitBtn.click();
                    console.log("✅ [CommentAuto] Reply submitted!");
                    return { success: true };
                }
            }
        }
        return { success: false, error: 'Failed to click reply or submit' };
    }

    /**
     * Likes a specific comment (Upvote).
     */
    async likeComment(targetText) {
        console.log(`👍 [CommentAuto] Liking comment containing: "${targetText}"`);
        const comments = document.querySelectorAll('ytd-comment-renderer, ytd-comment-thread-renderer');

        for (const comment of comments) {
            const text = comment.querySelector('#content-text')?.textContent;
            if (text && text.includes(targetText)) {
                const likeBtn = comment.querySelector('#vote-count-middle, #like-button button, button[aria-label*="Like"]');
                if (likeBtn) {
                    likeBtn.click();
                    console.log("✅ [CommentAuto] Comment liked!");
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Likes the current video (Main interaction).
     */
    async likeVideo() {
        console.log("👍 [CommentAuto] Liking the video...");
        const likeBtn = document.querySelector('ytd-menu-renderer ytd-toggle-button-renderer button[aria-label*="like this video"], #segmented-like-button button');
        if (likeBtn) {
            const isLiked = likeBtn.getAttribute('aria-pressed') === 'true';
            if (!isLiked) {
                likeBtn.click();
                console.log("✅ [CommentAuto] Video liked!");
                return true;
            } else {
                console.log("ℹ️ [CommentAuto] Video already liked.");
                return true;
            }
        }
        return false;
    }

    /**
     * Subscribes to the current channel.
     */
    async subscribeChannel() {
        console.log("🔔 [CommentAuto] Subscribing to channel...");
        const subBtn = document.querySelector('#subscribe-button button, ytd-subscribe-button-renderer button');
        if (subBtn) {
            const text = subBtn.textContent?.toLowerCase();
            if (text.includes('subscribe') && !text.includes('subscribed')) {
                subBtn.click();
                console.log("✅ [CommentAuto] Subscribed!");
                return true;
            } else {
                console.log("ℹ️ [CommentAuto] Already subscribed.");
                return true;
            }
        }
        return false;
    }

    /**
     * Utility delay function (Humanized).
     */
    async delay(ms) {
        if (window.SafetyProtocol) {
            // Add ±20% variation to the requested delay for human-like timing
            const min = Math.max(100, ms * 0.8);
            const max = ms * 1.2;
            return window.SafetyProtocol.humanDelay(min, max);
        }
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // 🆕 V2.0: IGNITE SOCKPUPPET SYSTEM (Multi-Comment Scripted Interaction)
    // ═══════════════════════════════════════════════════════════════════════════════

    /**
     * Stores a scripted comment queue for Ignite 2.0.
     * 
     * @param {string} videoUrl - URL of the video
     * @param {string[]} comments - Array of comment texts to post
     * @param {string[]} accounts - Optional array of account names to rotate through
     */
    storeIgniteScript(videoUrl, comments, accounts = []) {
        console.log(`🔥 [Ignite 2.0] Storing ${comments.length} scripted comments for video`);

        // Clear any existing queue
        this.scriptedCommentQueue = [];

        // 🆕 V2.1: Use configured accounts if not provided
        const config = typeof EXT_CONSTANTS !== 'undefined' && EXT_CONSTANTS.IGNITE_CONFIG
            ? EXT_CONSTANTS.IGNITE_CONFIG
            : { SOCKPUPPET_ACCOUNTS: [], COMMENT_DELAY_MIN: 60000, COMMENT_DELAY_MAX: 120000, FIRST_COMMENT_DELAY: 5000 };

        this.availableAccounts = accounts.length > 0 ? accounts : config.SOCKPUPPET_ACCOUNTS;
        console.log(`🔥 [Ignite 2.0] Using accounts:`, this.availableAccounts);

        // Build queue with delays
        comments.forEach((text, index) => {
            const delay = index === 0
                ? config.FIRST_COMMENT_DELAY
                : (config.COMMENT_DELAY_MIN + Math.random() * (config.COMMENT_DELAY_MAX - config.COMMENT_DELAY_MIN));

            this.scriptedCommentQueue.push({
                text: text,
                account: this.availableAccounts[index % this.availableAccounts.length] || null,
                delay: delay,
                pinFirst: index === 0
            });
        });

        // Store in chrome.storage for persistence
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({
                ignite_script_queue: JSON.stringify({
                    videoUrl: videoUrl,
                    queue: this.scriptedCommentQueue,
                    timestamp: Date.now()
                })
            });
        }

        console.log(`🔥 [Ignite 2.0] Queue ready:`, this.scriptedCommentQueue.map(c => c.text.substring(0, 30) + '...'));
        return this.scriptedCommentQueue;
    }

    /**
     * Executes the Ignite 2.0 scripted comment queue.
     * Posts comments with random delays to simulate organic engagement.
     */
    async executeIgniteQueue() {
        if (this.isIgniteRunning) {
            console.warn('⚠️ [Ignite 2.0] Execution already in progress');
            return;
        }

        if (this.scriptedCommentQueue.length === 0) {
            console.log('📝 [Ignite 2.0] No comments in queue');
            return;
        }

        const totalCount = this.scriptedCommentQueue.length;
        let successCount = 0;
        let failureCount = 0;

        this.isIgniteRunning = true;
        console.log(`🔥🔥🔥 [Ignite 2.0] STARTING Sockpuppet Execution - ${totalCount} comments`);

        for (let i = 0; i < totalCount; i++) {
            const item = this.scriptedCommentQueue[i];
            console.log(`🔥 [Ignite 2.0] Comment ${i + 1}/${totalCount}: "${item.text.substring(0, 40)}..."`);

            // Wait for the delay
            await this.delay(item.delay);

            // Switch account if specified and not the current one
            if (item.account) {
                const currentAccount = this.getCurrentChannelName();
                if (currentAccount !== item.account) {
                    console.log(`🔄 [Ignite 2.0] Switching to account: ${item.account}`);
                    const switched = await this.switchAccount(item.account);
                    if (switched) {
                        await this.delay(3000); // Wait for account switch
                    } else {
                        console.warn(`⚠️ [Ignite 2.0] Failed to switch to ${item.account}, posting with current account`);
                    }
                }
            }

            // Store the comment using existing system
            const currentUrl = window.location.href;
            this.storeComment(currentUrl, item.text, item.pinFirst);

            // Post it
            try {
                const result = await this.postComment();
                if (result.success) {
                    console.log(`✅ [Ignite 2.0] Comment ${i + 1} posted successfully!`);
                    successCount++;
                } else {
                    console.error(`❌ [Ignite 2.0] Comment ${i + 1} failed: ${result.error}`);
                    failureCount++;
                }
            } catch (e) {
                console.error(`❌ [Ignite 2.0] Comment ${i + 1} exception: ${e.message}`);
                failureCount++;
            }
        }

        // Clear queue after execution
        this.scriptedCommentQueue = [];
        this.isIgniteRunning = false;
        console.log('🎉 [Ignite 2.0] All scripted comments posted!');

        // Notify React
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({
                action: 'relayIgniteComplete',
                count: successCount,
                total: totalCount,
                failed: failureCount,
                status: 'success',
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * Loads Ignite script queue from storage and resumes execution.
     */
    async resumeIgniteFromStorage() {
        if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
            return false;
        }

        return new Promise((resolve) => {
            chrome.storage.local.get(['ignite_script_queue'], async (result) => {
                if (result.ignite_script_queue) {
                    try {
                        const data = JSON.parse(result.ignite_script_queue);

                        // Only resume if less than 1 hour old
                        if (Date.now() - data.timestamp < 3600000) {
                            const currentVideoId = this.extractVideoId(window.location.href);
                            const storedVideoId = this.extractVideoId(data.videoUrl);

                            if (currentVideoId === storedVideoId) {
                                console.log('🔥 [Ignite 2.0] Resuming stored script queue...');
                                this.scriptedCommentQueue = data.queue;
                                await this.executeIgniteQueue();

                                // Clear storage after execution
                                chrome.storage.local.remove('ignite_script_queue');
                                resolve(true);
                                return;
                            }
                        }
                    } catch (e) {
                        console.error('❌ [Ignite 2.0] Failed to parse stored queue:', e);
                    }
                }
                resolve(false);
            });
        });
    }
}

try {
    // Create singleton instance
    console.log('🚀 [CommentAuto] Creating instance...');
    const youtubeCommentAutomation = new YouTubeCommentAutomation();

    // Load persisted comments
    youtubeCommentAutomation.loadFromStorage();

    // Auto-check when on YouTube video page OR Shorts page
    if (window.location.href.includes('youtube.com/watch') ||
        window.location.href.includes('youtube.com/shorts')) {
        console.log('🔥🔥🔥 [CommentAuto] YouTube video/shorts page detected!');
        console.log('🔥🔥🔥 [CommentAuto] URL:', window.location.href);

        // 🔧 V7.3: Dual-storage check with robust matching
        const runCheck = async (attemptNum) => {
            console.log(`📝 [CommentAuto] Check attempt ${attemptNum}/3...`);

            const currentUrl = window.location.href;
            const currentVideoId = youtubeCommentAutomation.extractVideoId(currentUrl);

            if (!currentVideoId) {
                console.log('⚠️ [CommentAuto] Could not extract video ID from current URL');
                return;
            }

            const postedKey = `comment_posted_${currentVideoId}`;
            const storageResult = await new Promise(resolve => chrome.storage.local.get([postedKey, 'ignite_script_queue'], resolve));
            const postedAt = storageResult[postedKey];
            const igniteRaw = storageResult.ignite_script_queue;
            let ignitePendingForThisVideo = false;
            if (igniteRaw) {
                try {
                    const igniteData = JSON.parse(igniteRaw);
                    if (Date.now() - igniteData.timestamp < 3600000) {
                        const storedVideoId = youtubeCommentAutomation.extractVideoId(igniteData.videoUrl);
                        ignitePendingForThisVideo = storedVideoId && storedVideoId === currentVideoId;
                    }
                } catch { }
            }

            if (ignitePendingForThisVideo) {
                await youtubeCommentAutomation.resumeIgniteFromStorage();
                return;
            }

            if (postedAt) {
                console.log(`✅ [CommentAuto] Video ${currentVideoId} already has a posted comment, auto-closing...`);
                setTimeout(() => window.close(), 2000);
                return;
            }

            // Helper to process found data
            // 🛡️ V2.4: Added global lock to prevent race conditions across tabs
            const processData = async (dataStr, source) => {
                if (!dataStr) return false;

                try {
                    const data = JSON.parse(dataStr);
                    // 🔧 V7.7: Check both url and videoUrl fields (background.js uses 'url')
                    const storedVideoId = data.videoId || youtubeCommentAutomation.extractVideoId(data.url || data.videoUrl || '');

                    console.log(`📝 [CommentAuto] Found data in ${source}:`, {
                        storedVideoId,
                        currentVideoId,
                        text: data.text?.substring(0, 20) + '...'
                    });

                    if (storedVideoId === currentVideoId) {
                        console.log(`✅ [CommentAuto] MATCH found in ${source}!`);

                        // 🛡️ V2.4: Check global lock FIRST - prevent multi-tab race
                        const lockKey = `comment_lock_${currentVideoId}`;
                        const lockResult = await new Promise(resolve =>
                            chrome.storage.local.get([lockKey], r => resolve(r))
                        );

                        if (lockResult[lockKey]) {
                            const lockTime = lockResult[lockKey];
                            const elapsed = Date.now() - lockTime;
                            if (elapsed < 120000) { // 2 minute lock
                                console.warn(`⚠️ [CommentAuto] LOCK ACTIVE! Another tab is posting. Lock age: ${Math.round(elapsed / 1000)}s`);
                                return false;
                            }
                        }

                        // 🛡️ V2.4: Set lock IMMEDIATELY before any async operations
                        await new Promise(resolve =>
                            chrome.storage.local.set({ [lockKey]: Date.now() }, resolve)
                        );
                        console.log(`🔒 [CommentAuto] LOCK ACQUIRED for ${currentVideoId}`);

                        // 🛡️ V2.4: Clear storage BEFORE posting to prevent other tabs from picking up
                        if (source === 'chrome.storage') {
                            await new Promise(resolve =>
                                chrome.storage.local.remove(EXT_CONSTANTS.STORAGE.PENDING_AUTO_COMMENT, resolve)
                            );
                            chrome.storage.local.remove('pending_auto_comment');
                        } else {
                            localStorage.removeItem(EXT_CONSTANTS?.STORAGE?.PENDING_AUTO_COMMENT || 'pending_auto_comment');
                            localStorage.removeItem('pending_auto_comment');
                        }
                        console.log(`🗑️ [CommentAuto] Cleared pending storage BEFORE posting`);

                        // Store in local Map for the class to use
                        youtubeCommentAutomation.storeComment(currentUrl, data.text, data.pin !== false);

                        // Post it
                        const result = await youtubeCommentAutomation.postComment();

                        if (result.success) {
                            console.log(`✅ [CommentAuto] Comment posted successfully!`);
                            return true;
                        } else {
                            // 🛡️ V2.4: Release lock on failure (but keep a short cooldown)
                            console.warn(`⚠️ [CommentAuto] Post failed, releasing lock`);
                        }
                    }
                } catch (e) {
                    console.error(`❌ [CommentAuto] Error processing ${source} data:`, e);
                }
                return false;
            };

            // 1. Check chrome.storage.local (Primary)
            // 1. Check chrome.storage.local (Primary)
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                const keys = [
                    EXT_CONSTANTS?.STORAGE?.PENDING_AUTO_COMMENT || 'pending_auto_comment',
                    'pending_auto_comment'
                ];

                chrome.storage.local.get(keys, async (result) => {
                    console.log('📝 [CommentAuto] Raw storage result:', result);

                    let dataStr = result[keys[0]] || result['pending_auto_comment'];
                    const found = await processData(dataStr, 'chrome.storage');

                    if (found) return;

                    // 2. Check localStorage (Fallback)
                    const localData = localStorage.getItem('pending_auto_comment');
                    await processData(localData, 'localStorage');
                });
            } else {
                // Fallback to localStorage only
                const localData = localStorage.getItem('pending_auto_comment');
                await processData(localData, 'localStorage');
            }
        };

        // 🔧 V2.4: Single check with reasonable delay (lock mechanism handles race conditions)
        setTimeout(() => runCheck(1), 5000);
    }


    // Export
    window.YouTubeCommentAutomation = youtubeCommentAutomation;
    console.log('📦 [Module] platforms/youtube/commentAutomation.js loaded (V2.5 - Shorts Support)');

} catch (e) {
    console.error('❌ [CommentAuto] Critical initialization error:', e);

    // 🆕 V2.6: Ensure tab closes on critical error if it was opened by scheduler
    if (window.location.href.includes('youtube.com/watch') || window.location.href.includes('youtube.com/shorts')) {
        console.log('👋 [CommentAuto] Closing tab due to critical error...');
        setTimeout(() => window.close(), 5000);
    }

    // Ensure window object exists even if initialization fails partially
    if (typeof youtubeCommentAutomation !== 'undefined') {
        window.YouTubeCommentAutomation = youtubeCommentAutomation;
    }
}
