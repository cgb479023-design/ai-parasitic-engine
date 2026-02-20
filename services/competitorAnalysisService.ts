/**
 * Competitor Analysis Service
 * 
 * Analyzes viral patterns from trending videos in the same niche
 * to inform content strategy and title generation.
 * 
 * @module services/competitorAnalysisService
 * @version 1.0.0
 * @date 2026-01-08
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface ViralPattern {
    id: string;
    pattern: string;
    category: 'title' | 'hook' | 'thumbnail' | 'format';
    examples: string[];
    frequency: number;
    avgViews: number;
    successRate: number;
}

export interface CompetitorVideo {
    videoId: string;
    title: string;
    channelName: string;
    views: number;
    likes: number;
    publishedAt: string;
    duration: string;
    thumbnailUrl: string;
}

export interface NicheAnalysis {
    niche: string;
    analyzedVideos: number;
    topPatterns: ViralPattern[];
    bestPostingTimes: string[];
    avgViewsPerDay: number;
    competitorChannels: string[];
    recommendations: string[];
    lastUpdated: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATTERN DETECTION RULES
// ═══════════════════════════════════════════════════════════════════════════════

const TITLE_PATTERNS = {
    // Opening hooks
    hooks: [
        { regex: /^(Wait|Hold up|Stop|No way)/i, name: 'Interruption Hook' },
        { regex: /^(POV|When|That moment)/i, name: 'Relatable POV' },
        { regex: /^(Did you know|Nobody knows)/i, name: 'Knowledge Tease' },
        { regex: /^(This is why|Here's why)/i, name: 'Explanation Promise' },
        { regex: /^(I can't believe|Unbelievable)/i, name: 'Disbelief Hook' },
        { regex: /^(Breaking|Just in|Alert)/i, name: 'Urgency Hook' }
    ],
    // Emotional triggers
    emotions: [
        { regex: /(shocking|insane|crazy|wild)/i, name: 'Shock Factor' },
        { regex: /(satisfying|oddly satisfying)/i, name: 'Satisfaction' },
        { regex: /(scary|creepy|terrifying)/i, name: 'Fear Factor' },
        { regex: /(wholesome|heartwarming|cute)/i, name: 'Warmth' },
        { regex: /(fails?|mistakes?|wrong)/i, name: 'Schadenfreude' }
    ],
    // Format patterns
    formats: [
        { regex: /Part \d+|Pt\. ?\d+/i, name: 'Series Format' },
        { regex: /\#\d+ will|Number \d+/i, name: 'Countdown' },
        { regex: /vs\.?|versus/i, name: 'Versus Format' },
        { regex: /Before.*After|Transformation/i, name: 'Transformation' },
        { regex: /Step.*(by|-).*Step|How to/i, name: 'Tutorial' }
    ],
    // Curiosity gaps
    curiosity: [
        { regex: /\.{3}$|\?$/i, name: 'Open Loop' },
        { regex: /(what happens|wait for it|till the end)/i, name: 'Suspense' },
        { regex: /(secret|hidden|nobody knows)/i, name: 'Mystery' },
        { regex: /(you won't believe|impossible)/i, name: 'Incredulity' }
    ]
};

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYSIS FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Analyze a set of competitor videos to extract viral patterns.
 */
