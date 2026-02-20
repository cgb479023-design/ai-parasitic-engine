// h:\AI_Neural_Engine_Clean_v3.5\server\parasiticWorkflow.js
import { fetchYoutubeData } from './evomapScraper.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { synthesizeShortsVideo } from './videoSynthesisService.js';
import { uploadToYouTubeWithHealing } from './studioUploader.js';
import { upsertIntent } from './db.js';
import db from './db.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const IS_E2E_TEST = process.env.NODE_ENV === 'test';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 🏭 V2.0 Industrial Multi-Modal Pipeline
 * Realizes the Master-Slave inversion by driving everything from the backend.
 */
export async function triggerParasiticWorkflow(videoId, originalTitle) {
    const intentId = `int_${Date.now()}`;
    const intent = {
        id: intentId,
        timestamp: Date.now(),
        type: 'AUTO_NINJA_MISSION',
        payload: { videoId, originalTitle },
        origin: 'VPH_RADAR',
        status: 'scraping'
    };

    try {
        // Initial state persistence
        upsertIntent(intent);
        console.log(`\n🕸️ [Industrial Pipeline] Mission ID: ${intentId} | Target: ${videoId}`);

        if (IS_E2E_TEST) {
            console.log("🧪 [MOCK MODE] Simulating zero-cost industrial loop...");
            await sleep(2000);

            intent.status = 'mutating';
            upsertIntent(intent);
            await sleep(3000);

            intent.status = 'muxing';
            upsertIntent(intent);
            await sleep(4000);

            intent.status = 'uploading';
            upsertIntent(intent);
            await sleep(3000);

            intent.status = 'completed';
            upsertIntent(intent);
            console.log("🧪 [MOCK MODE] Simulation successful.");
            return { success: true, intentId, mock: true };
        }

        // 1. Scraping (EvoMap Hardened)
        console.log(`[Step 1] Scraping host essence...`);
        const hostData = await fetchYoutubeData(`https://www.youtube.com/watch?v=${videoId}`);
        if (!hostData?.transcript) throw new Error("Empty host genome.");

        // 2. Mutation (Gemini Core)
        intent.status = 'mutating';
        upsertIntent(intent);
        console.log(`[Step 2] Mutating viral code with Gemini...`);
        const viralAssets = await mutateWithGemini(originalTitle, hostData.transcript);

        // 3. Synthesis (Module 1: Visual & Vocal Reconstruction)
        intent.status = 'muxing';
        upsertIntent(intent);
        console.log(`[Step 3] Local Synthesis (ElevenLabs + FFmpeg)...`);
        // Assuming a default raw footage path for now, in a real env this would be dynamically sourced
        const rawFootagePath = './assets/base_shorts_footage.mp4';
        const outputFilename = `final_${intentId}.mp4`;
        const finalVideoPath = await synthesizeShortsVideo(viralAssets.full_script, rawFootagePath, outputFilename);

        // 4. Uploading (Module 2: Bulletproof Uploader)
        intent.status = 'uploading';
        upsertIntent(intent);
        console.log(`[Step 4] Deployment (Puppeteer + EvoMap Self-Healing)...`);
        const uploadResult = await uploadToYouTubeWithHealing(finalVideoPath, {
            title: viralAssets.ab_titles[0] || originalTitle,
            description: `#Shorts #AI #IndustrialEngine\n\n${viralAssets.emotion_core}`
        });

        // 5. Completion
        intent.status = 'completed';
        upsertIntent(intent);
        console.log(`✅ [Mission Success] Content deployed: ${uploadResult.finalUrl}`);

        // Save to viral contents for dashboard
        const stmt = db.prepare('INSERT INTO viral_contents (videoId, title, script) VALUES (?, ?, ?)');
        stmt.run(videoId, viralAssets.ab_titles[0], viralAssets.full_script);

        return { success: true, intentId };

    } catch (error) {
        intent.status = 'failed';
        intent.error = error.message;
        upsertIntent(intent);
        console.error(`❌ [Mission Failed]`, error.message);
        throw error;
    }
}

async function mutateWithGemini(title, transcript) {
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-pro",
        generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
    Analyze this viral video and produce a "Mutation Plan":
    Title: ${title}
    Transcript: ${transcript.substring(0, 15000)}

    Output JSON:
    {
      "emotion_core": "Analysis of hook",
      "hook_script": "First 5s",
      "full_script": "MP4 script (suitable for TTS)",
      "ab_titles": ["Title 1", "Title 2", "Title 3", "Title 4", "Title 5"],
      "thumbnail_prompts": ["Prompt 1", "Prompt 2", "Prompt 3"]
    }
    `;

    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
}

/**
 * 🛰️ VPH Sentiment Radar
 * Placeholder for the 7x24 trending video scanner
 */
export function startVPHRadar() {
    console.log("🛰️ [VPH Radar] Sentiment Radar Ignited. Scanning for viral triggers...");
    // In production, this would use YouTube Data API to poll for trending topics
}
