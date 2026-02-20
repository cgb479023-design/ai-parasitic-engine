/**
 * TikTok AutoPilot Module
 * 
 * Automates video uploads to TikTok web using Shadow DOM traversal.
 * Part of the Cross-Platform Distribution System.
 * 
 * @module platforms/tiktok/tiktokAutoPilot
 * @version 1.0.0
 * @date 2026-01-08
 */

(function () {
    'use strict';

    // Skip if not on TikTok
    if (!window.location.hostname.includes('tiktok.com')) {
        return;
    }

    const CONFIG = {
        // Selectors for TikTok web upload UI
        UPLOAD_SELECTORS: {
            // File input for video upload
            FILE_INPUT: [
                'input[type="file"]',
                'input[type="file"][accept*="video"]'
            ],
            // Caption input area
            CAPTION_INPUT: [
                '[data-contents="true"]',
                '[contenteditable="true"]',
                'div[role="textbox"]'
            ],
            // Post button
            POST_BUTTON: [
                'button[data-e2e="post_video_button"]',
                'button[type="submit"]',
                '.Button_root'
            ],
            // Dialogs to auto-close
            DIALOG_CLOSE: [
                '[role="dialog"] button[aria-label*="close" i]',
                '[aria-modal="true"] button[aria-label*="close" i]',
                '[role="dialog"] button[data-e2e*="close" i]',
                '[aria-modal="true"] button[data-e2e*="close" i]'
            ],
            // Upload progress indicator
            UPLOAD_PROGRESS: [
                '.upload-progress',
                '[data-e2e="upload-progress"]',
                '.progress-bar'
            ],
            // Success indicator
            SUCCESS_INDICATOR: [
                '[data-e2e="upload-success"]',
                '.upload-success',
                '.success-message'
            ]
        },
        // Delays
        DELAYS: {
            BEFORE_UPLOAD: 1000,
            AFTER_UPLOAD: 3000,
            TYPING_CHAR: 30,
            BEFORE_POST: 2000,
            AFTER_POST: 5000,
            WAIT_FOR_PROCESS: 30000
        },
        // TikTok upload page URL
        UPLOAD_URL: 'https://www.tiktok.com/tiktokstudio/upload?lang=en'
    };

    // ═══════════════════════════════════════════════════════════════════════
    // SHADOW DOM UTILITIES
    // ═══════════════════════════════════════════════════════════════════════

    function querySelectorAllDeep(selector, root = document) {
        const results = [];
        try {
            // V3.8: Robust existence check to prevent Vmok mode crashes
            if (!root || (typeof root.querySelectorAll !== 'function' && typeof root.querySelector !== 'function')) {
                return results;
            }

            // Direct match in current root
            const elements = root.querySelectorAll(selector);
            if (elements) results.push(...Array.from(elements));

            // Recursive Shadow DOM traversal with protection
            const all = root.querySelectorAll('*');
            for (const node of all) {
                if (node && node.shadowRoot) {
                    results.push(...querySelectorAllDeep(selector, node.shadowRoot));
                }
            }
        } catch (e) {
            // Silently ignore protected or cross-origin shadow roots
        }
        return results;
    }

    function querySelectorAllDeepAny(selector) {
        const results = [];
        const visited = new Set();
        const crawl = (doc) => {
            if (!doc || visited.has(doc)) return;
            visited.add(doc);
            results.push(...querySelectorAllDeep(selector, doc));
            let frames = [];
            try {
                frames = Array.from(doc.querySelectorAll?.('iframe') || []);
            } catch { }
            for (const frame of frames) {
                try {
                    const childDoc = frame.contentDocument;
                    if (childDoc) crawl(childDoc);
                } catch { }
            }
        };
        crawl(document);
        return results;
    }

    function querySelectorDeep(selector, root = document) {
        const results = root === document ? querySelectorAllDeepAny(selector) : querySelectorAllDeep(selector, root);
        return results.length > 0 ? results[0] : null;
    }

    /**
     * Deep selector that can pierce through Shadow DOM and handle common TikTok structures
     */
    function findElement(selectors) {
        if (!Array.isArray(selectors)) selectors = [selectors];
        
        for (const selector of selectors) {
            const found = querySelectorDeep(selector);
            if (found) {
                console.log('🎯 [TikTokAutoPilot] Verified Deep Hit:', found);
                return found;
            }
        }
        
        // Final fallback: Generic scan
        const allFiles = querySelectorAllDeepAny('input[type="file"]');
        for (const input of allFiles) {
            if (input.accept?.includes('video') || selectors.includes('input[type="file"]')) {
                return input;
            }
        }
        return null;
    }

    function findDeepButtonByText(text) {
        const target = String(text || '').toLowerCase();
        if (!target) return null;
        const buttons = querySelectorAllDeepAny('button');
        for (const btn of buttons) {
            const label = (btn.textContent || '').trim().toLowerCase();
            if (!label) continue;
            if (!label.includes(target)) continue;
            const disabled = !!btn.disabled || btn.getAttribute?.('disabled') !== null;
            if (disabled) continue;
            if (btn.offsetParent === null) continue;
            return btn;
        }
        return null;
    }

    function dismissExitConfirmation() {
        const needles = [
            'are you sure you want to exit',
            'your progress and changes will not be saved',
            '确定要退出',
            '更改将不会保存'
        ];

        const dialogs = querySelectorAllDeepAny('[role="dialog"],[aria-modal="true"]');
        for (const dlg of dialogs) {
            try {
                const t = (dlg.textContent || '').toLowerCase();
                if (!needles.some(n => t.includes(n))) continue;

                const buttons = querySelectorAllDeep('button', dlg);
                const cancel = buttons.find(b => {
                    const label = (b.textContent || '').trim().toLowerCase();
                    if (!label) return false;
                    if (b.disabled || b.getAttribute?.('disabled') !== null) return false;
                    if (b.offsetParent === null) return false;
                    return label.includes('cancel') || label.includes('stay') || label.includes('继续') || label.includes('取消');
                });
                if (cancel) {
                    cancel.click();
                    return true;
                }
            } catch { }
        }

        const cancelBtn = findDeepButtonByText('cancel') || findDeepButtonByText('取消');
        const exitBtn = findDeepButtonByText('exit') || findDeepButtonByText('退出');
        if (cancelBtn && exitBtn) {
            cancelBtn.click();
            return true;
        }
        return false;
    }

    function resolveEditable(element) {
        if (!element) return null;
        if (element.isContentEditable) return element;
        const closest = element.closest?.('[contenteditable="true"],[role="textbox"]');
        return closest || element;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // HUMAN SIMULATION
    // ═══════════════════════════════════════════════════════════════════════

    function delay(ms) {
        const variance = ms * 0.2;
        const actual = ms + (Math.random() * variance * 2 - variance);
        return new Promise(resolve => setTimeout(resolve, actual));
    }

    async function humanType(element, text) {
        if (!element) throw new Error('CAPTION_ELEMENT_MISSING');

        const isTextInput = element instanceof HTMLTextAreaElement || (element instanceof HTMLInputElement && (element.type === 'text' || element.type === 'search'));
        if (isTextInput) {
            const proto = Object.getPrototypeOf(element);
            const desc = Object.getOwnPropertyDescriptor(proto, 'value') || Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
            if (desc?.set) {
                desc.set.call(element, text);
            } else {
                element.value = text;
            }
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return;
        }

        element.focus({ preventScroll: true });
        try {
            const selection = document.getSelection?.();
            if (selection) {
                selection.removeAllRanges();
                const range = document.createRange();
                range.selectNodeContents(element);
                selection.addRange(range);
            }
        } catch { }

        try {
            document.execCommand('delete', false, null);
            document.execCommand('insertText', false, text);
            element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
            return;
        } catch { }

        element.textContent = '';
        element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
        for (const char of text) {
            element.textContent += char;
            element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: char }));
            await delay(CONFIG.DELAYS.TYPING_CHAR);
        }
    }

    function findDescriptionInput() {
        const textareas = querySelectorAllDeepAny('textarea');
        for (const ta of textareas) {
            try {
                if (!ta || ta.offsetParent === null) continue;
                const ph = (ta.getAttribute?.('placeholder') || '').toLowerCase();
                if (ph.includes('share more')) return ta;
                if (ph.includes('description')) return ta;
            } catch { }
        }

        const candidates = querySelectorAllDeepAny('textarea,[contenteditable="true"],div[role="textbox"]');
        let best = null;
        let bestScore = -Infinity;

        for (const el of candidates) {
            try {
                if (!el) continue;
                if (el.offsetParent === null) continue;
                const style = getComputedStyle(el);
                if (style.visibility === 'hidden' || style.display === 'none') continue;

                let score = 0;
                const placeholder = (el.getAttribute?.('placeholder') || '').toLowerCase();
                const ariaLabel = (el.getAttribute?.('aria-label') || '').toLowerCase();
                const role = (el.getAttribute?.('role') || '').toLowerCase();

                if (placeholder.includes('share more') || placeholder.includes('description')) score += 10;
                if (ariaLabel.includes('description')) score += 8;
                if (role === 'combobox') score -= 8;
                if (placeholder.includes('hashtags') || placeholder.includes('mention')) score -= 12;

                let p = el;
                for (let i = 0; i < 6; i++) {
                    p = p?.parentElement;
                    if (!p) break;
                    const t = (p.textContent || '').toLowerCase();
                    if (t.includes('description')) score += 3;
                    if (t.includes('hashtags') || t.includes('mention')) score -= 4;
                }

                if (el.isContentEditable) score += 1;
                if (el.tagName === 'TEXTAREA') score += 2;

                if (score > bestScore) {
                    bestScore = score;
                    best = el;
                }
            } catch { }
        }

        if (best) return best;

        const placeholderNeedles = ['share more about your video', 'share more', 'description'];
        const placeholderEls = querySelectorAllDeepAny('[placeholder]');
        for (const el of placeholderEls) {
            try {
                const ph = (el.getAttribute?.('placeholder') || '').toLowerCase();
                if (!ph) continue;
                if (!placeholderNeedles.some(n => ph.includes(n))) continue;
                const owner = el.closest?.('textarea,[contenteditable=\"true\"],div[role=\"textbox\"]') || el;
                return owner;
            } catch { }
        }

        return null;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // UPLOAD FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Converts base64 data URL to Blob
     */
    function dataURLtoBlob(dataURL) {
        const arr = dataURL.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    }

    /**
     * Creates a File object from video data
     */
    function createVideoFile(videoData, filename = 'video.mp4') {
        let blob;

        if (typeof videoData === 'string' && videoData.startsWith('data:')) {
            blob = dataURLtoBlob(videoData);
        } else if (videoData instanceof Blob) {
            blob = videoData;
        } else {
            throw new Error('Invalid video data format');
        }

        return new File([blob], filename, { type: 'video/mp4' });
    }

    /**
     * Uploads a video to TikTok
     * 
     * @param {string|Blob} videoData - Base64 data URL or Blob
     * @param {Object} metadata - Caption, hashtags, etc.
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async function uploadVideo(videoData, metadata) {
        let exitWatchdog = null;
        try {
            console.log('🎵 [TikTokAutoPilot] Starting upload sequence...', metadata.caption);
            if (!videoData) {
                throw new Error('NO_VIDEO_DATA');
            }

            exitWatchdog = setInterval(() => {
                try {
                    dismissExitConfirmation();
                } catch { }
            }, 800);

            const tryCloseDialogs = async () => {
                if (dismissExitConfirmation()) return;
                const gotIt = findDeepButtonByText('got it');
                if (gotIt) gotIt.click();
                const closeBtn = findElement(CONFIG.UPLOAD_SELECTORS.DIALOG_CLOSE);
                if (closeBtn) closeBtn.click();
            };

            for (let i = 0; i < 3; i++) {
                await tryCloseDialogs();
                await delay(700);
            }

            // Step 2: Find file input
            let fileInput = null;
            for (let i = 0; i < 25; i++) { // 🆕 增加到 25s 容错
                fileInput = findElement(CONFIG.UPLOAD_SELECTORS.FILE_INPUT);
                if (fileInput) {
                    console.log('✅ [TikTokAutoPilot] Found file input:', fileInput);
                    break;
                }
                await delay(1000);
            }

            if (!fileInput) {
                throw new Error('❌ [TikTokAutoPilot] Could not find file upload input after 25s. The UI might have changed.');
            }

            console.log('🎵 [TikTokAutoPilot] Found file input, uploading video...');

            // Step 3: Create File and upload
            const videoFile = createVideoFile(videoData);

            // Create DataTransfer to set files
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(videoFile);
            fileInput.files = dataTransfer.files;

            // Dispatch change event
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));

            await delay(CONFIG.DELAYS.AFTER_UPLOAD);

            // Step 4: Wait for video processing
            console.log('🎵 [TikTokAutoPilot] Waiting for video processing...');
            
            for (let i = 0; i < 5; i++) {
                await tryCloseDialogs();
                await delay(2000);
            }

            await delay(CONFIG.DELAYS.WAIT_FOR_PROCESS);

            // Step 5: Find and fill caption (TikTok Studio structure)
            let captionInput = null;
            console.log('🎵 [TikTokAutoPilot] Waiting for caption input to appear...');
            for (let i = 0; i < 60; i++) { // Wait up to 60s for upload processing
                captionInput = findDescriptionInput() || findElement([
                    'textarea[placeholder*="share more" i]',
                    'textarea[placeholder*="description" i]',
                    'textarea',
                    '[data-contents="true"]',
                    '.public-DraftEditor-content',
                    '[contenteditable="true"]',
                    'div[role="textbox"]'
                ]);
                if (captionInput) break;
                await delay(1000);
            }

            const needFill = !!(metadata.caption || (metadata.hashtags && metadata.hashtags.length));
            if (captionInput && needFill) {
                console.log('✅ [TikTokAutoPilot] Caption input found. Filling content...');
                let fullCaption = metadata.caption || '';
                if (metadata.hashtags && metadata.hashtags.length > 0) {
                    fullCaption += '\n\n' + metadata.hashtags.join(' ');
                }
                const editable = resolveEditable(captionInput);
                await humanType(editable, fullCaption);
                await delay(2000);
                try {
                    chrome.runtime.sendMessage({ action: 'TIKTOK_FILL_DESCRIPTION_ALL_FRAMES', text: fullCaption });
                } catch { }
            } else if (!captionInput && needFill) {
                throw new Error('DESCRIPTION_INPUT_NOT_FOUND');
            }

            // Step 6: Click post button
            let postBtn = null;
            console.log('🎵 [TikTokAutoPilot] Waiting for post button to be enabled...');
            for (let i = 0; i < 60; i++) {
                postBtn = findDeepButtonByText('post') || findElement(CONFIG.UPLOAD_SELECTORS.POST_BUTTON);
                
                // Extra check: Is it actually clickable?
                if (postBtn && !postBtn.disabled && postBtn.offsetParent !== null) {
                    console.log('✅ [TikTokAutoPilot] Post button is ready!');
                    break;
                }
                await delay(1000);
            }

            if (!postBtn) {
                throw new Error('Could not find post button');
            }

            if (postBtn.disabled) {
                throw new Error('Post button is disabled - video may still be processing');
            }

            console.log('🎵 [TikTokAutoPilot] Clicking post button...');
            postBtn.click();

            await delay(CONFIG.DELAYS.AFTER_POST);

            console.log('✅ [TikTokAutoPilot] Upload successful!');

            // Notify background script
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.sendMessage({
                    action: 'TIKTOK_UPLOAD_COMPLETE',
                    status: 'success',
                    caption: metadata.caption?.substring(0, 50),
                    timestamp: new Date().toISOString()
                });
            }

            return { success: true };

        } catch (error) {
            console.error('❌ [TikTokAutoPilot] Upload failed:', error.message);

            if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.sendMessage({
                    action: 'TIKTOK_UPLOAD_COMPLETE',
                    status: 'error',
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }

            return { success: false, error: error.message };
        } finally {
            try {
                if (exitWatchdog) clearInterval(exitWatchdog);
            } catch { }
        }
    }

    /**
     * Posts a comment on a TikTok video (for engagement boost)
     * 
     * @param {string} text - Comment text
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async function postComment(text) {
        console.log('🎵 [TikTokAutoPilot] Posting comment...');

        try {
            // Find comment input
            const commentInput = querySelectorDeep('[data-e2e="comment-input"]') ||
                querySelectorDeep('div[contenteditable="true"]');

            if (!commentInput) {
                throw new Error('Could not find comment input');
            }

            await humanType(commentInput, text);
            await delay(500);

            // Find and click post button
            const postBtn = querySelectorDeep('[data-e2e="comment-post"]') ||
                findDeepButtonByText('post');

            if (!postBtn) {
                throw new Error('Could not find comment post button');
            }

            postBtn.click();
            await delay(2000);

            console.log('✅ [TikTokAutoPilot] Comment posted!');
            return { success: true };

        } catch (error) {
            console.error('❌ [TikTokAutoPilot] Comment failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MESSAGE HANDLING
    // ═══════════════════════════════════════════════════════════════════════

    // Listen for messages from React app
    window.addEventListener('message', async (event) => {
        if (event.source !== window) return;

        const { type, payload } = event.data || {};

        if (type === 'TIKTOK_UPLOAD_REQUEST') {
            console.log('🎵 [TikTokAutoPilot] Received upload request');

            const result = await uploadVideo(payload.videoData, payload);

            window.postMessage({
                type: 'TIKTOK_UPLOAD_RESULT',
                payload: result
            }, '*');
        }

        if (type === 'TIKTOK_COMMENT_REQUEST') {
            console.log('🎵 [TikTokAutoPilot] Received comment request');

            const result = await postComment(payload.text);

            window.postMessage({
                type: 'TIKTOK_COMMENT_RESULT',
                payload: result
            }, '*');
        }
    });

    // Listen for messages from background script
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'tiktokUpload') {
                console.log('🎵 [TikTokAutoPilot] Received upload request from background');

                if (!request.videoData) {
                    console.warn('⚠️ [TikTokAutoPilot] Upload request missing videoData. Storing as pending and waiting.');
                    try {
                        chrome.storage.local.set({
                            pending_tiktok_upload: JSON.stringify({
                                caption: request.metadata?.caption || '',
                                hashtags: request.metadata?.hashtags || [],
                                videoData: null,
                                youtubeVideoId: request.youtubeVideoId,
                                sourceYouTubeUrl: request.sourceYouTubeUrl,
                                timestamp: Date.now()
                            })
                        }, () => {
                            checkPendingUploads();
                        });
                    } catch { }
                    sendResponse({ success: false, error: 'NO_VIDEO_DATA_YET' });
                    return true;
                }

                uploadVideo(request.videoData, request.metadata)
                    .then(result => sendResponse(result))
                    .catch(error => sendResponse({ success: false, error: error.message }));

                return true;
            }

            if (request.action === 'tiktokComment') {
                postComment(request.text)
                    .then(result => sendResponse(result))
                    .catch(error => sendResponse({ success: false, error: error.message }));

                return true;
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INITIALIZATION & AUTO-TRIGGER
    // ═══════════════════════════════════════════════════════════════════════

    console.log('🎵 [TikTokAutoPilot] Initialized on TikTok.com (v4.6.7)');
    const marker = document.createElement('div');
    marker.id = 'tiktok-autopilot-signal';
    marker.style.display = 'none';
    document.documentElement.appendChild(marker);

    // Safety lock to prevent multiple triggers in the same session
    let isAutoTriggered = false;

    async function checkPendingUploads() {
        if (isAutoTriggered) return;

        // 🆕 V3.5: Distributed Lock - Prevent multiple tabs from grabbing the same task
        const lockKey = 'tiktok_upload_lock';
        const lockValue = Date.now().toString();

        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['pending_tiktok_upload', lockKey], async (result) => {
                const pending = result.pending_tiktok_upload;
                const activeLock = result[lockKey];

                if (!pending) return;

                // If a lock exists and is less than 60s old, another tab is likely handling it
                if (activeLock && (Date.now() - parseInt(activeLock) < 60000)) {
                    console.log('🔒 [TikTokAutoPilot] Task is locked by another tab. Skipping.');
                    return;
                }

                const data = JSON.parse(pending);
                const now = Date.now();
                
                if (now - data.timestamp < 300000) {
                    if (!data.videoData && (data.youtubeVideoId || data.sourceYouTubeUrl)) {
                        console.log('⏳ [TikTokAutoPilot] Pending upload missing videoData. Fetching from background...', data.youtubeVideoId || data.sourceYouTubeUrl);
                        try {
                            const resp = await new Promise((resolve) => {
                                chrome.runtime.sendMessage({ action: 'GET_TIKTOK_VIDEO_DATA', youtubeVideoId: data.youtubeVideoId, sourceYouTubeUrl: data.sourceYouTubeUrl }, resolve);
                            });
                            if (resp?.success && resp?.videoData) {
                                data.videoData = resp.videoData;
                                chrome.storage.local.set({
                                    pending_tiktok_upload: JSON.stringify({ ...data, videoData: resp.videoData })
                                });
                            } else {
                                console.warn('⚠️ [TikTokAutoPilot] Background did not return videoData yet. Will retry.', resp?.error || resp?.debug || '');
                                setTimeout(checkPendingUploads, 2000);
                                return;
                            }
                        } catch {
                            setTimeout(checkPendingUploads, 2000);
                            return;
                        }
                    }

                    if (!data.videoData) {
                        console.warn('⚠️ [TikTokAutoPilot] Pending upload still missing videoData. Waiting for push message.');
                        setTimeout(checkPendingUploads, 2000);
                        return;
                    }

                    // Acquire lock only when we are ready to execute
                    chrome.storage.local.set({ [lockKey]: lockValue });
                    console.log('🎵 [TikTokAutoPilot] Found pending upload, auto-triggering...', data.caption);
                    isAutoTriggered = true;
                    
                    // Clear task immediately to prevent others from seeing it
                    chrome.storage.local.remove(['pending_tiktok_upload']);
                    
                    try {
                        await uploadVideo(data.videoData, data);
                    } finally {
                        // Release lock after attempt
                        chrome.storage.local.remove([lockKey]);
                    }
                }
            });
        }
    }

    // Run check on load
    if (window.location.href.includes('/upload') || window.location.href.includes('/tiktokstudio/upload')) {
        checkPendingUploads();
    }

    // Export for testing
    window.TikTokAutoPilot = {
        uploadVideo,
        postComment,
        checkPendingUploads
    };

})();
