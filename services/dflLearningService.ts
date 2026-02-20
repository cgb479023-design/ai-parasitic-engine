/**
 * DFL Learning Service V7.0
 * 
 * Purpose: Track predictions vs actual performance to continuously improve content strategy
 * 
 * Features:
 * - Record predicted scores when generating content
 * - Collect actual performance data after publishing
 * - Calculate prediction accuracy
 * - Adjust strategy weights based on real performance
 */

// Types for DFL Learning System
export interface ContentPrediction {
    videoId: string;           // Unique identifier for the video
    title: string;
    theme: string;             // e.g., "Pet Chaos", "Fails", "Wholesome"
    hookType: string;          // e.g., "action_jolt", "anticipation", "surprise"
    publishTime: string;       // When it was scheduled
    predictedPIS: number;      // Predicted Impact Score (0-100)
    predictedViewedRate: number;  // Expected % who don't swipe away
    predictedAPV: number;      // Expected Average Percentage Viewed
    predictedLikeRate: number; // Expected like rate
    generatedAt: string;       // When this prediction was made
}

export interface ActualPerformance {
    videoId: string;
    title?: string;               // 🆕 V7.1: Title for fuzzy matching
    actualViews1h: number;     // Views in first hour
    actualViews24h: number;    // Views in 24 hours
    actualViewedRate: number;  // Actual % who watched
    actualAPV: number;         // Actual completion rate
    actualLikeRate: number;    // Actual likes / views
    actualCommentCount: number;
    collectedAt: string;
}

export interface PerformanceComparison {
    videoId: string;
    title: string;
    theme: string;
    hookType: string;

    // Predictions
    predictedPIS: number;
    predictedViewedRate: number;

    // Actuals
    actualViews24h: number;
    actualViewedRate: number;

    // Analysis
    predictionAccuracy: number;  // 0-100% how accurate was our prediction
    performanceScore: number;    // Normalized score (0-100) based on actual performance
    isSuccess: boolean;          // Did it meet viral thresholds?
    deviation: string;           // "OVERESTIMATED" | "ACCURATE" | "UNDERESTIMATED"
}

export interface ThemeWeight {
    theme: string;
    weight: number;              // 1.0 = neutral, >1 = boost, <1 = reduce
    totalVideos: number;
    successRate: number;         // % of videos that were successful
    avgViews: number;
    lastUpdated: string;
}

export interface HookWeight {
    hookType: string;
    weight: number;
    totalVideos: number;
    successRate: number;
    avgRetention: number;
    lastUpdated: string;
}

export interface DFLLearningState {
    predictions: ContentPrediction[];
    actuals: ActualPerformance[];
    comparisons: PerformanceComparison[];
    themeWeights: ThemeWeight[];
    hookWeights: HookWeight[];
    lastLearningCycle: string;
    totalVideosAnalyzed: number;
    overallAccuracy: number;     // How accurate are our predictions on average
}

// Default theme weights (start neutral)
const DEFAULT_THEME_WEIGHTS: ThemeWeight[] = [
    { theme: 'Pet Chaos', weight: 1.0, totalVideos: 0, successRate: 0, avgViews: 0, lastUpdated: '' },
    { theme: 'Fails & Funny', weight: 1.0, totalVideos: 0, successRate: 0, avgViews: 0, lastUpdated: '' },
    { theme: 'Wholesome', weight: 1.0, totalVideos: 0, successRate: 0, avgViews: 0, lastUpdated: '' },
    { theme: 'Instant Karma', weight: 1.0, totalVideos: 0, successRate: 0, avgViews: 0, lastUpdated: '' },
    { theme: 'Unexpected', weight: 1.0, totalVideos: 0, successRate: 0, avgViews: 0, lastUpdated: '' },
    { theme: 'Forensics', weight: 0.5, totalVideos: 0, successRate: 0, avgViews: 0, lastUpdated: '' }, // Penalized based on recent performance
];

