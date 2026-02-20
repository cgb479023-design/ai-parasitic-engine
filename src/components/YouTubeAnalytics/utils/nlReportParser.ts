// 🆕 V7.8: NATURAL LANGUAGE REPORT PARSER
// Extracted from monolithic YouTubeAnalytics.tsx
// Parses Ask Studio's text-based reports when JSON output is unavailable

export interface NLReportData {
    yppSprint?: { new_subscribers: number; views_48h: number };
    channelOverview?: { total_subscribers: number; total_watch_time_seconds: number; total_videos: number };
    retention?: { average_view_percentage: number; average_view_duration_seconds: number };
    velocity?: { views_48h: number };
    videoPerformance?: { top_videos: { title: string; views: string; avp: string }[] };
    audience?: { top_countries: { country: string; percentage: number }[] };
    traffic?: { shorts_feed_pct: number; youtube_search_pct: number };
    engagement?: { total_likes: number; total_comments: number; total_shares: number };
    swipeAway?: { stayed_to_watch_ratio: number; swipe_away_rate: number };
    subsConversion?: { views_per_new_sub: number };
    sessionTime?: { views_per_unique_viewer: number };
    [key: string]: any;
}

/**
 * Parses Ask Studio's natural language text report into structured data.
 * Handles 13 analytics categories using regex extraction.
 */
