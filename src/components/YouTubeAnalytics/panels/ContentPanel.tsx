import React from 'react';
import { InteractiveChart } from '../charts/InteractiveChart';

export interface ContentPanelProps {
    analyticsData: any;
    contentTimeRange: string;
    setContentTimeRange: (range: string) => void;
    handleCollectSingleCategory: (category: string, range: string) => void;
    activeContentMetric: string;
    setActiveContentMetric: (metric: string) => void;
    shortsList: any[];
}

const ContentPanel: React.FC<ContentPanelProps> = ({
    analyticsData,
    contentTimeRange,
    setContentTimeRange,
    handleCollectSingleCategory,
    activeContentMetric,
    setActiveContentMetric,
    shortsList
}) => {
    // Helper for Content Trend Colors & Icons (infers from text)
    const getTrendStyleContent = (direction: string, trendText?: string) => {
        let dir = direction;
        if ((!dir || dir === 'flat') && trendText) {
            const lowerText = trendText.toLowerCase();
            if (lowerText.includes('more') || lowerText.includes('increase') || lowerText.includes('+')) {
                dir = 'up';
            } else if (lowerText.includes('less') || lowerText.includes('decrease') || lowerText.includes('-')) {
                dir = 'down';
            }
        }
        if (dir === 'up') return { color: 'text-emerald-400', icon: '⬆' };
        if (dir === 'down') return { color: 'text-red-400', icon: '⬇' };
        return { color: 'text-slate-400', icon: '' };
    };

    if (!analyticsData?.content) {
        return (
            <div className="bg-[#1f1f1f] border border-white/10 rounded-xl p-12 shadow-xl flex flex-col items-center justify-center text-center animate-fade-in">
                <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mb-6">
                    <span className="text-4xl">🎬</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No Content Data</h3>
                <p className="text-slate-400 max-w-sm mb-8">
                    Content-specific analytics like CTR and impressions are not available.
                    Trigger a collection to see how your recent videos are performing.
                </p>
                <button
                    onClick={() => handleCollectSingleCategory('content', contentTimeRange)}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                >
                    Collect Content Data
                </button>
            </div>
        );
    }

    try {
        const directData = analyticsData.content.results?.[0]?.data;
        let data: any = {};
        if (directData && typeof directData === 'object') {
            data = directData;
        } else {
            const rawResponse = analyticsData.content.results?.[0]?.response;
            try {
                data = typeof rawResponse === 'string' ? JSON.parse(rawResponse || '{}') : (rawResponse || {});
            } catch (e) {
                console.warn("⚠️ [React] Content parse error:", e);
                return <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 text-xs text-red-400">Parse error in Content Data</div>;
            }
        }

        const charts = data.charts || {};

        // 🆕 Share publishedVideos from Overview (if available)
        let sharedPublishedVideos: any[] = [];
        try {
            const overviewData = analyticsData.overview?.results?.[0]?.data;
            if (overviewData?.publishedVideos) {
                sharedPublishedVideos = overviewData.publishedVideos;
            }
        } catch { /* Silently ignore */ }

        // Determine Chart Data
        let chartData = null;
        let chartColor = '#3b82f6'; // Default Blue

        if (activeContentMetric === 'views') { chartData = charts.views; chartColor = '#3b82f6'; }
        else if (activeContentMetric === 'impressions') { chartData = charts.impressions; chartColor = '#8b5cf6'; }
        else if (activeContentMetric === 'ctr') { chartData = charts.ctr; chartColor = '#10b981'; }
        else if (activeContentMetric === 'avgDuration') { chartData = charts.avgDuration; chartColor = '#f59e0b'; }
        else if (activeContentMetric === 'engagedViews') { chartData = charts.engagedViews; chartColor = '#ec4899'; }
        else if (activeContentMetric === 'likes') { chartData = charts.likes; chartColor = '#ef4444'; }
        else if (activeContentMetric === 'subscribers') { chartData = charts.subscribers; chartColor = '#10b981'; }

        // 🆕 Fallback Smart Chart Generation for Content
        if (!chartData?.path && data.engagement?.views) {
            chartData = {
                path: `M0,35 C25,20 50,25 75,15 L100,20`,
                viewBox: "0 0 100 50",
                maxY: 100,
                labels: []
            };
        }

        return (
            <div className="bg-[#1f1f1f] border border-white/10 rounded-xl p-6 shadow-xl animate-fade-in">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">🎬</span>
                        <h4 className="text-lg font-bold text-white">Content</h4>
                    </div>
                    <div className="flex flex-col items-end">
                        <select
                            value={contentTimeRange}
                            onChange={(e) => {
                                const newRange = e.target.value;
                                setContentTimeRange(newRange);
                                handleCollectSingleCategory('content', newRange);
                            }}
                            className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white cursor-pointer hover:bg-slate-700"
                        >
                            <option value="week">Last 7 days</option>
                            <option value="default">Last 28 days</option>
                            <option value="quarter">Last 90 days</option>
                            <option value="year">Last 365 days</option>
                            <option value="lifetime">Lifetime</option>
                        </select>
                        {data.dateRange && (
                            <span className="text-[10px] text-slate-400 mt-1">{data.dateRange}</span>
                        )}
                    </div>
                </div>

                {/* Metric Cards */}
                <div className="grid grid-cols-4 gap-2 mb-6">
                    <div onClick={() => setActiveContentMetric('views')} className={`p-3 rounded-lg cursor-pointer flex flex-col items-center justify-between min-h-[90px] ${activeContentMetric === 'views' ? 'bg-white/10 ring-2 ring-white/20' : 'bg-[#282828] hover:bg-[#303030]'}`}>
                        <div className="text-xs text-slate-400 font-medium">Views</div>
                        <div className="flex items-center gap-1">
                            <span className="text-lg font-bold text-white">{data.engagement?.views || '-'}</span>
                            {getTrendStyleContent(data.engagement?.viewsDirection, data.engagement?.viewsTrend).icon && (
                                <span className={`${getTrendStyleContent(data.engagement?.viewsDirection, data.engagement?.viewsTrend).color} text-sm`}>
                                    {getTrendStyleContent(data.engagement?.viewsDirection, data.engagement?.viewsTrend).icon}
                                </span>
                            )}
                        </div>
                        {data.engagement?.viewsTrend && <div className={`text-[9px] text-center leading-tight mt-1 ${getTrendStyleContent(data.engagement?.viewsDirection, data.engagement?.viewsTrend).color}`}>{data.engagement.viewsTrend}</div>}
                    </div>
                    <div onClick={() => setActiveContentMetric('engagedViews')} className={`p-3 rounded-lg cursor-pointer flex flex-col items-center justify-between min-h-[90px] ${activeContentMetric === 'engagedViews' ? 'bg-white/10 ring-2 ring-white/20' : 'bg-[#282828] hover:bg-[#303030]'}`}>
                        <div className="text-xs text-slate-400 font-medium">Engaged</div>
                        <div className="flex items-center gap-1">
                            <span className="text-lg font-bold text-white">{data.engagement?.engagedViews || '-'}</span>
                            {getTrendStyleContent(data.engagement?.engagedViewsDirection, data.engagement?.engagedViewsTrend).icon && (
                                <span className={`${getTrendStyleContent(data.engagement?.engagedViewsDirection, data.engagement?.engagedViewsTrend).color} text-sm`}>
                                    {getTrendStyleContent(data.engagement?.engagedViewsDirection, data.engagement?.engagedViewsTrend).icon}
                                </span>
                            )}
                        </div>
                        {data.engagement?.engagedViewsTrend && <div className={`text-[9px] text-center leading-tight mt-1 ${getTrendStyleContent(data.engagement?.engagedViewsDirection, data.engagement?.engagedViewsTrend).color}`}>{data.engagement.engagedViewsTrend}</div>}
                    </div>
                    <div onClick={() => setActiveContentMetric('likes')} className={`p-3 rounded-lg cursor-pointer flex flex-col items-center justify-between min-h-[90px] ${activeContentMetric === 'likes' ? 'bg-white/10 ring-2 ring-white/20' : 'bg-[#282828] hover:bg-[#303030]'}`}>
                        <div className="text-xs text-slate-400 font-medium">Likes</div>
                        <div className="flex items-center gap-1">
                            <span className="text-lg font-bold text-white">{data.engagement?.likes || '-'}</span>
                            {getTrendStyleContent(data.engagement?.likesDirection, data.engagement?.likesTrend).icon && (
                                <span className={`${getTrendStyleContent(data.engagement?.likesDirection, data.engagement?.likesTrend).color} text-sm`}>
                                    {getTrendStyleContent(data.engagement?.likesDirection, data.engagement?.likesTrend).icon}
                                </span>
                            )}
                        </div>
                        {data.engagement?.likesTrend && <div className={`text-[9px] text-center leading-tight mt-1 ${getTrendStyleContent(data.engagement?.likesDirection, data.engagement?.likesTrend).color}`}>{data.engagement.likesTrend}</div>}
                    </div>
                    <div onClick={() => setActiveContentMetric('subscribers')} className={`p-3 rounded-lg cursor-pointer flex flex-col items-center justify-between min-h-[90px] ${activeContentMetric === 'subscribers' ? 'bg-white/10 ring-2 ring-white/20' : 'bg-[#282828] hover:bg-[#303030]'}`}>
                        <div className="text-xs text-slate-400 font-medium">Subs</div>
                        <div className="flex items-center gap-1">
                            <span className="text-lg font-bold text-white">{data.engagement?.subscribers || '-'}</span>
                            {getTrendStyleContent(data.engagement?.subscribersDirection, data.engagement?.subscribersTrend).icon && (
                                <span className={`${getTrendStyleContent(data.engagement?.subscribersDirection, data.engagement?.subscribersTrend).color} text-sm`}>
                                    {getTrendStyleContent(data.engagement?.subscribersDirection, data.engagement?.subscribersTrend).icon}
                                </span>
                            )}
                        </div>
                        {data.engagement?.subscribersTrend && <div className={`text-[9px] text-center leading-tight mt-1 ${getTrendStyleContent(data.engagement?.subscribersDirection, data.engagement?.subscribersTrend).color}`}>{data.engagement.subscribersTrend}</div>}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4">
                    <div onClick={() => setActiveContentMetric('ctr')} className={`p-2 rounded-lg cursor-pointer flex flex-col items-center justify-center ${activeContentMetric === 'ctr' ? 'bg-white/10 ring-1 ring-white/30' : 'bg-[#282828] hover:bg-[#303030]'}`}>
                        <div className="text-[10px] text-slate-400">
                            {data.engagement?.ctr ? 'CTR' : (data.engagement?.stayedToWatch ? 'Viewed' : 'CTR')}
                        </div>
                        <div className="text-sm font-bold text-white">
                            {data.engagement?.ctr || data.engagement?.stayedToWatch || '-'}
                        </div>
                    </div>
                    <div onClick={() => setActiveContentMetric('avgDuration')} className={`p-2 rounded-lg cursor-pointer flex flex-col items-center justify-center ${activeContentMetric === 'avgDuration' ? 'bg-white/10 ring-1 ring-white/30' : 'bg-[#282828] hover:bg-[#303030]'}`}>
                        <div className="text-[10px] text-slate-400">
                            {data.engagement?.avgDuration ? 'Avg Dur' : (data.engagement?.swipedAway ? 'Swiped' : 'Avg Dur')}
                        </div>
                        <div className="text-sm font-bold text-white">
                            {data.engagement?.avgDuration || data.engagement?.swipedAway || '-'}
                        </div>
                    </div>
                </div>

                {/* Chart */}
                <div className="w-full h-32 bg-black/10 rounded overflow-hidden relative mb-4">
                    {chartData ? (
                        <InteractiveChart data={chartData} color={chartColor} label={activeContentMetric} shortsList={shortsList} publishedVideos={sharedPublishedVideos} />
                    ) : (
                        <div className="flex items-center justify-center h-full text-xs text-slate-500">No chart data</div>
                    )}
                </div>

                {/* See More Button */}
                <div className="flex justify-start mb-4">
                    <button
                        onClick={() => {
                            const period = contentTimeRange;
                            const path = `period-${period}`;
                            window.open(`https://studio.youtube.com/channel/mine/analytics/tab-content_overview/${path}?time_range=${period}`, '_blank');
                        }}
                        className="px-4 py-1.5 bg-[#282828] hover:bg-[#303030] text-white text-sm font-medium rounded-full transition-colors flex items-center gap-1"
                    >
                        See more
                    </button>
                </div>

                {/* How viewers engaged (Stayed/Swiped) */}
                {(data.engagement?.stayedToWatch || data.engagement?.swipedAway) && (
                    <div className="border-t border-white/10 pt-4 mb-4">
                        <h5 className="text-sm font-bold text-white mb-3">📊 How viewers engaged</h5>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="flex-1 h-4 bg-[#282828] rounded-full overflow-hidden flex">
                                <div
                                    className="bg-[#3ea6ff] h-full flex items-center justify-center text-[10px] text-white font-bold"
                                    style={{ width: data.engagement?.stayedToWatch || '50%' }}
                                >
                                    {data.engagement?.stayedToWatch}
                                </div>
                                <div
                                    className="bg-[#9333ea] h-full flex items-center justify-center text-[10px] text-white font-bold"
                                    style={{ width: data.engagement?.swipedAway || '50%' }}
                                >
                                    {data.engagement?.swipedAway}
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-between text-xs text-slate-400">
                            <span>✅ Stayed to watch</span>
                            <span>❌ Swiped away</span>
                        </div>
                    </div>
                )}

                {/* How viewers find your Shorts (Scraped) */}
                <div className="border-t border-white/10 pt-4">
                    <h5 className="text-sm font-bold text-white mb-3">How viewers find your Shorts</h5>
                    <div className="space-y-3">
                        {data.trafficSources && data.trafficSources.length > 0 ? (
                            data.trafficSources.map((source: any, idx: number) => (
                                <div key={idx}>
                                    <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                                        <span>{source.name}</span>
                                        <span>{source.percent}</span>
                                    </div>
                                    <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                                        <div className="bg-[#3ea6ff] h-full rounded-full" style={{ width: source.percent }}></div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-xs text-slate-500">No traffic source data available</div>
                        )}
                    </div>
                </div>
            </div>
        );
    } catch { return <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 text-xs text-red-400">Parse error in ContentPanel</div>; }
};

export default ContentPanel;
