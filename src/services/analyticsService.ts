// Re-export analyticsService from root services directory
// This allows src/components to import from ../services/analyticsService

export interface AnalyticsResult {
    category: string;
    results: Array<{
        success: boolean;
        question: string;
        response?: string;
        data?: any;
        jsonData?: any;
        error?: string;
        timestamp: number;
    }>;
    successCount: number;
    totalCount: number;
    Data?: any;
    metadata?: any;
}

export interface AnalyticsHistory {
    lastUpdated: number;
    data: { [category: string]: AnalyticsResult };
    insights: string[];
}

const STORAGE_KEY = 'gemini_app_analytics_history';

export const analyticsService = {
    saveAnalytics: (data: { [category: string]: AnalyticsResult }) => {
        try {
            const history: AnalyticsHistory = {
                lastUpdated: Date.now(),
                data: data,
                insights: []
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
            console.log("[AnalyticsService] Saved analytics data");
        } catch (e: any) {
            console.error("Failed to save analytics:", e);
        }
    },

    loadAnalytics: (): AnalyticsHistory | null => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                return JSON.parse(stored) as AnalyticsHistory;
            }
        } catch (e: any) {
            console.error("Failed to load analytics:", e);
        }
        return null;
    },

    clearAnalytics: () => {
        localStorage.removeItem(STORAGE_KEY);
    }
};
