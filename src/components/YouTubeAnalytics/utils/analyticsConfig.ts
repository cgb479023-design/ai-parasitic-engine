// 🎯 ANALYTICS CATEGORIES CONFIG
// Extracted from monolithic YouTubeAnalytics.tsx
// Algorithm-focused metrics highlighted for each analytics category

export interface AnalyticsCategoryConfig {
    name: string;
    icon: string;
    color: string;
    bgGradient: string;
    algorithmMetrics: { key: string; label: string; format: 'number' | 'percent' | 'time' | 'ratio' }[];
    description: string;
}

export const ANALYTICS_CATEGORIES: Record<string, AnalyticsCategoryConfig> = {
    yppSprint: {
        name: 'YPP Sprint (Daily)',
        icon: '🔥',
        color: 'text-orange-400',
        bgGradient: 'from-orange-500/20 to-red-500/20',
        algorithmMetrics: [
            { key: 'total_views', label: 'Views', format: 'number' },
            { key: 'new_subscribers_count', label: 'New Subs', format: 'number' },
            { key: 'watch_time_hours', label: 'Watch Hours', format: 'time' }
        ],
        description: 'YPP monetization progress'
    },
    channelOverview: {
        name: 'Channel Overview',
        icon: '📊',
        color: 'text-blue-400',
        bgGradient: 'from-blue-500/20 to-cyan-500/20',
        algorithmMetrics: [
            { key: 'total_views', label: 'Total Views', format: 'number' },
            { key: 'watch_time', label: 'Watch Time', format: 'time' },
            { key: 'subscribers_change', label: 'Subs Change', format: 'number' }
        ],
        description: 'Overall channel performance snapshot'
    },
    videoPerformance: {
        name: 'Video Performance',
        icon: '📹',
        color: 'text-purple-400',
        bgGradient: 'from-purple-500/20 to-pink-500/20',
        algorithmMetrics: [
            { key: 'top_video_views', label: 'Top Video', format: 'number' },
            { key: 'ctr', label: 'CTR', format: 'percent' },
            { key: 'avg_view_duration', label: 'Avg Duration', format: 'time' }
        ],
        description: 'Individual video metrics'
    },
    audience: {
        name: 'Audience Insights',
        icon: '👥',
        color: 'text-green-400',
        bgGradient: 'from-green-500/20 to-emerald-500/20',
        algorithmMetrics: [
            { key: 'returning_viewers', label: 'Returning %', format: 'percent' },
            { key: 'unique_viewers', label: 'Unique Viewers', format: 'number' },
            { key: 'subscribers_watch_pct', label: 'Subs Watching', format: 'percent' }
        ],
        description: 'Who is watching your content'
    },
    traffic: {
        name: 'Traffic Sources',
        icon: '🚦',
        color: 'text-yellow-400',
        bgGradient: 'from-yellow-500/20 to-amber-500/20',
        algorithmMetrics: [
            { key: 'shorts_feed_pct', label: '⚡ Shorts Feed %', format: 'percent' },
            { key: 'browse_pct', label: 'Browse %', format: 'percent' },
            { key: 'search_pct', label: 'Search %', format: 'percent' }
        ],
        description: 'Where viewers find your videos'
    },
    engagement: {
        name: 'Engagement Metrics',
        icon: '💖',
        color: 'text-pink-400',
        bgGradient: 'from-pink-500/20 to-rose-500/20',
        algorithmMetrics: [
            { key: 'likes', label: 'Likes', format: 'number' },
            { key: 'comments', label: 'Comments', format: 'number' },
            { key: 'shares', label: 'Shares', format: 'number' }
        ],
        description: 'How viewers interact with content'
    },
    comments: {
        name: 'Comment Analysis',
        icon: '💬',
        color: 'text-indigo-400',
        bgGradient: 'from-indigo-500/20 to-violet-500/20',
        algorithmMetrics: [
            { key: 'total_comments', label: 'Total Comments', format: 'number' },
            { key: 'replied_pct', label: 'Reply Rate', format: 'percent' },
            { key: 'sentiment', label: 'Sentiment', format: 'ratio' }
        ],
        description: 'Viewer comment insights'
    },
    retention: {
        name: 'Retention Curve',
        icon: '📈',
        color: 'text-cyan-400',
        bgGradient: 'from-cyan-500/20 to-teal-500/20',
        algorithmMetrics: [
            { key: 'retention_3s', label: '⚡ 3s Retention', format: 'percent' },
            { key: 'apv', label: 'APV %', format: 'percent' },
            { key: 'avg_view_pct', label: 'Avg Viewed', format: 'percent' }
        ],
        description: 'Hook strength & viewer retention'
    },
    velocity: {
        name: 'First Hour Velocity',
        icon: '⚡',
        color: 'text-amber-400',
        bgGradient: 'from-amber-500/20 to-orange-500/20',
        algorithmMetrics: [
            { key: 'first_hour_views', label: '🔥 1st Hour Views', format: 'number' },
            { key: 'velocity_rank', label: 'Velocity Rank', format: 'ratio' },
            { key: 'algorithm_trigger', label: 'Algo Trigger', format: 'ratio' }
        ],
        description: 'Algorithm ignition signal'
    },
    swipeAway: {
        name: 'Swipe-Away Rate',
        icon: '👆',
        color: 'text-red-400',
        bgGradient: 'from-red-500/20 to-rose-500/20',
        algorithmMetrics: [
            { key: 'swipe_away_rate', label: '🚨 Swipe-Away %', format: 'percent' },
            { key: 'avg_watch_before_swipe', label: 'Avg Watch Time', format: 'time' },
            { key: 'hook_failure_pct', label: 'Hook Fail %', format: 'percent' }
        ],
        description: 'Negative algorithm signal'
    },
    rewatch: {
        name: 'Rewatch Ratio',
        icon: '🔄',
        color: 'text-violet-400',
        bgGradient: 'from-violet-500/20 to-purple-500/20',
        algorithmMetrics: [
            { key: 'rewatch_ratio', label: '🔁 Rewatch Ratio', format: 'ratio' },
            { key: 'loop_completion_pct', label: 'Loop Rate', format: 'percent' },
            { key: 'repeat_views', label: 'Repeat Views', format: 'number' }
        ],
        description: 'Content loop effectiveness'
    },
    subsConversion: {
        name: 'Subs Conversion',
        icon: '✨',
        color: 'text-emerald-400',
        bgGradient: 'from-emerald-500/20 to-green-500/20',
        algorithmMetrics: [
            { key: 'conversion_rate', label: '⭐ Conversion %', format: 'percent' },
            { key: 'new_subs_from_shorts', label: 'Shorts Subs', format: 'number' },
            { key: 'sub_per_1000_views', label: 'Per 1K Views', format: 'ratio' }
        ],
        description: 'Viewer-to-subscriber conversion'
    },
    sessionTime: {
        name: 'Session Time',
        icon: '⏱️',
        color: 'text-slate-400',
        bgGradient: 'from-slate-500/20 to-gray-500/20',
        algorithmMetrics: [
            { key: 'avg_session_time', label: 'Avg Session', format: 'time' },
            { key: 'your_contribution', label: 'Your Contribution', format: 'percent' },
            { key: 'session_starts', label: 'Session Starts', format: 'number' }
        ],
        description: 'Platform session contribution'
    }
};