export function analyzeCompetitorVideos(videos: CompetitorVideo[]): NicheAnalysis {
    console.log(`🔍 [Competitor] Analyzing ${videos.length} videos...`);

    const patternCounts: Map<string, { count: number; totalViews: number; examples: string[] }> = new Map();

    // Extract patterns from each video
    for (const video of videos) {
        const detectedPatterns = detectPatterns(video.title);

        for (const pattern of detectedPatterns) {
            const existing = patternCounts.get(pattern) || { count: 0, totalViews: 0, examples: [] };
            existing.count++;
            existing.totalViews += video.views;
            if (existing.examples.length < 3) {
                existing.examples.push(video.title);
            }
            patternCounts.set(pattern, existing);
        }
    }

    // Convert to sorted patterns
    const topPatterns: ViralPattern[] = Array.from(patternCounts.entries())
        .map(([name, data]) => ({
            id: name.toLowerCase().replace(/\s+/g, '_'),
            pattern: name,
            category: 'title' as const,
            examples: data.examples,
            frequency: data.count / videos.length,
            avgViews: data.totalViews / data.count,
            successRate: data.count / videos.length
        }))
        .sort((a, b) => b.avgViews - a.avgViews)
        .slice(0, 10);

    // Extract posting time patterns
    const postingHours = videos.map(v => new Date(v.publishedAt).getHours());
    const hourCounts = postingHours.reduce((acc, h) => {
        acc[h] = (acc[h] || 0) + 1;
        return acc;
    }, {} as Record<number, number>);

    const bestHours = Object.entries(hourCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([hour]) => `${hour}:00`);

    // Extract competitor channels
    const channelCounts = videos.reduce((acc, v) => {
        acc[v.channelName] = (acc[v.channelName] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const topChannels = Object.entries(channelCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name]) => name);

    // Generate recommendations
    const recommendations = generateRecommendations(topPatterns);

    const analysis: NicheAnalysis = {
        niche: 'Auto-detected',
        analyzedVideos: videos.length,
        topPatterns,
        bestPostingTimes: bestHours,
        avgViewsPerDay: videos.reduce((sum, v) => sum + v.views, 0) / videos.length,
        competitorChannels: topChannels,
        recommendations,
        lastUpdated: new Date()
    };

    console.log(`🔍 [Competitor] Found ${topPatterns.length} viral patterns`);
    return analysis;
}

/**
 * Detect patterns in a title.
 */
function detectPatterns(title: string): string[] {
    const patterns: string[] = [];

    // Check all pattern categories
    for (const [category, rules] of Object.entries(TITLE_PATTERNS)) {
        for (const rule of rules) {
            if (rule.regex.test(title)) {
                patterns.push(rule.name);
            }
        }
    }

    // Check for emoji usage
    if (/[\u{1F600}-\u{1FAFF}]/u.test(title)) {
        patterns.push('Emoji Hook');
    }

    // Check for ALL CAPS words
    if (/\b[A-Z]{3,}\b/.test(title)) {
        patterns.push('Caps Emphasis');
    }

    // Check for numbers
    if (/\d+/.test(title)) {
        patterns.push('Number Usage');
    }

    return patterns;
}

/**
 * Generate recommendations based on patterns.
 */
function generateRecommendations(patterns: ViralPattern[]): string[] {
    const recommendations: string[] = [];

    if (patterns.length === 0) {
        return ['Not enough data to generate recommendations'];
    }

    // Top pattern recommendation
    const topPattern = patterns[0];
    recommendations.push(
        `Use "${topPattern.pattern}" in titles - ${(topPattern.successRate * 100).toFixed(0)}% of viral videos use this`
    );

    // Check for emotional hooks
    const emotionalPattern = patterns.find(p =>
        ['Shock Factor', 'Fear Factor', 'Warmth', 'Schadenfreude'].includes(p.pattern)
    );
    if (emotionalPattern) {
        recommendations.push(
            `Incorporate "${emotionalPattern.pattern}" - drives ${formatNumber(emotionalPattern.avgViews)} avg views`
        );
    }

    // Check for format patterns
    const formatPattern = patterns.find(p =>
        ['Series Format', 'Countdown', 'Versus Format'].includes(p.pattern)
    );
    if (formatPattern) {
        recommendations.push(
            `Consider "${formatPattern.pattern}" content structure`
        );
    }

    // Check for curiosity patterns
    const curiosityPattern = patterns.find(p =>
        ['Open Loop', 'Suspense', 'Mystery'].includes(p.pattern)
    );
    if (curiosityPattern) {
        recommendations.push(
            `Add curiosity gaps using "${curiosityPattern.pattern}" technique`
        );
    }

    return recommendations.slice(0, 5);
}

/**
 * Format large numbers.
 */
function formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

/**
 * Apply learned patterns to improve a title.
 */
export function improveTitle(originalTitle: string, patterns: ViralPattern[]): string[] {
    const improvements: string[] = [];

    // Add top pattern if not present
    for (const pattern of patterns.slice(0, 3)) {
        if (pattern.pattern === 'Emoji Hook' && !/[\u{1F600}-\u{1FAFF}]/u.test(originalTitle)) {
            const emojis = ['😱', '🔥', '💀', '😳', '👀'];
            const emoji = emojis[Math.floor(Math.random() * emojis.length)];
            improvements.push(`${emoji} ${originalTitle}`);
        }

        if (pattern.pattern === 'Open Loop' && !originalTitle.endsWith('...')) {
            improvements.push(`${originalTitle}...`);
        }

        if (pattern.pattern === 'Interruption Hook' && !/^(Wait|Hold up|Stop)/i.test(originalTitle)) {
            improvements.push(`Wait... ${originalTitle}`);
        }

        if (pattern.pattern === 'Suspense' && !/wait for it/i.test(originalTitle)) {
            improvements.push(`${originalTitle} (wait for it)`);
        }
    }

    return improvements.slice(0, 4);
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export const competitorAnalysisService = {
    analyzeCompetitorVideos,
    detectPatterns,
    improveTitle
};

console.log('🔍 [Service] competitorAnalysisService loaded');
