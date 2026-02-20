/**
 * A/B Title Testing Service
 * 
 * Automatically generates title variants and swaps them based on performance.
 * Designed to maximize click-through rate in the first hour.
 * 
 * @module services/abTestingService
 * @version 1.0.0
 * @date 2026-01-08
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface TitleVariant {
    id: string;
    text: string;
    strategy: 'curiosity' | 'conflict' | 'urgency' | 'mystery' | 'social_proof';
    emoji: string;
    score?: number;
}

export interface ABTest {
    videoId: string;
    originalTitle: string;
    variants: TitleVariant[];
    currentVariantId: string;
    startTime: Date;
    swapHistory: Array<{
        fromVariantId: string;
        toVariantId: string;
        timestamp: Date;
        metrics: { views: number; ctr: number };
    }>;
    status: 'running' | 'completed' | 'paused';
}

export interface PerformanceSnapshot {
    videoId: string;
    timestamp: Date;
    views: number;
    likes: number;
    comments: number;
    ctr: number; // Click-through rate
    avgViewDuration: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
    // Time windows for A/B testing
    FIRST_CHECK_MINUTES: 10,      // First performance check
    SWAP_THRESHOLD_MINUTES: 15,   // Minimum time before swap
    MAX_TEST_DURATION_HOURS: 1,   // End test after 1 hour

    // Performance thresholds for swap decision
    MIN_VIEWS_FOR_SWAP: 50,       // Need at least 50 views to evaluate
    CTR_IMPROVEMENT_THRESHOLD: 0.15, // 15% CTR improvement triggers swap

    // Title generation strategies
    STRATEGIES: {
        curiosity: {
            prefix: ['Wait...', 'Hold up—', 'Um...'],
            suffix: ['(watch till the end)', '👀', '???'],
            emoji: ['🤔', '😳', '👀']
        },
        conflict: {
            prefix: ['WRONG!', 'Actually...', 'Unpopular opinion:'],
            suffix: ['(prove me wrong)', '🔥', '#debate'],
            emoji: ['⚡', '🔥', '💥']
        },
        urgency: {
            prefix: ['BREAKING:', 'JUST NOW:', 'Before it\'s deleted:'],
            suffix: ['(seriously)', '⚠️', '🚨'],
            emoji: ['🚨', '⚠️', '🔴']
        },
        mystery: {
            prefix: ['What happens next will...', 'No one expected...', 'The secret to...'],
            suffix: ['(I can\'t believe it)', '😱', '🔮'],
            emoji: ['🔮', '✨', '🌟']
        },
        social_proof: {
            prefix: ['Everyone is talking about...', 'This went viral because...', '10M people saw this...'],
            suffix: ['(join the trend)', '📈', '#viral'],
            emoji: ['📈', '🏆', '⭐']
        }
    }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVE TESTS STORAGE
// ═══════════════════════════════════════════════════════════════════════════════

const activeTests: Map<string, ABTest> = new Map();

// ═══════════════════════════════════════════════════════════════════════════════
// TITLE VARIANT GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generates title variants using different viral strategies.
 */
export function generateTitleVariants(originalTitle: string): TitleVariant[] {
    const variants: TitleVariant[] = [];

    // Clean the original title (remove existing emojis)
    const cleanTitle = originalTitle.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();

    // Generate variants for each strategy
    for (const [strategy, patterns] of Object.entries(CONFIG.STRATEGIES)) {
        const prefix = patterns.prefix[Math.floor(Math.random() * patterns.prefix.length)];
        const suffix = patterns.suffix[Math.floor(Math.random() * patterns.suffix.length)];
        const emoji = patterns.emoji[Math.floor(Math.random() * patterns.emoji.length)];

        // Variant 1: Emoji + Prefix + Title
        const text1 = `${emoji} ${prefix} ${cleanTitle}`;
        if (text1.length <= 100) {
            variants.push({
                id: `${strategy}_prefix_${Date.now()}`,
                text: text1,
                strategy: strategy as TitleVariant['strategy'],
                emoji: emoji
            });
        }

        // Variant 2: Title + Suffix + Emoji
        const text2 = `${cleanTitle} ${suffix} ${emoji}`;
        if (text2.length <= 100) {
            variants.push({
                id: `${strategy}_suffix_${Date.now()}`,
                text: text2,
                strategy: strategy as TitleVariant['strategy'],
                emoji: emoji
            });
        }
    }

    // Add the original as a variant for comparison
    variants.unshift({
        id: 'original',
        text: originalTitle,
        strategy: 'curiosity', // Default
        emoji: ''
    });

    return variants.slice(0, 6); // Max 6 variants
}

// ═══════════════════════════════════════════════════════════════════════════════
// A/B TEST MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Starts an A/B test for a video.
 */
