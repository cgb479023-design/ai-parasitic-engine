/**
 * Google Vids Workflow Module
 * 
 * Handles automation for Google Vids (docs.google.com/videos) video generation.
 * Extracted from content.js for better modularity and maintainability.
 * 
 * @module platforms/googleVids/workflow
 * @version 1.0.0
 * @date 2026-01-05
 * 
 * Dependencies:
 * - core/constants.js (EXT_CONSTANTS)
 * - platforms/googleVids/promptSanitizer.js (sanitizePromptForGoogleVids)
 */

(function () {
    'use strict';

    // Helper functions for enhanced logging and monitoring
    const logWorkflowStage = (stage, details) => {
        const timestamp = new Date().toISOString();
        console.log(`📋 [Google Vids Workflow] [${timestamp}] ${stage}`, details ? `| ${JSON.stringify(details)}` : '');
    };

    const logPerformanceMetric = (metric, value, context) => {
        console.log(`📊 [Google Vids Workflow] ${metric}: ${value}ms`, context ? `| ${JSON.stringify(context)}` : '');
    };

    const logError = (message, error, context) => {
        console.error(`❌ [Google Vids Workflow] ${message}:`, error, context ? `| ${JSON.stringify(context)}` : '');
    };

    // Only run on Google Vids pages
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    const workflowStartTime = Date.now();

    logWorkflowStage('MODULE_INITIALIZATION', { hostname, pathname, workflowStartTime });

    if (!hostname.includes('docs.google.com') || !pathname.includes('/videos')) {
        console.log("🚫 [Google Vids Workflow] Not on Google Vids page, skipping initialization");
        return;
    }

    logWorkflowStage('MODULE_LOADED', { workflowStartTime });

    // ═══════════════════════════════════════════════════════════════════════════
    // HELPER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Finds the prompt input element with multiple strategies
     */
    async function findPromptInput() {
        const selectors = [
            // Primary: Google Vids specific selectors
            'textarea.javascriptMaterialdesignGm3WizTextFieldOutlined-text-field__input',
            'textarea[aria-label*="Describe"]',
            'textarea[placeholder*="Describe"]',
            'textarea[placeholder*="video"]',
            // Secondary: Generic selectors
            'textarea[placeholder*="prompt"]',
            '.prompt-input textarea',
            '[data-testid="prompt-input"]',
            // Fallback: Any visible textarea in the AI panel
            '.videoGenCreationView textarea',
            '[class*="videoGen"] textarea',
            // Last resort: First visible textarea
            'textarea'
        ];

        const startTime = Date.now();
        logWorkflowStage('FIND_PROMPT_INPUT_START', { startTime, selectorCount: selectors.length });
        let foundTextareas = 0;

        for (let i = 0; i < 20; i++) {
            const attemptStartTime = Date.now();
            
            for (const sel of selectors) {
                try {
                    const el = document.querySelector(sel);
                    if (el && el.offsetParent !== null) {
                        const duration = Date.now() - startTime;
                        logWorkflowStage('PROMPT_INPUT_FOUND', { selector: sel, attempt: i + 1, duration });
                        logPerformanceMetric('findPromptInput', duration, { success: true, selector: sel });
                        return el;
                    }
                } catch (e) {
                    logError(`Invalid selector: ${sel}`, e, { attempt: i + 1 });
                }
            }

            // Debug every 2 seconds
            if (i % 4 === 0) {
                const allTextareas = document.querySelectorAll('textarea');
                foundTextareas = allTextareas.length;
                logWorkflowStage('PROMPT_INPUT_SEARCH_PROGRESS', { 
                    attempt: i + 1, 
                    totalAttempts: 20, 
                    foundTextareas, 
                    elapsedSeconds: Math.round((Date.now() - startTime) / 1000) 
                });
            }

            await new Promise(r => setTimeout(r, 500));
        }

        const duration = Date.now() - startTime;
        logWorkflowStage('PROMPT_INPUT_NOT_FOUND', { duration, foundTextareas, totalAttempts: 20 });
        logPerformanceMetric('findPromptInput', duration, { success: false });
        logError("Prompt input not found after 10 seconds!", null, { foundTextareas });
        return null;
    }

    /**
     * Sets the aspect ratio
     */
    async function setAspectRatio(targetRatio) {
        const startTime = Date.now();
        logWorkflowStage('SET_ASPECT_RATIO_START', { targetRatio, startTime });
        
        const buttons = document.querySelectorAll('button, [role="button"]');
        logWorkflowStage('SET_ASPECT_RATIO_BUTTONS_FOUND', { buttonCount: buttons.length, targetRatio });
        
        for (const btn of buttons) {
            const text = btn.textContent || btn.getAttribute('aria-label') || '';
            const btnText = text.trim();
            
            if (btnText.includes(targetRatio) || btnText.includes(targetRatio.replace(':', '×'))) {
                btn.click();
                const duration = Date.now() - startTime;
                logWorkflowStage('ASPECT_RATIO_SET', { targetRatio, buttonText: btnText, duration });
                logPerformanceMetric('setAspectRatio', duration, { success: true, targetRatio });
                return true;
            }
        }
        
        const duration = Date.now() - startTime;
        logWorkflowStage('ASPECT_RATIO_SET_FAILED', { targetRatio, buttonCount: buttons.length, duration });
        logPerformanceMetric('setAspectRatio', duration, { success: false, targetRatio });
        console.warn("⚠️ [Google Vids Workflow] Aspect ratio selector not found");
        return false;
    }

    /**
     * Finds the Generate button
     */
    async function findGenerateButton() {
        const startTime = Date.now();
        logWorkflowStage('FIND_GENERATE_BUTTON_START', { startTime });
        
        const buttons = document.querySelectorAll('button, [role="button"]');
        logWorkflowStage('FIND_GENERATE_BUTTON_BUTTONS_FOUND', { buttonCount: buttons.length });
        
        // First pass - exact "Generate" text
        logWorkflowStage('FIND_GENERATE_BUTTON_EXACT_MATCH');
        for (const btn of buttons) {
            const text = (btn.textContent || '').trim();
            if (text === 'Generate' && btn.offsetParent !== null && !btn.disabled) {
                const duration = Date.now() - startTime;
                logWorkflowStage('GENERATE_BUTTON_FOUND_EXACT', { buttonText: text, duration });
                logPerformanceMetric('findGenerateButton', duration, { success: true, matchType: 'exact' });
                return btn;
            }
        }

        // Second pass - contains generate
        logWorkflowStage('FIND_GENERATE_BUTTON_CONTAINS_MATCH');
        for (const btn of buttons) {
            const text = (btn.textContent || '').toLowerCase();
            const label = (btn.getAttribute('aria-label') || '').toLowerCase();
            if (text.trim() === 'veo' || text.trim() === 'veo 3.1') continue;

            if ((text.includes('generate') || label.includes('generate'))
                && btn.offsetParent !== null && !btn.disabled) {
                const duration = Date.now() - startTime;
                logWorkflowStage('GENERATE_BUTTON_FOUND_CONTAINS', { 
                    buttonText: btn.textContent?.trim(), 
                    ariaLabel: label, 
                    duration 
                });
                logPerformanceMetric('findGenerateButton', duration, { success: true, matchType: 'contains' });
                return btn;
            }
        }

        const duration = Date.now() - startTime;
        logWorkflowStage('GENERATE_BUTTON_NOT_FOUND', { duration, buttonCount: buttons.length });
        logPerformanceMetric('findGenerateButton', duration, { success: false });
        console.warn("⚠️ [Google Vids Workflow] Generate button not found");
        return null;
    }

    /**
     * Waits for video generation to complete
     * Monitors progress and detects when a NEW video appears (not pre-existing)
     */
    async function waitForVideoGeneration(timeout = 300000, preExistingVideoSrcs = [], videoIndex = null) {
        const startTime = Date.now();
        const checkInterval = 5000;
        let generationStarted = false;
        let lastProgressPercent = 0;
        
        logWorkflowStage('WAIT_FOR_VIDEO_GENERATION_START', { 
            timeout, 
            preExistingVideoSrcCount: preExistingVideoSrcs.length, 
            videoIndex, 
            startTime 
        });

        // Wait 10 seconds for generation to start
        logWorkflowStage('WAIT_FOR_GENERATION_INITIAL_DELAY', { delaySeconds: 10 });
        await new Promise(r => setTimeout(r, 10000));

        while (Date.now() - startTime < timeout) {
            const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
            const elapsedTime = Date.now() - startTime;
            const pageText = document.body.innerText || '';
            
            logWorkflowStage('VIDEO_GENERATION_CHECK', { 
                elapsedSeconds, 
                remainingSeconds: Math.round((timeout - elapsedTime) / 1000) 
            });

            const hasGeneratingText = pageText.includes('Generating') ||
                pageText.includes('Creating') ||
                pageText.includes('Processing') ||
                pageText.includes('%');

            if (hasGeneratingText && !generationStarted) {
                logWorkflowStage('GENERATION_STARTED', { elapsedSeconds });
                generationStarted = true;

                // Report status to background
                chrome.runtime.sendMessage({
                    action: 'relayGoogleVidsStatus',
                    status: 'Generating',
                    message: 'Generation started...',
                    videoIndex: videoIndex
                });
            }

            // Check for errors
            const errorText = pageText.toLowerCase();
            if (errorText.includes('something went wrong') ||
                errorText.includes('try again') ||
                errorText.includes('unexpected error')) {
                logWorkflowStage('GENERATION_ERROR_DETECTED', { errorText: errorText.substring(0, 100) + '...' });
                return { success: false, error: 'Generation failed', shouldRetry: true };
            }

            if (!generationStarted) {
                logWorkflowStage('WAITING_FOR_GENERATION_TO_START', { elapsedSeconds });
                await new Promise(r => setTimeout(r, checkInterval));
                continue;
            }

            // Check progress percentage
            const percentMatch = pageText.match(/(\d+)%/);
            const currentPercent = percentMatch ? parseInt(percentMatch[1]) : 0;

            if (hasGeneratingText && currentPercent < 100) {
                if (currentPercent > lastProgressPercent) {
                    lastProgressPercent = currentPercent;
                    const statusMsg = `Generating ${currentPercent}%`;
                    logWorkflowStage('GENERATION_PROGRESS_UPDATE', { 
                        percent: currentPercent, 
                        elapsedSeconds 
                    });
                    
                    // Report status to background
                    chrome.runtime.sendMessage({
                        action: 'relayGoogleVidsStatus',
                        status: 'Generating',
                        message: statusMsg,
                        videoIndex: videoIndex
                    });
                }
                await new Promise(r => setTimeout(r, checkInterval));
                continue;
            }

            // 100% reached
            if (currentPercent === 100) {
                logWorkflowStage('GENERATION_REACHED_100_PERCENT', { elapsedSeconds });
                await new Promise(r => setTimeout(r, 3000));
            }

            logWorkflowStage('GENERATION_COMPLETE_SCANNING_FOR_VIDEO', { elapsedSeconds });

            // 🔧 SNAPSHOT PROVEN: Actively scan for NEW video elements
            const videoSelectors = [
                'video[src]:not([src=""])',
                'video source[src]',
                'video',
                '[class*="video-player"] video',
                '[class*="preview"] video',
                '.timeline video',
                '[data-testid*="video"]'
            ];

            let allVideos = [];
            for (const selector of videoSelectors) {
                const found = document.querySelectorAll(selector);
                allVideos.push(...found);
            }
            // Remove duplicates
            allVideos = [...new Set(allVideos)];

            logWorkflowStage('VIDEO_ELEMENTS_FOUND', { totalVideos: allVideos.length });

            for (const video of allVideos) {
                const videoUrl = video.src || video.querySelector?.('source')?.src || video.currentSrc;
                const videoRect = video.getBoundingClientRect?.();
                
                // Skip if no valid URL
                if (!videoUrl || videoUrl.includes('placeholder') || videoUrl === '') {
                    logWorkflowStage('VIDEO_SKIPPED_NO_VALID_URL', { videoUrl: videoUrl || 'empty' });
                    continue;
                }

                logWorkflowStage('VIDEO_CANDIDATE_FOUND', { 
                    videoUrl: videoUrl.substring(0, 60) + '...', 
                    duration: video.duration,
                    readyState: video.readyState,
                    position: videoRect ? { left: videoRect.left, top: videoRect.top } : null
                });

                // 🔧 CRITICAL: Skip pre-existing videos
                if (preExistingVideoSrcs.some(src => videoUrl.includes(src) || src.includes(videoUrl))) {
                    logWorkflowStage('VIDEO_SKIPPED_PRE_EXISTING', { videoUrl: videoUrl.substring(0, 40) + '...' });
                    continue;
                }

                // 🔧 SNAPSHOT PROVEN: Skip sidebar sample videos (right side of screen)
                if (videoRect && videoRect.left > window.innerWidth * 0.6) {
                    logWorkflowStage('VIDEO_SKIPPED_SIDEBAR', { 
                        leftPosition: videoRect.left, 
                        windowWidth: window.innerWidth 
                    });
                    continue;
                }

                // Check if video has valid duration (actually generated)
                if (video.duration && video.duration > 0 && !isNaN(video.duration)) {
                    const duration = Date.now() - startTime;
                    logWorkflowStage('NEW_VIDEO_FOUND_VALID_DURATION', { 
                        duration: video.duration,
                        videoUrl: videoUrl.substring(0, 80) + '...',
                        totalGenerationTime: duration
                    });
                    logPerformanceMetric('waitForVideoGeneration', duration, { success: true });
                    return { success: true, videoUrl };
                }

                // Fallback: If readyState is high enough, accept even with NaN duration
                if (video.readyState >= 2) {
                    const duration = Date.now() - startTime;
                    logWorkflowStage('NEW_VIDEO_FOUND_READY_STATE', { 
                        readyState: video.readyState,
                        videoUrl: videoUrl.substring(0, 80) + '...',
                        totalGenerationTime: duration
                    });
                    logPerformanceMetric('waitForVideoGeneration', duration, { success: true });
                    return { success: true, videoUrl };
                }
            }

            // Check for download link
            const downloadLink = document.querySelector('a[download], a[href*="download"]');
            if (downloadLink?.href && !preExistingVideoSrcs.includes(downloadLink.href)) {
                const duration = Date.now() - startTime;
                logWorkflowStage('DOWNLOAD_LINK_FOUND', { 
                    downloadUrl: downloadLink.href.substring(0, 80) + '...',
                    totalGenerationTime: duration
                });
                logPerformanceMetric('waitForVideoGeneration', duration, { success: true });
                return { success: true, videoUrl: downloadLink.href };
            }

            // Check timeline for duration (fallback)
            const timePatterns = [
                /(\d{2}:\d{2}\.\d)\s*\/\s*(\d{2}:\d{2}\.\d)/,
                /(\d{2}:\d{2}:\d{2})\s*\/\s*(\d{2}:\d{2}:\d{2})/,
                /(\d:\d{2})\s*\/\s*(\d:\d{2})/,
                /(\d{1,2}:\d{2})\s*\/\s*(\d{1,2}:\d{2})/,
            ];

            for (const pattern of timePatterns) {
                const match = pageText.match(pattern);
                if (match) {
                    const [_, current, total] = match;
                    if (total && total !== '00:00.0' && total !== '0:00') {
                        logWorkflowStage('TIMELINE_DURATION_FOUND', { totalDuration: total });

                        // 🆕 V3.5: If timeline shows duration, force-accept any visible video
                        // This fixes the issue where video element has NaN duration but is actually ready
                        const anyVideo = document.querySelector('video[src], video');
                        if (anyVideo) {
                            const videoSrc = anyVideo.src || anyVideo.currentSrc || anyVideo.querySelector('source')?.src;
                            if (videoSrc && !videoSrc.includes('placeholder')) {
                                const duration = Date.now() - startTime;
                                logWorkflowStage('VIDEO_FORCE_ACCEPTED_TIMELINE', { 
                                    videoUrl: videoSrc.substring(0, 60) + '...',
                                    totalDuration: total,
                                    totalGenerationTime: duration
                                });
                                logPerformanceMetric('waitForVideoGeneration', duration, { success: true });
                                return { success: true, videoUrl: videoSrc };
                            }
                        }

                        // 🆕 V3.5: Even without video src, if timeline shows duration, mark as needing file download
                        logWorkflowStage('TIMELINE_VALID_NO_VIDEO_SRC', { totalDuration: total });
                    }
                }
            }


            // Check for download button
            logWorkflowStage('CHECKING_FOR_DOWNLOAD_BUTTON');
            const downloadBtns = [...document.querySelectorAll('button, [role="button"]')]
                .filter(el => el.textContent?.toLowerCase().includes('download'));
            
            if (downloadBtns.length > 0) {
                const duration = Date.now() - startTime;
                logWorkflowStage('DOWNLOAD_BUTTON_FOUND', { 
                    buttonCount: downloadBtns.length,
                    buttonText: downloadBtns[0].textContent?.trim(),
                    totalGenerationTime: duration
                });
                logPerformanceMetric('waitForVideoGeneration', duration, { success: true });
                return { success: true, videoUrl: 'DOWNLOAD_BUTTON_FOUND', downloadButton: downloadBtns[0] };
            }

            logWorkflowStage('VIDEO_NOT_FOUND_CONTINUING', { checkInterval });
            await new Promise(r => setTimeout(r, checkInterval));
        }

        const duration = Date.now() - startTime;
        logWorkflowStage('VIDEO_GENERATION_TIMED_OUT', { totalDuration: duration });
        logPerformanceMetric('waitForVideoGeneration', duration, { success: false });
        return { success: false, error: 'Generation timed out' };
    }

    /**
     * Clicks a button with comprehensive event dispatch
     */
    async function clickButton(btn) {
        btn.scrollIntoView({ behavior: 'instant', block: 'center' });
        await new Promise(r => setTimeout(r, 300));
        btn.focus();
        btn.click();

        // Mouse events
        ['mousedown', 'mouseup', 'click'].forEach(eventType => {
            btn.dispatchEvent(new MouseEvent(eventType, {
                view: window, bubbles: true, cancelable: true, buttons: 1
            }));
        });

        // Pointer events
        ['pointerdown', 'pointerup'].forEach(eventType => {
            btn.dispatchEvent(new PointerEvent(eventType, {
                view: window, bubbles: true, cancelable: true, isPrimary: true
            }));
        });

        // Enter key
        btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
        btn.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MAIN AUTOMATION FLOW
    // ═══════════════════════════════════════════════════════════════════════════

    const runGoogleVidsAutomation = async () => {
        const workflowStartTime = Date.now();
        logWorkflowStage('RUN_GOOGLE_VIDS_AUTOMATION_START', { workflowStartTime });
        
        try {
            // 1. Check for pending request from background
            logWorkflowStage('CHECK_PENDING_REQUEST');
            const response = await new Promise(resolve => {
                chrome.runtime.sendMessage({ action: 'getGoogleVidsRequest' }, resolve);
            });

            if (!response || !response.success || !response.data) {
                logWorkflowStage('NO_PENDING_REQUEST', { response });
                return;
            }

            const { prompt, aspectRatio, uploadData } = response.data;
            logWorkflowStage('REQUEST_FOUND', { 
                promptPreview: prompt?.substring(0, 50) + '...', 
                aspectRatio, 
                hasUploadData: !!uploadData 
            });

            // 2. Wait for UI to load
            logWorkflowStage('WAIT_FOR_UI_LOAD', { delayMs: 3000 });
            await new Promise(r => setTimeout(r, 3000));

            // 3. Click Portrait button for 9:16 if needed
            if (aspectRatio === '9:16') {
                logWorkflowStage('CHECK_PORTRAIT_BUTTON');
                const portraitBtn = [...document.querySelectorAll('button, [role="button"]')]
                    .find(b => (b.textContent || '').toLowerCase().includes('portrait'));
                if (portraitBtn) {
                    logWorkflowStage('CLICK_PORTRAIT_BUTTON');
                    portraitBtn.click();
                    await new Promise(r => setTimeout(r, 1000));
                }
            }

            // 4. Click Veo 3.1 button
            logWorkflowStage('LOOKING_FOR_VEO_BUTTON');
            const veoBtn = [...document.querySelectorAll('button, [role="button"]')]
                .find(b => (b.textContent || '').toLowerCase().includes('veo'));

            if (veoBtn) {
                logWorkflowStage('CLICK_VEO_BUTTON');
                await clickButton(veoBtn);
                await new Promise(r => setTimeout(r, 2000));
            }

            // 5. Find and fill prompt
            logWorkflowStage('FIND_PROMPT_INPUT');
            const promptInput = await findPromptInput();
            if (!promptInput) {
                logWorkflowStage('PROMPT_INPUT_NOT_FOUND');
                return;
            }

            logWorkflowStage('FILL_PROMPT');
            promptInput.focus();
            promptInput.value = '';

            // Sanitize prompt
            const sanitizedPrompt = window.sanitizePromptForGoogleVids?.(prompt) || prompt;
            logWorkflowStage('SANITIZE_PROMPT', { sanitized: sanitizedPrompt !== prompt });

            if (window.typeText) {
                await window.typeText(promptInput, sanitizedPrompt, 10);
            } else {
                promptInput.value = sanitizedPrompt;
                promptInput.dispatchEvent(new Event('input', { bubbles: true }));
                promptInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            logWorkflowStage('PROMPT_FILLED');

            // 6. Set aspect ratio
            logWorkflowStage('SET_ASPECT_RATIO', { aspectRatio: aspectRatio || '9:16' });
            await new Promise(r => setTimeout(r, 500));
            await setAspectRatio(aspectRatio || '9:16');

            // 7. Capture pre-existing videos
            logWorkflowStage('CAPTURE_PRE_EXISTING_VIDEOS');
            const preExistingVideoSrcs = [...document.querySelectorAll('video')]
                .map(v => v.src)
                .filter(s => s && s.length > 0);
            logWorkflowStage('PRE_EXISTING_VIDEOS_CAPTURED', { count: preExistingVideoSrcs.length });

            // 8. Click Generate button
            logWorkflowStage('FIND_GENERATE_BUTTON');
            await new Promise(r => setTimeout(r, 500));
            const generateBtn = await findGenerateButton();
            if (generateBtn) {
                logWorkflowStage('CLICK_GENERATE_BUTTON');
                await clickButton(generateBtn);
            } else {
                logWorkflowStage('GENERATE_BUTTON_NOT_FOUND');
                return;
            }

            // 9. Wait for video generation with retry logic
            logWorkflowStage('WAIT_FOR_VIDEO_GENERATION', { maxRetries: 10 });
            const MAX_RETRIES = 10;
            let videoData = null;
            let retryCount = 0;

            while (retryCount < MAX_RETRIES) {
                logWorkflowStage('VIDEO_GENERATION_ATTEMPT', { attempt: retryCount + 1, maxRetries: MAX_RETRIES });
                videoData = await waitForVideoGeneration(300000, preExistingVideoSrcs, uploadData?.videoIndex);

                if (videoData.success) {
                    logWorkflowStage('VIDEO_GENERATION_SUCCESS', { attempt: retryCount + 1 });
                    break;
                }

                if (videoData.shouldRetry) {
                    retryCount++;
                    logWorkflowStage('VIDEO_GENERATION_RETRY', { 
                        attempt: retryCount, 
                        maxRetries: MAX_RETRIES, 
                        error: videoData.error 
                    });

                    if (retryCount < MAX_RETRIES) {
                        const retryDelay = Math.min(5000 + retryCount * 2000, 15000);
                        logWorkflowStage('RETRY_DELAY', { delayMs: retryDelay });
                        await new Promise(r => setTimeout(r, retryDelay));

                        // 🔧 FIX: Look for BOTH "Try Again" AND "Generate" buttons
                        // Google Vids shows "Generate" button on error, not "Try Again"
                        const allButtons = [...document.querySelectorAll('button')];

                        // Priority 1: Try Again button
                        let retryBtn = allButtons.find(b =>
                            b.textContent?.toLowerCase().includes('try again'));

                        // Priority 2: Generate button (primary retry action)
                        if (!retryBtn) {
                            retryBtn = allButtons.find(b => {
                                const text = b.textContent?.toLowerCase() || '';
                                const isGenerate = text.includes('generate');
                                const isVisible = b.offsetParent !== null;
                                const isNotDisabled = !b.disabled;
                                return isGenerate && isVisible && isNotDisabled;
                            });
                        }

                        if (retryBtn) {
                            logWorkflowStage('CLICK_RETRY_BUTTON', { buttonText: retryBtn.textContent?.trim() });
                            retryBtn.click();
                            await new Promise(r => setTimeout(r, 3000));
                        } else {
                            logWorkflowStage('NO_RETRY_BUTTON_FOUND');
                        }
                    }
                } else {
                    break;
                }
            }

            if (!videoData || !videoData.success) {
                logWorkflowStage('VIDEO_GENERATION_FAILED', { videoData, retryCount });
                return;
            }

            // 10. Extract and send video
            console.log("✅ [Google Vids Workflow] Processing video for YouTube upload...");

            let videoUrl = null;

            // 🔧 CRITICAL FIX: USE the videoUrl returned by waitForVideoGeneration!
            if (videoData.videoUrl &&
                videoData.videoUrl !== 'VIDEO_GENERATED_USE_FILE_DOWNLOAD' &&
                videoData.videoUrl !== 'DOWNLOAD_BUTTON_FOUND') {

                videoUrl = videoData.videoUrl;
                console.log(`✅ [Google Vids Workflow] Using returned video URL: ${videoUrl.substring(0, 80)}...`);
            } else {
                // Fallback: Scan DOM for new video (EXCLUDE pre-existing videos)
                console.log(`🔍 [Google Vids Workflow] Returned URL is placeholder, scanning DOM for new video...`);

                const allVideos = [...document.querySelectorAll('video')];
                let targetVideo = null;
                let maxDuration = 0;

                console.log(`🔍 [Google Vids Workflow] Found ${allVideos.length} total videos, ${preExistingVideoSrcs.length} pre-existing`);

                for (const video of allVideos) {
                    const src = video.src || video.currentSrc;
                    if (!src) continue;

                    // 🔧 CRITICAL FIX: Skip pre-existing videos!
                    const isPreExisting = preExistingVideoSrcs.some(existingSrc =>
                        src === existingSrc || src.includes(existingSrc) || existingSrc.includes(src)
                    );

                    if (isPreExisting) {
                        console.log(`⏭️ [Google Vids Workflow] Skipping pre-existing video: ${src.substring(0, 50)}...`);
                        continue;
                    }

                    // 🔧 SNAPSHOT PROVEN: Skip sidebar videos
                    const rect = video.getBoundingClientRect();
                    if (rect && rect.left > window.innerWidth * 0.6) {
                        console.log(`⏭️ [Google Vids Workflow] Skipping sidebar video: left=${rect.left}`);
                        continue;
                    }

                    const isValidUrl = src.startsWith('http') || src.startsWith('blob:');
                    const isValid = isValidUrl && rect.width > 100 && rect.height > 100 && video.readyState >= 1;

                    console.log(`🔍 [Google Vids Workflow] Checking video: valid=${isValid}, duration=${video.duration}s, size=${rect.width}x${rect.height}`);

                    if (isValid && video.duration > maxDuration) {
                        targetVideo = video;
                        maxDuration = video.duration;
                        console.log(`✅ [Google Vids Workflow] New candidate video found! Duration: ${maxDuration}s`);
                    }
                }

                // 🔧 FALLBACK: If no new video found, try waiting a bit more
                if (!targetVideo) {
                    console.warn("⚠️ [Google Vids Workflow] No new video found yet, waiting 5 seconds...");
                    await new Promise(r => setTimeout(r, 5000));

                    // Retry with fresh scan
                    const retryVideos = [...document.querySelectorAll('video')];
                    for (const video of retryVideos) {
                        const src = video.src || video.currentSrc;
                        if (!src) continue;

                        const isPreExisting = preExistingVideoSrcs.some(existingSrc =>
                            src === existingSrc || src.includes(existingSrc) || existingSrc.includes(src)
                        );

                        if (isPreExisting) continue;

                        const rect = video.getBoundingClientRect();
                        if (rect && rect.left > window.innerWidth * 0.6) continue;

                        const isValid = (src.startsWith('http') || src.startsWith('blob:')) &&
                            rect.width > 100 && rect.height > 100;

                        if (isValid && video.duration > maxDuration) {
                            targetVideo = video;
                            maxDuration = video.duration;
                        }
                    }
                }

                if (targetVideo) {
                    videoUrl = targetVideo.src || targetVideo.currentSrc;
                    console.log(`✅ [Google Vids Workflow] Selected video from DOM (${maxDuration}s): ${videoUrl.substring(0, 80)}...`);
                }
            }

            if (videoUrl) {
                console.log(`✅ [Google Vids Workflow] Final video URL: ${videoUrl.substring(0, 80)}...`);

                // Handle blob URL
                if (videoUrl.startsWith('blob:')) {
                    try {
                        const response = await fetch(videoUrl);
                        const blob = await response.blob();
                        const videoBase64 = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.onerror = (e) => reject(e);
                            reader.readAsDataURL(blob);
                        });

                        console.log(`✅ [Google Vids Workflow] Converted to base64`);

                        // Send to background
                        chrome.runtime.sendMessage({
                            action: 'relayGoogleVidsComplete',
                            videoData: videoBase64,
                            videoUrl: null,
                            uploadData: {
                                id: uploadData?.videoIndex ?? uploadData?.id ?? 'googlevids_' + Date.now(),
                                title: uploadData?.title || 'Google Vids Video',
                                description: uploadData?.description || '',
                                tags: uploadData?.tags || '',
                                scheduleDate: uploadData?.scheduleDate || '',
                                scheduleTime: uploadData?.scheduleTime || '',
                                scheduleTimeOnly: uploadData?.scheduleTimeOnly || '',
                                isShorts: uploadData?.isShorts ?? true,
                                pinnedComment: uploadData?.pinnedComment || ''
                            }
                        });

                        console.log("✅ [Google Vids Workflow] Video sent to background! YouTube Studio will open...");

                        // 🆕 V1.1: Close tab after successful trigger to advance queue
                        setTimeout(() => {
                            console.log("👋 [Google Vids Workflow] Task complete. Closing tab...");
                            window.close();
                        }, 2000);
                        return;
                    } catch (e) {
                        console.error("❌ [Google Vids Workflow] Blob fetch failed:", e);
                    }
                } else {
                    // HTTP URL
                    chrome.runtime.sendMessage({
                        action: 'relayGoogleVidsComplete',
                        videoUrl: videoUrl,
                        uploadData: {
                            id: uploadData?.videoIndex ?? uploadData?.id ?? 'googlevids_' + Date.now(),
                            title: uploadData?.title || 'Google Vids Video',
                            description: uploadData?.description || '',
                            tags: uploadData?.tags || '',
                            scheduleDate: uploadData?.scheduleDate || '',
                            scheduleTime: uploadData?.scheduleTime || '',
                            scheduleTimeOnly: uploadData?.scheduleTimeOnly || '',
                            isShorts: uploadData?.isShorts ?? true,
                            pinnedComment: uploadData?.pinnedComment || ''
                        }
                    });

                    console.log("✅ [Google Vids Workflow] Video URL sent to background!");

                    // 🆕 V1.1: Close tab after successful trigger to advance queue
                    setTimeout(() => {
                        console.log("👋 [Google Vids Workflow] Task complete. Closing tab...");
                        window.close();
                    }, 2000);
                    return;
                }
            }

            console.warn("⚠️ [Google Vids Workflow] Video element not found, trying File > Download...");

        } catch (e) {
            console.error("❌ [Google Vids Workflow] Automation error:", e);
        }
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════════════════

    // Start automation after page loads
    setTimeout(runGoogleVidsAutomation, 5000);

    // Export for debugging
    window.GoogleVidsWorkflow = {
        run: runGoogleVidsAutomation,
        findPromptInput,
        findGenerateButton,
        setAspectRatio,
        waitForVideoGeneration
    };

    console.log("✅ [Google Vids Workflow] Module initialized!");

})();
