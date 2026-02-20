/**
 * YouTube Studio Uploader Utilities
 * 
 * Common utility functions for YouTube Studio upload automation.
 * These helpers are used across upload, metadata, and visibility operations.
 * 
 * @module platforms/youtube/uploaderUtils
 * @version 1.0.0
 * @date 2026-01-05
 */

(function () {
    'use strict';

    console.log("📦 [YouTube UploaderUtils] Module loading...");

    // ═══════════════════════════════════════════════════════════════════════════
    // SHADOW DOM HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Deep Query Selector - Traverses Shadow DOM
     * @param {Element} root - Root element to search from
     * @param {string} selector - CSS selector
     * @returns {Element|null}
     */
    function deepQuery(root, selector) {
        if (!root) return null;

        if (root.querySelector && root.querySelector(selector)) {
            return root.querySelector(selector);
        }

        // Traverse children and shadow roots
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
        let node;

        while (node = walker.nextNode()) {
            if (node.shadowRoot) {
                const found = deepQuery(node.shadowRoot, selector);
                if (found) return found;
            }
        }

        return null;
    }

    /**
     * Deep Query All - Returns all matches including Shadow DOM
     * @param {Element} root - Root element to search from
     * @param {string} selector - CSS selector
     * @returns {Element[]}
     */
    function deepQueryAll(root, selector) {
        const results = [];
        if (!root) return results;

        try {
            const nodes = Array.from(root.querySelectorAll('*'));

            // Include root if matches
            if (root.matches && root.matches(selector)) {
                results.push(root);
            }

            // Add matching light DOM nodes
            nodes.forEach(node => {
                if (node.matches && node.matches(selector)) {
                    results.push(node);
                }
            });

            // Dive into Shadow Roots
            const allNodes = [root, ...nodes];
            allNodes.forEach(node => {
                if (node.shadowRoot) {
                    results.push(...deepQueryAll(node.shadowRoot, selector));
                }
            });
        } catch (e) {
            // Ignore errors from disconnected nodes
        }

        return results;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // WAIT HELPERS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Wait for an element to appear
     * @param {string|Function} selector - CSS selector or finder function
     * @param {number} timeout - Timeout in ms
     * @returns {Promise<Element|null>}
     */
    function waitForElement(selector, timeout = 10000) {
        return new Promise((resolve) => {
            const start = Date.now();
            const check = () => {
                const el = typeof selector === 'function'
                    ? selector()
                    : document.querySelector(selector);

                if (el) {
                    resolve(el);
                } else if (Date.now() - start > timeout) {
                    resolve(null);
                } else {
                    setTimeout(check, 500);
                }
            };
            check();
        });
    }

    /**
     * Wait for element with rejection on timeout
     * @param {string} selector - CSS selector
     * @param {number} timeout - Timeout in ms
     * @returns {Promise<Element>}
     */
    function waitFor(selector, timeout = 30000) {
        return new Promise((resolve, reject) => {
            const interval = setInterval(() => {
                const el = document.querySelector(selector);
                if (el) {
                    clearInterval(interval);
                    resolve(el);
                }
            }, 1000);

            setTimeout(() => {
                clearInterval(interval);
                reject(`Timeout waiting for ${selector}`);
            }, timeout);
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // BASE64 / FILE CONVERSION
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Convert base64 string to File object
     * @param {string} base64Data - Base64 encoded video data
     * @param {string} fileName - Output file name
     * @returns {File}
     */
    function base64ToFile(base64Data, fileName = `video_${Date.now()}.mp4`) {
        let base64String = base64Data;

        // Handle data URL format
        if (typeof base64String === 'string' && base64String.startsWith('data:')) {
            base64String = base64String.split(',')[1];
        }

        const byteCharacters = atob(base64String);
        const byteNumbers = new Array(byteCharacters.length);

        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }

        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'video/mp4' });

        return new File([blob], fileName, { type: 'video/mp4' });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DUPLICATE PREVENTION
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Check if upload is already in progress
     * @param {string} uploadId - Unique upload identifier
     * @param {number} timeout - Max age in ms (default 15 min)
     * @returns {Promise<{inProgress: boolean, shouldContinue: boolean}>}
     */
    async function checkDuplicateUpload(uploadId, timeout = 15 * 60 * 1000) {
        const result = await new Promise(resolve => {
            chrome.storage.local.get([uploadId], (data) => {
                resolve(data);
            });
        });

        if (result[uploadId]) {
            const startedAt = result[uploadId];
            const elapsed = Date.now() - new Date(startedAt).getTime();

            if (elapsed < timeout) {
                console.warn(`🚫 [Duplicate Prevention] Upload in progress: ${uploadId}`);
                console.warn(`   Started: ${startedAt} (${Math.round(elapsed / 60000)} mins ago)`);
                return { inProgress: true, shouldContinue: false };
            } else {
                console.log(`⏰ [Duplicate Prevention] Previous upload expired, clearing...`);
                await new Promise(resolve => {
                    chrome.storage.local.remove([uploadId], resolve);
                });
                return { inProgress: false, shouldContinue: true };
            }
        }

        return { inProgress: false, shouldContinue: true };
    }

    /**
     * Mark upload as started
     * @param {string} uploadId - Unique upload identifier
     */
    async function markUploadStarted(uploadId) {
        await new Promise(resolve => {
            chrome.storage.local.set({ [uploadId]: new Date().toISOString() }, resolve);
        });
        console.log(`✅ [Duplicate Prevention] Marked upload started: ${uploadId}`);
    }

    /**
     * Clear upload marker
     * @param {string} uploadId - Unique upload identifier
     */
    async function clearUploadMarker(uploadId) {
        await new Promise(resolve => {
            chrome.storage.local.remove([uploadId], resolve);
        });
        console.log(`🧹 [Duplicate Prevention] Cleared upload marker: ${uploadId}`);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // UPLOAD INPUT FINDER
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Find the upload file input element
     * @returns {Promise<HTMLInputElement|null>}
     */
    async function findUploadInput() {
        const selectors = [
            'input[type="file"][accept*="video"]',
            '#content input[type="file"]',
            'ytcp-uploads-file-picker input[type="file"]',
            'input[type="file"]'
        ];

        for (const selector of selectors) {
            // Try regular DOM
            let input = document.querySelector(selector);
            if (input) return input;

            // Try Shadow DOM
            input = deepQuery(document.body, selector);
            if (input) return input;
        }

        // Wait for it to appear
        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 1000));

            for (const selector of selectors) {
                const input = document.querySelector(selector) || deepQuery(document.body, selector);
                if (input) {
                    console.log(`✅ [Upload] Found file input: ${selector}`);
                    return input;
                }
            }
        }

        return null;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TITLE/METADATA SELECTORS
    // ═══════════════════════════════════════════════════════════════════════════

    const TITLE_SELECTORS = [
        '#textbox[aria-label*="Add a title"]',
        '#textbox[aria-label*="标题"]',
        '#title-textarea #textbox',
        'ytcp-social-suggestions-textbox #textbox',
        '#details-container #textbox',
        'div[slot="input"] #textbox',
        '#textbox[contenteditable="true"]',
        'ytcp-mention-textbox #textbox'
    ];

    const DESCRIPTION_SELECTORS = [
        '#textbox[aria-label*="description"]',
        '#textbox[aria-label*="描述"]',
        '#description-textarea #textbox',
        '#description-container #textbox',
        'ytcp-social-suggestions-textbox:last-of-type #textbox'
    ];

    /**
     * Find title input box
     * @returns {Promise<Element|null>}
     */
    async function findTitleInput() {
        for (const selector of TITLE_SELECTORS) {
            try {
                const el = await waitFor(selector, 3000);
                if (el) return el;
            } catch (e) {
                // Continue to next selector
            }
        }
        return null;
    }

    /**
     * Find description input box
     * @returns {Promise<Element|null>}
     */
    async function findDescriptionInput() {
        for (const selector of DESCRIPTION_SELECTORS) {
            try {
                const el = await waitFor(selector, 2000);
                if (el) return el;
            } catch (e) {
                // Continue to next selector
            }
        }
        return null;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // EXPORT TO WINDOW
    // ═══════════════════════════════════════════════════════════════════════════

    window.YouTubeUploaderUtils = {
        // Shadow DOM
        deepQuery,
        deepQueryAll,

        // Wait helpers
        waitForElement,
        waitFor,

        // File conversion
        base64ToFile,

        // Duplicate prevention
        checkDuplicateUpload,
        markUploadStarted,
        clearUploadMarker,

        // Element finders
        findUploadInput,
        findTitleInput,
        findDescriptionInput,

        // Selectors (for external use)
        TITLE_SELECTORS,
        DESCRIPTION_SELECTORS
    };

    console.log("✅ [YouTube UploaderUtils] Module loaded successfully!");

})();
