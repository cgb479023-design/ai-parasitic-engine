/**
 * Auto-Pivot Agent
 *
 * Monitors YouTube Analytics data and automatically adjusts content strategy
 * when high-performing signals are detected.
 *
 * Rules:
 * - If a specific topic/niche > 10% CTR: Set as 'winning_strategy'
 * - If a specific style (e.g., 'Tutorial') > 60% Retention: Set as 'winning_style'
 *
 * @module platforms/autoPivot
 */

const PIVOT_THRESHOLDS = {
    CTR_HIGH: 10.0,
    RETENTION_HIGH: 60.0
};

class AutoPivotAgent {
    constructor() {
        this.currentStrategy = {
            niche: null,
            style: null,
            topic: null
        };
    }

    /**
     * Analyzes incoming analytics data and determines if a pivot is needed.
     * @param {Object} data - Analytics data from YouTube Studio
     */
    analyzeAndPivot(data) {
        if (!data || !data.rows) return;

        console.log("🧠 [AutoPivot] Analyzing performance data...");
        let bestVideo = null;
        let maxCTR = 0;

        // Find best performing recent video
        // Assumption: data.rows contains [VideoTitle, Views, CTR, AverageViewDuration, ...]
        // This structure depends on the specific report type, generalizing here for the agent logic

        data.rows.forEach(row => {
            // Simplified parsing - in real usage, would map headers
            const title = row[0];
            const ctr = parseFloat(row[2]); // Assuming col 2 is CTR

            if (ctr > maxCTR) {
                maxCTR = ctr;
                bestVideo = { title, ctr };
            }
        });

        if (bestVideo && maxCTR >= PIVOT_THRESHOLDS.CTR_HIGH) {
            console.log(`🧠 [AutoPivot] HIGH PERFORMANCE DETECTED! (${maxCTR}% CTR)`);
            console.log(`   Video: ${bestVideo.title}`);

            // Extract potential niche/topic from title
            const newTopic = this.extractTopic(bestVideo.title);

            if (newTopic && newTopic !== this.currentStrategy.topic) {
                console.log(`🔄 [AutoPivot] PIVOTING STRATEGY to: ${newTopic}`);
                this.setStrategy(newTopic);

                // Notify Frontend
                this.notifyFrontend(newTopic, maxCTR);
            }
        }
    }

    extractTopic(title) {
        // Simple extraction: remove common stop words or take the main noun phrase
        // For now, return the title as the new "seed"
        return title;
    }

    setStrategy(topic) {
        this.currentStrategy.topic = topic;
        // Persist
        chrome.storage.local.set({ 'auto_pivot_strategy': this.currentStrategy });
    }

    notifyFrontend(topic, ctr) {
        // Broadcast to React App
        // Background script will relay this to active tabs
        chrome.runtime.sendMessage({
            action: 'relayToAllTabs',
            message: {
                type: 'AUTO_PIVOT_UPDATE',
                payload: {
                    topic: topic,
                    reason: `High CTR detected (${ctr}%)`,
                    timestamp: Date.now()
                }
            }
        });
    }
}

// Singleton
const autoPivotAgent = new AutoPivotAgent();

// Listen for analytics data
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'YOUTUBE_ANALYTICS_RESULT') {
        autoPivotAgent.analyzeAndPivot(message.data);
    }
});

console.log('🧠 [AutoPivot] Agent Active');