export const parseNaturalLanguageReport = (text: string): NLReportData | null => {
    const report: NLReportData = {};

    try {
        console.log('🧠 [NL Parser] Parsing natural language report...');

        // === 1. YPP Sprint ===
        const yppMatch = text.match(/last 48 hours.*?gained\s*([\d,]+)\s*new subscribers.*?accumulated\s*([\d,]+)\s*views/i);
        if (yppMatch) {
            report.yppSprint = {
                new_subscribers: parseInt(yppMatch[1].replace(/,/g, '')),
                views_48h: parseInt(yppMatch[2].replace(/,/g, ''))
            };
        }

        // === 2. Channel Overview ===
        const subsMatch = text.match(/Total Subscribers[:\s]*([\d,]+)/i);
        const watchTimeMatch = text.match(/Total Watch Time[:\s]*([\d,]+)\s*seconds/i);
        const videoCountMatch = text.match(/Published Content Count[:\s]*([\d,]+)/i);
        if (subsMatch || watchTimeMatch) {
            report.channelOverview = {
                total_subscribers: subsMatch ? parseInt(subsMatch[1].replace(/,/g, '')) : 0,
                total_watch_time_seconds: watchTimeMatch ? parseInt(watchTimeMatch[1].replace(/,/g, '')) : 0,
                total_videos: videoCountMatch ? parseInt(videoCountMatch[1].replace(/,/g, '')) : 0
            };
        }

        // === 3. Retention ===
        const avpMatch = text.match(/Average View Percentage.*?[:\s]*([\d.]+)%/i);
        const avdMatch = text.match(/Average View Duration.*?[:\s]*([\d]+)\s*seconds/i);
        if (avpMatch || avdMatch) {
            report.retention = {
                average_view_percentage: avpMatch ? parseFloat(avpMatch[1]) : 0,
                average_view_duration_seconds: avdMatch ? parseInt(avdMatch[1]) : 0
            };
        }

        // === 4. Velocity ===
        const velocityViewsMatch = text.match(/Velocity.*?Total Views[:\s]*([\d,]+)/i) || text.match(/last two days.*?Total Views[:\s]*([\d,]+)/i);
        if (velocityViewsMatch) {
            report.velocity = {
                views_48h: parseInt(velocityViewsMatch[1].replace(/,/g, ''))
            };
        }

        // === 5. Video Performance (Top 5) ===
        const videoRows = text.match(/\d+\s+[🍕🤯🚗💪😳🔥🥺]?\s*[^|]+\|?\s*[\d,]+\s*\|?\s*[\d.]+%/g);
        if (videoRows && videoRows.length > 0) {
            report.videoPerformance = {
                top_videos: videoRows.slice(0, 5).map(row => {
                    const parts = row.split(/\t|\|/).map(p => p.trim());
                    return {
                        title: parts[0] || '',
                        views: parts[1] || '',
                        avp: parts[2] || ''
                    };
                })
            };
        }

        // === 6. Audience ===
        const countriesSection = text.match(/Top 5 Audience Countries.*?:([\s\S]*?)(?:Top Age|$)/i);
        if (countriesSection) {
            const countryMatches = countriesSection[1].match(/(\w+(?:\s+\w+)?)\s*\(([\d.]+)%\)/g);
            if (countryMatches) {
                report.audience = {
                    top_countries: countryMatches.slice(0, 5).map(m => {
                        const parts = m.match(/(.+?)\s*\(([\d.]+)%\)/) || [];
                        return { country: parts[1] || '', percentage: parseFloat(parts[2] || '0') };
                    })
                };
            }
        }

        // === 7. Traffic ===
        const shortsMatch = text.match(/Shorts feed[:\s]*([\d.]+)%/i);
        const searchMatch = text.match(/YouTube search[:\s]*([\d.]+)%/i);
        if (shortsMatch || searchMatch) {
            report.traffic = {
                shorts_feed_pct: shortsMatch ? parseFloat(shortsMatch[1]) : 0,
                youtube_search_pct: searchMatch ? parseFloat(searchMatch[1]) : 0
            };
        }

        // === 8. Engagement ===
        const likesMatch = text.match(/Total Likes[:\s]*([\d,]+)/i);
        const commentsMatch = text.match(/Total Comments[:\s]*([\d,]+)/i);
        const sharesMatch = text.match(/Total Shar(?:ing|e)s?[:\s]*([\d,]+)/i);
        if (likesMatch || commentsMatch) {
            report.engagement = {
                total_likes: likesMatch ? parseInt(likesMatch[1].replace(/,/g, '')) : 0,
                total_comments: commentsMatch ? parseInt(commentsMatch[1].replace(/,/g, '')) : 0,
                total_shares: sharesMatch ? parseInt(sharesMatch[1].replace(/,/g, '')) : 0
            };
        }

        // === 9. Swipe Away ===
        const swipeMatch = text.match(/Shorts Stayed-to-Watch Ratio[:\s]*([\d.]+)%/i) ||
            text.match(/Stayed to watch[:\s]*([\d.]+)%/i) ||
            text.match(/Viewed[:\s]*([\d.]+)%/i);
        if (swipeMatch) {
            const viewedPct = parseFloat(swipeMatch[1]);
            report.swipeAway = {
                stayed_to_watch_ratio: viewedPct,
                swipe_away_rate: 100 - viewedPct
            };
        }

        // === 10. Subs Conversion ===
        const viewsPerSubMatch = text.match(/Views Per New Subscriber[:\s]*([\d,]+)/i) ||
            text.match(/Average views for one sub[:\s]*([\d,]+)/i);
        if (viewsPerSubMatch) {
            report.subsConversion = {
                views_per_new_sub: parseInt(viewsPerSubMatch[1].replace(/,/g, ''))
            };
        }

        // === 11. Watch Time (supplement channelOverview) ===
        const watchHoursMatch = text.match(/Watch time\s*\(hours\)\s*[:\s]*([\d,.]+)/i);
        if (watchHoursMatch && !report.channelOverview?.total_watch_time_seconds) {
            if (!report.channelOverview) report.channelOverview = { total_subscribers: 0, total_watch_time_seconds: 0, total_videos: 0 };
            report.channelOverview.total_watch_time_seconds = parseFloat(watchHoursMatch[1].replace(/,/g, '')) * 3600;
        }

        // === 12. Session Time ===
        const viewsPerViewerMatch = text.match(/Views Per Unique Viewer[:\s]*([\d.]+)/i);
        if (viewsPerViewerMatch) {
            report.sessionTime = {
                views_per_unique_viewer: parseFloat(viewsPerViewerMatch[1])
            };
        }

        console.log('✅ [NL Parser] Extracted categories:', Object.keys(report));
        return report;

    } catch (e: any) {
        console.error('❌ [NL Parser] Error:', e.message);
        return null;
    }
};
