/**
 * LMArena Automation Module
 * 
 * Handles automation for LMArena (lmarena.ai) AI chat interface.
 * Provides prompt injection, response monitoring, and JSON extraction.
 * 
 * @module platforms/lmArena/autoPilot
 * @version 1.0.0
 * @date 2026-01-05
 * 
 * Dependencies:
 * - core/constants.js (EXT_CONSTANTS)
 * - platforms/askStudio/jsonExtractor.js (optional)
 */

(function () {
    'use strict';

    // Only run on LMArena pages
    const hostname = window.location.hostname;
    if (!hostname.includes('lmarena.ai')) {
        return;
    }

    console.log("🏟️ [LMArena AutoPilot] Module loaded - Initializing...");

    // ═══════════════════════════════════════════════════════════════════════════
    // JSON EXTRACTION UTILITIES
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Robust JSON extractor using state machine
     */
    function extractJSON(text, start) {
        let balance = 0;
        let inString = false;
        let escaped = false;
        const startChar = text[start];
        const endChar = startChar === '{' ? '}' : ']';

        for (let i = start; i < text.length; i++) {
            const char = text[i];

            if (escaped) {
                escaped = false;
                continue;
            }

            if (char === '\\') {
                escaped = true;
                continue;
            }

            if (char === '"' && !escaped) {
                inString = !inString;
                continue;
            }

            if (!inString) {
                if (char === startChar) balance++;
                if (char === endChar) balance--;
                if (balance === 0) {
                    return text.substring(start, i + 1);
                }
            }
        }
        return null;
    }

    /**
     * Validate and parse JSON response
     */
    function validateAndParseJSON(text) {
        // Clean up common issues
        let cleaned = text
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/gi, '')
            .replace(/^\s*json\s*/i, '')
            .trim();

        // Try to find JSON structure
        const jsonStart = cleaned.indexOf('{');
        const arrayStart = cleaned.indexOf('[');

        let startIdx = -1;
        if (jsonStart === -1) startIdx = arrayStart;
        else if (arrayStart === -1) startIdx = jsonStart;
        else startIdx = Math.min(jsonStart, arrayStart);

        if (startIdx === -1) return null;

        const extracted = extractJSON(cleaned, startIdx);
        if (!extracted) return null;

        try {
            const parsed = JSON.parse(extracted);

            // Handle array response (wrap in schedule object)
            if (Array.isArray(parsed)) {
                console.log("🔄 [LMArena] Wrapping array in schedule object");
                return { schedule: parsed };
            }

            return parsed;
        } catch (e) {
            console.error("❌ [LMArena] JSON parse error:", e.message);
            return null;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RESPONSE MONITORING
    // ═══════════════════════════════════════════════════════════════════════════

    function startResponseMonitoring() {
        console.log("📡 [LMArena AutoPilot] Starting Response Monitoring...");

        let stabilityCount = 0;
        let lastTextLength = 0;
        let attempts = 0;
        let foundResponse = false;

        const monitorInterval = setInterval(() => {
            attempts++;
            let capturedText = null;
            let sourceElement = null;

            // Strategy 1: Code/Pre block search
            const codeBlocks = Array.from(document.querySelectorAll('code, pre'));
            const candidateBlock = codeBlocks.reverse().find(block => {
                const text = block.innerText || '';
                const hasSchedule = text.includes('"schedule"') || text.includes("'schedule'");
                const hasPillar = text.includes('"pillar"') || text.includes("'pillar'");
                const hasArray = text.includes('[') && text.includes(']');

                // Anti-placeholder check
                const isPlaceholder = text.includes('"pillar": "string"') ||
                    text.includes('"type": "string"') ||
                    text.includes(': "string"');

                return (hasSchedule || hasPillar) && hasArray && text.length > 100 && !isPlaceholder;
            });

            if (candidateBlock) {
                capturedText = candidateBlock.innerText;
                sourceElement = candidateBlock;
                console.log(`🔍 [LMArena] Found candidate (Length: ${capturedText.length})`);
                candidateBlock.style.border = "2px solid #fbbf24";
            }

            // Strategy 2: Full page text search
            if (!capturedText && attempts > 5) {
                const bodyText = document.body.innerText;
                let keywordIndex = bodyText.lastIndexOf('"schedule"');

                if (keywordIndex === -1) {
                    keywordIndex = bodyText.lastIndexOf('"pillar"');
                }

                if (keywordIndex !== -1) {
                    // Walk backwards to find enclosing structure
                    let searchCursor = keywordIndex;
                    for (let loops = 0; loops < 50 && searchCursor > 0; loops++) {
                        searchCursor--;
                        const char = bodyText[searchCursor];

                        if (char === '{' || char === '[') {
                            const extracted = extractJSON(bodyText, searchCursor);
                            if (extracted && extracted.length > 200) {
                                capturedText = extracted;
                                console.log(`🔍 [LMArena] Found via page text (Length: ${capturedText.length})`);
                                break;
                            }
                        }
                    }
                }
            }

            // Stability check
            if (capturedText) {
                if (capturedText.length === lastTextLength) {
                    stabilityCount++;
                } else {
                    stabilityCount = 0;
                    lastTextLength = capturedText.length;
                }

                // Response is stable (same length for 3 checks)
                if (stabilityCount >= 3 && !foundResponse) {
                    foundResponse = true;
                    clearInterval(monitorInterval);

                    console.log("✅ [LMArena AutoPilot] Response stabilized!");

                    if (sourceElement) {
                        sourceElement.style.border = "3px solid #22c55e";
                    }

                    // Parse and send
                    const parsed = validateAndParseJSON(capturedText);
                    if (parsed) {
                        console.log("✅ [LMArena AutoPilot] Parsed JSON successfully!");

                        // Send to background
                        chrome.runtime.sendMessage({
                            action: 'relayLMArenaResponse',
                            data: parsed
                        }, (response) => {
                            if (chrome.runtime.lastError) {
                                console.error("❌ [LMArena] Send failed:", chrome.runtime.lastError.message);
                            } else {
                                console.log("✅ [LMArena] Response sent to background!");
                                // 🆕 V1.1: Close tab after successful relay
                                setTimeout(() => {
                                    console.log("👋 [LMArena] Task complete. Closing tab...");
                                    window.close();
                                }, 2000);
                            }
                        });
                    } else {
                        console.error("❌ [LMArena AutoPilot] Failed to parse JSON!");
                    }
                }
            }

            // Timeout after 3 minutes
            if (attempts > 180) {
                clearInterval(monitorInterval);
                console.error("❌ [LMArena AutoPilot] Monitoring timeout!");
            }

        }, 1000);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MAIN AUTOMATION
    // ═══════════════════════════════════════════════════════════════════════════

    async function runLMArenaAutomation() {
        try {
            // Check for pending prompt
            const result = await new Promise(resolve => {
                chrome.storage.local.get(['pendingLMArenaPrompt'], resolve);
            });

            if (!result.pendingLMArenaPrompt) {
                return;
            }

            const prompt = result.pendingLMArenaPrompt;
            console.log("📝 [LMArena AutoPilot] Found pending prompt! Length:", prompt.length);

            // Find input box
            const inputSelectors = [
                'textarea[placeholder*="Type"]',
                'textarea[placeholder*="Message"]',
                'textarea',
                '[contenteditable="true"]'
            ];

            let inputBox = null;
            for (const sel of inputSelectors) {
                inputBox = document.querySelector(sel);
                if (inputBox && inputBox.offsetParent !== null) break;
            }

            if (!inputBox) {
                console.log("⏳ [LMArena AutoPilot] Input not found yet...");
                return;
            }

            console.log("✅ [LMArena AutoPilot] Found input box!");

            // Focus and type
            inputBox.focus();

            if (inputBox.tagName === 'TEXTAREA' || inputBox.tagName === 'INPUT') {
                inputBox.value = prompt;
            } else {
                inputBox.textContent = prompt;
            }

            inputBox.dispatchEvent(new Event('input', { bubbles: true }));
            inputBox.dispatchEvent(new Event('change', { bubbles: true }));

            console.log("✅ [LMArena AutoPilot] Prompt typed!");

            // Wait and find send button
            await new Promise(r => setTimeout(r, 1500));

            const sendSelectors = [
                'button[type="submit"]',
                'button[aria-label*="Send"]',
                'button[aria-label*="Submit"]',
                '#send-btn',
                'button svg[class*="send"]'
            ];

            let sendBtn = null;
            for (const sel of sendSelectors) {
                const el = document.querySelector(sel);
                if (el) {
                    sendBtn = el.closest('button') || el;
                    if (sendBtn) break;
                }
            }

            // Fallback: Find button near input
            if (!sendBtn) {
                const buttons = document.querySelectorAll('button');
                const inputRect = inputBox.getBoundingClientRect();

                for (const btn of buttons) {
                    const btnRect = btn.getBoundingClientRect();
                    const isNear = Math.abs(btnRect.top - inputRect.top) < 100;
                    const text = (btn.textContent || '').toLowerCase();

                    if (isNear && (text.includes('send') || btn.querySelector('svg'))) {
                        sendBtn = btn;
                        break;
                    }
                }
            }

            if (sendBtn) {
                console.log("🚀 [LMArena AutoPilot] Clicking send button!");
                sendBtn.click();

                // Clear pending prompt
                chrome.storage.local.remove(['pendingLMArenaPrompt'], () => {
                    console.log("✅ [LMArena AutoPilot] Prompt submitted!");
                    startResponseMonitoring();
                });
            } else {
                console.error("❌ [LMArena AutoPilot] Send button not found!");
            }

        } catch (e) {
            console.error("❌ [LMArena AutoPilot] Error:", e);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════════════════

    // Check every second for pending prompt
    const checkInterval = setInterval(runLMArenaAutomation, 1000);
    setTimeout(() => clearInterval(checkInterval), 15000);

    // Export for debugging
    window.LMArenaAutoPilot = {
        runAutomation: runLMArenaAutomation,
        startMonitoring: startResponseMonitoring,
        extractJSON,
        validateAndParseJSON
    };

    console.log("✅ [LMArena AutoPilot] Module initialized!");

})();