const DEFAULT_HOOK_WEIGHTS: HookWeight[] = [
    { hookType: 'action_jolt', weight: 1.0, totalVideos: 0, successRate: 0, avgRetention: 0, lastUpdated: '' },
    { hookType: 'anticipation', weight: 1.0, totalVideos: 0, successRate: 0, avgRetention: 0, lastUpdated: '' },
    { hookType: 'surprise', weight: 1.0, totalVideos: 0, successRate: 0, avgRetention: 0, lastUpdated: '' },
    { hookType: 'cute_pet', weight: 1.0, totalVideos: 0, successRate: 0, avgRetention: 0, lastUpdated: '' },
    { hookType: 'fail_setup', weight: 1.0, totalVideos: 0, successRate: 0, avgRetention: 0, lastUpdated: '' },
];

// Viral thresholds for success determination
const VIRAL_THRESHOLDS = {
    views1h: 50,           // Minimum views in first hour to be considered "traction"
    views24h: 200,         // Minimum views in 24 hours for "success"
    viewedRate: 60,        // % who don't immediately swipe away
    apv: 80,               // Average Percentage Viewed (for 9s video, this means ~7s watch)
    likeRate: 3,           // 3% like rate is good
};

class DFLLearningService {
    private state: DFLLearningState;
    private readonly STORAGE_KEY = 'dfl_learning_state';

    constructor() {
        this.state = this.loadState();
    }

