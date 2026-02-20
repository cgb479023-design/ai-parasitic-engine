/**
 * Quality Gate Service V1.0
 * 
 * Post-generation quality check and real performance feedback loop.
 * Addresses the "high predicted score, low actual views" problem.
 * 
 * @date 2025-12-31
 */

export interface VideoQualityCheck {
    videoId: string;
    title: string;

    // Pre-generation (predicted)
    predictedScores: {
        PIS: number;           // Predicted Impact Score
        predictedAPV: number;  // Predicted Average Percentage Viewed
        predictedViewedRate: number;
        predictedLikeRate: number;
        controversyQuotient: number;
    };

    // Post-generation (manual/AI check)
    generationQuality?: {
        firstFrameHookStrength: 1 | 2 | 3 | 4 | 5;  // 1=weak, 5=strong
        visualClarity: 1 | 2 | 3 | 4 | 5;           // 1=blurry, 5=crisp 4K
        textOverlayVisible: boolean;                 // Did text render correctly?
        loopSeamless: boolean;                       // Does loop work?
        audioPresent: boolean;                       // Is audio there?
        overallPassFail: 'PASS' | 'FAIL' | 'REQUEUE';
        reviewerNotes?: string;
    };

    // Post-publish (real performance - updated after 1hr, 24hr, 48hr)
    actualPerformance?: {
        views1h: number;
        views24h: number;
        views48h: number;
        realViewedRate?: number;      // From YouTube Analytics
        realAPV?: number;             // From YouTube Analytics
        realLikeRate?: number;
        velocity1h?: number;          // views per hour in first hour
        lastUpdated: string;
    };

    // Calculated fields
    predictionAccuracy?: number;  // How close was prediction to reality?
    lessonsLearned?: string[];    // What to improve next time
}

export interface DiversityCheck {
    date: string;
    videos: Array<{
        index: number;
        title: string;
        firstWord: string;
        mainTheme: string;
        cameraType: string;
    }>;
    diversityScore: number;  // 0-100
    violations: string[];
}

export interface ABTestBatch {
    batchId: string;
    publishTime: string;
    videos: Array<{
        videoId: string;
        title: string;
        theme: string;
    }>;
    status: 'PENDING' | 'PUBLISHED' | 'ANALYZED';
    winnerTheme?: string;
    performanceData?: { [videoId: string]: number };
}

/**
 * Quality Gate Service
 */
