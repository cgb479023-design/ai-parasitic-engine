/**
 * X (Twitter) AutoPilot Module
 * 
 * Automates posting to X/Twitter with content from the DFL system.
 * Uses Draft.js compatible text insertion for the tweet composer.
 * 
 * @module platforms/x/autoPilot
 * @version 1.0.0
 * @date 2026-01-08
 */

(function () {
    'use strict';

    const hostname = window.location.hostname;
    
    // Only run on X/Twitter
    if (!hostname.includes('x.com') && !hostname.includes('twitter.com')) {
        return;
    }

    console.log("📱 [XAutoPilot] Initialized on X.com");

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    /**
     * Find the Draft.js text editor
     */
    function findEditor() {
        // Primary: data-testid approach
        const textareaContainer = document.querySelector('[data-testid="tweetTextarea_0"]');
        if (textareaContainer) {
            const editor = textareaContainer.querySelector('[contenteditable="true"]');
            if (editor) return editor;
        }

        // Fallback: Draft.js class
        const draftEditor = document.querySelector('.public-DraftStyleDefault-block');
        if (draftEditor) {
            const parent = draftEditor.closest('[contenteditable="true"]');
            return parent || draftEditor;
        }

        // Fallback 2: Any contenteditable in compose area
        const composeArea = document.querySelector('[aria-label*="Tweet text"], [aria-label*="Post text"]');
        if (composeArea) return composeArea;

        return null;
    }

    /**
     * Find the Post/Tweet button
     */
    function findPostButton() {
        // Primary: data-testid
        const btn = document.querySelector('[data-testid="tweetButton"], [data-testid="tweetButtonInline"]');
        if (btn) return btn;

        // Fallback: Button with "Post" text
        const buttons = Array.from(document.querySelectorAll('button[type="button"], div[role="button"]'));
        return buttons.find(b => {
            const text = (b.textContent || '').trim().toLowerCase();
            return text === 'post' || text === 'tweet' || text === '发布' || text === '发推';
        });
    }

    /**
     * Find media upload input
     */
    function findMediaInput() {
        return document.querySelector('input[type="file"][accept*="image"], input[type="file"][accept*="video"]');
    }

    /**
     * Insert text into Draft.js editor
     * Draft.js requires special handling - we simulate typing
     */
    async function insertTextDraftJs(editor, text) {
        console.log(`📝 [XAutoPilot] Inserting text: "${text.substring(0, 50)}..."`);
        
        // Focus the editor
        editor.focus();
        await delay(300);

        // Try multiple methods
        
        // Method 1: execCommand (works in most cases)
        try {
            document.execCommand('insertText', false, text);
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            console.log("✅ [XAutoPilot] Method 1 (execCommand) succeeded");
            return true;
        } catch (e) {
            console.warn("⚠️ [XAutoPilot] Method 1 failed:", e.message);
        }

        // Method 2: Clipboard paste simulation
        try {
            const clipboardData = new DataTransfer();
            clipboardData.setData('text/plain', text);
            
            const pasteEvent = new ClipboardEvent('paste', {
                clipboardData: clipboardData,
                bubbles: true,
                cancelable: true
            });
            
            editor.dispatchEvent(pasteEvent);
            console.log("✅ [XAutoPilot] Method 2 (paste) succeeded");
            return true;
        } catch (e) {
            console.warn("⚠️ [XAutoPilot] Method 2 failed:", e.message);
        }

        // Method 3: Direct innerHTML manipulation (last resort)
        try {
            const textNode = document.createTextNode(text);
            editor.appendChild(textNode);
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            console.log("✅ [XAutoPilot] Method 3 (appendChild) succeeded");
            return true;
        } catch (e) {
            console.warn("⚠️ [XAutoPilot] Method 3 failed:", e.message);
        }

        return false;
    }

    /**
     * Main automation function - post a tweet
     */
    async function autoPost(content) {
        console.log("🚀 [XAutoPilot] Starting auto-post...");
        console.log("📋 [XAutoPilot] Content:", content);

        // Step 1: Check if compose dialog is open
        let editor = findEditor();
        
        if (!editor) {
            console.log("📝 [XAutoPilot] Compose dialog not open, attempting to open...");
            
            // Try to click the compose button
            const composeBtn = document.querySelector('[data-testid="SideNav_NewTweet_Button"]') ||
                               document.querySelector('[aria-label="Post"], [aria-label="Tweet"]') ||
                               document.querySelector('a[href="/compose/post"]');
            
            if (composeBtn) {
                composeBtn.click();
                await delay(2000);
                editor = findEditor();
            }
        }

        if (!editor) {
            console.error("❌ [XAutoPilot] Could not find editor!");
            return { success: false, error: 'Editor not found' };
        }

        console.log("✅ [XAutoPilot] Editor found");

        // Step 2: Insert text
        const tweetText = content.text + (content.youtubeLink ? '\n\n' + content.youtubeLink : '');
        const textInserted = await insertTextDraftJs(editor, tweetText);
        
        if (!textInserted) {
            console.error("❌ [XAutoPilot] Failed to insert text");
            return { success: false, error: 'Text insertion failed' };
        }

        await delay(1500);

        // Step 3: Find and click Post button
        const postBtn = findPostButton();
        
        if (!postBtn) {
            console.error("❌ [XAutoPilot] Post button not found");
            return { success: false, error: 'Post button not found' };
        }

        const isDisabled = postBtn.getAttribute('aria-disabled') === 'true' || postBtn.disabled;
        console.log(`📍 [XAutoPilot] Post button found, disabled: ${isDisabled}`);

        if (isDisabled) {
            console.warn("⚠️ [XAutoPilot] Post button is disabled - waiting...");
            await delay(2000);
        }

        // Step 4: Click to post
        console.log("🔘 [XAutoPilot] Clicking Post button...");
        postBtn.click();
        
        await delay(3000);

        // Step 5: Verify success (check if dialog closed)
        const dialogStillOpen = findEditor();
        if (!dialogStillOpen) {
            console.log("✅ [XAutoPilot] Tweet posted successfully!");
            return { success: true };
        } else {
            console.warn("⚠️ [XAutoPilot] Dialog still open - may need manual intervention");
            return { success: false, error: 'Dialog still open after post attempt' };
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MESSAGE LISTENERS
    // ═══════════════════════════════════════════════════════════════════════════

    // Listen for post requests from background/content script
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log("📨 [XAutoPilot] Received message:", message.action || message.type);

            if (message.action === 'xAutoPost' || message.type === 'X_AUTO_POST') {
                const content = message.payload || message.content || {
                    text: message.text,
                    youtubeLink: message.youtubeLink
                };

                autoPost(content).then(result => {
                    sendResponse(result);
                    
                    // Notify React app of result
                    if (typeof chrome !== 'undefined' && chrome.runtime) {
                        chrome.runtime.sendMessage({
                            action: 'xPostResult',
                            success: result.success,
                            error: result.error
                        });
                    }
                });

                return true; // Keep channel open for async response
            }
        });
        
        console.log("✅ [XAutoPilot] Message listener initialized");
    }

    // Also check storage for pending posts on page load
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['pending_x_post'], async (result) => {
            if (result.pending_x_post) {
                console.log("📬 [XAutoPilot] Found pending post in storage");
                
                try {
                    const pendingData = JSON.parse(result.pending_x_post);
                    
                    // Check if not too old (5 minutes)
                    if (Date.now() - pendingData.timestamp < 5 * 60 * 1000) {
                        // Wait for page to fully load
                        await delay(3000);
                        
                        // Check if on compose page or open compose
                        if (window.location.pathname.includes('/compose')) {
                            const postResult = await autoPost(pendingData);
                            
                            if (postResult.success) {
                                // Clear the pending data
                                chrome.storage.local.remove('pending_x_post');
                            }
                        }
                    } else {
                        console.log("⏰ [XAutoPilot] Pending post expired, clearing...");
                        chrome.storage.local.remove('pending_x_post');
                    }
                } catch (e) {
                    console.error("❌ [XAutoPilot] Error processing pending post:", e);
                }
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // EXPOSE FOR DEBUGGING
    // ═══════════════════════════════════════════════════════════════════════════

    window.XAutoPilot = {
        findEditor,
        findPostButton,
        findMediaInput,
        insertTextDraftJs,
        autoPost,
        
        // Debug helper
        test: async function(testText = '🚀 Test tweet from XAutoPilot! #Test') {
            return autoPost({ text: testText, youtubeLink: 'https://youtube.com/shorts/test123' });
        }
    };

    console.log("📱 [XAutoPilot] Ready! Test with: XAutoPilot.test()");

})();
