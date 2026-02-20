
/**
 * YPP Algorithm Analyzer
 * Analyzes raw YouTube Analytics data against YPP algorithm goals.
 */

export interface YPPReport {
    overallScore: number; // 0-100
    viralStatus: 'Seeding' | 'Rising' | 'Viral' | 'Dormant';
    metrics: {
        apv: { value: number; target: number; status: 'Good' | 'Warning' | 'Critical' };
        ctr: { value: number; target: number; status: 'Good' | 'Warning' | 'Critical' };
        engagement: { value: number; target: number; status: 'Good' | 'Warning' | 'Critical' };
        shortsFeed: { value: number; target: number; status: 'Good' | 'Warning' | 'Critical' };
    };
    insights: string[];
    actions: string[];
}

type AnalyticsData = {
    videoPerformance?: { apv?: number | string; ctr?: number | string };
    engagement?: { likes?: number | string; comments?: number | string };
    overview?: { views?: number | string };
    trafficSources?: { shortsFeed?: number | string };
};

export const analyzeYPPData = (analyticsData: AnalyticsData): YPPReport => {
    // 1. Extract Metrics (Data structure depends on Ask Studio response)

    // Mock data extraction for now based on typical structure
    const apv = parseFloat(String(analyticsData?.videoPerformance?.apv ?? 0));
    const ctr = parseFloat(String(analyticsData?.videoPerformance?.ctr ?? 0));
    const likes = parseInt(String(analyticsData?.engagement?.likes ?? 0));
    const comments = parseInt(String(analyticsData?.engagement?.comments ?? 0));
    const views = parseInt(String(analyticsData?.overview?.views ?? 0));
    const shortsFeed = parseFloat(String(analyticsData?.trafficSources?.shortsFeed ?? 0));

    // Calculate Engagement Rate
    const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : 0;

    // 2. Define Targets (from YPP_ALGORITHM_METRICS.md)
    const TARGETS = {
        APV: 70,
        CTR: 5, // Baseline for Shorts
        ENGAGEMENT: 5,
        SHORTS_FEED: 90
    };

    // 3. Analyze Status
    const getStatus = (val: number, target: number): 'Good' | 'Warning' | 'Critical' => {
        if (val >= target) return 'Good';
        if (val >= target * 0.7) return 'Warning';
        return 'Critical';
    };

    const metrics = {
        apv: { value: apv, target: TARGETS.APV, status: getStatus(apv, TARGETS.APV) },
        ctr: { value: ctr, target: TARGETS.CTR, status: getStatus(ctr, TARGETS.CTR) },
        engagement: { value: engagementRate, target: TARGETS.ENGAGEMENT, status: getStatus(engagementRate, TARGETS.ENGAGEMENT) },
        shortsFeed: { value: shortsFeed, target: TARGETS.SHORTS_FEED, status: getStatus(shortsFeed, TARGETS.SHORTS_FEED) }
    };

    // 4. Calculate Overall Score
    let score = 0;
    score += (Math.min(apv, 100) / TARGETS.APV) * 40; // APV is 40% weight
    score += (Math.min(shortsFeed, 100) / TARGETS.SHORTS_FEED) * 30; // Feed is 30% weight
    score += (Math.min(engagementRate, 10) / TARGETS.ENGAGEMENT) * 20; // Engagement 20%
    score += (Math.min(ctr, 10) / TARGETS.CTR) * 10; // CTR 10%

    const overallScore = Math.min(Math.round(score), 100);

    // 5. Determine Viral Status
    let viralStatus: YPPReport['viralStatus'] = 'Dormant';
    if (overallScore > 85 && views > 10000) viralStatus = 'Viral';
    else if (overallScore > 60) viralStatus = 'Rising';
    else if (overallScore > 30) viralStatus = 'Seeding';

    // 6. Generate Insights & Actions
    const insights: string[] = [];
    const actions: string[] = [];

    if (metrics.apv.status !== 'Good') {
        insights.push(`APV (${apv}%) is below target (${TARGETS.APV}%). Viewers are dropping off.`);
        actions.push('Optimize "Smart Editor" to remove dead air.');
        actions.push('Improve the "Hook" in the first 3 seconds.');
    }

    if (metrics.shortsFeed.status !== 'Good') {
        insights.push(`Shorts Feed traffic (${shortsFeed}%) is low. Algorithm is not pushing content.`);
        actions.push('Check "First Hour Velocity" - upload at Golden Hours.');
    }

    if (metrics.engagement.status !== 'Good') {
        insights.push(`Engagement (${engagementRate.toFixed(1)}%) is low.`);
        actions.push('Add "Call to Action" (CTA) overlays.');
        actions.push('Reply to comments immediately to boost signals.');
    }

    return {
        overallScore,
        viralStatus,
        metrics,
        insights,
        actions
    };
};
