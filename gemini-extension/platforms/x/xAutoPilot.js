/**
 * X (Twitter) AutoPilot Module
 * 
 * Automates posting to X.com using Shadow DOM traversal.
 * Part of the Cross-Platform Distribution System.
 * 
 * @module platforms/x/xAutoPilot
 * @version 1.0.0
 * @date 2026-01-08
 */

(function () {
    'use strict';

    // Skip if not on X.com
    if (!window.location.hostname.includes('x.com') &&
        !window.location.hostname.includes('twitter.com')) {
        return;
    }

    const CONFIG = {
        // Selectors for X.com compose UI
        COMPOSE_SELECTORS: {
            // Compose button (to open compose modal)
            COMPOSE_BUTTON: [
                '[data-testid="SideNav_NewTweet_Button"]',
                'a[href="/compose/tweet"]',
                '[aria-label*="Tweet"]',
                '[aria-label*="Post"]'
            ],
            // Text input area
            TEXT_INPUT: [
                '[data-testid="tweetTextarea_0"]',
                '[role="textbox"][data-text="true"]',
                'div[contenteditable="true"][role="textbox"]',
                '.public-DraftEditor-content'
            ],
            // Post button
            POST_BUTTON: [
                '[data-testid="tweetButton"]',
                '[data-testid="tweetButtonInline"]',
                'button[data-testid*="tweet"]'
            ],
            // Close button (for modal)
            CLOSE_BUTTON: [
                '[data-testid="app-bar-close"]',
                '[aria-label="Close"]'
            ]
        },
        // Delays for human-like behavior
        DELAYS: {
            BEFORE_TYPE: 1000,
            TYPE_CHAR: 50,
            AFTER_TYPE: 500,
            BEFORE_POST: 1000,
            AFTER_POST: 2000
        }
    };

    // ═══════════════════════════════════════════════════════════════════════
    // SHADOW DOM UTILITIES (from xTrendsScraper)
    // ═══════════════════════════════════════════════════════════════════════

    function querySelectorAllDeep(selector, root = document) {
        const results = [];
        const elements = root.querySelectorAll(selector);
        results.push(...Array.from(elements));

        const allElements = root.querySelectorAll('*');
        for (const el of allElements) {
            if (el.shadowRoot) {
                results.push(...querySelectorAllDeep(selector, el.shadowRoot));
            }
        }
        return results;
    }

    function querySelectorDeep(selector, root = document) {
        const results = querySelectorAllDeep(selector, root);
        return results.length > 0 ? results[0] : null;
    }

    function findElement(selectors) {
        for (const selector of selectors) {
            const el = querySelectorDeep(selector);
            if (el) return el;
        }
        return null;
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
        element.focus();

        // 🆕 For Draft.js (X's editor), use execCommand which properly triggers React state
        // First clear any existing content
        if (element.textContent) {
            element.textContent = '';
            element.dispatchEvent(new Event('input', { bubbles: true }));
            await delay(100);
        }

        // Try execCommand first (works best with contenteditable Draft.js)
        try {
            // Insert text using execCommand - this properly binds to React state
            document.execCommand('insertText', false, text);
            console.log('📱 [XAutoPilot] Used execCommand for text insertion');

            // Trigger additional events to ensure React picks up the change
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));

            await delay(500);

            // Check if text was actually inserted
            if (element.textContent.length > 0) {
                console.log('✅ [XAutoPilot] Text inserted successfully via execCommand');
                return;
            }
        } catch (e) {
            console.warn('⚠️ [XAutoPilot] execCommand failed, falling back to keystroke simulation');
        }

        // Fallback: Simulate keystrokes character by character
        for (const char of text) {
            // Create keyboard event for each character
            const keydown = new KeyboardEvent('keydown', {
                key: char,
                code: `Key${char.toUpperCase()}`,
                bubbles: true,
                cancelable: true
            });
            element.dispatchEvent(keydown);

            // beforeinput event (Draft.js listens to this)
            const beforeInput = new InputEvent('beforeinput', {
                inputType: 'insertText',
                data: char,
                bubbles: true,
                cancelable: true
            });
            element.dispatchEvent(beforeInput);

            // Update textContent for contenteditable
            if (element.getAttribute('contenteditable') === 'true') {
                // Use Selection API to insert at cursor
                const selection = window.getSelection();
                const range = selection.getRangeAt(0);
                range.deleteContents();
                range.insertNode(document.createTextNode(char));
                range.collapse(false);
            }

            // Input event
            element.dispatchEvent(new InputEvent('input', {
                inputType: 'insertText',
                data: char,
                bubbles: true
            }));

            // Keyup event
            const keyup = new KeyboardEvent('keyup', {
                key: char,
                code: `Key${char.toUpperCase()}`,
                bubbles: true
            });
            element.dispatchEvent(keyup);

            await delay(CONFIG.DELAYS.TYPE_CHAR);
        }

        // Final events to trigger React state update
        element.dispatchEvent(new Event('blur', { bubbles: true }));
        await delay(100);
        element.focus();
        element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // COMPOSE AND POST
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Composes and posts a tweet/post to X.
     * 
     * @param {string} text - The post text
     * @param {string} youtubeLink - YouTube URL to append
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async function composeAndPost(text, youtubeLink = null) {
        console.log('📱 [XAutoPilot] Starting compose flow...');

        try {
            // Step 1: Click compose button
            const composeBtn = findElement(CONFIG.COMPOSE_SELECTORS.COMPOSE_BUTTON);
            if (!composeBtn) {
                // Try navigating to compose URL
                console.log('📱 [XAutoPilot] Compose button not found, navigating to compose URL...');
                window.location.href = 'https://x.com/compose/tweet';
                await delay(2000);
            } else {
                composeBtn.click();
                await delay(1500);
            }

            // Step 2: Find text input
            let textInput = null;
            for (let i = 0; i < 10; i++) {
                textInput = findElement(CONFIG.COMPOSE_SELECTORS.TEXT_INPUT);
                if (textInput) break;
                await delay(500);
            }

            if (!textInput) {
                throw new Error('Could not find text input area');
            }

            console.log('📱 [XAutoPilot] Found text input, typing...');
            await delay(CONFIG.DELAYS.BEFORE_TYPE);

            // Step 3: Type the text
            const fullText = youtubeLink ? `${text}\n\n${youtubeLink}` : text;
            await humanType(textInput, fullText);

            await delay(CONFIG.DELAYS.AFTER_TYPE);

            // Step 4: Find and click post button
            let postBtn = null;
            for (let i = 0; i < 5; i++) {
                postBtn = findElement(CONFIG.COMPOSE_SELECTORS.POST_BUTTON);
                if (postBtn && !postBtn.disabled) break;
                await delay(500);
            }

            if (!postBtn) {
                throw new Error('Could not find post button');
            }

            if (postBtn.disabled) {
                throw new Error('Post button is disabled');
            }

            console.log('📱 [XAutoPilot] Clicking post button...');
            await delay(CONFIG.DELAYS.BEFORE_POST);
            postBtn.click();

            await delay(CONFIG.DELAYS.AFTER_POST);

            console.log('✅ [XAutoPilot] Post successful!');

            // Notify background script
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.sendMessage({
                    action: 'X_POST_COMPLETE',
                    status: 'success',
                    text: text.substring(0, 50),
                    timestamp: new Date().toISOString()
                });
            }

            return { success: true };

        } catch (error) {
            console.error('❌ [XAutoPilot] Post failed:', error.message);

            if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.sendMessage({
                    action: 'X_POST_COMPLETE',
                    status: 'error',
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }

            return { success: false, error: error.message };
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MESSAGE HANDLING
    // ═══════════════════════════════════════════════════════════════════════

    // Listen for messages from React app (via content.js bridge)
    window.addEventListener('message', async (event) => {
        if (event.source !== window) return;

        const { type, payload } = event.data || {};

        if (type === 'X_POST_REQUEST') {
            console.log('📱 [XAutoPilot] Received post request');

            const result = await composeAndPost(
                payload.text,
                payload.youtubeLink
            );

            // Send result back
            window.postMessage({
                type: 'X_POST_RESULT',
                payload: result
            }, '*');
        }
    });

    // Listen for messages from background script
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'xPost') {
                console.log('📱 [XAutoPilot] Received post request from background');

                composeAndPost(request.text, request.youtubeLink)
                    .then(result => {
                        sendResponse(result);
                    })
                    .catch(error => {
                        sendResponse({ success: false, error: error.message });
                    });

                return true; // Async response
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════════════

    console.log('📱 [XAutoPilot] Initialized on X.com');

    // 🆕 V2.0: Auto-click Post on Intent page (twitter.com/intent/tweet)
    if (window.location.pathname.includes('/intent/tweet')) {
        console.log('📱 [XAutoPilot] On Intent page - will auto-click Post...');

        // Wait for page to fully load and Post button to be ready
        setTimeout(async () => {
            console.log('📱 [XAutoPilot] Searching for Post button on Intent page...');

            // Intent page uses different selectors
            const intentPostSelectors = [
                'input[type="submit"][value*="Post"]',
                'input[type="submit"][value*="Tweet"]',
                'button[type="submit"]',
                '[data-testid="tweetButton"]',
                'button[class*="tweet"]',
                '.EdgeButton--primary',
                'input.submit'
            ];

            let postBtn = null;
            for (let attempt = 0; attempt < 10; attempt++) {
                for (const selector of intentPostSelectors) {
                    postBtn = document.querySelector(selector);
                    if (postBtn && !postBtn.disabled) {
                        console.log(`✅ [XAutoPilot] Found Post button: ${selector}`);
                        break;
                    }
                }

                // Also try finding by button text
                if (!postBtn) {
                    const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
                    postBtn = buttons.find(b => {
                        const text = (b.textContent || b.value || '').toLowerCase();
                        return (text.includes('post') || text.includes('tweet')) && !b.disabled;
                    });
                }

                if (postBtn && !postBtn.disabled) break;
                console.log(`⏳ [XAutoPilot] Post button not ready, retry ${attempt + 1}/10...`);
                await delay(500);
            }

            if (postBtn && !postBtn.disabled) {
                console.log('🔘 [XAutoPilot] Clicking Post button on Intent page...');
                await delay(1000); // Brief pause before clicking
                postBtn.click();
                console.log('✅ [XAutoPilot] Post button clicked!');

                // Wait and verify
                await delay(2000);
                console.log('✅ [XAutoPilot] Intent page post complete!');
            } else {
                console.warn('⚠️ [XAutoPilot] Post button not found or disabled on Intent page');
                console.log('   User needs to click Post manually.');
            }
        }, 3000); // Wait 3s for Intent page to load

        return; // Skip other initialization
    }

    // 🆕 Auto-check for pending post on compose page load
    if (window.location.pathname.includes('/compose')) {
        console.log('📱 [XAutoPilot] On compose page - checking for pending post...');

        // Wait for page to fully load
        setTimeout(async () => {
            try {
                // Check storage for pending post
                chrome.storage.local.get(['pending_x_post'], async (result) => {
                    if (result.pending_x_post) {
                        console.log('📬 [XAutoPilot] Found pending post in storage!');

                        const pendingData = JSON.parse(result.pending_x_post);

                        // Check if not too old (5 minutes)
                        if (Date.now() - pendingData.timestamp < 5 * 60 * 1000) {
                            console.log('📱 [XAutoPilot] Executing auto-post...');
                            console.log('   Text:', pendingData.text?.substring(0, 50) + '...');
                            console.log('   Link:', pendingData.youtubeLink);

                            // Wait a bit more for compose dialog to be ready
                            await delay(2000);

                            const postResult = await composeAndPost(
                                pendingData.text,
                                pendingData.youtubeLink
                            );

                            if (postResult.success) {
                                console.log('✅ [XAutoPilot] Auto-post successful! Clearing storage...');
                                chrome.storage.local.remove('pending_x_post');
                            } else {
                                console.warn('⚠️ [XAutoPilot] Auto-post failed:', postResult.error);
                            }
                        } else {
                            console.log('⏰ [XAutoPilot] Pending post expired, clearing...');
                            chrome.storage.local.remove('pending_x_post');
                        }
                    } else {
                        console.log('📭 [XAutoPilot] No pending post found in storage');
                    }
                });
            } catch (e) {
                console.error('❌ [XAutoPilot] Error checking pending post:', e);
            }
        }, 3000); // Wait 3s for page to fully load
    }

    // Export for testing
    window.XAutoPilot = {
        composeAndPost
    };

})();