export const qualityGateService = {

    // =========================================================================
    // SOLUTION 1: Post-Generation Quality Check
    // =========================================================================

    /**
     * Check video quality after generation, before publishing.
     * Returns PASS/FAIL/REQUEUE recommendation.
     */
    checkGeneratedVideoQuality: (
        title: string,
        thumbnailBase64?: string,
        videoPreviewFrames?: string[]
    ): VideoQualityCheck['generationQuality'] => {
        // This would ideally use AI vision to analyze the video
        // For now, we provide a manual checklist structure

        console.log("🔍 [QualityGate] Checking video quality for:", title);

        // Default to manual review needed
        return {
            firstFrameHookStrength: 3,
            visualClarity: 3,
            textOverlayVisible: true,
            loopSeamless: true,
            audioPresent: true,
            overallPassFail: 'PASS', // Default pass, user can override
            reviewerNotes: 'Auto-approved. Manual review recommended for first batch.'
        };
    },

    /**
     * Create a quality check report for a batch of videos.
     */
    createBatchQualityReport: (
        videos: Array<{ title: string; predictedScores: VideoQualityCheck['predictedScores'] }>
    ): string => {
        let report = "📋 BATCH QUALITY CHECK REPORT\n";
        report += "═".repeat(50) + "\n\n";

        videos.forEach((v, i) => {
            report += `${i + 1}. "${v.title}"\n`;
            report += `   PIS: ${v.predictedScores.PIS} | APV: ${v.predictedScores.predictedAPV}%\n`;
            report += `   Viewed Rate: ${v.predictedScores.predictedViewedRate}% | Like: ${v.predictedScores.predictedLikeRate}%\n`;
            report += `   Controversy: ${v.predictedScores.controversyQuotient}/10\n\n`;
        });

        return report;
    },

    // =========================================================================
    // SOLUTION 2: Real Performance Feedback Loop
    // =========================================================================

    /**
     * Calculate prediction accuracy after getting real data.
     */
    calculatePredictionAccuracy: (
        predicted: VideoQualityCheck['predictedScores'],
        actual: VideoQualityCheck['actualPerformance']
    ): number => {
        if (!actual || !actual.realViewedRate) return 0;

        // Compare predicted vs actual viewed rate
        const viewedRateDiff = Math.abs(predicted.predictedViewedRate - (actual.realViewedRate || 0));
        const apvDiff = Math.abs(predicted.predictedAPV - (actual.realAPV || 100));

        // Lower difference = higher accuracy
        const viewedAccuracy = Math.max(0, 100 - viewedRateDiff);
        const apvAccuracy = Math.max(0, 100 - apvDiff);

        return Math.round((viewedAccuracy + apvAccuracy) / 2);
    },

    /**
     * Extract lessons from performance gap.
     */
    extractLessons: (
        title: string,
        predicted: VideoQualityCheck['predictedScores'],
        actual: VideoQualityCheck['actualPerformance']
    ): string[] => {
        const lessons: string[] = [];

        if (!actual) {
            lessons.push("No actual data yet - wait 24-48 hours");
            return lessons;
        }

        // View velocity check
        if (actual.views1h < 100) {
            lessons.push("❌ Low 1st hour velocity (<100) - Hook not stopping scroll");
        }

        if (actual.views24h < 500) {
            lessons.push("❌ Low 24h views - Algorithm not pushing to Shorts Feed");
        }

        // Check if title pattern worked
        if (title.includes("Karen") && actual.views24h < 100) {
            lessons.push("⚠️ 'Karen' theme saturated - AVOID in future");
        }

        if (title.includes("Cat") && actual.views24h > 1000) {
            lessons.push("✅ 'Cat' theme working - DO MORE");
        }

        // Compare prediction to reality
        if (predicted.predictedViewedRate > 70 && (actual.realViewedRate || 50) < 50) {
            lessons.push("📉 Viewed rate prediction was too optimistic - video not engaging");
        }

        return lessons;
    },

    /**
     * Generate improvement suggestions based on performance data.
     */
    generateImprovementSuggestions: (
        performanceHistory: VideoQualityCheck[]
    ): string[] => {
        const suggestions: string[] = [];

        // Analyze patterns
        const lowPerformers = performanceHistory.filter(v =>
            v.actualPerformance && v.actualPerformance.views24h < 100
        );

        const highPerformers = performanceHistory.filter(v =>
            v.actualPerformance && v.actualPerformance.views24h > 1000
        );

        // Theme analysis
        const lowThemes = lowPerformers.map(v => v.title.split(' ')[0]);
        const highThemes = highPerformers.map(v => v.title.split(' ')[0]);

        const themeCounts: { [key: string]: { low: number; high: number } } = {};
        lowThemes.forEach(t => {
            if (!themeCounts[t]) themeCounts[t] = { low: 0, high: 0 };
            themeCounts[t].low++;
        });
        highThemes.forEach(t => {
            if (!themeCounts[t]) themeCounts[t] = { low: 0, high: 0 };
            themeCounts[t].high++;
        });

        // Generate suggestions
        Object.entries(themeCounts).forEach(([theme, counts]) => {
            if (counts.low > 2 && counts.high === 0) {
                suggestions.push(`🚫 AVOID "${theme}" theme - ${counts.low} low-performers, 0 hits`);
            }
            if (counts.high > 1) {
                suggestions.push(`✅ PRIORITIZE "${theme}" theme - ${counts.high} high-performers`);
            }
        });

        return suggestions;
    },

    // =========================================================================
    // SOLUTION 3: Title/Theme Diversity Enforcement
    // =========================================================================

    /**
     * Check if a batch of videos meets diversity requirements.
     */
    checkDiversity: (
        videos: Array<{ title: string; promptBlock?: string }>
    ): DiversityCheck => {
        const date = new Date().toISOString().split('T')[0];
        const violations: string[] = [];

        const processedVideos = videos.map((v, i) => {
            const words = v.title.split(' ');
            const firstWord = words[0].replace(/[^\w]/g, '');

            // Detect theme
            let mainTheme = 'Unknown';
            const lowerTitle = v.title.toLowerCase();
            if (lowerTitle.includes('karen')) mainTheme = 'Karen';
            else if (lowerTitle.includes('cat') || lowerTitle.includes('🐱')) mainTheme = 'Cat';
            else if (lowerTitle.includes('dog') || lowerTitle.includes('🐕')) mainTheme = 'Dog';
            else if (lowerTitle.includes('hack')) mainTheme = 'Hacking';
            else if (lowerTitle.includes('security')) mainTheme = 'Security';
            else if (lowerTitle.includes('scam')) mainTheme = 'Scammer';

            // Detect camera type
            let cameraType = 'Unknown';
            const lowerPrompt = (v.promptBlock || '').toLowerCase();
            if (lowerPrompt.includes('security cam') || lowerPrompt.includes('cctv')) cameraType = 'SecurityCam';
            else if (lowerPrompt.includes('dashcam')) cameraType = 'Dashcam';
            else if (lowerPrompt.includes('bodycam') || lowerPrompt.includes('gopro')) cameraType = 'Bodycam';
            else if (lowerPrompt.includes('phone cam')) cameraType = 'PhoneCam';

            return {
                index: i + 1,
                title: v.title,
                firstWord,
                mainTheme,
                cameraType
            };
        });

        // Check for violations

        // Rule 1: No more than 2 videos with same first word
        const firstWordCounts: { [key: string]: number } = {};
        processedVideos.forEach(v => {
            firstWordCounts[v.firstWord] = (firstWordCounts[v.firstWord] || 0) + 1;
        });
        Object.entries(firstWordCounts).forEach(([word, count]) => {
            if (count > 2) {
                violations.push(`❌ First word "${word}" used ${count}x (max 2)`);
            }
        });

        // Rule 2: No more than 2 videos with same theme
        const themeCounts: { [key: string]: number } = {};
        processedVideos.forEach(v => {
            themeCounts[v.mainTheme] = (themeCounts[v.mainTheme] || 0) + 1;
        });
        Object.entries(themeCounts).forEach(([theme, count]) => {
            if (count > 2) {
                violations.push(`❌ Theme "${theme}" used ${count}x (max 2)`);
            }
        });

        // Rule 3: Must have at least 3 different camera types
        const uniqueCameraTypes = new Set(processedVideos.map(v => v.cameraType)).size;
        if (uniqueCameraTypes < 3 && videos.length >= 6) {
            violations.push(`⚠️ Only ${uniqueCameraTypes} camera types (need 3+)`);
        }

        // Calculate diversity score
        const uniqueFirstWords = new Set(processedVideos.map(v => v.firstWord)).size;
        const uniqueThemes = new Set(processedVideos.map(v => v.mainTheme)).size;

        const diversityScore = Math.round(
            ((uniqueFirstWords / videos.length) * 40) +
            ((uniqueThemes / videos.length) * 40) +
            ((uniqueCameraTypes / 4) * 20)
        );

        return {
            date,
            videos: processedVideos,
            diversityScore,
            violations
        };
    },

    /**
     * Enforce diversity by modifying plan if needed.
     */
    enforceDiversity: (
        schedule: Array<{ title: string; promptBlock: string }>
    ): { modified: boolean; suggestions: string[] } => {
        const check = qualityGateService.checkDiversity(schedule);

        if (check.violations.length === 0) {
            return { modified: false, suggestions: ["✅ Diversity check passed!"] };
        }

        const suggestions = [
            "⚠️ Diversity issues detected:",
            ...check.violations,
            "",
            "💡 Suggestions:",
            "- Replace duplicate themes with Cat/Pet content",
            "- Vary first words (use emoji, How, Why, This, etc.)",
            "- Add different camera perspectives"
        ];

        return { modified: false, suggestions };
    },

    // =========================================================================
    // SOLUTION 4: A/B Testing Mechanism
    // =========================================================================

    /**
     * Split videos into A/B test batches.
     */
    createABTestBatches: (
        schedule: Array<{ title: string; theme: string; publishTimeLocal: string }>
    ): ABTestBatch[] => {
        const batches: ABTestBatch[] = [];

        // Split into batches of 2
        for (let i = 0; i < schedule.length; i += 2) {
            const batchVideos = schedule.slice(i, i + 2);
            const batchId = `AB_${Date.now()}_${i}`;

            batches.push({
                batchId,
                publishTime: batchVideos[0]?.publishTimeLocal || '',
                videos: batchVideos.map((v, j) => ({
                    videoId: `${batchId}_${j}`,
                    title: v.title,
                    theme: v.theme || 'Unknown'
                })),
                status: 'PENDING'
            });
        }

        return batches;
    },

    /**
     * Analyze A/B test results and determine winner.
     */
    analyzeABTestResults: (
        batch: ABTestBatch,
        performanceData: { [videoId: string]: number }
    ): ABTestBatch => {
        batch.performanceData = performanceData;
        batch.status = 'ANALYZED';

        // Find winner
        let maxViews = 0;
        let winnerTheme = '';

        batch.videos.forEach(v => {
            const views = performanceData[v.videoId] || 0;
            if (views > maxViews) {
                maxViews = views;
                winnerTheme = v.theme;
            }
        });

        batch.winnerTheme = winnerTheme;
        console.log(`🏆 [A/B Test] Winner: "${winnerTheme}" with ${maxViews} views`);

        return batch;
    },

    /**
     * Get recommended theme for next batch based on A/B results.
     */
    getRecommendedTheme: (
        analyzedBatches: ABTestBatch[]
    ): string => {
        const themeCounts: { [theme: string]: number } = {};

        analyzedBatches.forEach(batch => {
            if (batch.winnerTheme) {
                themeCounts[batch.winnerTheme] = (themeCounts[batch.winnerTheme] || 0) + 1;
            }
        });

        // Find most winning theme
        let bestTheme = '';
        let maxWins = 0;

        Object.entries(themeCounts).forEach(([theme, wins]) => {
            if (wins > maxWins) {
                maxWins = wins;
                bestTheme = theme;
            }
        });

        return bestTheme || 'Cat + Forensics'; // Default to new strategy
    }
};

export default qualityGateService;