export function startABTest(videoId: string, originalTitle: string): ABTest {
    console.log(`🔬 [ABTest] Starting test for video: ${videoId}`);

    const variants = generateTitleVariants(originalTitle);

    const test: ABTest = {
        videoId,
        originalTitle,
        variants,
        currentVariantId: variants[0].id, // Start with original
        startTime: new Date(),
        swapHistory: [],
        status: 'running'
    };

    activeTests.set(videoId, test);

    // Schedule first check
    setTimeout(() => checkAndSwap(videoId), CONFIG.FIRST_CHECK_MINUTES * 60 * 1000);

    // Schedule end of test
    setTimeout(() => endTest(videoId), CONFIG.MAX_TEST_DURATION_HOURS * 60 * 60 * 1000);

    console.log(`🔬 [ABTest] Generated ${variants.length} variants`);
    return test;
}

/**
 * Checks performance and swaps title if needed.
 */
async function checkAndSwap(videoId: string): Promise<void> {
    const test = activeTests.get(videoId);
    if (!test || test.status !== 'running') return;

    console.log(`🔬 [ABTest] Checking performance for video: ${videoId}`);

    // Request current performance from extension
    const performance = await getCurrentPerformance(videoId);

    if (!performance || performance.views < CONFIG.MIN_VIEWS_FOR_SWAP) {
        console.log(`🔬 [ABTest] Not enough views yet (${performance?.views || 0}), rescheduling...`);
        setTimeout(() => checkAndSwap(videoId), 5 * 60 * 1000); // Check again in 5 min
        return;
    }

    // Calculate CTR (using likes as proxy for engagement)
    const currentCTR = performance.views > 0
        ? (performance.likes + performance.comments) / performance.views
        : 0;

    // Update current variant score
    const currentVariant = test.variants.find(v => v.id === test.currentVariantId);
    if (currentVariant) {
        currentVariant.score = currentCTR;
    }

    // Find the untested variant with highest potential
    const untestedVariants = test.variants.filter(v => v.score === undefined && v.id !== 'original');

    if (untestedVariants.length > 0) {
        // Try a new variant
        const nextVariant = untestedVariants[0];

        test.swapHistory.push({
            fromVariantId: test.currentVariantId,
            toVariantId: nextVariant.id,
            timestamp: new Date(),
            metrics: { views: performance.views, ctr: currentCTR }
        });

        test.currentVariantId = nextVariant.id;

        // Trigger title change via extension
        triggerTitleChange(videoId, nextVariant.text);

        console.log(`🔬 [ABTest] Swapped to variant: ${nextVariant.strategy}`);

        // Schedule next check
        setTimeout(() => checkAndSwap(videoId), CONFIG.SWAP_THRESHOLD_MINUTES * 60 * 1000);
    } else {
        // All variants tested, pick the best
        const bestVariant = test.variants.reduce((best, v) =>
            (v.score || 0) > (best.score || 0) ? v : best
        );

        if (bestVariant.id !== test.currentVariantId) {
            triggerTitleChange(videoId, bestVariant.text);
            console.log(`🔬 [ABTest] Final swap to best variant: ${bestVariant.strategy} (CTR: ${bestVariant.score})`);
        }

        test.status = 'completed';
    }
}

/**
 * Ends an A/B test.
 */
function endTest(videoId: string): void {
    const test = activeTests.get(videoId);
    if (!test) return;

    test.status = 'completed';

    // Find best performing variant
    const bestVariant = test.variants.reduce((best, v) =>
        (v.score || 0) > (best.score || 0) ? v : best
    );

    console.log(`🔬 [ABTest] Test completed for ${videoId}`);
    console.log(`   Winner: ${bestVariant.strategy} with CTR: ${bestVariant.score}`);
    console.log(`   Swaps made: ${test.swapHistory.length}`);
}

/**
 * Gets current performance metrics from YouTube Studio.
 */
async function getCurrentPerformance(videoId: string): Promise<PerformanceSnapshot | null> {
    return new Promise((resolve) => {
        const handler = (event: MessageEvent) => {
            if (event.data?.type === 'VIDEO_PERFORMANCE_RESULT' &&
                event.data?.videoId === videoId) {
                window.removeEventListener('message', handler);
                resolve(event.data.performance);
            }
        };

        window.addEventListener('message', handler);

        // Request from extension
        window.postMessage({
            type: 'GET_VIDEO_PERFORMANCE',
            videoId: videoId
        }, '*');

        // Timeout after 10 seconds
        setTimeout(() => {
            window.removeEventListener('message', handler);
            resolve(null);
        }, 10000);
    });
}

/**
 * Triggers title change via extension.
 */
function triggerTitleChange(videoId: string, newTitle: string): void {
    console.log(`🔬 [ABTest] Triggering title change: "${newTitle.substring(0, 50)}..."`);

    window.postMessage({
        type: 'CHANGE_VIDEO_TITLE',
        videoId: videoId,
        newTitle: newTitle
    }, '*');
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export function getActiveTests(): ABTest[] {
    return Array.from(activeTests.values());
}

export function getTest(videoId: string): ABTest | undefined {
    return activeTests.get(videoId);
}

export const abTestingService = {
    generateTitleVariants,
    startABTest,
    getActiveTests,
    getTest
};

console.log('🔬 [Service] abTestingService loaded');
