/**
 * YouTube Studio Agent Module
 * 
 * Handles YouTube Studio analytics automation including:
 * - Ask Studio dialog interaction
 * - Prompt typing and submission
 * - Response capture and relay
 * 
 * @module platforms/youtube/studioAgent
 * @version 1.4.0
 * @date 2026-01-16
 * 
 * @changelog
 * - v1.4.0: Restored error handling from snapshot (rate limit detection, 
 *           cancelled response retry, exponential backoff, callback confirmation)
 * 
 * Only active on studio.youtube.com
 */

(function () {
    'use strict';

    const hostname = window.location.hostname;
    if (hostname !== 'studio.youtube.com') {
        return;
    }

    console.log("📺 [YouTube StudioAgent] Module loaded - Initializing...");

    // ═══════════════════════════════════════════════════════════════════════════
    // PREDEFINED PROMPTS
    // ═══════════════════════════════════════════════════════════════════════════

    const ANALYTICS_PROMPTS = {
        yppSprint: "Summarize my channel performance in the last 48 hours. Focus on Views, Subscribers gained, and Average View Duration (AWD). List the top 5 performing videos by views.",
        channelOverview: "Summarize my channel performance in the last 28 days. Focus on core growth metrics (Views, Watch Time, Subscribers) and identify any significant trends.",
        videoPerformance: "Analyze the performance of my videos from the **Last 7 Days**. **CRITICAL: What is the First Hour Velocity (views in first 60 mins) of my latest short?** Also, what is the Average Views Per Viewer (APV) for my last 5 shorts? Which specific topics had the highest retention?",
        audience: "Who is my audience? **CRITICAL: List the TOP 3 PEAK HOURS (in local time) when my viewers are most active on YouTube.** Also, analyze the **Retention Curve**: At what specific second does retention typically drop below 60% for my recent shorts?",
        traffic: "Where is my traffic coming from in the **Last 7 Days**? Compare Shorts Feed vs YouTube Search. **CRITICAL: How many subscribers did I gain per 1,000 views (Subs Conversion Rate)?**",
        engagement: "Analyze the engagement on my channel. What is the Like-to-View ratio? What are the most common sentiments in the comments?",
        comments: "Summarize the top themes and questions in my recent comments. What are viewers asking for? Are there any recurring complaints or praise?"
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    function delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    /**
     * Ultra-robust Shadow DOM traversal (Based on querySelectorAllDeep from snapshots)
     * @param {string} selector 
     * @param {Element|Document|ShadowRoot} root 
     * @returns {Element[]}
     */
    function querySelectorAllDeep(selector, root = document) {
        const results = [];

        // 1. Check current root
        try {
            root.querySelectorAll(selector).forEach(item => results.push(item));
        } catch (e) { }

        // 2. Traverse children to find Shadow Roots
        // Use a recursive approach that works even if TreeWalker is restricted
        const allElements = root.querySelectorAll('*');
        for (const el of allElements) {
            if (el.shadowRoot) {
                results.push(...querySelectorAllDeep(selector, el.shadowRoot));
            }
        }

        return results;
    }

    function findInShadow(root, selector) {
        const results = querySelectorAllDeep(selector, root);
        return results.length > 0 ? results[0] : null;
    }

    function findAskButton() {
        // 🎯 PRIORITY 0: Direct query for Ask Studio button (EXACT MATCH - PROVEN FROM USER'S CONSOLE)
        const askStudioDirect = document.querySelector('ytcp-icon-button[aria-label="Ask Studio"]');
        if (askStudioDirect && askStudioDirect.offsetParent !== null) {
            console.log("✅ [StudioAgent] Found Ask Studio via EXACT MATCH!");
            return askStudioDirect;
        }

        const selectors = [
            'ytcp-icon-button[aria-label*="Ask"]',
            'ytcp-icon-button[icon="sparkles"]',
            'ytcp-icon-button[icon*="sparkle"]',
            '#ask-studio-button',
            'button[aria-label*="Ask"]',
            'ytcp-icon-button[aria-label*="Assistant"]',
            // 🎯 NEW: Search bar icon (fallback - opens Ask Studio on click)
            '#search-icon-button',
            '#search-icon',
            'ytcp-icon-button#search-icon',
            '[aria-label="Search across your channel"]'
        ];

        for (const selector of selectors) {
            const el = findInShadow(document, selector);
            if (el && el.getBoundingClientRect().width > 0) {
                console.log(`✅ [StudioAgent] Found Ask button via: ${selector}`);
                return el;
            }
        }

        // 🎯 SNAPSHOT PROVEN: Comprehensive fallback search
        const allButtons = Array.from(document.querySelectorAll('ytcp-icon-button, button, [role="button"]'));
        console.log(`🔍 [StudioAgent] Scanning ${allButtons.length} buttons for Ask Studio...`);

        // 🎯 NEW: Log all buttons for debugging
        console.log(`🔍 [StudioAgent] Available buttons:`, allButtons.slice(0, 20).map(b => ({
            label: (b.getAttribute('aria-label') || '').substring(0, 30),
            text: (b.innerText || '').substring(0, 20),
            id: b.id || ''
        })));

        const foundBtn = allButtons.find(b => {
            const label = (b.getAttribute('aria-label') || '').toLowerCase();
            const text = (b.innerText || '').toLowerCase();
            // Must be visible and contain "ask" or "search" (but not "task")
            return ((label.includes('ask') && !label.includes('task')) ||
                (text.includes('ask studio') || text === 'ask') ||
                label.includes('sparkle') || label.includes('assistant') ||
                label.includes('search across')) &&
                (b.offsetParent !== null || b.getBoundingClientRect().width > 0);
        });

        if (!foundBtn) {
            console.warn("⚠️ [StudioAgent] Ask button not found! Trying search bar as fallback...");
            // Final fallback: Click on search bar (opens Ask Studio panel)
            const searchBar = document.querySelector('ytcp-omnisearch-input, #search-input, [class*="search"]');
            if (searchBar) {
                console.log("✅ [StudioAgent] Found search bar as fallback");
                return searchBar;
            }
        }

        return foundBtn;
    }


    function findInputBox() {
        // Try multiple selectors for Ask Studio input (Based on snapshots + current UI)
        const selectors = [
            // 🎯 DIAGNOSTIC PROVEN: Exact class from user's environment
            '.ytcpCreatorChatEntityAttachmentInlineFlowPromptBox',
            'div.ytcpCreatorChatEntityAttachmentInlineFlowPromptBox',

            // 🎯 SNAPSHOT PROVEN: Specific classes
            '.ytcp-creator-chat-entity-attachment-inline-flow-prompt-box',

            // 🎯 CURRENT UI: Shadow DOM targets
            'ytcp-creator-chat-input #input',
            'ytcp-creator-chat-spark [contenteditable="true"]',

            // 🎯 ARIA LABELS
            'div[contenteditable="true"][aria-label="Ask something"]',
            '[aria-label="Ask something"]',
            '[placeholder="Ask something"]',
            '[aria-placeholder="Ask something"]',

            // 🎯 GENERIC FALLBACKS
            'div[contenteditable="true"]',
            '[role="textbox"]',
            'ytcp-omnisearch-input input'
        ];

        for (const selector of selectors) {
            const results = querySelectorAllDeep(selector, document);
            // Filter for visible elements that are likely the chat input
            // 🔧 FIX: Removed offsetParent check as it's unreliable in Shadow DOM
            const el = results.find(item => {
                const rect = item.getBoundingClientRect();
                return rect.width > 50 && rect.height > 10;
            });

            if (el) {
                console.log(`✅ [StudioAgent] Found input with: ${selector}`);
                return el;
            }
        }

        return null;
    }

    function findSendButton() {
        const selectors = [
            '#send-button',
            'button[aria-label="Send"]',
            'button[aria-label="Submit"]',
            'ytcp-icon-button[icon="send"]',
            'ytcp-icon-button[aria-label="Send"]',
            '[id="send-button"]',
            'button[aria-label*="send"]',
            'ytcp-button[aria-label*="Send"]',
            '#search-button'
        ];

        for (const selector of selectors) {
            const results = querySelectorAllDeep(selector, document);
            // 🔧 FIX: Removed offsetParent check
            const el = results.find(item => {
                const rect = item.getBoundingClientRect();
                return rect.width > 10 && rect.height > 10;
            });
            if (el) return el;
        }

        return null;
    }


    // ═══════════════════════════════════════════════════════════════════════════
    // MAIN TASK EXECUTION
    // ═══════════════════════════════════════════════════════════════════════════

    async function performAnalyticsTask(payload) {
        const { category, customQuery, directPrompt, isPlan } = payload;
        console.log(`🚀 [StudioAgent] Starting task: ${category || 'Direct Query'}`);

        const promptText = directPrompt || customQuery || ANALYTICS_PROMPTS[category];

        // 📡 Initial Heartbeat to acknowledge task receipt and stop initial React-side timeout
        chrome.runtime.sendMessage({
            action: 'relayPlanResponse',
            payload: JSON.stringify({ status: 'started', message: "Ask Studio task received, initializing...", progress: 0 }),
            isHeartbeat: true
        }).catch(() => { });

        if (!promptText) {
            console.error("❌ [StudioAgent] No prompt available for task:", payload);
            return;
        }

        // Check if dialog is already open
        // 🎯 FIX: Removed [aria-label="Ask Studio"] as it matches the BUTTON, not the dialog!
        let inputEl = findInputBox();
        const dialogSelectors = 'ytcp-creator-chat-dialog, #creator-chat-dialog, [class*="CreatorChatEntity"], ytcp-omnisearch-dialog';
        const dialog = findInShadow(document, dialogSelectors) || document.querySelector(dialogSelectors);
        const isAlreadyOpen = inputEl !== null || (dialog && dialog.getBoundingClientRect().width > 100);

        if (!isAlreadyOpen) {
            let askBtn = null;
            // 🎯 Robust retry loop for Ask button
            for (let retry = 0; retry < 10; retry++) {
                console.log(`🔍 [StudioAgent] Looking for Ask Studio button... (retry ${retry + 1}/10)`);
                askBtn = findAskButton();
                if (askBtn) break;
                await delay(2000);
            }

            if (askBtn) {
                console.log("🖱️ [StudioAgent] Clicking Ask Studio button:", askBtn.getAttribute('aria-label') || askBtn.innerText);
                askBtn.click();
                console.log("⏳ [StudioAgent] Waiting for Ask Studio dialog to open (5s)...");
                await delay(5000); // Increased wait time
            } else {
                console.warn("⚠️ [StudioAgent] Ask button not found even after retries.");
                // 📡 Failsafe Relay
                chrome.runtime.sendMessage({
                    action: isPlan ? 'relayPlanResponse' : 'relayAnalyticsResult',
                    payload: isPlan ? JSON.stringify({ error: 'Ask Studio button not found. Please ensure the Channel Research feature is available.', success: false }) : undefined,
                    data: isPlan ? undefined : { error: 'UI Button Missing', timestamp: Date.now() }
                }).catch(() => { });
                return;
            }
        } else {
            console.log("✅ [StudioAgent] Dialog already open");
        }

        // 🎯 SNAPSHOT PROVEN: Scroll dialog to bottom to ensure input is visible
        const dialogEl = findInShadow(document, '[class*="CreatorChatEntity"], [class*="omnisearch"], ytcp-creator-chat-dialog');
        if (dialogEl) {
            dialogEl.scrollTo(0, dialogEl.scrollHeight);
            console.log("📜 [StudioAgent] Scrolled dialog to bottom");
        }
        await delay(1000);

        // 🛡️ SNAPSHOT RESTORED: Check for error states (rate limits, paused, etc.)
        const errorCheckTarget = dialogEl || document.body;
        const dialogText = errorCheckTarget.innerText || '';
        console.log("🔍 [StudioAgent] Checking dialog text length:", dialogText.length, "chars");

        const hasError = dialogText.includes('temporarily paused') ||
            dialogText.includes('rate limit') ||
            dialogText.includes('try again later') ||
            dialogText.includes("Couldn't create") ||
            dialogText.includes("couldn't create");

        if (hasError) {
            console.warn("⚠️ [StudioAgent] Ask Studio ERROR detected:", dialogText.substring(0, 100));

            // Get current retry count from storage or initialize
            const retryKey = 'askStudio_retryCount';
            const retryData = await new Promise(resolve => {
                chrome.storage.local.get([retryKey], result => resolve(result[retryKey] || { count: 0, lastAttempt: 0 }));
            });

            const MAX_RETRIES = 3;
            const BASE_DELAY = 30000; // 30 seconds

            if (retryData.count < MAX_RETRIES) {
                // Calculate exponential backoff delay: 30s, 60s, 120s
                const delayMs = BASE_DELAY * Math.pow(2, retryData.count);
                const delaySec = Math.round(delayMs / 1000);

                console.log(`🔄 [StudioAgent] Auto-retry ${retryData.count + 1}/${MAX_RETRIES} in ${delaySec} seconds...`);

                // Update retry count
                chrome.storage.local.set({
                    [retryKey]: { count: retryData.count + 1, lastAttempt: Date.now() }
                });

                // Notify React of retry status
                chrome.runtime.sendMessage({
                    action: 'relayAnalyticsResult',
                    data: {
                        category: category || 'Direct Query',
                        status: 'retrying',
                        message: `Ask Studio rate-limited. Retrying in ${delaySec}s (${retryData.count + 1}/${MAX_RETRIES})...`,
                        timestamp: Date.now()
                    }
                });

                // Wait and retry
                await delay(delayMs);

                // Close and reopen dialog
                const closeBtn = findInShadow(document, '[aria-label="Close"], .close-button, [icon="close"]');
                if (closeBtn) {
                    closeBtn.click();
                    await delay(2000);
                }

                // Recursive retry
                console.log(`🔄 [StudioAgent] Retrying now...`);
                return performAnalyticsTask(payload);
            } else {
                console.error("❌ [StudioAgent] Max retries reached. Giving up.");
                // Reset retry count
                chrome.storage.local.remove([retryKey]);

                chrome.runtime.sendMessage({
                    action: isPlan ? 'relayPlanResponse' : 'relayAnalyticsResult',
                    payload: isPlan ? JSON.stringify({ error: 'Ask Studio rate-limited. Max retries (3) reached.', success: false }) : undefined,
                    data: isPlan ? undefined : {
                        category: category || 'Direct Query',
                        error: 'Ask Studio rate-limited. Max retries (3) reached. Please wait a few minutes and try again.',
                        timestamp: Date.now()
                    }
                });
                return;
            }
        }

        // Reset retry count on successful dialog access
        chrome.storage.local.remove(['askStudio_retryCount']);

        if (!inputEl) {
            for (let retry = 0; retry < 8; retry++) {
                console.log(`🔍 [StudioAgent] Looking for input box... (retry ${retry + 1}/8)`);
                inputEl = findInputBox();
                if (inputEl) break;

                // If not found, try re-clicking Ask button on retry 3
                if (retry === 3) {
                    console.log("🔄 [StudioAgent] Still no input, trying to re-click Ask button...");
                    const retryBtn = findAskButton();
                    if (retryBtn) retryBtn.click();
                }

                await delay(2000);
            }
        }

        if (!inputEl) {
            console.error("❌ [StudioAgent] Input box not found even after waiting");
            // 📡 Failsafe Relay
            chrome.runtime.sendMessage({
                action: isPlan ? 'relayPlanResponse' : 'relayAnalyticsResult',
                payload: isPlan ? JSON.stringify({ error: 'Ask Studio input box not found. Please ensure you are on the YouTube Analytics page.', success: false }) : undefined,
                data: isPlan ? undefined : { error: 'Input Box Missing', timestamp: Date.now() }
            }).catch(() => { });
            return;
        }

        console.log("✅ [StudioAgent] Found input box. Typing prompt...");

        // Type prompt
        inputEl.focus();

        const isContentEditable = inputEl.getAttribute('contenteditable') === 'true' ||
            inputEl.tagName === 'DIV';

        if (isContentEditable) {
            console.log("📝 [StudioAgent] Using contenteditable method");
            inputEl.innerHTML = '';
            inputEl.textContent = promptText;
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            inputEl.dispatchEvent(new Event('change', { bubbles: true }));

            // Fallback for contenteditable
            if (inputEl.textContent !== promptText) {
                document.execCommand('selectAll', false, null);
                document.execCommand('insertText', false, promptText);
            }
        } else {
            console.log("📝 [StudioAgent] Using input.value method");
            inputEl.value = promptText;
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        }

        await delay(1000);

        // Click send
        const sendBtn = findSendButton();
        if (sendBtn && !sendBtn.disabled && sendBtn.getAttribute('aria-disabled') !== 'true') {
            console.log("🚀 [StudioAgent] Clicking Send button");
            sendBtn.click();
        } else {
            console.log("⚠️ [StudioAgent] Send button not clickable, simulating ENTER key");
            inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
            inputEl.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        }

        console.log("⏳ [StudioAgent] Waiting for response...");

        // Wait for response (Based on robust snapshot logic)
        let attempts = 0;
        const maxAttempts = 600; // 10 minutes (Increased from 3m for constitution logic)
        let lastSeenText = '';
        let stableCount = 0;

        const checkResponse = setInterval(() => {
            attempts++;

            // 🎯 SNAPSHOT PROVEN: Look for CODE element with JSON
            let codeElement = findInShadow(document, 'code.language-json');
            if (!codeElement) {
                const allCodes = querySelectorAllDeep('code', document);
                codeElement = allCodes.find(c => c.textContent?.includes('"algorithmStage"') || c.textContent?.includes('"schedule"'));
            }

            // Fallback: Look for message bubbles
            const messages = querySelectorAllDeep('ytcp-creator-chat-message, .ytcp-creator-chat-message, ytcp-omnisearch-message', document);
            const lastMessage = messages[messages.length - 1];

            let text = '';
            if (codeElement) {
                text = codeElement.textContent || '';
            } else if (lastMessage) {
                text = lastMessage.innerText || '';
            }

            // 📡 Progress Relay to React to prevent 300s timeout (Heartbeat every 3 cycles)
            if (attempts % 3 === 0) {
                chrome.runtime.sendMessage({
                    action: 'relayPlanResponse',
                    payload: JSON.stringify({ status: 'generating', message: "Ask Studio is generating your strategy...", progress: attempts }),
                    isHeartbeat: true
                }).catch(() => { });
            }

            // Skip if still generating (but keep heartbeat alive above)
            if (text.includes("Thinking") || text.includes("Generating") || text.includes("Thinking...") || text.includes("Working on it") || text.includes("Wait a moment")) {
                stableCount = 0;
                return;
            }

            // 🛡️ SNAPSHOT RESTORED: Detect errors during generation
            const dialogFullText = lastMessage?.closest('[role="dialog"]')?.innerText || document.body.innerText || '';

            const isError = dialogFullText.includes('temporarily paused') ||
                dialogFullText.includes('rate limit') ||
                dialogFullText.includes('try again later') ||
                dialogFullText.includes("Couldn't create") ||
                dialogFullText.includes("couldn't create");

            if (isError && attempts > 5) {
                console.error("❌ [StudioAgent] Ask Studio ERROR detected during generation:", dialogFullText.substring(0, 100));
                clearInterval(checkResponse);

                const errorMessage = dialogFullText.includes('temporarily paused')
                    ? "Ask Studio feature temporarily paused. Please try again later."
                    : "Ask Studio error: " + dialogFullText.substring(0, 100);

                if (isPlan) {
                    chrome.runtime.sendMessage({
                        action: 'relayPlanResponse',
                        payload: JSON.stringify({ error: errorMessage, success: false })
                    });
                } else {
                    chrome.runtime.sendMessage({
                        action: 'relayAnalyticsResult',
                        data: { category, error: errorMessage, timestamp: Date.now() }
                    });
                }
                return;
            }

            // 🛡️ SNAPSHOT RESTORED: Detect cancelled response
            const isCancelled = dialogFullText.toLowerCase().includes('canceled this response') ||
                dialogFullText.toLowerCase().includes('cancelled this response') ||
                dialogFullText.toLowerCase().includes('you canceled') ||
                dialogFullText.toLowerCase().includes('you cancelled');

            if (isCancelled && attempts < maxAttempts - 30) {
                console.warn("⚠️ [StudioAgent] Response was CANCELLED! Auto-retrying in 3s...");
                stableCount = 0;
                lastSeenText = '';

                // 🎯 FIX: Do NOT clear the interval here, or if we do, restart it.
                // Instead, just skip this cycle and let the timeout handle the button click.
                setTimeout(async () => {
                    console.log("🔄 [StudioAgent] Retrying Ask Studio request (Cancelled detection)...");
                    const retryInput = findInputBox();
                    if (retryInput) {
                        retryInput.focus();
                        const retrySendBtn = findSendButton();
                        if (retrySendBtn && !retrySendBtn.disabled) {
                            retrySendBtn.click();
                            console.log("🚀 [StudioAgent] Retry click sent!");
                        } else {
                            retryInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
                        }
                    }
                }, 3000);

                // Reset attempts to give AI more time after cancellation
                if (attempts > 60) attempts -= 30;
                return;
            }

            // Check if response contains useful content
            const hasJsonContent = text.includes('"schedule"') || text.includes('"algorithmStage"');
            const isLongEnough = text.length > 200;

            // 🛡️ Guard: Skip if it's just the user's prompt or a template
            const isTemplate = text.includes("YYYY") || text.includes('"algorithmStage": "string"');
            const isPrompt = promptText && text.includes(promptText.substring(0, 100));

            // 🔧 V10.1 FIX: If we have JSON, ignore the isPrompt guard (AI often repeats prompt in chat)
            const shouldCapture = (hasJsonContent || isLongEnough) && text.length > 0 && !isTemplate && (!isPrompt || hasJsonContent);

            if (attempts % 5 === 0) {
                console.log(`⏳ [StudioAgent] Progress: attempts=${attempts}, len=${text.length}, hasJson=${hasJsonContent}, isPrompt=${isPrompt}, isTemplate=${isTemplate}, shouldCapture=${shouldCapture}`);
            }

            if (shouldCapture) {
                if (text.length === lastSeenText.length) {
                    stableCount++;
                    // 🚀 SPEED UP: If we have valid JSON, reduce stable wait to 2 cycles
                    const requiredStability = hasJsonContent ? 2 : 3;

                    if (stableCount >= requiredStability) {
                        console.log(`✅ [StudioAgent] Response stabilized (${stableCount})! Capturing...`);
                        clearInterval(checkResponse);
                        relayResponse(text);
                        return;
                    }
                } else {
                    stableCount = 0;
                }
                lastSeenText = text;
            } else if (isTemplate || isPrompt) {
                if (attempts % 10 === 0) console.log("⏳ [StudioAgent] Skipping template/prompt message, waiting for real AI response...");
                stableCount = 0;
            }

            // Failsafe: Direct JSON Detection in dialog
            if (attempts > 10 && !hasJsonContent) {
                const dialog = findInShadow(document, '#creator-chat-dialog') ||
                    findInShadow(document, 'ytcp-omnisearch-dialog') ||
                    findInShadow(document, 'ytcp-creator-chat-spark');
                if (dialog) {
                    const dialogText = dialog.innerText;
                    // 🎯 FIX: Search for the LAST occurrence of a known key to avoid grabbing the prompt's template
                    // "algorithmStage" is a unique key in our JSON structure
                    const keyIndex = dialogText.lastIndexOf('"algorithmStage"');

                    if (keyIndex !== -1) {
                        // Find the opening brace BEFORE this key
                        const firstBrace = dialogText.lastIndexOf('{', keyIndex);
                        // Find the closing brace AFTER this key (likely the end of the text)
                        const lastBrace = dialogText.lastIndexOf('}');

                        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                            const possibleJson = dialogText.substring(firstBrace, lastBrace + 1);

                            // 🛡️ Extra Guard: Ensure it doesn't contain template placeholders
                            if (possibleJson.length > 200 && !possibleJson.includes("YYYY")) {
                                console.log("✅ [StudioAgent] Response captured via direct JSON detection (Last Block)!");
                                clearInterval(checkResponse);
                                relayResponse(possibleJson);
                                return;
                            } else if (possibleJson.includes("YYYY")) {
                                console.log("⏳ [StudioAgent] Detected JSON contains 'YYYY' (Template), ignoring...");
                            }
                        }
                    }
                }
            }

            if (attempts > maxAttempts) {
                console.warn("⚠️ [StudioAgent] Response timeout. Capturing current state.");
                clearInterval(checkResponse);

                // If we have some content, send it as partial result
                if (text.length > 50) {
                    relayResponse(text);
                } else {
                    chrome.runtime.sendMessage({
                        action: isPlan ? 'relayPlanResponse' : 'relayAnalyticsResult',
                        payload: isPlan ? JSON.stringify({ error: 'Ask Studio timed out waiting for AI response.', success: false }) : undefined,
                        data: isPlan ? undefined : { error: 'Timeout', timestamp: Date.now() }
                    }).catch(() => { });
                }
            }
        }, 1000);

        function relayResponse(responseText) {
            console.log(`📡 [StudioAgent] Relaying response (${responseText.length} chars, isPlan: ${isPlan})`);
            if (isPlan) {
                let parsed = {};
                try {
                    parsed = JSON.parse(responseText);
                } catch (e) {
                    console.warn("⚠️ [StudioAgent] Failed to parse responseText as JSON:", e);
                    // If parsing fails, send as-is or with an error structure
                    parsed = { error: "Invalid JSON response from AI", rawResponse: responseText, success: false };
                }

                // 📡 Final Result relay
                chrome.runtime.sendMessage({
                    action: 'relayPlanResponse',
                    payload: JSON.stringify(parsed),
                    isHeartbeat: false, // 🎯 Explicitly NOT a heartbeat
                    source: 'studio_agent'
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("❌ [StudioAgent] Failed to send relayPlanResponse:", chrome.runtime.lastError.message);
                    } else {
                        console.log("✅ [StudioAgent] relayPlanResponse acknowledged by background");
                    }
                });
            } else {
                chrome.runtime.sendMessage({
                    action: 'relayAnalyticsResult',
                    data: { category, question: promptText, response: responseText, timestamp: Date.now() }
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("❌ [StudioAgent] Failed to send relayAnalyticsResult:", chrome.runtime.lastError.message);
                    } else {
                        console.log("✅ [StudioAgent] relayAnalyticsResult acknowledged by background");
                    }
                });
            }
        }
    }

    // Message Listeners
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log("📨 [StudioAgent] Received message:", JSON.stringify(message).substring(0, 300));

            if (message.action === 'performAnalyticsAsk' || message.type === 'ASK_STUDIO_GENERATE_PLAN' || message.action === 'ASK_STUDIO_GENERATE_PLAN') {
                // 🎯 FIX: Try multiple ways to extract the prompt
                const promptFromMessage = message.prompt || message.directPrompt || message.payload?.directPrompt || message.payload?.prompt;

                // Ensure payload has the prompt
                const payload = message.payload || {};
                if (!payload.directPrompt && promptFromMessage) {
                    payload.directPrompt = promptFromMessage;
                }
                if (payload.isPlan === undefined) {
                    payload.isPlan = message.isPlan !== undefined ? message.isPlan : (message.type === 'ASK_STUDIO_GENERATE_PLAN' || message.action === 'ASK_STUDIO_GENERATE_PLAN');
                }

                console.log("📋 [StudioAgent] Extracted prompt length:", payload.directPrompt?.length || 0);

                if (!payload.directPrompt) {
                    console.error("❌ [StudioAgent] No prompt in message! Checking storage...");
                    // Fallback: Check both storage keys
                    chrome.storage.local.get(['pendingAskStudioPrompt', 'pendingAnalyticsRequest'], (result) => {
                        if (result.pendingAskStudioPrompt) {
                            console.log("✅ [StudioAgent] Found prompt in pendingAskStudioPrompt!");
                            performAnalyticsTask({ directPrompt: result.pendingAskStudioPrompt, isPlan: true });
                            chrome.storage.local.remove(['pendingAskStudioPrompt']);
                        } else if (result.pendingAnalyticsRequest) {
                            console.log("✅ [StudioAgent] Found prompt in pendingAnalyticsRequest!");
                            const storedPayload = result.pendingAnalyticsRequest;
                            if (typeof storedPayload === 'string') {
                                performAnalyticsTask({ directPrompt: storedPayload, isPlan: true });
                            } else {
                                performAnalyticsTask(storedPayload);
                            }
                            chrome.storage.local.remove(['pendingAnalyticsRequest']);
                        } else {
                            console.error("❌ [StudioAgent] No prompt in storage either!");
                        }
                    });
                } else {
                    performAnalyticsTask(payload);
                }

                if (typeof sendResponse === 'function') {
                    sendResponse({ received: true });
                }
                return false; // Port closed after ACK
            } else {
                // 🛡️ V2.6 FIX: Always return false for non-matching messages to close port
                return false;
            }
        });
    }

    // Startup Checks
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['pendingAskStudioPrompt', 'pendingAnalyticsRequest'], (result) => {
            if (result.pendingAskStudioPrompt) {
                const prompt = result.pendingAskStudioPrompt;
                chrome.storage.local.remove(['pendingAskStudioPrompt']);
                setTimeout(() => performAnalyticsTask({ directPrompt: prompt, isPlan: true }), 5000);
            }
            if (result.pendingAnalyticsRequest) {
                const payload = result.pendingAnalyticsRequest;
                chrome.storage.local.remove(['pendingAnalyticsRequest']);
                setTimeout(() => performAnalyticsTask(payload), 5000);
            }
        });
    }

    // Export for debugging
    window.YouTubeStudioAgent = {
        performTask: performAnalyticsTask,
        findInput: findInputBox,
        findSend: findSendButton,
        findInShadow: findInShadow,
        querySelectorAllDeep: querySelectorAllDeep
    };

    console.log("✅ [YouTube StudioAgent] Module initialized with snapshot-proven logic!");

})();
