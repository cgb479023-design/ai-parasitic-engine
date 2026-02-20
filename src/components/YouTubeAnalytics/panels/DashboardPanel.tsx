import React from 'react';
import { InteractiveChart } from '../charts/InteractiveChart';

export interface DashboardPanelProps {
    analyticsData: any;
    overviewTimeRange: string;
    setOverviewTimeRange: (range: string) => void;
    handleCollectSingleCategory: (category: string, range: string) => void;
    activeMetric: string;
    setActiveMetric: (metric: string) => void;
    shortsList: any[];
}

const DashboardPanel: React.FC<DashboardPanelProps> = ({
    analyticsData,
    overviewTimeRange,
    setOverviewTimeRange,
    handleCollectSingleCategory,
    activeMetric,
    setActiveMetric,
    shortsList
}) => {
    // Helper for Trend Colors & Icons
    const getTrendStyle = (direction: string, trendText?: string) => {
        let dir = direction;
        if ((!dir || dir === 'flat') && trendText) {
            const lowerText = trendText.toLowerCase();
            if (lowerText.includes('more') || lowerText.includes('increase') || lowerText.includes('+')) {
                dir = 'up';
            } else if (lowerText.includes('less') || lowerText.includes('decrease') || lowerText.includes('-')) {
                dir = 'down';
            }
        }

        if (dir === 'up') return { color: 'text-emerald-400', icon: '⬆', bg: 'bg-emerald-400/10' };
        if (dir === 'down') return { color: 'text-red-400', icon: '⬇', bg: 'bg-red-400/10' };
        return { color: 'text-slate-400', icon: '', bg: 'bg-slate-400/10' };
    };

    if (!analyticsData?.overview) {
        return (
            <div className="bg-[#1f1f1f] border border-white/10 rounded-xl p-12 shadow-xl flex flex-col items-center justify-center text-center animate-fade-in">
                <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mb-6">
                    <span className="text-4xl">📊</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No Dashboard Data</h3>
                <p className="text-slate-400 max-w-sm mb-8">
                    We haven't collected your YouTube analytics overview yet.
                    Click the button below to fetch your latest channel performance.
                </p>
                <div className="flex gap-4">
                    <button
                        onClick={() => handleCollectSingleCategory('overview', overviewTimeRange)}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                    >
                        Collect Overview
                    </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-6 uppercase tracking-widest font-bold">
                    YouTube Analytics Engine • Active
                </p>
            </div>
        );
    }

    try {
        const directData = analyticsData.overview.results?.[0]?.data;
        let data: any = {};

        if (directData && typeof directData === 'object') {
            data = directData;
        } else if (analyticsData.overview && typeof analyticsData.overview === 'object' && !analyticsData.overview.results) {
            // Support very flat direct results if they bypassed normalization
            data = analyticsData.overview;
        } else {
            const rawResponse = analyticsData.overview.results?.[0]?.response;
            try {
                data = typeof rawResponse === 'string' ? JSON.parse(rawResponse || '{}') : (rawResponse || {});
            } catch (e) {
                console.warn("⚠️ [React] Overview parse error:", e);
                return <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-xs text-red-400">Parse error in Overview Data</div>;
            }
        }

        // Shared published videos - needed for charts
        const sharedPublishedVideos = data.publishedVideos || [];

        return (
            <div className="bg-[#1f1f1f] border border-white/10 rounded-xl p-6 shadow-xl animate-fade-in">
                {/* Header with Time Range Selector */}
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white">📊 Overview</h3>
                    <div className="flex flex-col items-end">
                        <select
                            value={overviewTimeRange}
                            onChange={(e) => {
                                const newRange = e.target.value;
                                setOverviewTimeRange(newRange);
                                handleCollectSingleCategory('overview', newRange);
                            }}
                            className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white cursor-pointer hover:bg-slate-700"
                        >
                            <option value="week">Last 7 days</option>
                            <option value="default">Last 28 days</option>
                            <option value="quarter">Last 90 days</option>
                            <option value="year">Last 365 days</option>
                            <option value="lifetime">Lifetime</option>
                        </select>
                        {data.summary?.dateRange && (
                            <span className="text-[10px] text-slate-400 mt-1">{data.summary.dateRange}</span>
                        )}
                    </div>
                </div>

                {/* Dynamic Summary */}
                <div className="text-center mb-4">
                    <p className="text-lg text-white">
                        Your channel got <span className="font-bold text-blue-400">{data.summary?.views || '...'}</span> views in the {
                            overviewTimeRange === 'week' ? 'last 7 days' :
                                overviewTimeRange === 'quarter' ? 'last 90 days' :
                                    overviewTimeRange === 'year' ? 'last 365 days' :
                                        overviewTimeRange === 'lifetime' ? 'lifetime' : 'last 28 days'
                        }
                    </p>
                </div>

                {/* Metric Cards Grid */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    {/* Views Card */}
                    <div
                        onClick={() => setActiveMetric('views')}
                        className={`rounded-lg p-4 cursor-pointer transition-all flex flex-col items-center justify-between min-h-[100px] ${activeMetric === 'views' ? 'bg-white/10 ring-2 ring-white/20' : 'bg-[#282828] hover:bg-[#303030]'}`}
                    >
                        <div className="text-sm text-slate-400 font-medium mb-1">Views</div>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-white">{data.summary?.views || '—'}</span>
                            {(() => {
                                const style = getTrendStyle(data.summary?.viewsDirection, data.summary?.viewsTrend);
                                return style.icon ? <span className={`${style.color} text-lg`}>{style.icon}</span> : null;
                            })()}
                        </div>
                        {data.summary?.viewsTrend && (
                            <div className={`text-[10px] text-center mt-2 leading-tight ${getTrendStyle(data.summary?.viewsDirection, data.summary?.viewsTrend).color}`}>
                                {data.summary.viewsTrend}
                            </div>
                        )}
                    </div>

                    {/* Watch Time Card */}
                    <div
                        onClick={() => setActiveMetric('watchTime')}
                        className={`rounded-lg p-4 cursor-pointer transition-all flex flex-col items-center justify-between min-h-[100px] ${activeMetric === 'watchTime' ? 'bg-white/10 ring-2 ring-white/20' : 'bg-[#282828] hover:bg-[#303030]'}`}
                    >
                        <div className="text-sm text-slate-400 font-medium mb-1">Watch time (hours)</div>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-white">{data.summary?.watchTime || '—'}</span>
                            {(() => {
                                const style = getTrendStyle(data.summary?.watchTimeDirection, data.summary?.watchTimeTrend);
                                return style.icon ? <span className={`${style.color} text-lg`}>{style.icon}</span> : null;
                            })()}
                        </div>
                        {data.summary?.watchTimeTrend && (
                            <div className={`text-[10px] text-center mt-2 leading-tight ${getTrendStyle(data.summary?.watchTimeDirection, data.summary?.watchTimeTrend).color}`}>
                                {data.summary.watchTimeTrend}
                            </div>
                        )}
                    </div>

                    {/* Subscribers Card */}
                    <div
                        onClick={() => setActiveMetric('subscribers')}
                        className={`rounded-lg p-4 cursor-pointer transition-all flex flex-col items-center justify-between min-h-[100px] ${activeMetric === 'subscribers' ? 'bg-white/10 ring-2 ring-white/20' : 'bg-[#282828] hover:bg-[#303030]'}`}
                    >
                        <div className="text-sm text-slate-400 font-medium mb-1">Subscribers</div>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-white">{data.summary?.subscribers || '—'}</span>
                            {(() => {
                                const style = getTrendStyle(data.summary?.subscribersDirection, data.summary?.subscribersTrend);
                                return style.icon ? <span className={`${style.color} text-lg`}>{style.icon}</span> : null;
                            })()}
                        </div>
                        {data.summary?.subscribersTrend && (
                            <div className={`text-[10px] text-center mt-2 leading-tight ${getTrendStyle(data.summary?.subscribersDirection, data.summary?.subscribersTrend).color}`}>
                                {data.summary.subscribersTrend}
                            </div>
                        )}
                    </div>
                </div>

                {/* Interactive Chart */}
                <div className="mt-3 w-full h-32 bg-black/10 rounded overflow-hidden relative mb-4">
                    {(() => {
                        let chartData = data.summary?.viewsChart;
                        let chartColor = '#3ea6ff';
                        if (activeMetric === 'watchTime') {
                            chartData = data.summary?.watchTimeChart;
                            chartColor = '#3b82f6';
                        } else if (activeMetric === 'subscribers') {
                            chartData = data.summary?.subsChart;
                            chartColor = '#8b5cf6';
                        }

                        if (!chartData) chartData = data.summary?.chartData;

                        // Fallback Smart Generation
                        if (!chartData?.path && data.summary?.viewsTrend) {
                            const trend = data.summary.viewsTrend || '';
                            const isUp = trend.includes('more');
                            const isDown = trend.includes('less');
                            const percentMatch = trend.match(/(\d+)%/);
                            const percent = percentMatch ? parseInt(percentMatch[1]) : 20;
                            const variance = Math.min(Math.max(percent * 0.2, 5), 15);

                            let path = "M0,25 Q25,22 50,25 T100,25";
                            if (isUp) path = `M0,40 C30,40 70,${25 - variance} 100,10`;
                            if (isDown) path = `M0,10 C30,10 70,${25 + variance} 100,40`;

                            chartData = { path, viewBox: "0 0 100 50", maxY: 100, labels: [] };
                        }

                        if (chartData) {
                            return (
                                <InteractiveChart
                                    data={chartData}
                                    color={chartColor}
                                    label={activeMetric}
                                    shortsList={shortsList}
                                    publishedVideos={sharedPublishedVideos}
                                />
                            );
                        }

                        return (
                            <div className="flex items-center justify-center h-full text-xs text-slate-500">
                                No chart data available
                            </div>
                        );
                    })()}
                </div>

                {/* Published Videos Timeline */}
                {data.publishedVideos && data.publishedVideos.length > 0 && (
                    <div className="mt-3 mb-3">
                        <p className="text-xs text-slate-400 mb-2 flex items-center gap-2">
                            📹 <span className="font-medium text-white">{data.totalPublishedVideos || data.publishedVideos.length} videos published</span>
                        </p>
                        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                            {data.publishedVideos.slice(0, 5).map((video: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group">
                                    <a
                                        href={video.analyticsUrl || `https://studio.youtube.com/video/${video.videoId}/analytics`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-shrink-0"
                                    >
                                        <img
                                            src={video.thumbnailUrl || `https://i.ytimg.com/vi/${video.videoId}/default.jpg`}
                                            alt={video.title}
                                            className="w-16 h-10 rounded object-cover border border-white/10 group-hover:border-blue-500/50 transition-colors"
                                            onError={(e) => { (e.target as HTMLImageElement).src = `https://i.ytimg.com/vi/${video.videoId}/default.jpg`; }}
                                        />
                                    </a>
                                    <div className="flex-1 min-w-0">
                                        <a
                                            href={video.analyticsUrl || `https://studio.youtube.com/video/${video.videoId}/analytics`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-white font-medium truncate block hover:text-blue-400 transition-colors"
                                            title={video.title}
                                        >
                                            {video.title || 'Untitled Video'}
                                        </a>
                                        <p className="text-[10px] text-slate-400">{video.publishDate || 'No date'}</p>
                                    </div>
                                    <a
                                        href={video.analyticsUrl || `https://studio.youtube.com/video/${video.videoId}/analytics`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-slate-400 hover:text-blue-400 transition-colors p-1"
                                        title="View Analytics"
                                    >
                                        📊
                                    </a>
                                </div>
                            ))}
                        </div>
                        {(data.totalPublishedVideos || data.publishedVideos.length) > 5 && (
                            <p className="text-[10px] text-slate-500 mt-2 text-center">
                                + {(data.totalPublishedVideos || data.publishedVideos.length) - 5} more videos
                            </p>
                        )}
                    </div>
                )}

                {/* See More Button */}
                <div className="flex justify-start">
                    <button
                        onClick={() => {
                            const period = overviewTimeRange;
                            const path = `period-${period}`;
                            window.open(`https://studio.youtube.com/channel/mine/analytics/tab-overview/${path}?time_range=${period}`, '_blank');
                        }}
                        className="px-4 py-1.5 bg-[#282828] hover:bg-[#303030] text-white text-sm font-medium rounded-full transition-colors flex items-center gap-1"
                    >
                        See more
                    </button>
                </div>

                {data.realtime && (
                    <div className="mb-3 mt-4 pt-4 border-t border-white/10">
                        <p className="text-xs text-slate-400 mb-1">Realtime</p>
                        <p className="text-sm text-white">👥 {data.realtime.subscribers} subs | 👁️ {data.realtime.views} views</p>
                    </div>
                )}

                {data.topContent && data.topContent.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                        <p className="text-xs text-slate-400 mb-2">Top Content</p>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                            {data.topContent.slice(0, 10).map((item: any, idx: number) => {
                                const videoId = item.videoId || item.id || '';
                                const thumbnailUrl = item.thumbnail || (videoId ? `https://i.ytimg.com/vi/${videoId}/default.jpg` : '');
                                const analyticsUrl = videoId ? `https://studio.youtube.com/video/${videoId}/analytics` : '';
                                const isShort = item.isShort || item.title?.includes('Short') || (item.duration && parseInt(item.duration) <= 60);
                                const contentIcon = isShort ? '🩳' : '🎬';

                                return (
                                    <a
                                        key={idx}
                                        href={analyticsUrl || '#'}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`flex items-start gap-2 p-1.5 rounded bg-white/5 hover:bg-white/15 transition-colors ${analyticsUrl ? 'cursor-pointer' : 'cursor-default'}`}
                                        onClick={(e) => !analyticsUrl && e.preventDefault()}
                                    >
                                        <div className="w-4 text-[10px] text-slate-500 font-mono pt-1">{idx + 1}</div>
                                        <div className="w-12 h-8 bg-slate-700 rounded overflow-hidden flex-shrink-0">
                                            {thumbnailUrl ? (
                                                <img
                                                    src={thumbnailUrl}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                        const parent = (e.target as HTMLImageElement).parentElement;
                                                        if (parent) parent.innerHTML = `<div class="w-full h-full flex items-center justify-center text-lg">${contentIcon}</div>`;
                                                    }}
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-lg">{contentIcon}</div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] text-white truncate hover:text-blue-300" title={item.title}>{item.title}</p>
                                            <div className="flex items-center gap-1 text-[9px] text-slate-500">
                                                {item.date && <span>{item.date}</span>}
                                                {item.recentUpload && <span className="px-1 py-0.5 bg-blue-500/20 text-blue-300 rounded text-[8px]">Recent</span>}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] text-slate-300">{item.duration || '-'}</div>
                                            {item.durationPercent && (
                                                <div className={`text-[9px] ${parseFloat(item.durationPercent) > 100 ? 'text-green-400' : 'text-slate-500'}`}>
                                                    ({item.durationPercent})
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right w-14">
                                            <div className="text-[11px] font-medium text-blue-400">{item.views}</div>
                                        </div>
                                    </a>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        );
    } catch {
        return <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-xl p-4 text-xs text-red-400">Parse error in DashboardPanel</div>;
    }
};

export default DashboardPanel;
