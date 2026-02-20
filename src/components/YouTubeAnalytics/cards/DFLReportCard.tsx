// 🧠 DFL Report Professional Card Component
// Extracted from monolithic YouTubeAnalytics.tsx

import React, { useState } from 'react';

interface DFLReportCardProps {
    data: any;
    onCollect?: () => void;
    isCollecting?: boolean;
    lastUpdated?: Date;
}

const DFLReportCard: React.FC<DFLReportCardProps> = ({
    data,
    onCollect,
    isCollecting = false,
    lastUpdated
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // 🔧 FIX: Smart extraction from Ask Studio JSON structure
    const parsed = data?.parsed || {};
    const raw = data?.raw || {};

    // Extract metrics from various possible locations in the data
    const extractMetrics = () => {
        // Helper: Deep search for a value by key name
        const deepFind = (obj: any, ...keys: string[]): any => {
            if (!obj || typeof obj !== 'object') return undefined;
            for (const key of keys) {
                if (obj[key] !== undefined) return obj[key];
            }
            for (const val of Object.values(obj)) {
                if (val && typeof val === 'object') {
                    const found = deepFind(val, ...keys);
                    if (found !== undefined) return found;
                }
            }
            return undefined;
        };

        // Try to extract numeric values from text responses
        const extractNumber = (...keys: string[]): number => {
            const val = deepFind(parsed, ...keys);
            if (val === undefined) return 0;
            if (typeof val === 'number') return val;
            if (typeof val === 'string') {
                const match = val.match(/[\d,]+(?:\.\d+)?/);
                if (match) return parseFloat(match[0].replace(/,/g, ''));
            }
            return 0;
        };

        const extractRank = (): string => {
            const rank = deepFind(parsed, 'rank', 'velocity_rank', 'velocityRank');
            if (rank && typeof rank === 'string') return rank.toUpperCase();
            const velocity = extractNumber('first_hour_velocity', 'velocity', 'views_first_hour');
            if (velocity > 1000) return 'A';
            if (velocity > 500) return 'B';
            if (velocity > 100) return 'C';
            return 'D';
        };

        const extractTrend = (): string => {
            const trend = deepFind(parsed, 'trend', 'trendDirection', 'trend_direction');
            if (trend && typeof trend === 'string') return trend.toUpperCase();
            return 'STABLE';
        };

        if (Object.keys(parsed).length > 0) {
            return {
                firstHourVelocity: extractNumber('latest_short_views_1h', 'total_views', 'first_hour_velocity'),
                velocityRank: extractRank(),
                currentSubs: extractNumber('current_subscribers', 'subscribers', 'subs'),
                daysToYPP: extractNumber('estimated_days_to_ypp', 'days_to_ypp', 'days_remaining') || 365,
                avgViewPct: extractNumber('average_view_percentage', 'avg_view_pct', 'rewatch_ratio'),
                swipeAwayRate: extractNumber('swipe_away_rate', 'swipe_rate'),
                shortsFeedPct: extractNumber('shorts_feed_percentage', 'shorts_feed'),
                watchHours: extractNumber('total_watch_time_hours', 'watch_hours_accumulated', 'watch_hours'),
                trendDirection: extractTrend(),
                suggestedTitle: deepFind(parsed, 'suggested_title', 'suggestion', 'recommended_title') || null,
                priority: deepFind(parsed, 'priority') || 'MEDIUM',
                topPerformers: deepFind(parsed, 'top_performing_shorts') || []
            };
        }

        return data?.metrics || {};
    };

    const metrics = extractMetrics();
    const topShorts = metrics.topPerformers || data?.topShorts || [];
    const hasData = data && (Object.keys(parsed).length > 0 || Object.keys(metrics).length > 0);

    // Determine status color based on velocity rank
    const getStatusColor = () => {
        const rank = metrics.velocityRank || 'D';
        if (rank === 'S' || rank === 'A') return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: '🚀 Strong' };
        if (rank === 'B') return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: '⚠️ Normal' };
        return { bg: 'bg-red-500/20', text: 'text-red-400', label: '🔻 Low' };
    };
    const status = getStatusColor();

    if (!hasData) {
        return (
            <div className="col-span-full bg-gradient-to-br from-purple-900/30 to-indigo-900/30 backdrop-blur-sm border border-purple-500/30 rounded-2xl overflow-hidden p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        🧠 DFL Report (Structured)
                    </h3>
                    <button
                        onClick={onCollect}
                        disabled={isCollecting}
                        className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-bold rounded-lg hover:opacity-80 disabled:opacity-50"
                    >
                        {isCollecting ? '⏳ Collecting...' : '🧠 Generate DFL Report'}
                    </button>
                </div>
                <div className="text-center py-8 text-slate-400">
                    <div className="text-4xl mb-4">🧠</div>
                    <p>Click "Generate DFL Report" to collect structured analytics</p>
                </div>
            </div>
        );
    }

    return (
        <div className="col-span-full bg-gradient-to-br from-purple-900/30 via-indigo-900/30 to-pink-900/30 backdrop-blur-sm border border-purple-500/30 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">🧠</span>
                    <div>
                        <h3 className="text-lg font-bold text-white">DFL Report (V2)</h3>
                        <p className="text-xs text-slate-400">Structured Analysis • {new Date(data?.timestamp || Date.now()).toLocaleTimeString()}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${status.bg} ${status.text}`}>
                        {status.label}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${metrics.trendDirection === 'UP' ? 'bg-emerald-500/20 text-emerald-400' : metrics.trendDirection === 'DOWN' ? 'bg-red-500/20 text-red-400' : 'bg-slate-500/20 text-slate-400'}`}>
                        {metrics.trendDirection === 'UP' ? '📈' : metrics.trendDirection === 'DOWN' ? '📉' : '➡️'} {metrics.trendDirection || 'UNKNOWN'}
                    </span>
                </div>
            </div>

            {/* 4-Column Metrics Grid */}
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Velocity Card */}
                <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl p-4 border border-amber-500/30">
                    <div className="text-xs text-amber-300 mb-1">⚡ 1st Hour Velocity</div>
                    <div className="text-2xl font-black text-white">{(metrics.firstHourVelocity || 0).toLocaleString()}</div>
                    <div className="text-xs text-slate-400 mt-1">Rank: <span className="font-bold text-amber-400">{metrics.velocityRank || '?'}</span></div>
                </div>

                {/* YPP Progress Card */}
                <div className="bg-gradient-to-br from-emerald-500/20 to-green-500/20 rounded-xl p-4 border border-emerald-500/30">
                    <div className="text-xs text-emerald-300 mb-1">✨ YPP Progress</div>
                    <div className="text-2xl font-black text-white">{(metrics.currentSubs || 0).toLocaleString()}</div>
                    <div className="text-xs text-slate-400 mt-1">
                        {metrics.daysToYPP < 365 ? `${metrics.daysToYPP} days to YPP` : 'Est. > 1 year'}
                    </div>
                </div>

                {/* Algorithm Signals Card */}
                <div className="bg-gradient-to-br from-cyan-500/20 to-teal-500/20 rounded-xl p-4 border border-cyan-500/30">
                    <div className="text-xs text-cyan-300 mb-1">📊 Avg View %</div>
                    <div className="text-2xl font-black text-white">{metrics.avgViewPct || 0}%</div>
                    <div className="text-xs text-slate-400 mt-1">
                        Swipe: <span className={metrics.swipeAwayRate > 30 ? 'text-red-400' : 'text-emerald-400'}>{metrics.swipeAwayRate}%</span>
                    </div>
                </div>

                {/* Watch Hours Card */}
                <div className="bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-xl p-4 border border-violet-500/30">
                    <div className="text-xs text-violet-300 mb-1">⏰ Watch Hours</div>
                    <div className="text-2xl font-black text-white">{(metrics.watchHours || 0).toLocaleString()}h</div>
                    <div className="text-xs text-slate-400 mt-1">
                        Feed: <span className="text-violet-400">{metrics.shortsFeedPct || 0}%</span>
                    </div>
                </div>
            </div>

            {/* Top Shorts List */}
            {topShorts.length > 0 && (
                <div className="px-4 pb-4">
                    <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                        <div className="text-xs font-bold text-slate-300 mb-2">🏆 Top Performing Shorts</div>
                        <div className="space-y-2">
                            {topShorts.slice(0, 3).map((short: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400 truncate max-w-[60%]">
                                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'} {short.title?.replace(/\[.*?\]/g, '').substring(0, 40) || 'Unknown'}
                                    </span>
                                    <span className="font-mono text-emerald-400">{(short.views || 0).toLocaleString()} views</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Suggested Content */}
            {metrics.suggestedTitle && (
                <div className="px-4 pb-4">
                    <div className="bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-xl p-3 border border-pink-500/20">
                        <div className="text-xs font-bold text-pink-300 mb-1">🎯 Next Content Suggestion ({metrics.priority})</div>
                        <div className="text-sm text-white font-medium">{metrics.suggestedTitle}</div>
                    </div>
                </div>
            )}

            {/* Expandable Raw Details */}
            <div className="border-t border-white/5">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full px-4 py-2 text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1 transition-colors"
                >
                    {isExpanded ? '▲ Hide Raw Data' : '▼ View Raw Data'}
                </button>
                {isExpanded && (
                    <div className="px-4 pb-4 animate-fade-in">
                        <div className="bg-black/30 rounded-lg p-3 max-h-48 overflow-auto text-xs font-mono text-slate-400 whitespace-pre-wrap">
                            {JSON.stringify(data, null, 2)}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 bg-black/20 flex items-center justify-between border-t border-white/5">
                <span className="text-xs text-slate-500">
                    Updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Never'}
                </span>
                <button
                    onClick={onCollect}
                    disabled={isCollecting}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-80 disabled:opacity-50"
                >
                    {isCollecting ? '⏳...' : '🔄 Refresh DFL'}
                </button>
            </div>
        </div>
    );
};

export default DFLReportCard;
export { DFLReportCard };
export type { DFLReportCardProps };
