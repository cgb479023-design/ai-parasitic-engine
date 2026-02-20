/**
 * GeminiGen Auto-Pilot Module
 * 
 * Handles automation for GeminiGen (geminigen.ai / gmicloud.ai) video generation.
 * Extracted from content.js for better modularity and maintainability.
 * 
 * @module platforms/geminiGen/autoPilot
 * @version 1.0.0
 * @date 2026-01-05
 * 
 * Dependencies:
 * - core/constants.js (EXT_CONSTANTS)
 * - platforms/googleVids/promptSanitizer.js (sanitizePromptForGoogleVids)
 */

(function () {
    'use strict';

    // Only run on GeminiGen pages
    const hostname = window.location.hostname;
    if (!hostname.includes('geminigen.ai') && !hostname.includes('gmicloud.ai')) {
        return;
    }

    console.log("🎬 [GeminiGen AutoPilot] Module loaded - Initializing...");
    console.log("📍 [GeminiGen AutoPilot] Current path:", window.location.pathname);

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    let hasClickedGenerate = false;

    // Check if we're on History page with pending generation
    const isHistoryPage = window.location.pathname.includes('/history');
    const hasPendingGeneration = sessionStorage.getItem('gemini_pending_generation') === 'true';

    if (isHistoryPage) {
        console.log("📜 [GeminiGen AutoPilot] History page detected!");
        console.log("   Pending generation:", hasPendingGeneration ? "Yes ✅" : "No");

        // Auto-start monitoring if there's a pending generation
        setTimeout(() => {
            console.log("🚀 [GeminiGen History] Starting video auto-scan...");
        }, 1500);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Sanitizes prompt for safety using the centralized sanitizer
     */
    const sanitizePrompt = (prompt) => {
        if (!prompt) return prompt;

        // Use the full sanitization function if available
        if (window.sanitizePromptForGoogleVids) {
            const originalPrompt = prompt;
            const sanitized = window.sanitizePromptForGoogleVids(prompt);
            if (sanitized !== originalPrompt) {
                console.log("🛡️ [Safety] Prompt sanitized using sanitizePromptForGoogleVids");
            }
            return sanitized;
        }

        // Fallback: basic sanitization if module not loaded
        const sensitiveTerms = {
            'child': 'adult', 'children': 'adults',
            'kid': 'adult', 'kids': 'adults',
            'baby': 'person', 'babies': 'people',
            'toddler': 'person', 'infant': 'person',
            'boy': 'person', 'girl': 'person',
            'teen': 'adult', 'teenager': 'adult',
            'school': 'workplace', 'playground': 'park',
            'student': 'person', 'pupil': 'person',
            'karen': 'customer', 'chad': 'person',
            'celebrity': 'person', 'famous': 'notable'
        };

        let sanitized = prompt;
        Object.keys(sensitiveTerms).forEach(term => {
            const regex = new RegExp(`\\b${term}\\b`, 'gi');
            if (regex.test(sanitized)) {
                console.log(`🛡️ [Safety] Replacing "${term}" with "${sensitiveTerms[term]}"`);
                sanitized = sanitized.replace(regex, sensitiveTerms[term]);
            }
        });

        return sanitized;
    };

    /**
     * Sends video result back to React app via background script
     */
    const relayVideoResult = (base64Content) => {
        console.log(`🎬 [GeminiGen AutoPilot] Relaying video result (${Math.round(base64Content.length / 1024)}KB)...`);

        const action = typeof EXT_CONSTANTS !== 'undefined'
            ? EXT_CONSTANTS.ACTIONS.RELAY_GEMINI_VIDEO_RESULT
            : 'relayGeminiVideoResult';

        try {
            chrome.runtime.sendMessage({
                action: action,
                payload: base64Content
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("❌ [GeminiGen AutoPilot] Failed to send message:", chrome.runtime.lastError.message);
                    return;
                }
                console.log("✅ [GeminiGen AutoPilot] Video result sent to background!");
                // 🆕 V2.1: Close tab after successful relay
                setTimeout(() => {
                    console.log("👋 [GeminiGen] Task complete. Closing tab...");
                    window.close();
                }, 2000);
            });
        } catch (e) {
            console.error("❌ [GeminiGen AutoPilot] Extension communication error:", e);
        }
    };

    /**
     * Safe message sender with retry
     */
    const safeSendMessage = (retries = 3) => {
        // Implementation inherited from content.js
        // Will be called when sending video to background
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // PROCESS FOUND VIDEO
    // ═══════════════════════════════════════════════════════════════════════════

    const processFoundVideo = (videoUrl) => {
        console.log(`🎬 [GeminiGen AutoPilot] Processing found video: ${videoUrl.substring(0, 80)}...`);

        // Mark generation as complete
        sessionStorage.removeItem('gemini_pending_generation');

        // Handle blob URLs differently
        if (videoUrl.startsWith('blob:')) {
            console.log("🎬 [GeminiGen AutoPilot] Blob URL detected, fetching in content script...");

            fetch(videoUrl)
                .then(response => response.blob())
                .then(blob => {
                    console.log(`✅ [GeminiGen AutoPilot] Blob fetched: ${blob.size} bytes, type: ${blob.type}`);

                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64Content = reader.result;
                        console.log(`✅ [GeminiGen AutoPilot] Converted to base64: ${base64Content.length} chars`);
                        relayVideoResult(base64Content);
                    };
                    reader.onerror = (e) => {
                        console.error("❌ [GeminiGen AutoPilot] FileReader error:", e);
                    };
                    reader.readAsDataURL(blob);
                })
                .catch(error => {
                    console.error("❌ [GeminiGen AutoPilot] Blob fetch failed:", error);
                });

            return;
        }

        // HTTP URL - use background script for CORS
        console.log("📥 [GeminiGen AutoPilot] Sending HTTP URL to background for fetching...");

        chrome.runtime.sendMessage({
            action: 'downloadVideo',
            url: videoUrl
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("❌ [GeminiGen AutoPilot] Download failed:", chrome.runtime.lastError.message);
                return;
            }

            if (response && response.success && response.data) {
                console.log(`✅ [GeminiGen AutoPilot] Video downloaded: ${response.data.length} chars`);
                relayVideoResult(`data:video/mp4;base64,${response.data}`);
            } else {
                console.error("❌ [GeminiGen AutoPilot] Download failed:", response?.error);
            }
        });
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // MONITOR RESULT
    // ═══════════════════════════════════════════════════════════════════════════

    const monitorResult = () => {
        console.log("🚀 [GeminiGen AutoPilot] Monitoring for video result...");

        // Track retry count for generation failures
        if (!window._geminiGenRetryCount) {
            window._geminiGenRetryCount = 0;
        }
        window._maxRetriesReached = false;

        const checkVideo = setInterval(() => {
            // CONTINUOUS ERROR DETECTION
            const pageText = (document.body.innerText || '').toLowerCase();
            const hasGenerationFailed =
                pageText.includes('generation failed') ||
                pageText.includes('video generation failed') ||
                (pageText.includes('please try again') && !pageText.includes('generating'));

            if (hasGenerationFailed && !window._retryInProgress && !window._maxRetriesReached) {
                window._geminiGenRetryCount++;
                console.warn(`❌ [GeminiGen AutoPilot] Generation Failed! (Retry ${window._geminiGenRetryCount}/5)`);

                if (window._geminiGenRetryCount <= 5) {
                    window._retryInProgress = true;

                    // Find and click "try again" button
                    const tryAgainElements = Array.from(document.querySelectorAll('a, button, span')).filter(el => {
                        const text = (el.textContent || '').toLowerCase();
                        return text.includes('try again') || text.includes('retry') || text.includes('重试');
                    });

                    if (tryAgainElements.length > 0) {
                        console.log("🔄 [GeminiGen AutoPilot] Clicking 'Try Again' button...");
                        tryAgainElements[0].click();

                        setTimeout(() => {
                            window._retryInProgress = false;
                            hasClickedGenerate = false;
                            console.log("🔄 [GeminiGen AutoPilot] Ready for retry attempt... Re-triggering generation.");
                            runGenAutomation(); // 🚀 Re-trigger the generation flow
                        }, 5000);
                    } else {
                        window._retryInProgress = false;
                        // FALLBACK: If status text is there but button is missing, try to re-trigger anyway after a delay
                        setTimeout(() => {
                            hasClickedGenerate = false;
                            runGenAutomation();
                        }, 3000);
                    }
                } else {
                    console.error("❌ [GeminiGen AutoPilot] Max retries reached (5/5). Stopping auto-retry to prevent loop.");
                    window._maxRetriesReached = true;
                }
            }

            // STUCK AT 98% DETECTION
            const stuckPageText = document.body.innerText || '';
            const progressMatch = stuckPageText.match(/(\d{1,3})%/);
            const currentProgress = progressMatch ? parseInt(progressMatch[1]) : 0;
            const isStuckAt98Plus = currentProgress >= 98;
            const hasHistoryBtn = stuckPageText.includes('Go to History') ||
                stuckPageText.includes('历史记录') ||
                stuckPageText.includes('check the history');
            const hasTipsDialog = stuckPageText.includes('Tips') ||
                stuckPageText.includes('still being generated');

            if (isStuckAt98Plus && (hasHistoryBtn || hasTipsDialog)) {
                if (!window._stuckTimer) {
                    window._stuckTimer = Date.now();
                    console.warn(`⚠️ [GeminiGen AutoPilot] Detected ${currentProgress}% with Tips dialog. Starting 20s countdown...`);
                }
                const elapsed = Date.now() - window._stuckTimer;
                console.log(`⏱️ [Stuck Watch] ${currentProgress}% | Elapsed: ${Math.round(elapsed / 1000)}s`);

                if (elapsed > 20000) {
                    console.warn("🚨 [GeminiGen AutoPilot] Stuck at 98%+ for 20s! Clicking 'Go to History'...");

                    const histBtn = Array.from(document.querySelectorAll('a, button')).find(el => {
                        const text = (el.textContent || '').toLowerCase();
                        return text.includes('go to history') || text.includes('history');
                    });

                    if (histBtn) {
                        histBtn.click();
                    }
                }
            }

            // VIDEO DETECTION
            const videos = document.querySelectorAll('video');
            if (videos.length === 0) return;

            // Find the generated video (has valid duration)
            let generatedVideo = null;
            for (const video of videos) {
                if (video.duration && video.duration > 1 && video.duration < 120 &&
                    video.readyState >= 4 && video.src) {
                    generatedVideo = video;
                    break;
                }
            }

            // FALLBACK: Relaxed detection
            let videoToProcess = generatedVideo;
            if (!videoToProcess) {
                const fallbackVideo = Array.from(videos).find(v => {
                    const src = v.src || '';
                    const isValidSrc = src.startsWith('http') || src.startsWith('blob:');
                    return isValidSrc && v.readyState >= 4;
                });
                if (fallbackVideo) {
                    videoToProcess = fallbackVideo;
                }
            }


            if (videoToProcess) {
                clearInterval(checkVideo);
                processFoundVideo(videoToProcess.src);
                return;
            }

            // FALLBACK 2: Monitor "Download Video" button as a completion signal
            const downloadBtn = Array.from(document.querySelectorAll('button, a')).find(el => {
                const text = (el.textContent || '').toLowerCase();
                return text.includes('download video') || text.includes('下载视频');
            });

            if (downloadBtn && !window._processingDownload) {
                console.log("🎯 [GeminiGen AutoPilot] 'Download Video' button detected! Generation is definitely complete.");

                // Try to find the video associated with this button or just the first valid video on page
                const anyVideo = document.querySelector('video');
                if (anyVideo && anyVideo.src) {
                    window._processingDownload = true;
                    clearInterval(checkVideo);
                    processFoundVideo(anyVideo.src);
                } else {
                    console.log("⏳ Button exists but video src not ready. Waiting...");
                }
            }

        }, 2000);
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // RUN GENERATION AUTOMATION
    // ═══════════════════════════════════════════════════════════════════════════

    const runGenAutomation = () => {
        console.log("🚀 [GeminiGen AutoPilot] runGenAutomation triggered!");
        console.log("📍 [GeminiGen AutoPilot] Current URL:", window.location.href);

        if (hasClickedGenerate) {
            console.log("⏭️ [GeminiGen AutoPilot] Already clicked generate, skipping.");
            return;
        }

        const params = new URLSearchParams(window.location.search);
        let prompt = params.get('prompt');

        // Sanitize prompt for safety
        if (prompt) {
            prompt = sanitizePrompt(prompt);
        }

        const model = params.get('model');

        console.log(`🚀 [GeminiGen AutoPilot] Params - Prompt: ${prompt ? 'YES (Length: ' + prompt.length + ')' : 'NO'}, Model: ${model}`);

        if (prompt) {
            // Mark that we are waiting for a generation
            sessionStorage.setItem('gemini_pending_generation', 'true');
            console.log("🚀 [GeminiGen AutoPilot] Found prompt in URL, attempting to inject...");

            const injectPromptAndGenerate = () => {
                // Find Input Element
                const inputEl = document.querySelector('textarea') ||
                    document.querySelector('input[type="text"][placeholder*="Describe"]') ||
                    document.querySelector('div[contenteditable="true"]') ||
                    document.querySelector('[role="textbox"]');

                if (!inputEl) {
                    console.log("⏳ [GeminiGen AutoPilot] Input not found yet, retrying in 1s...");
                    setTimeout(injectPromptAndGenerate, 1000);
                    return;
                }

                console.log("✅ [GeminiGen AutoPilot] Found input element:", inputEl.tagName);

                // Clear and type prompt
                inputEl.focus();

                if (inputEl.tagName === 'TEXTAREA' || inputEl.tagName === 'INPUT') {
                    inputEl.value = prompt;
                } else {
                    inputEl.textContent = prompt;
                }

                // Dispatch events
                inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                inputEl.dispatchEvent(new Event('change', { bubbles: true }));

                console.log("✅ [GeminiGen AutoPilot] Prompt injected!");


                // Find and click Generate button
                setTimeout(() => {
                    const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
                    let generateBtn = null;

                    // Strategy 1: Look for text-based buttons
                    generateBtn = buttons.find(btn => {
                        const text = (btn.textContent || '').toLowerCase();
                        const label = (btn.getAttribute('aria-label') || '').toLowerCase();
                        return (text.includes('generate') || text.includes('create') ||
                            label.includes('generate') || label.includes('create')) &&
                            btn.offsetParent !== null && !btn.disabled;
                    });

                    // Strategy 2: Look for the specific 'Up Arrow' icon button (GeminiGen's current UI)
                    if (!generateBtn) {
                        generateBtn = buttons.find(btn => {
                            const hasArrowIcon = btn.querySelector('svg path[d*="M7 11l5-5 5 5"]') ||
                                btn.querySelector('i.fa-arrow-up') ||
                                (btn.innerHTML && btn.innerHTML.includes('arrow'));
                            const isBlackButton = window.getComputedStyle(btn).backgroundColor === 'rgb(0, 0, 0)' ||
                                window.getComputedStyle(btn).backgroundColor === 'black';
                            return (hasArrowIcon || isBlackButton) && btn.offsetParent !== null;
                        });
                    }

                    // Strategy 3: Specific selector for the current UI (the black arrow button)
                    if (!generateBtn) {
                        generateBtn = document.querySelector('button.bg-black, button[type="submit"]');
                    }

                    if (generateBtn) {
                        console.log("🎯 [GeminiGen AutoPilot] Found Generate button, clicking...");

                        // Ensure it's not the 'Pro Studio' button
                        if (generateBtn.textContent.includes('Pro Studio')) {
                            console.log("⚠️ Found Pro Studio button instead of Generate. Looking for sibling...");
                            generateBtn = generateBtn.parentElement.querySelector('button:not(:first-child)');
                        }

                        if (generateBtn) {
                            generateBtn.click();
                            hasClickedGenerate = true;

                            // Also dispatch pointer events for modern UIs
                            ['pointerdown', 'pointerup'].forEach(eventType => {
                                generateBtn.dispatchEvent(new PointerEvent(eventType, {
                                    view: window, bubbles: true, cancelable: true, isPrimary: true
                                }));
                            });

                            console.log("✅ [GeminiGen AutoPilot] Generate button clicked!");
                        }
                    } else {
                        console.warn("⚠️ [GeminiGen AutoPilot] Generate button not found!");
                    }
                }, 1500);
            };

            // Start injection after page load
            setTimeout(injectPromptAndGenerate, 2000);
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════════════════

    // Start automation
    runGenAutomation();

    // Also start monitoring immediately
    monitorResult();

    // Export for debugging
    window.GeminiGenAutoPilot = {
        processFoundVideo,
        monitorResult,
        runGenAutomation,
        sanitizePrompt
    };

    console.log("✅ [GeminiGen AutoPilot] Module initialized successfully!");

})();
