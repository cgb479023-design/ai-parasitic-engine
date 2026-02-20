// ═══════════════════════════════════════════════════════════════════════════
// 📅 SCHEDULER MODULE
// ═══════════════════════════════════════════════════════════════════════════

// Helper sleep function if not globally available
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function handleScheduledPublish({ itemId, videoData, url }) {
    console.log(`📅 [Scheduler] Starting scheduled publish for ${itemId}`);

    try {
        // 1. Validate video data
        if (!videoData) {
            console.error(`❌ [Scheduler] No video data for ${itemId}`);
            throw new Error('Video data not found');
        }

        // 2. Store video data if not already stored (Migrate to chrome.storage.local)
        chrome.storage.local.get([`videoData_${itemId}`], (result) => {
            if (!result[`videoData_${itemId}`]) {
                console.log(`💾 [Scheduler] Storing video data for ${itemId} (chrome.storage.local)`);
                chrome.storage.local.set({ [`videoData_${itemId}`]: videoData });
            }
        });

        // 3. Open YouTube Studio upload page
        console.log(`🌐 [Scheduler] Opening YouTube Studio: ${url}`);
        const tab = await TabManager.create({
            url: url,
            active: true,
            purpose: 'scheduled_upload'
        });

        // 4. Wait for page to load
        await sleep(5000); // 5 seconds for initial load

        // 5. Send video data to the upload page
        console.log(`📤 [Scheduler] Sending video data to upload page`);
        chrome.tabs.sendMessage(tab.id, {
            action: 'UPLOAD_VIDEO',
            data: {
                ...videoData,
                itemId: itemId,
                isScheduled: true
            }
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('❌ [Scheduler] Failed to send video data:', chrome.runtime.lastError);
            } else {
                console.log('✅ [Scheduler] Video data sent to upload page');
            }
        });

        console.log(`📅 [Scheduler] Scheduled publish initiated for ${itemId}`);
        return { tabId: tab.id, status: 'uploading' };
    } catch (error) {
        console.error('❌ [Scheduler] Scheduled publish failed:', error);
        // Notify React component of failure
        self.clients.matchAll().then(clients => {
            clients.forEach(client => client.postMessage({
                type: 'SCHEDULED_PUBLISH_FAILED',
                payload: { itemId, error: error.message }
            }));
        });
        throw error;
    }
}
