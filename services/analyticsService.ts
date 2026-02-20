// 1. Move Interface definition HERE to break circular dependency
export interface AnalyticsResult {
    category: string;
    results: Array<{
        success: boolean;
        question: string;
        response?: string;
        data?: any;
        error?: string;
        timestamp: number;
    }>;
    successCount: number;
    totalCount: number;
}

export interface AnalyticsHistory {
    lastUpdated: number;
    data: { [category: string]: AnalyticsResult };
    insights: string[];
}

const STORAGE_KEY = 'gemini_app_analytics_history';

// Helper to generate simple insights from raw text
function generateBasicInsights(data: { [category: string]: AnalyticsResult }): string[] {
    const insights: string[] = [];
    // Add safety checks to prevent crashes
    if (data['channelOverview']?.results && Array.isArray(data['channelOverview'].results)) {
        const views = data['channelOverview'].results.find(r => r.question?.includes('views'));
        if (views?.response) insights.push(`Recent Views: ${views.response.substring(0, 50)}...`);
    }
    if (data['audience']?.results && Array.isArray(data['audience'].results)) {
        const countries = data['audience'].results.find(r => r.question?.includes('countries'));
        if (countries?.response) insights.push(`Top Countries: ${countries.response.substring(0, 50)}...`);
    }
    return insights;
}

export const analyticsService = {
    saveAnalytics: (data: { [category: string]: AnalyticsResult }) => {
        try {
            const history: AnalyticsHistory = {
                lastUpdated: Date.now(),
                data: data,
                insights: generateBasicInsights(data)
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
            console.log("💾 [AnalyticsService] Saved analytics data");
        } catch (e: any) {
            console.error("Failed to save analytics:", e);
            // Handle quota exceeded error by clearing old data
            if (e.name === 'QuotaExceededError' || e.message?.includes('quota')) {
                console.warn("⚠️ [AnalyticsService] Storage quota exceeded, clearing old data...");
                try {
                    // Clear old analytics data
                    localStorage.removeItem(STORAGE_KEY);
                    // ❌ REMOVED - This was causing Direct Collect data loss!
                    // localStorage.removeItem('youtubeAnalyticsData');
                    localStorage.removeItem('analyticsData');
                    // Try again with fresh storage
                    const history: AnalyticsHistory = {
                        lastUpdated: Date.now(),
                        data: data,
                        insights: generateBasicInsights(data)
                    };
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
                    console.log("✅ [AnalyticsService] Saved after clearing old data");
                } catch (retryError) {
                    console.error("❌ [AnalyticsService] Still failed after clearing:", retryError);
                }
            }
        }
    },

    getAnalytics: (): AnalyticsHistory | null => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) return null;
            return JSON.parse(stored);
        } catch (e) {
            console.error("Failed to load analytics:", e);
            return null;
        }
    },

    getTopPerformingTopics: (): string[] => {
        const history = analyticsService.getAnalytics();
        if (!history || !history.data['videoPerformance']) return [];
        const performance = history.data['videoPerformance'];
        const goodVideos = performance.results
            .filter(r => r.success && r.response && !r.response.toLowerCase().includes('no data'))
            .map(r => r.response || "");
        return goodVideos;
    }
};