    private loadState(): DFLLearningState {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            console.warn('⚠️ [DFL Learning] Failed to load state, using defaults');
        }
        return {
            predictions: [],
            actuals: [],
            comparisons: [],
            themeWeights: [...DEFAULT_THEME_WEIGHTS],
            hookWeights: [...DEFAULT_HOOK_WEIGHTS],
            lastLearningCycle: '',
            totalVideosAnalyzed: 0,
            overallAccuracy: 0,
        };
    }

    private saveState(): void {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
            console.log('✅ [DFL Learning] State saved');
        } catch (e) {
            console.error('❌ [DFL Learning] Failed to save state:', e);
        }
    }

    /**
     * PART A-1: Record a new prediction when generating content
     */
    recordPrediction(prediction: ContentPrediction): void {
        // Avoid duplicates
        const existing = this.state.predictions.find(p => p.videoId === prediction.videoId);
        if (existing) {
            console.log(`⚠️ [DFL Learning] Prediction already exists for ${prediction.videoId}`);
            return;
        }

        this.state.predictions.push({
            ...prediction,
            generatedAt: new Date().toISOString(),
        });

        console.log(`📝 [DFL Learning] Recorded prediction for "${prediction.title}" (PIS: ${prediction.predictedPIS})`);
        this.saveState();
    }

    /**
     * PART A-2: Record actual performance data
     */
    recordActualPerformance(actual: ActualPerformance): void {
        // Update or add
        const idx = this.state.actuals.findIndex(a => a.videoId === actual.videoId);
        if (idx >= 0) {
            this.state.actuals[idx] = {
                ...actual,
                collectedAt: new Date().toISOString(),
            };
        } else {
            this.state.actuals.push({
                ...actual,
                collectedAt: new Date().toISOString(),
            });
        }

        console.log(`📊 [DFL Learning] Recorded actual performance for ${actual.videoId}: ${actual.actualViews24h} views`);

        // Trigger comparison calculation
        this.calculateComparison(actual.videoId);
        this.saveState();
    }

    /**
     * Helper: Match predictions to actuals by title similarity
     */
    private findMatchingPrediction(actual: ActualPerformance): ContentPrediction | null {
        // 1. Try exact videoId match
        const exactMatch = this.state.predictions.find(p => p.videoId === actual.videoId);
        if (exactMatch) return exactMatch;

        // 2. Try title matching (fuzzy)
        if (actual.title) {
            const actualTitle = actual.title.toLowerCase().replace(/[^a-z0-9]/g, '');
            for (const pred of this.state.predictions) {
                const predTitle = (pred.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                // Check if titles are similar (one contains the other or >70% match)
                if (actualTitle.includes(predTitle) || predTitle.includes(actualTitle)) {
                    return pred;
                }
                // Compare first 20 chars (handles truncation)
                if (actualTitle.substring(0, 20) === predTitle.substring(0, 20)) {
                    return pred;
                }
            }
        }
        return null;
    }

    /**
     * Helper: Auto-detect theme from video title
     */
    private detectThemeFromTitle(title: string): string {
        const lowerTitle = title.toLowerCase();

        // Pet-related keywords
        if (/\b(dog|cat|pet|puppy|kitten|pup|kitty|doggo|pupper|reunite|reunion)\b/.test(lowerTitle)) {
            return 'Pet Chaos';
        }
        // Fails/Funny keywords
        if (/\b(fail|fails|funny|hilarious|oops|wrong|mistake|blunder|blooper)\b/.test(lowerTitle)) {
            return 'Fails & Funny';
        }
        // Unexpected/Surprise keywords  
        if (/\b(unexpected|surprise|twist|shocking|unbelievable|impossible|crazy)\b/.test(lowerTitle)) {
            return 'Unexpected';
        }
        // Wholesome keywords
        if (/\b(wholesome|heartwarming|sweet|touching|emotional|crying|tears)\b/.test(lowerTitle)) {
            return 'Wholesome';
        }
        // Instant Karma keywords
        if (/\b(karma|instant|justice|deserved|revenge|payback)\b/.test(lowerTitle)) {
            return 'Instant Karma';
        }
        // Default
        return 'Unexpected';
    }

    /**
     * Helper: Auto-detect hook type from video title
     */
    private detectHookFromTitle(title: string): string {
        const lowerTitle = title.toLowerCase();

        if (/\b(wait|watch|look)\b/.test(lowerTitle)) return 'anticipation';
        if (/\b(cute|adorable|sweet|aww)\b/.test(lowerTitle)) return 'cute_pet';
        if (/\b(fail|falls|crash|drops)\b/.test(lowerTitle)) return 'fail_setup';
        if (/\b(unexpected|twist|surprise)\b/.test(lowerTitle)) return 'surprise';
        return 'action_jolt';
    }

    /**
     * PART A-3: Calculate prediction vs actual comparison
     * Enhanced: Supports title matching + auto theme detection
     */
    private calculateComparison(videoId: string): void {
        const actual = this.state.actuals.find(a => a.videoId === videoId);
        if (!actual) {
            console.log(`⚠️ [DFL Learning] No actual data found for: ${videoId}`);
            return;
        }

        // Try to find matching prediction (by videoId or title)
        let prediction = this.findMatchingPrediction(actual);

        // If no prediction found, create a synthetic one based on title analysis
        const autoDetectedTheme = actual.title ? this.detectThemeFromTitle(actual.title) : 'Unexpected';
        const autoDetectedHook = actual.title ? this.detectHookFromTitle(actual.title) : 'action_jolt';

        if (!prediction) {
            console.log(`🔄 [DFL Learning] No prediction match for "${actual.title}". Auto-detecting theme: ${autoDetectedTheme}`);
            // Create synthetic prediction for learning purposes
            prediction = {
                videoId,
                title: actual.title || 'Unknown',
                theme: autoDetectedTheme,
                hookType: autoDetectedHook,
                publishTime: new Date().toISOString(),
                predictedPIS: 50, // Neutral baseline
                predictedViewedRate: 80,
                predictedAPV: 70,
                predictedLikeRate: 3,
                generatedAt: new Date().toISOString(),
            };
        }

        // Calculate performance score (normalized 0-100)
        const viewScore = Math.min(100, (actual.actualViews24h / VIRAL_THRESHOLDS.views24h) * 50);
        const retentionScore = Math.min(50, (actual.actualViewedRate / VIRAL_THRESHOLDS.viewedRate) * 50);
        const performanceScore = viewScore + retentionScore;

        // Calculate prediction accuracy
        const predictedNormalized = prediction.predictedPIS;
        const actualNormalized = performanceScore;
        const deviation = Math.abs(predictedNormalized - actualNormalized);
        const accuracy = Math.max(0, 100 - deviation);

        // Determine deviation direction
        let deviationDirection: string;
        if (deviation < 15) {
            deviationDirection = 'ACCURATE';
        } else if (predictedNormalized > actualNormalized) {
            deviationDirection = 'OVERESTIMATED';
        } else {
            deviationDirection = 'UNDERESTIMATED';
        }

        // Determine success
        const isSuccess = actual.actualViews24h >= VIRAL_THRESHOLDS.views24h &&
            actual.actualViewedRate >= VIRAL_THRESHOLDS.viewedRate * 0.8;

        const comparison: PerformanceComparison = {
            videoId,
            title: prediction.title,
            theme: prediction.theme,
            hookType: prediction.hookType,
            predictedPIS: prediction.predictedPIS,
            predictedViewedRate: prediction.predictedViewedRate,
            actualViews24h: actual.actualViews24h,
            actualViewedRate: actual.actualViewedRate,
            predictionAccuracy: accuracy,
            performanceScore,
            isSuccess,
            deviation: deviationDirection,
        };

        // Update or add comparison
        const existingIdx = this.state.comparisons.findIndex(c => c.videoId === videoId);
        if (existingIdx >= 0) {
            this.state.comparisons[existingIdx] = comparison;
        } else {
            this.state.comparisons.push(comparison);
        }

        console.log(`📈 [DFL Learning] Comparison calculated for "${prediction.title}":
  - Predicted PIS: ${prediction.predictedPIS}
  - Actual Score: ${performanceScore.toFixed(1)}
  - Accuracy: ${accuracy.toFixed(1)}%
  - Deviation: ${deviationDirection}
  - Success: ${isSuccess ? '✅' : '❌'}`);

        // Update weights based on this comparison
        this.updateWeights(comparison);
    }

    /**
     * PART B: Update strategy weights based on actual performance
     */
    private updateWeights(comparison: PerformanceComparison): void {
        const now = new Date().toISOString();

        // Update theme weight
        const themeIdx = this.state.themeWeights.findIndex(t =>
            t.theme.toLowerCase().includes(comparison.theme.toLowerCase()) ||
            comparison.theme.toLowerCase().includes(t.theme.toLowerCase())
        );

        if (themeIdx >= 0) {
            const theme = this.state.themeWeights[themeIdx];
            const successBoost = comparison.isSuccess ? 0.1 : -0.1;

            // Calculate new weight (bounded between 0.3 and 2.0)
            const newWeight = Math.max(0.3, Math.min(2.0, theme.weight + successBoost));

            // Update stats
            const newTotal = theme.totalVideos + 1;
            const newSuccessRate = ((theme.successRate * theme.totalVideos) + (comparison.isSuccess ? 100 : 0)) / newTotal;
            const newAvgViews = ((theme.avgViews * theme.totalVideos) + comparison.actualViews24h) / newTotal;

            this.state.themeWeights[themeIdx] = {
                ...theme,
                weight: newWeight,
                totalVideos: newTotal,
                successRate: newSuccessRate,
                avgViews: newAvgViews,
                lastUpdated: now,
            };

            console.log(`🎯 [DFL Learning] Theme "${theme.theme}" weight updated: ${theme.weight.toFixed(2)} → ${newWeight.toFixed(2)}`);
        }

        // Update hook weight
        const hookIdx = this.state.hookWeights.findIndex(h =>
            h.hookType.toLowerCase() === comparison.hookType.toLowerCase()
        );

        if (hookIdx >= 0) {
            const hook = this.state.hookWeights[hookIdx];
            const retentionBoost = comparison.actualViewedRate >= 60 ? 0.1 : -0.05;

            const newWeight = Math.max(0.3, Math.min(2.0, hook.weight + retentionBoost));
            const newTotal = hook.totalVideos + 1;
            const newSuccessRate = ((hook.successRate * hook.totalVideos) + (comparison.isSuccess ? 100 : 0)) / newTotal;
            const newAvgRetention = ((hook.avgRetention * hook.totalVideos) + comparison.actualViewedRate) / newTotal;

            this.state.hookWeights[hookIdx] = {
                ...hook,
                weight: newWeight,
                totalVideos: newTotal,
                successRate: newSuccessRate,
                avgRetention: newAvgRetention,
                lastUpdated: now,
            };

            console.log(`🎣 [DFL Learning] Hook "${hook.hookType}" weight updated: ${hook.weight.toFixed(2)} → ${newWeight.toFixed(2)}`);
        }

        // Update overall stats
        this.state.totalVideosAnalyzed = this.state.comparisons.length;
        this.state.overallAccuracy = this.state.comparisons.reduce(
            (sum, c) => sum + c.predictionAccuracy, 0
        ) / this.state.comparisons.length;
        this.state.lastLearningCycle = now;

        this.saveState();
    }

    /**
     * 🆕 V7.1: Recalculate overall accuracy from all comparisons
     */
    private recalculateOverallAccuracy(): void {
        if (this.state.comparisons.length === 0) {
            this.state.overallAccuracy = 0;
            return;
        }
        const totalAccuracy = this.state.comparisons.reduce((sum, c) => sum + c.predictionAccuracy, 0);
        this.state.overallAccuracy = totalAccuracy / this.state.comparisons.length;
        console.log(`📊 [DFL Learning] Overall accuracy recalculated: ${this.state.overallAccuracy.toFixed(1)}%`);
    }

    /**
     * Get current theme weights (for prompt generation)
     */
    getThemeWeights(): ThemeWeight[] {
        return [...this.state.themeWeights].sort((a, b) => b.weight - a.weight);
    }

    /**
     * Get best performing themes
     */
    getBestThemes(count: number = 3): ThemeWeight[] {
        return this.getThemeWeights().slice(0, count);
    }

    /**
     * Get themes to avoid
     */
    getWeakThemes(threshold: number = 0.7): ThemeWeight[] {
        return this.state.themeWeights.filter(t => t.weight < threshold);
    }

    /**
     * Get hook weights
     */
    getHookWeights(): HookWeight[] {
        return [...this.state.hookWeights].sort((a, b) => b.weight - a.weight);
    }

    /**
     * 🆕 V7.1: Reprocess all actuals to generate comparisons
     * Useful when data was added manually via console
     */
    reprocessAllActuals(): void {
        console.log(`🔄 [DFL Learning] Reprocessing ${this.state.actuals.length} actuals...`);

        for (const actual of this.state.actuals) {
            this.calculateComparison(actual.videoId);
        }

        // Recalculate overall accuracy
        this.recalculateOverallAccuracy();
        this.saveState();

        console.log(`✅ [DFL Learning] Reprocessed. Comparisons: ${this.state.comparisons.length}`);
    }

    /**
     * 🆕 V7.1: Force complete relearn from actuals
     * Resets weights and rebuilds from scratch
     */
    forceRelearn(): void {
        console.log(`🔄 [DFL Learning] Force relearning from ${this.state.actuals.length} videos...`);

        // Reset weights to neutral
        this.state.themeWeights = [...DEFAULT_THEME_WEIGHTS];
        this.state.hookWeights = [...DEFAULT_HOOK_WEIGHTS];
        this.state.comparisons = [];
        this.state.overallAccuracy = 0;

        // Reprocess all
        this.reprocessAllActuals();

        this.state.lastLearningCycle = new Date().toISOString();
        this.saveState();

        console.log(`✅ [DFL Learning] Relearn complete!`);
    }

    /**
     * PART C: Generate learning report
     */
    generateLearningReport(): string {
        const report: string[] = [];
        const now = new Date();

        report.push('═══════════════════════════════════════════════════════════════');
        report.push('📊 DFL LEARNING REPORT V7.0');
        report.push(`Generated: ${now.toISOString()}`);
        report.push('═══════════════════════════════════════════════════════════════');
        report.push('');

        // Overall stats
        report.push('📈 OVERALL PERFORMANCE');
        report.push(`Total Videos Analyzed: ${this.state.totalVideosAnalyzed}`);
        report.push(`Overall Prediction Accuracy: ${this.state.overallAccuracy.toFixed(1)}%`);
        report.push(`Last Learning Cycle: ${this.state.lastLearningCycle || 'Never'}`);
        report.push('');

        // Theme performance
        report.push('🎯 THEME PERFORMANCE (Sorted by Weight)');
        const sortedThemes = this.getThemeWeights();
        sortedThemes.forEach((theme, idx) => {
            const indicator = theme.weight >= 1.0 ? '✅' : theme.weight >= 0.7 ? '⚠️' : '❌';
            report.push(`${idx + 1}. ${indicator} ${theme.theme}`);
            report.push(`   Weight: ${theme.weight.toFixed(2)} | Videos: ${theme.totalVideos} | Success: ${theme.successRate.toFixed(1)}% | Avg Views: ${theme.avgViews.toFixed(0)}`);
        });
        report.push('');

        // Hook performance
        report.push('🎣 HOOK TYPE PERFORMANCE');
        const sortedHooks = this.getHookWeights();
        sortedHooks.forEach((hook, idx) => {
            const indicator = hook.weight >= 1.0 ? '✅' : hook.weight >= 0.7 ? '⚠️' : '❌';
            report.push(`${idx + 1}. ${indicator} ${hook.hookType}`);
            report.push(`   Weight: ${hook.weight.toFixed(2)} | Avg Retention: ${hook.avgRetention.toFixed(1)}%`);
        });
        report.push('');

        // Recent comparisons
        report.push('📋 RECENT PREDICTION VS ACTUAL (Last 10)');
        const recentComparisons = this.state.comparisons.slice(-10).reverse();
        recentComparisons.forEach(c => {
            const successIcon = c.isSuccess ? '✅' : '❌';
            report.push(`${successIcon} "${c.title.substring(0, 40)}..."`);
            report.push(`   Predicted: ${c.predictedPIS} → Actual: ${c.performanceScore.toFixed(0)} (${c.deviation})`);
            report.push(`   Views: ${c.actualViews24h} | Retention: ${c.actualViewedRate.toFixed(1)}%`);
        });
        report.push('');

        // Recommendations
        report.push('💡 RECOMMENDATIONS');
        const bestThemes = this.getBestThemes(2);
        const weakThemes = this.getWeakThemes();

        if (bestThemes.length > 0 && bestThemes[0].totalVideos > 0) {
            report.push(`✅ INCREASE: Focus more on "${bestThemes[0].theme}" (${bestThemes[0].successRate.toFixed(0)}% success rate)`);
        }
        if (weakThemes.length > 0) {
            report.push(`❌ REDUCE: Decrease "${weakThemes[0].theme}" content (weight: ${weakThemes[0].weight.toFixed(2)})`);
        }
        if (this.state.overallAccuracy < 50) {
            report.push(`⚠️ CALIBRATION NEEDED: Prediction accuracy is low (${this.state.overallAccuracy.toFixed(1)}%). Consider adjusting thresholds.`);
        }

        report.push('');
        report.push('═══════════════════════════════════════════════════════════════');

        return report.join('\n');
    }

    /**
     * Get strategy context for prompt injection
     */
    getStrategyContext(): string {
        const bestThemes = this.getBestThemes(3);
        const weakThemes = this.getWeakThemes();

        let context = '\n\n📊 DFL LEARNING INSIGHTS (Based on ACTUAL performance data):\n';

        if (this.state.totalVideosAnalyzed > 0) {
            context += `\n🎯 HIGH-PERFORMING THEMES (Prioritize these):\n`;
            bestThemes.forEach(t => {
                if (t.totalVideos > 0) {
                    context += `- ${t.theme}: ${t.successRate.toFixed(0)}% success, avg ${t.avgViews.toFixed(0)} views\n`;
                }
            });

            if (weakThemes.length > 0) {
                context += `\n❌ LOW-PERFORMING THEMES (Avoid or reduce):\n`;
                weakThemes.forEach(t => {
                    context += `- ${t.theme}: Only ${t.successRate.toFixed(0)}% success, avg ${t.avgViews.toFixed(0)} views\n`;
                });
            }

            context += `\nOverall Prediction Accuracy: ${this.state.overallAccuracy.toFixed(1)}%\n`;
        } else {
            context += 'No performance data yet. Using default strategy.\n';
        }

        return context;
    }

    /**
     * Clear all learning data (reset)
     */
    reset(): void {
        this.state = {
            predictions: [],
            actuals: [],
            comparisons: [],
            themeWeights: [...DEFAULT_THEME_WEIGHTS],
            hookWeights: [...DEFAULT_HOOK_WEIGHTS],
            lastLearningCycle: '',
            totalVideosAnalyzed: 0,
            overallAccuracy: 0,
        };
        this.saveState();
        console.log('🔄 [DFL Learning] State reset to defaults');
    }

    /**
     * Get current state (for debugging)
     */
    getState(): DFLLearningState {
        return { ...this.state };
    }
}

// Export singleton instance
export const dflLearningService = new DFLLearningService();
