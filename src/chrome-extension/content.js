// src/chrome-extension/content.js
import { YouTubeDomAdapter } from '../services/capabilities/YouTubeDomAdapter';

const hand = YouTubeDomAdapter.getInstance();

console.log("🔌 [Content Script] DeadStar V8.0 Neural Link Established.");

chrome.runtime.onMessage.addListener((message) => {
    if (!message || !message.type) return;
    window.postMessage({ ...message, source: 'extension' }, '*');
});

/**
 * 🧠 Neural Link Receiver
 * Listens for intent signals from Brain (React) or Pacemaker (Background)
 */
window.addEventListener('message', async (event) => {
    // Security Filter: Process only internal brain/extension signals
    if (event.source !== window || !event.data.type || event.data.source === 'extension') return;

    const { type, payload, requestId } = event.data;

    try {
        switch (type) {
            case 'EXECUTE_UPLOAD_METADATA':
                console.log("⚡ [Nerve] Signal Received: Enter Metadata");
                await hand.enterMetadata(payload);
                window.postMessage({ type: 'METADATA_ENTERED_SUCCESS', requestId, source: 'extension' }, '*');
                chrome.runtime.sendMessage({ type: 'METADATA_ENTERED_SUCCESS', requestId });
                break;

            case 'EXECUTE_SCHEDULING':
                console.log(`⚡ [Nerve] Signal Received: Schedule for ${payload.date} @ ${payload.time}`);
                await hand.selectScheduleDate(payload.date);
                await hand.selectScheduleTime(payload.time);
                window.postMessage({ type: 'EXECUTE_SCHEDULING_RESULT', requestId, source: 'extension' }, '*');
                chrome.runtime.sendMessage({ type: 'EXECUTE_SCHEDULING_RESULT', requestId });
                break;

            case 'EXECUTE_PUBLISH_CLICK': {
                console.log("⚡ [Nerve] Signal Received: PUBLISH");
                const videoUrl = await hand.publishVideo();
                window.postMessage({ type: 'UPLOAD_COMPLETED_SUCCESS', payload: { videoUrl }, requestId, source: 'extension' }, '*');
                chrome.runtime.sendMessage({ type: 'UPLOAD_COMPLETED_SUCCESS', payload: { videoUrl }, requestId });
                break;
            }

            case 'REQUEST_VELOCITY_DATA': {
                const velocity = await hand.scrapeRealtimeVelocity();
                window.postMessage({ type: 'VELOCITY_DATA_RESULT', payload: velocity, requestId, source: 'extension' }, '*');
                chrome.runtime.sendMessage({ type: 'VELOCITY_DATA_RESULT', payload: velocity, requestId });
                break;
            }

            // DFL Multi-intent logic can be added here
        }
    } catch (error) {
        console.error(`💥 [Nerve Failure] Execution Error in ${type}:`, error);
        // Relay error to React dashboard for remote diagnostics
        window.postMessage({
            type: 'ERROR_LOG',
            payload: { type, message: error.message || String(error) },
            requestId,
            source: 'extension'
        }, '*');
        chrome.runtime.sendMessage({
            type: 'ERROR_LOG',
            payload: { type, message: error.message || String(error) },
            requestId
        });
    }
});
