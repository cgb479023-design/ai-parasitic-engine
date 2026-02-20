/**
 * Google Flow Automation Module
 * 
 * Handles automation for Google Flow (labs.google/fx/tools/flow).
 * Based on content_flow_complete.js snapshot approach - simple and robust.
 * 
 * @module platforms/googleFlow/autoPilot
 * @version 2.0.0
 * @date 2026-01-06
 */

(function () {
    'use strict';

    const hostname = window.location.hostname;
    if (!hostname.includes('labs.google')) {
        return;
    }

    console.log("🌊 [Google Flow AutoPilot] Module loaded - Initializing...");
    console.log("📍 [Google Flow AutoPilot] Path:", window.location.pathname);

    let hasClickedCreate = false;

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    const delay = (ms) => new Promise(r => setTimeout(r, ms));

    // Get prompt from URL parameters
    const getPromptFromURL = () => {
        const params = new URLSearchParams(window.location.search);
        return params.get('prompt');
    };

    // Handle "Pick or create a project" dialog
    const handleProjectDialog = async () => {
        console.log("📋 [Google Flow] Checking for project dialog...");

        const pageText = document.body.innerText || '';
        if (!pageText.includes('Pick or create a project') &&
            !pageText.includes('create a project') &&
            !pageText.includes('use the prompt')) {
            console.log("✅ [Google Flow] No project dialog detected");
            return true;
        }

        console.log("📋 [Google Flow] Project dialog detected!");

        // Look for Create button/link in both button and anchor elements
        const clickables = Array.from(document.querySelectorAll('button, a, [role="button"]'));

        // First, try to find "Create" button
        let createBtn = clickables.find(el => {
            const text = (el.innerText || el.textContent || '').toLowerCase().trim();
            const isCreate = text === 'create' || text.includes('create project') || text.includes('new project');
            const isVisible = el.offsetParent !== null || getComputedStyle(el).display !== 'none';
            return isCreate && isVisible;
        });

        if (createBtn) {
            console.log("✅ [Google Flow] Found Create button/link, clicking...");
            createBtn.click();
            await delay(2000);
            return true;
        }

        // Log all visible buttons for debugging
        const visibleBtns = clickables.filter(el => el.offsetParent !== null);
        console.log("🔍 [Google Flow] Visible clickables:", visibleBtns.map(b => `"${(b.innerText || '').trim().substring(0, 20)}"`).join(', '));

        // Fallback: Click Dismiss to close dialog
        const dismissBtn = clickables.find(el => {
            const text = (el.innerText || el.textContent || '').toLowerCase().trim();
            return text === 'dismiss' && el.offsetParent !== null;
        });

        if (dismissBtn) {
            console.log("⚠️ [Google Flow] Clicking Dismiss to close dialog...");
            dismissBtn.click();
            await delay(1000);
        }

        return true;
    };

    // Set 9:16 aspect ratio (for Shorts)
    const setAspectRatio = async () => {
        console.log("📐 [Google Flow] Looking for aspect ratio settings...");

        // Look for Settings button (tune icon)
        const settingsBtn = Array.from(document.querySelectorAll('button')).find(b =>
            (b.innerText || '').includes('Settings') ||
            (b.innerText || '').toLowerCase().includes('tune') ||
            b.querySelector('svg[class*="tune"]')
        );

        if (!settingsBtn) {
            console.warn("⚠️ [Google Flow] Settings button not found, trying direct ratio buttons...");

            // Try finding direct ratio buttons
            const ratioButtons = Array.from(document.querySelectorAll('button, [role="button"]'));
            const ratio916 = ratioButtons.find(el =>
                (el.innerText || el.getAttribute('aria-label') || '').includes('9:16') ||
                (el.innerText || el.getAttribute('aria-label') || '').toLowerCase().includes('portrait')
            );

            if (ratio916) {
                console.log("📐 [Google Flow] Found direct 9:16 button, selecting...");
                ratio916.click();
                await delay(500);
                return true;
            }

            console.warn("⚠️ [Google Flow] Aspect ratio selector not found");
            return false;
        }

        console.log("⚙️ [Google Flow] Found Settings button, clicking...");
        settingsBtn.click();
        await delay(1000);

        // Look for 9:16 option
        const ratioOptions = Array.from(document.querySelectorAll('button, [role="option"], [role="menuitem"]'));
        const ratio916 = ratioOptions.find(el =>
            (el.innerText || '').includes('9:16') || (el.innerText || '').includes('Portrait')
        );

        if (ratio916) {
            console.log("📐 [Google Flow] Found 9:16 option, selecting...");
            ratio916.click();
            await delay(500);

            // Close settings if open
            const closeBtn = document.querySelector('[aria-label="Close"], button:has(.close)');
            if (closeBtn) closeBtn.click();
            return true;
        }

        console.warn("⚠️ [Google Flow] 9:16 option not found in settings");
        return false;
    };

    // Set Quantity to x1 (save quota)
    const setQuantityX1 = async () => {
        console.log("🔢 [Google Flow] Setting quantity to x1...");
        const qtyBtn = Array.from(document.querySelectorAll('button')).find(b =>
            b.innerText && b.innerText.includes('x2')
        );

        if (qtyBtn) {
            console.log('🔢 [Google Flow] Changing quantity from x2 to x1...');
            qtyBtn.click();
            await delay(500);

            // After clicking, a dropdown appears; select x1
            const x1Option = Array.from(document.querySelectorAll('button')).find(b =>
                b.innerText && b.innerText.trim() === 'x1'
            );
            if (x1Option) {
                x1Option.click();
                await delay(500);
            }
        }
    };

    // Inject prompt into textarea
    const injectPrompt = (prompt) => {
        console.log("📝 [Google Flow] Injecting prompt...");

        // Find the prompt textarea with multiple fallback strategies
        let textarea = document.querySelector('textarea[placeholder*="video"]') ||
            document.querySelector('textarea[placeholder*="Generate"]') ||
            document.querySelector('textarea[placeholder*="describe"]') ||
            document.querySelector('textarea[placeholder*="prompt"]') ||
            document.querySelector('textarea');

        if (textarea) {
            textarea.focus();
            textarea.value = prompt;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            textarea.dispatchEvent(new Event('change', { bubbles: true }));
            console.log("✅ [Google Flow] Prompt injected:", prompt.substring(0, 50) + "...");

            // Relay success to React
            try {
                chrome.runtime.sendMessage({
                    action: 'relayAnalyticsLog',
                    message: '✅ [Google Flow] Prompt injected successfully'
                });
            } catch (e) { /* ignore */ }

            return true;
        }

        console.warn("⚠️ [Google Flow] Textarea not found");
        return false;
    };

    // Click Create button to start generation
    // Based on snapshot: content_flow_complete.js line 7646-7664
    const clickCreate = () => {
        console.log("🚀 [Google Flow] Looking for Create/Submit button...");

        let createBtn = null;
        const buttons = Array.from(document.querySelectorAll('button'));

        // Strategy 0: Snapshot method - class name + text match (most reliable)
        createBtn = buttons.find(b =>
            b.innerText?.includes('Create') ||
            b.className?.includes('sc-408537d4')  // Google Flow specific class from snapshot
        );

        if (createBtn) {
            console.log("✅ [Google Flow] Found Create button (snapshot method), clicking...");
            createBtn.click();
            hasClickedCreate = true;
            return true;
        }

        // Strategy 1: Find the blue arrow submit button (most common in SceneBuilder)
        // This is typically a circular button with an arrow icon at bottom-right of textarea
        createBtn = buttons.find(b => {
            const hasSvg = b.querySelector('svg');
            const isSmallRound = b.offsetWidth < 80 && b.offsetWidth > 20;
            const isVisible = b.offsetParent !== null;
            const notDisabled = !b.disabled;

            // Check aria-label for submit/send patterns
            const ariaLabel = (b.getAttribute('aria-label') || '').toLowerCase();
            const hasSubmitLabel = ariaLabel.includes('submit') || ariaLabel.includes('send') ||
                ariaLabel.includes('create') || ariaLabel.includes('generate');

            return (hasSvg || hasSubmitLabel) && isVisible && notDisabled && isSmallRound;
        });

        if (createBtn) {
            console.log("✅ [Google Flow] Found arrow/submit button (Strategy 1), clicking...");
            createBtn.click();
            hasClickedCreate = true;
            return true;
        }

        // Strategy 2: Find button with "Create" or "Generate" text
        createBtn = buttons.find(b => {
            const text = (b.innerText || '').toLowerCase().trim();
            const isCreateButton = text === 'create' || text.includes('generate');
            const isVisible = b.offsetParent !== null;
            const notDisabled = !b.disabled;
            return isCreateButton && isVisible && notDisabled;
        });

        if (createBtn) {
            console.log("✅ [Google Flow] Found Create button (Strategy 2), clicking...");
            createBtn.click();
            hasClickedCreate = true;
            return true;
        }

        // Strategy 3: Look for any button near textarea with SVG icon
        const textarea = document.querySelector('textarea');
        if (textarea) {
            // Traverse up to find container and look for nearby buttons
            let container = textarea.parentElement;
            for (let i = 0; i < 5 && container; i++) {
                const btns = container.querySelectorAll('button');
                const submitBtn = Array.from(btns).find(b => {
                    const hasSvg = b.querySelector('svg');
                    const isVisible = b.offsetParent !== null;
                    return hasSvg && isVisible && !b.disabled;
                });
                if (submitBtn) {
                    console.log("✅ [Google Flow] Found submit button near textarea (Strategy 3), clicking...");
                    submitBtn.click();
                    hasClickedCreate = true;
                    return true;
                }
                container = container.parentElement;
            }
        }

        // Strategy 4: Look for button with arrow/chevron in innerHTML
        createBtn = buttons.find(b => {
            const html = b.innerHTML.toLowerCase();
            const hasArrow = html.includes('arrow') || html.includes('chevron') ||
                html.includes('send') || html.includes('m12') || html.includes('path');
            return hasArrow && b.offsetParent !== null && !b.disabled;
        });

        if (createBtn) {
            console.log("✅ [Google Flow] Found arrow button (Strategy 4), clicking...");
            createBtn.click();
            hasClickedCreate = true;
            return true;
        }

        // Strategy 4: Look for any visible button with common generate patterns
        if (!createBtn) {
            const allClickables = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="submit"]'));
            createBtn = allClickables.find(el => {
                const text = (el.innerText || el.value || '').toLowerCase().trim();
                const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
                const isGenerate = text.includes('create') || text.includes('generate') ||
                    ariaLabel.includes('create') || ariaLabel.includes('generate') ||
                    ariaLabel.includes('submit') || ariaLabel.includes('send');
                return isGenerate && el.offsetParent !== null && !el.disabled;
            });
        }

        if (createBtn) {
            console.log("✅ [Google Flow] Found Create button (Strategy 4), clicking...");
            createBtn.click();
            hasClickedCreate = true;
            return true;
        }

        // Log visible buttons for debugging
        const visibleBtns = Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent !== null);
        console.log("🔍 [Google Flow] Visible buttons:", visibleBtns.map(b => `"${(b.innerText || '').trim().substring(0, 30)}"`).join(', '));

        console.warn("⚠️ [Google Flow] Create button not found");
        return false;
    };

    // Monitor for generated video
    const monitorVideoResult = () => {
        console.log("🎥 [Google Flow] Monitoring for video result...");

        try {
            chrome.runtime.sendMessage({
                action: 'relayGoogleVidsStatus',
                status: 'Generating',
                message: 'Monitoring for video...'
            });
        } catch (e) { /* ignore */ }

        const startTime = Date.now();
        const timeout = 5 * 60 * 1000; // 5 minutes

        const checkInterval = setInterval(async () => {
            const elapsed = Date.now() - startTime;

            // Timeout check
            if (elapsed > timeout) {
                clearInterval(checkInterval);
                console.warn("⏱️ [Google Flow] Video generation timeout after 5 minutes");
                return;
            }

            // Error detection
            const pageText = (document.body.innerText || '').toLowerCase();
            if ((pageText.includes('error') && pageText.includes('try again')) ||
                pageText.includes('failed') ||
                pageText.includes('quota exceeded') ||
                pageText.includes('unable to generate') ||
                pageText.includes('something went wrong')) {

                console.error("❌ [Google Flow] Generation Failed: Error detected on page.");
                clearInterval(checkInterval);

                try {
                    chrome.runtime.sendMessage({
                        action: 'relayAnalyticsLog',
                        message: '❌ [Google Flow] Generation FAILED - Error detected'
                    });
                } catch (e) { /* ignore */ }

                return;
            }

            // Progress detection
            const progressMatch = pageText.match(/(\d+)%/);
            if (progressMatch) {
                const progress = progressMatch[1];
                console.log(`⏳ [Google Flow] Progress: ${progress}%`);
                try {
                    chrome.runtime.sendMessage({
                        action: 'relayGoogleVidsStatus',
                        status: 'Generating',
                        message: `Generating ${progress}%`
                    });
                } catch (e) { /* ignore */ }
            }

            // Video detection - Based on snapshot content_flow_complete.js
            const videos = document.querySelectorAll('video');

            // Debug: Log video status periodically
            if (videos.length > 0 && elapsed % 15000 < 3000) {
                console.log(`🔍 [Google Flow] Videos found: ${videos.length}`);
                videos.forEach((v, i) => {
                    console.log(`  Video ${i}: src=${(v.src || v.currentSrc || '').substring(0, 60)}...`);
                });
            }

            for (const video of videos) {
                const src = video.src || video.currentSrc || '';

                // For HTTP URLs: Accept immediately (don't wait for video to load)
                // For blob URLs: Need to check readyState
                const isHttpUrl = src.startsWith('http');
                const isBlobUrl = src.startsWith('blob:');
                const isValidBlob = isBlobUrl && video.readyState >= 1 &&
                    video.duration > 0 && video.duration !== Infinity;

                if (isHttpUrl || isValidBlob) {
                    console.log("🎉 [Google Flow] Video found!", src.substring(0, 60));
                    clearInterval(checkInterval);

                    // Relay success to React
                    try {
                        chrome.runtime.sendMessage({
                            action: 'relayAnalyticsLog',
                            message: '🎉 [Google Flow] Video generated successfully!'
                        });
                    } catch (e) { /* ignore */ }

                    // Get upload data from storage
                    chrome.storage.local.get(['googleVidsRequest'], async (result) => {
                        const uploadData = result.googleVidsRequest?.uploadData || {};
                        const urlParams = new URLSearchParams(window.location.search);
                        const prompt = urlParams.get('prompt') || '';

                        if (isBlobUrl) {
                            // Blob URL: Fetch and convert to base64
                            try {
                                const response = await fetch(src);
                                const blob = await response.blob();
                                const videoId = uploadData.videoIndex || 'googleflow_' + Date.now();

                                const reader = new FileReader();
                                reader.onloadend = () => {
                                    const base64 = reader.result;
                                    console.log("📤 [Google Flow] Sending blob video to Background...");

                                    const videoDataObj = {
                                        id: videoId,
                                        videoData: base64,
                                        title: uploadData.title || 'Google Flow Video',
                                        description: uploadData.description || decodeURIComponent(prompt),
                                        tags: uploadData.tags || '',
                                        fileName: 'google_flow_video.mp4',
                                        scheduleDate: uploadData.scheduleDate || '',
                                        scheduleTime: uploadData.scheduleTime || '',
                                        scheduleTimeOnly: uploadData.scheduleTimeOnly || '',
                                        isShorts: true,
                                        pinnedComment: uploadData.pinnedComment || ''
                                    };

                                    // Store video data
                                    chrome.runtime.sendMessage({
                                        action: 'storeVideoData',
                                        data: videoDataObj
                                    }, (storeRes) => {
                                        console.log("📦 [Google Flow] Video stored:", storeRes);

                                        // Now force open YouTube Studio
                                        console.log("🚀 [Google Flow] Opening YouTube Studio...");
                                        chrome.runtime.sendMessage({
                                            action: 'forceOpenYouTubeStudio',
                                            videoId: videoId
                                        }, (openRes) => {
                                            console.log("✅ [Google Flow] YouTube Studio opened:", openRes);
                                            // 🆕 V2.1: Close tab after successful trigger to advance queue (same as HTTP URL case)
                                            setTimeout(() => {
                                                console.log("👋 [Google Flow] Task complete. Closing tab...");
                                                window.close();
                                            }, 2000);
                                        });
                                    });

                                    chrome.storage.local.remove('googleVidsRequest');
                                };
                                reader.readAsDataURL(blob);
                            } catch (e) {
                                console.error("❌ [Google Flow] Blob fetch error:", e);
                            }
                        } else {
                            // HTTP URL: Use new all-in-one googleFlowUpload action
                            console.log("📤 [Google Flow] Triggering all-in-one upload...");

                            chrome.runtime.sendMessage({
                                action: 'googleFlowUpload',
                                videoUrl: src,
                                uploadData: {
                                    id: uploadData.videoIndex || 'googleflow_' + Date.now(),
                                    title: uploadData.title || 'Google Flow Video',
                                    description: uploadData.description || decodeURIComponent(prompt),
                                    tags: uploadData.tags || '',
                                    scheduleDate: uploadData.scheduleDate || '',
                                    scheduleTime: uploadData.scheduleTime || '',
                                    scheduleTimeOnly: uploadData.scheduleTimeOnly || '',
                                    pinnedComment: uploadData.pinnedComment || ''
                                }
                            }, (res) => {
                                console.log("✅ [Google Flow] Upload triggered:", res);
                                // 🆕 V2.1: Close tab after successful trigger to advance queue
                                setTimeout(() => {
                                    console.log("👋 [Google Flow] Task complete. Closing tab...");
                                    window.close();
                                }, 2000);
                            });

                            chrome.storage.local.remove('googleVidsRequest');
                        }
                    });

                    break;
                }
            }
        }, 3000);
    };

    // Main automation execution
    const executeAutomation = async (prompt) => {
        if (hasClickedCreate) {
            console.log("🛑 [Google Flow] Already clicked Create. Skipping...");
            return;
        }

        console.log("🚀 [Google Flow] Starting automation with prompt:", prompt.substring(0, 50));

        // Step 0: Handle project dialog if present
        await handleProjectDialog();

        // Wait for page to stabilize
        await delay(2000);

        // Step 1: Try to set 9:16 aspect ratio
        await setAspectRatio();

        // Step 2: Set Quantity to x1
        await setQuantityX1();

        // Step 3: Inject prompt
        let promptInjected = injectPrompt(prompt);
        if (!promptInjected) {
            await delay(2000);
            promptInjected = injectPrompt(prompt);
        }

        // Step 4: Click Create after short delay
        await delay(1500);
        const createClicked = clickCreate();

        if (createClicked) {
            // Step 5: Monitor for result
            monitorVideoResult();
        } else {
            console.error("❌ [Google Flow] Failed to click Create button");
        }
    };

    // Main automation flow
    const runFlowAutomation = async () => {
        // First, check URL for prompt
        const promptFromURL = getPromptFromURL();

        if (promptFromURL) {
            console.log("📝 [Google Flow] Found prompt in URL:", promptFromURL.substring(0, 50));
            await executeAutomation(promptFromURL);
            return;
        }

        // Otherwise, check storage for pending request
        console.log("📝 [Google Flow] No prompt in URL. Checking storage...");

        chrome.storage.local.get(['googleVidsRequest'], (result) => {
            if (result.googleVidsRequest?.prompt) {
                console.log("📝 [Google Flow] Found prompt in storage!");
                executeAutomation(result.googleVidsRequest.prompt);
            } else {
                console.log("📭 [Google Flow] No pending request. Standing by...");
            }
        });
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════════════════

    // Run automation after page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(runFlowAutomation, 2000));
    } else {
        setTimeout(runFlowAutomation, 2000);
    }

    // Export for debugging
    window.GoogleFlowAutoPilot = {
        run: runFlowAutomation,
        executeAutomation,
        handleProjectDialog,
        setAspectRatio,
        injectPrompt,
        clickCreate,
        monitorVideoResult
    };

    console.log("✅ [Google Flow AutoPilot] Module initialized!");

})();
