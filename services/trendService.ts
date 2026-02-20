/**
 * Real-Time Trend Service
 * 
 * Fetches trending topics from Google Trends and intelligently matches them
 * against channel themes for content strategy optimization.
 * 
 * @module services/trendService
 * @version 1.0.0
 * @date 2026-01-08
 */

import { autoPivotService } from './autoPivotService';

// Chrome extension types (for TypeScript compatibility)
declare const chrome: any;

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

export type TrendRegion = 'US' | 'CN' | 'GLOBAL' | 'JP' | 'KR';

const TREND_CONFIG = {
    // 🆕 V1.3.2: Multi-Region Support
    REGION_RSS_URLS: {
        US: 'https://trends.google.com/trending/rss?geo=US',
        CN: 'https://trends.google.com/trending/rss?geo=CN',
        GLOBAL: 'https://trends.google.com/trending/rss',
        JP: 'https://trends.google.com/trending/rss?geo=JP',
        KR: 'https://trends.google.com/trending/rss?geo=KR'
    } as Record<TrendRegion, string>,

    // Default region
    DEFAULT_REGION: 'US' as TrendRegion,

    // Cache duration (1 hour)
    CACHE_DURATION_MS: 60 * 60 * 1000,

    // Max trends to fetch
    MAX_TRENDS: 20,

    // Minimum relevance score for matching (0-1)
    MIN_RELEVANCE_SCORE: 0.3,

    // Theme keyword weights for matching
    THEME_SYNONYMS: {
        pets: ['cat', 'dog', 'puppy', 'kitten', 'pet', 'animal', 'cute', 'fluffy', 'adorable', 'furry'],
        food: ['food', 'recipe', 'cooking', 'restaurant', 'chef', 'delicious', 'eating', 'meal', 'dish'],
        comedy: ['funny', 'humor', 'meme', 'joke', 'laugh', 'comedy', 'viral', 'fail', 'prank'],
        tech: ['tech', 'ai', 'app', 'software', 'gadget', 'iphone', 'android', 'gaming', 'computer'],
        lifestyle: ['life', 'routine', 'vlog', 'day', 'morning', 'night', 'style', 'fashion'],
        motivation: ['success', 'inspire', 'motivation', 'goal', 'growth', 'mindset', 'hustle'],
        reaction: ['react', 'reaction', 'watch', 'response', 'review', 'opinion']
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface TrendItem {
    title: string;
    description?: string;
    traffic?: string;
    link?: string;
    pubDate?: string;
    viralityScore?: number; // 🆕 V2.0: Virality Potential (0-100)
}

/**
 * Calculate Virality Potential Score based on traffic and keywords
 */
function calculateViralityScore(trend: TrendItem): number {
    let score = 50; // Base score

    // 1. Traffic weight
    const traffic = trend.traffic || '';
    if (traffic.includes('M+')) score += 40;
    else if (traffic.includes('500K+')) score += 30;
    else if (traffic.includes('200K+')) score += 20;
    else if (traffic.includes('100K+')) score += 15;
    else if (traffic.includes('50K+')) score += 10;

    // 2. Keyword weight (High-emotion / High-CTR words)
    const viralKeywords = ['weather', 'breaking', 'unexpected', 'reveal', 'shocking', 'mystery', 'secret', 'vs'];
    const titleLower = trend.title.toLowerCase();
    viralKeywords.forEach(kw => {
        if (titleLower.includes(kw)) score += 10;
    });

    return Math.min(100, score);
}

export interface TrendMatch {
    trend: TrendItem;
    matchedTheme: string;
    relevanceScore: number;
    reason: string;
}

export interface TrendAnalysis {
    timestamp: string;
    topTrends: TrendItem[];
    matchedTrends: TrendMatch[];
    promptInjection: string;
    cacheExpiry: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// CACHE
// ═══════════════════════════════════════════════════════════════════════════

let trendCache: TrendAnalysis | null = null;

// ═══════════════════════════════════════════════════════════════════════════
// TREND HISTORY (V1.3.1)
// ═══════════════════════════════════════════════════════════════════════════

const HISTORY_STORAGE_KEY = 'trendHistory';
const MAX_HISTORY_ENTRIES = 168; // 7 days * 24 hours

export interface TrendHistoryEntry {
    timestamp: string;
    region: string;
    trends: TrendItem[];
    matchedThemes: string[];
}

export interface TrendHistory {
    entries: TrendHistoryEntry[];
    lastUpdated: string;
}

/**
 * Load trend history from localStorage
 */
function loadTrendHistory(): TrendHistory {
    try {
        const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        console.warn('⚠️ [TrendService] Failed to load history:', e);
    }
    return { entries: [], lastUpdated: new Date().toISOString() };
}

/**
 * Save trend history to localStorage
 */
function saveTrendHistory(history: TrendHistory): void {
    try {
        // Trim to max entries
        if (history.entries.length > MAX_HISTORY_ENTRIES) {
            history.entries = history.entries.slice(-MAX_HISTORY_ENTRIES);
        }
        history.lastUpdated = new Date().toISOString();
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch (e) {
        console.warn('⚠️ [TrendService] Failed to save history:', e);
    }
}

/**
 * Add current trends to history
 */
function addToHistory(trends: TrendItem[], region: string = 'US', matchedThemes: string[] = []): void {
    const history = loadTrendHistory();
    history.entries.push({
        timestamp: new Date().toISOString(),
        region,
        trends: trends.slice(0, 10), // Only store top 10 for space
        matchedThemes
    });
    saveTrendHistory(history);
    console.log(`📈 [TrendService] Added to history (${history.entries.length} total entries)`);
}

/**
 * Get trend frequency analysis (which trends appear most often)
 */
export function analyzeTrendFrequency(days: number = 7): Record<string, number> {
    const history = loadTrendHistory();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const frequency: Record<string, number> = {};

    for (const entry of history.entries) {
        if (new Date(entry.timestamp) >= cutoff) {
            for (const trend of entry.trends) {
                const key = trend.title.toLowerCase();
                frequency[key] = (frequency[key] || 0) + 1;
            }
        }
    }

    return frequency;
}

/**
 * Get all history entries
 */
export function getTrendHistory(): TrendHistory {
    return loadTrendHistory();
}

/**
 * Clear trend history
 */
export function clearTrendHistory(): void {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
    console.log('📈 [TrendService] History cleared');
}

// ═══════════════════════════════════════════════════════════════════════════
// TREND FETCHING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fetch trends from Google Trends RSS feed
 * Uses a CORS proxy since browser can't directly access RSS
 * @param region Target region for trends
 */
async function fetchGoogleTrends(region: TrendRegion = TREND_CONFIG.DEFAULT_REGION): Promise<TrendItem[]> {
    console.log(`📈 [TrendService] Fetching Google Trends for region: ${region}...`);

    try {
        // Get RSS URL for region
        const rssUrl = TREND_CONFIG.REGION_RSS_URLS[region] || TREND_CONFIG.REGION_RSS_URLS.US;

        // Use a CORS proxy for browser access
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`;

        const response = await fetch(proxyUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/xml, text/xml, application/rss+xml'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const xmlText = await response.text();
        const trends = parseRssFeed(xmlText);

        console.log(`📈 [TrendService] Fetched ${trends.length} trends from ${region}`);
        return trends.slice(0, TREND_CONFIG.MAX_TRENDS);

    } catch (error) {
        console.warn(`⚠️ [TrendService] Failed to fetch Google Trends for ${region}, using fallback:`, error);
        return getFallbackTrends();
    }
}

/**
 * Parse RSS XML into TrendItem array
 */
function parseRssFeed(xmlText: string): TrendItem[] {
    const trends: TrendItem[] = [];

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlText, 'text/xml');
        const items = doc.querySelectorAll('item');

        items.forEach((item) => {
            const title = item.querySelector('title')?.textContent || '';
            const description = item.querySelector('description')?.textContent || '';
            const traffic = item.querySelector('ht\\:approx_traffic, approx_traffic')?.textContent || '';
            const link = item.querySelector('link')?.textContent || '';
            const pubDate = item.querySelector('pubDate')?.textContent || '';

            if (title) {
                const trendItem: TrendItem = { title, description, traffic, link, pubDate };
                trendItem.viralityScore = calculateViralityScore(trendItem);
                trends.push(trendItem);
            }
        });
    } catch (e) {
        console.warn('⚠️ [TrendService] XML parse error:', e);
    }

    return trends;
}

/**
 * Fallback trends when API fails (manually curated evergreen topics)
 */
function getFallbackTrends(): TrendItem[] {
    return [
        { title: 'AI Technology', traffic: '100K+' },
        { title: 'Cute Cat Videos', traffic: '500K+' },
        { title: 'Cooking Recipes', traffic: '200K+' },
        { title: 'Gaming News', traffic: '300K+' },
        { title: 'Fitness Tips', traffic: '150K+' },
        { title: 'Travel Destinations', traffic: '100K+' },
        { title: 'DIY Projects', traffic: '80K+' },
        { title: 'Music Reactions', traffic: '250K+' }
    ];
}

// ═══════════════════════════════════════════════════════════════════════════
// INTELLIGENT MATCHING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate relevance score between a trend and a theme
 */
function calculateRelevance(trend: TrendItem, theme: string): number {
    const trendText = `${trend.title} ${trend.description || ''}`.toLowerCase();
    const synonyms = TREND_CONFIG.THEME_SYNONYMS[theme as keyof typeof TREND_CONFIG.THEME_SYNONYMS] || [theme];

    let matchCount = 0;
    let totalWeight = 0;

    synonyms.forEach((keyword, index) => {
        // Earlier keywords in the array have higher weight
        const weight = 1 - (index * 0.05);
        totalWeight += weight;

        if (trendText.includes(keyword.toLowerCase())) {
            matchCount += weight;
        }
    });

    return totalWeight > 0 ? matchCount / totalWeight : 0;
}

/**
 * Match trends against channel's hot themes from AutoPivot
 */
function matchTrendsToThemes(
    trends: TrendItem[],
    hotThemes: string[]
): TrendMatch[] {
    const matches: TrendMatch[] = [];

    for (const trend of trends) {
        let bestMatch: TrendMatch | null = null;

        for (const theme of hotThemes) {
            const score = calculateRelevance(trend, theme);

            if (score >= TREND_CONFIG.MIN_RELEVANCE_SCORE) {
                if (!bestMatch || score > bestMatch.relevanceScore) {
                    bestMatch = {
                        trend,
                        matchedTheme: theme,
                        relevanceScore: Math.round(score * 100) / 100,
                        reason: `Trend "${trend.title}" matches your HOT theme "${theme}" with ${Math.round(score * 100)}% relevance`
                    };
                }
            }
        }

        if (bestMatch) {
            matches.push(bestMatch);
        }
    }

    // Sort by relevance score descending
    matches.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return matches.slice(0, 5); // Top 5 matches
}

// ═══════════════════════════════════════════════════════════════════════════
// PROMPT INJECTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate prompt injection text from matched trends
 */
function generatePromptInjection(matches: TrendMatch[], allTrends: TrendItem[]): string {
    if (matches.length === 0) {
        // No theme matches, just show general trends
        const topTrends = allTrends.slice(0, 5);
        return `
## 🔥 REAL-TIME GOOGLE TRENDS (Live Data)
The following topics are currently trending on Google. Consider if any align with your content:

${topTrends.map((t, i) => `${i + 1}. **${t.title}** ${t.traffic ? `(${t.traffic} searches)` : ''}`).join('\n')}

> ⚠️ Use these only if they naturally fit your channel's style.
`;
    }

    return `
## 🎯 SMART TREND MATCH (AI-Powered Recommendation)

Based on your channel's HOT themes from Auto-Pivot analysis, these TRENDING topics are HIGHLY RELEVANT:

${matches.map((m, i) => `
### ${i + 1}. "${m.trend.title}" 🔥
- **Matched Theme**: ${m.matchedTheme}
- **Relevance Score**: ${Math.round(m.relevanceScore * 100)}%
- **Live Traffic**: ${m.trend.traffic || 'Trending Now'}
- **Why this matters**: ${m.reason}
`).join('\n')}

> ⚡ **PRIORITY**: These trends align with your proven high-CTR themes. 
> Creating content on these topics NOW has maximum viral potential!

💡 **Suggested Approach**: Take your "${matches[0]?.matchedTheme}" content style and apply it to "${matches[0]?.trend.title}" topic.
`;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get trend analysis with intelligent matching
 * Uses caching to avoid excessive API calls
 * @param hotThemes Array of themes to match against
 * @param region Target region for trends (default: US)
 */
export async function analyzeTrends(hotThemes: string[] = [], region: TrendRegion = TREND_CONFIG.DEFAULT_REGION): Promise<TrendAnalysis> {
    const now = Date.now();

    // Check cache
    if (trendCache && trendCache.cacheExpiry > now) {
        console.log('📈 [TrendService] Using cached trends');
        return trendCache;
    }

    // Fetch fresh trends for specified region
    const trends = await fetchGoogleTrends(region);

    // If no hot themes provided, try to get from AutoPivot
    const themesToMatch = hotThemes.length > 0
        ? hotThemes
        : Object.keys(TREND_CONFIG.THEME_SYNONYMS);

    // Match trends to themes
    const matchedTrends = matchTrendsToThemes(trends, themesToMatch);

    // Generate prompt injection
    const promptInjection = generatePromptInjection(matchedTrends, trends);

    // Build analysis result
    const analysis: TrendAnalysis = {
        timestamp: new Date().toISOString(),
        topTrends: trends,
        matchedTrends,
        promptInjection,
        cacheExpiry: now + TREND_CONFIG.CACHE_DURATION_MS
    };

    // Cache it
    trendCache = analysis;

    // 🆕 V1.3.1: Save to history for long-term analysis
    addToHistory(trends, 'US', matchedTrends.map(m => m.matchedTheme));

    console.log(`📈 [TrendService] Analysis complete: ${trends.length} trends, ${matchedTrends.length} matches`);
    return analysis;
}

/**
 * Clear trend cache (force refresh)
 */
export function clearTrendCache(): void {
    trendCache = null;
    console.log('📈 [TrendService] Cache cleared');
}

/**
 * Get prompt injection string directly (convenience method)
 */
export async function getTrendPromptInjection(hotTheme?: string | null): Promise<string> {
    const hotThemes = hotTheme ? [hotTheme] : [];
    const analysis = await analyzeTrends(hotThemes);
    return analysis.promptInjection;
}

// ═══════════════════════════════════════════════════════════════════════════
// TWITTER/X TRENDS (V1.3.3)
// ═══════════════════════════════════════════════════════════════════════════

export interface TwitterTrend {
    name: string;
    url?: string;
    tweetVolume?: number;
    category?: string;
}

export interface SocialTrendsResult {
    twitter: TwitterTrend[];
    timestamp: string;
    source: 'api' | 'scrape' | 'fallback';
}

// Twitter API configuration (requires bearer token)
const TWITTER_CONFIG = {
    // Note: User must provide their own Twitter API Bearer Token
    API_URL: 'https://api.twitter.com/1.1/trends/place.json',
    WOEID_US: 23424977,      // United States
    WOEID_WORLD: 1,          // Worldwide
    BEARER_TOKEN: '', // Set via setTwitterBearerToken()
};

let twitterBearerToken: string = '';

/**
 * Set Twitter API Bearer Token (required for API access)
 */
export function setTwitterBearerToken(token: string): void {
    twitterBearerToken = token;
    console.log('📱 [TrendService] Twitter Bearer Token set');
}

/**
 * Fetch Twitter/X trends via API
 * Note: Requires Twitter API access (paid since 2023)
 */
async function fetchTwitterTrends(woeid: number = TWITTER_CONFIG.WOEID_US): Promise<TwitterTrend[]> {
    if (!twitterBearerToken) {
        console.warn('⚠️ [TrendService] Twitter Bearer Token not set, using fallback');
        return getTwitterFallbackTrends();
    }

    try {
        const response = await fetch(`${TWITTER_CONFIG.API_URL}?id=${woeid}`, {
            headers: {
                'Authorization': `Bearer ${twitterBearerToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Twitter API ${response.status}`);
        }

        const data = await response.json();
        const trends = data[0]?.trends || [];

        return trends.map((t: any) => ({
            name: t.name,
            url: t.url,
            tweetVolume: t.tweet_volume,
            category: 'twitter'
        }));
    } catch (error) {
        console.warn('⚠️ [TrendService] Twitter API failed:', error);
        return getTwitterFallbackTrends();
    }
}

/**
 * Fallback Twitter trends (curated popular topics)
 */
function getTwitterFallbackTrends(): TwitterTrend[] {
    return [
        { name: '#AIGenerated', tweetVolume: 50000 },
        { name: '#Viral', tweetVolume: 100000 },
        { name: '#Shorts', tweetVolume: 75000 },
        { name: '#TrendingNow', tweetVolume: 80000 },
        { name: '#FYP', tweetVolume: 120000 },
        { name: '#MustWatch', tweetVolume: 45000 },
        { name: '#LifeHack', tweetVolume: 35000 },
        { name: '#CatsOfTwitter', tweetVolume: 60000 }
    ];
}

/**
 * Get combined social media trends (Twitter/X)
 */
export async function getSocialTrends(): Promise<SocialTrendsResult> {
    const twitter = await fetchTwitterTrends();

    return {
        twitter,
        timestamp: new Date().toISOString(),
        source: twitterBearerToken ? 'api' : 'fallback'
    };
}

/**
 * Get combined Google + Twitter trends for maximum coverage
 */
export async function getAllTrends(
    hotThemes: string[] = [],
    region: TrendRegion = 'US'
): Promise<{ google: TrendAnalysis; twitter: SocialTrendsResult }> {
    const [google, twitter] = await Promise.all([
        analyzeTrends(hotThemes, region),
        getSocialTrends()
    ]);

    return { google, twitter };
}

// ═══════════════════════════════════════════════════════════════════════════
// X TRENDS FROM EXTENSION (V1.3.4)
// ═══════════════════════════════════════════════════════════════════════════

export interface XScrapedTrend {
    name: string;
    volume?: number;
    source: string;
    timestamp: string;
}

/**
 * Fetch X Trends from Chrome extension storage (scraped by xTrendsScraper.js)
 * This works via window.postMessage to communicate with the extension
 */
export async function fetchXTrendsFromExtension(): Promise<XScrapedTrend[]> {
    return new Promise((resolve) => {
        // Check if chrome runtime is available
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ action: 'requestXTrends' }, (response) => {
                if (chrome.runtime.lastError || !response || !response.trends) {
                    console.warn('⚠️ [TrendService] No X Trends from extension, using fallback');
                    resolve(getTwitterFallbackTrends().map(t => ({
                        name: t.name,
                        volume: t.tweetVolume,
                        source: 'fallback',
                        timestamp: new Date().toISOString()
                    })));
                } else {
                    console.log(`📱 [TrendService] Got ${response.trends.length} X Trends from extension`);
                    resolve(response.trends);
                }
            });
        } else {
            // Fallback when not in extension context
            console.log('📱 [TrendService] Not in extension context, using fallback');
            resolve(getTwitterFallbackTrends().map(t => ({
                name: t.name,
                volume: t.tweetVolume,
                source: 'fallback',
                timestamp: new Date().toISOString()
            })));
        }
    });
}

/**
 * Generate X Trends section for prompt injection
 */
function generateXTrendsSection(xTrends: XScrapedTrend[]): string {
    if (xTrends.length === 0) return '';

    const isFallback = xTrends[0]?.source === 'fallback';

    return `
## 📱 X/TWITTER TRENDS ${isFallback ? '(Fallback Data)' : '(Live Scraped)'}

${isFallback ? '> Note: Using curated fallback trends. Open X.com to get live data.\n' : ''}
Popular hashtags and topics on X right now:

${xTrends.slice(0, 8).map((t, i) => `${i + 1}. **${t.name}** ${t.volume ? `(~${Math.round(t.volume / 1000)}K posts)` : ''}`).join('\n')}

💡 Consider incorporating relevant hashtags into your video titles or descriptions.
`;
}

/**
 * Get combined Google Trends + X Trends prompt injection
 * This is the main function to call for complete trend data
 */
export async function getCombinedTrendInjection(
    hotThemes: string[] = [],
    region: TrendRegion = 'US'
): Promise<string> {
    console.log('📊 [TrendService] Fetching combined Google + X Trends...');

    // Fetch both in parallel
    const [googleAnalysis, xTrends] = await Promise.all([
        analyzeTrends(hotThemes, region),
        fetchXTrendsFromExtension()
    ]);

    // Combine the prompts
    const googleSection = googleAnalysis.promptInjection;
    const xSection = generateXTrendsSection(xTrends);

    const combined = `
═══════════════════════════════════════════════════════════════════════════════
🔥 REAL-TIME TREND INTELLIGENCE (Multi-Source Analysis)
═══════════════════════════════════════════════════════════════════════════════

${googleSection}

${xSection}

> ⚡ **Cross-Platform Synergy**: Topics trending on BOTH Google AND X have maximum viral potential!
`;

    console.log(`📊 [TrendService] Combined injection: Google(${googleAnalysis.topTrends.length}) + X(${xTrends.length})`);
    return combined;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export const trendService = {
    // Core
    analyzeTrends,
    clearTrendCache,
    getTrendPromptInjection,

    // History
    getTrendHistory,
    analyzeTrendFrequency,
    clearTrendHistory,

    // Twitter/X
    setTwitterBearerToken,
    getSocialTrends,
    getAllTrends,

    // 🆕 V1.3.4: Combined Injection
    fetchXTrendsFromExtension,
    getCombinedTrendInjection,

    // Config
    CONFIG: TREND_CONFIG
};

