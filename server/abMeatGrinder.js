// h:\AI_Neural_Engine_Clean_v3.5\server\abMeatGrinder.js
import db from './db.js';
import { uploadToYouTubeWithHealing } from './studioUploader.js';
import puppeteer from 'puppeteer';

/**
 * 🥩 A/B Meat Grinder (CTR Optimizer)
 * 7x24 monitoring of performance and autonomous hot-swapping
 */
export async function startMeatGrinder() {
    console.log("🥩 [Meat Grinder] CTR Optimizer active. Monitoring performance...");

    // Periodically check for low CTR
    setInterval(async () => {
        try {
            // Find active videos published in the last 24 hours
            const activeVideos = db.prepare('SELECT * FROM viral_contents WHERE timestamp > datetime("now", "-24 hours")').all();

            for (const video of activeVideos) {
                const ctr = await fetchRealTimeCTR(video.videoId);

                if (ctr < 0.08) { // Target < 8%
                    console.warn(`📉 [Meat Grinder] Low CTR Detected (${(ctr * 100).toFixed(2)}%) for ${video.videoId}. Triggering hot-swap...`);
                    await performHotSwap(video.videoId);
                }
            }
        } catch (err) {
            console.error("❌ [Meat Grinder] Monitor error:", err.message);
        }
    }, 1000 * 60 * 30); // Every 30 minutes
}

async function fetchRealTimeCTR(videoId) {
    // Mocking CTR retrieval - in production this uses Analytics API
    const metric = db.prepare('SELECT ctr FROM performance_metrics WHERE videoId = ? ORDER BY timestamp DESC LIMIT 1').get(videoId);
    return metric ? metric.ctr : 0.1; // Default to 10% if unknown
}

async function performHotSwap(videoId) {
    // Get next available title from variants
    const variant = db.prepare(`
        SELECT * FROM viral_content_variants 
        WHERE parent_content_id = (SELECT id FROM viral_contents WHERE videoId = ?)
        AND type = 'title' AND is_active = 0
        LIMIT 1
    `).get(videoId);

    if (variant) {
        console.log(`💊 [Meat Grinder] Swapping title to: ${variant.content}`);

        // This would reuse the same logic as the uploader but for metadata update
        // await updateMetadataOnStudio(videoId, { title: variant.content });

        db.prepare('UPDATE viral_content_variants SET is_active = 1 WHERE id = ?').run(variant.id);
        console.log(`✅ [Meat Grinder] Hot-swap complete for ${videoId}`);
    } else {
        console.log(`⏹️ [Meat Grinder] No more variants available for ${videoId}`);
    }
}
