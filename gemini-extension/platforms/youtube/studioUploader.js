/**
 * YouTube Studio Uploader Module (Aetheria-Flow Optimized)
 * 
 * Handles automatic video upload to YouTube Studio by orchestrating 
 * concrete capabilities provided by the YouTubeDomCapability.
 * 
 * Pillar 2: Semantic Sandboxing - All DOM access is delegated to the Capability layer.
 */

(function () {
    'use strict';

    if (window.location.hostname !== 'studio.youtube.com') return;
    if (!window.location.href.includes('/upload')) return;

    console.log("📤 [Studio Uploader] Constitutional Uploader Initialized.");

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // 📡 EvoMap Self-Healing Hook
    const searchEvoMapForFix = async (query, errorMsg) => {
        console.warn(`[EvoMap] Attempting to find fix for: ${query}`);
        try {
            const response = await new Promise(resolve => {
                chrome.runtime.sendMessage({
                    action: "evomapSearch",
                    payload: { query, error: errorMsg }
                }, resolve);
            });
            return response?.solution || null;
        } catch (e) {
            console.error("[EvoMap] Search failed:", e.message);
            return null;
        }
    };

    const runYouTubeUpload = async (retryCount = 0) => {
        const capability = window.YouTubeDomCapability;
        if (!capability) {
            console.error("❌ [Studio Uploader] YouTubeDomCapability NOT FOUND.");
            return;
        }

        const urlParams = new URLSearchParams(window.location.search);
        const videoId = urlParams.get('gemini_id');

        const response = await new Promise(resolve => {
            chrome.runtime.sendMessage({ action: "getVideoData", videoId }, resolve);
        });

        if (!response?.success || !response?.data) return;
        const data = response.data;

        try {
            console.log(`🚀 [Studio Uploader] Starting Execution (Attempt ${retryCount + 1})`);

            // Convert Base64 to File...
            let base64String = data.videoData;
            if (base64String?.startsWith('data:')) base64String = base64String.split(',')[1];
            const byteCharacters = atob(base64String);
            const byteArray = new Uint8Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) byteArray[i] = byteCharacters.charCodeAt(i);
            const file = new File([new Blob([byteArray], { type: 'video/mp4' })], data.fileName || 'upload.mp4', { type: 'video/mp4' });

            // 1. Select File
            await capability.selectFile(file);

            // 2. Monitoring upload...
            let progress = 0;
            while (progress < 100) {
                progress = await capability.getUploadProgress();
                if (progress < 100) await delay(3000);
            }

            // 3. Enter Metadata
            await capability.enterTitle(data.title || '');
            await capability.enterDescription(data.description || '');
            await capability.setAudienceNotForKids();

            // 4. Scheduling
            if (data.scheduleDate && data.scheduleTime) {
                await capability.selectScheduleDate(data.scheduleDate);
                await capability.selectScheduleTime(data.scheduleTime);
            } else {
                await capability.setVisibility('UNLISTED');
            }

            // 5. Publish
            for (let i = 0; i < 3; i++) {
                await capability.clickNext();
                await delay(1500);
            }
            await capability.clickPublish();

            chrome.runtime.sendMessage({ action: "relayYouTubeUploadComplete", videoId: data.videoId || videoId, status: "completed" });
            console.log("✅ [Studio Uploader] Mission Accomplished.");

        } catch (e) {
            console.error("❌ [Studio Uploader] Execution Blockage:", e.message);

            if (retryCount < 2) {
                console.log("🛡️ [EvoMap] Resilience triggered. Calling support...");
                const fix = await searchEvoMapForFix('youtube studio upload selector', e.message);
                if (fix) {
                    console.log("💊 [EvoMap] Patch received. Applying hotfix...");
                    try {
                        // 1. Behavioral Patch: Function string that modifies the capability object
                        if (typeof fix === 'string' && fix.includes('function')) {
                            const patchFn = new Function('capability', fix);
                            patchFn(capability);
                        }
                        // 2. Structural Patch: Object describing selector overrides
                        else if (typeof fix === 'object' || fix.startsWith('{')) {
                            const patch = typeof fix === 'string' ? JSON.parse(fix) : fix;
                            if (patch.selectors && capability.selectors) {
                                Object.assign(capability.selectors, patch.selectors);
                            }
                        }
                        return runYouTubeUpload(retryCount + 1);
                    } catch (patchErr) {
                        console.error("❌ [EvoMap] Patch application failed:", patchErr.message);
                    }
                }
            }
            chrome.runtime.sendMessage({ action: "relayYouTubeUploadComplete", videoId: data.videoId || videoId, status: "failed", error: e.message });
        }
    };

    // Small delay to let Studio initialize
    setTimeout(runYouTubeUpload, 3000);

})();
