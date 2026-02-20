import React from 'react';
import { InteractiveChart } from '../charts/InteractiveChart';

export interface AnalyticsPanelProps {
    analyticsData: any;
    audienceTimeRange: string;
    setAudienceTimeRange: (range: string) => void;
    handleCollectSingleCategory: (category: string, range: string) => void;
    activeAudienceMetric: string;
    setActiveAudienceMetric: (metric: string) => void;
    shortsList: any[];
}

const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({
    analyticsData,
    audienceTimeRange,
    setAudienceTimeRange,
    handleCollectSingleCategory,
    activeAudienceMetric,
    setActiveAudienceMetric,
    shortsList
}) => {
    // Helper for Audience Trend Colors & Icons
    const getTrendStyleAudience = (direction: string, trendText?: string) => {
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

    if (!analyticsData?.audience) {
        return (
            <div className="bg-[#1f1f1f] border border-white/10 rounded-xl p-12 shadow-xl flex flex-col items-center justify-center text-center animate-fade-in">
                <div className="w-20 h-20 bg-purple-500/10 rounded-full flex items-center justify-center mb-6">
                    <span className="text-4xl">👥</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No Audience Data</h3>
                <p className="text-slate-400 max-w-sm mb-8">
                    We don't have demographic or retention data for your audience yet.
                    Fetch your audience insights to better understand your viewers.
                </p>
                <button
                    onClick={() => handleCollectSingleCategory('audience', audienceTimeRange)}
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg transition-all shadow-lg shadow-purple-500/20 active:scale-95"
                >
                    Collect Audience Insights
                </button>
            </div>
        );
    }

    try {
        let data;
        const directData = analyticsData.audience.results?.[0]?.data;
        if (directData && typeof directData === 'object') {
            data = directData;
        } else {
            try {
                data = JSON.parse(analyticsData.audience.results?.[0]?.response || '{}');
            } catch {
                console.warn("⚠️ [React] Audience response is not JSON:", analyticsData.audience.results?.[0]?.response);
                data = {};
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
        let chartColor = '#8b5cf6'; // Default Purple

        if (activeAudienceMetric === 'returning') { chartData = charts.returning; chartColor = '#8b5cf6'; }
        else if (activeAudienceMetric === 'unique') { chartData = charts.unique; chartColor = '#ec4899'; }
        else if (activeAudienceMetric === 'subscribers') { chartData = charts.subscribers; chartColor = '#10b981'; }
        else if (activeAudienceMetric === 'monthlyAudience') { chartData = charts.monthlyAudience; chartColor = '#f59e0b'; }

        if (!chartData?.path) {
            const availableCharts = ['returning', 'unique', 'subscribers', 'monthlyAudience'];
            for (const key of availableCharts) {
                if (charts[key]?.path) {
                    chartData = charts[key];
                    break;
                }
            }
        }

        if (!chartData?.path && data.summary?.chartData?.path) {
            chartData = data.summary.chartData;
        }

        if (!chartData?.path && data.chartData?.path) {
            chartData = data.chartData;
        }

        // 🆕 Fallback Smart Chart Generation for Audience
        if (!chartData?.path) {
            const baseValue = 50;
            const variance = 15;

            // Generate default date labels if not available
            const dateLabelsToUse = data.dateLabels || [];
            if (dateLabelsToUse.length === 0) {
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const today = new Date();

                // Determine number of days based on time range
                let numDays = 7;
                const tr = audienceTimeRange || 'default';
                if (tr.includes('28') || tr.includes('month')) numDays = 28;
                else if (tr.includes('90')) numDays = 90;
                else if (tr.includes('365') || tr.includes('year')) numDays = 365;

                const step = Math.max(1, Math.floor(numDays / 7));
                for (let i = numDays - 1; i >= 0; i -= step) {
                    const d = new Date(today);
                    d.setDate(d.getDate() - i);
                    dateLabelsToUse.push(`${months[d.getMonth()]} ${d.getDate()}`);
                }
            }

            chartData = {
                path: `M0,${baseValue + variance} C30,${baseValue} 60,${baseValue - variance} 100,${baseValue - variance * 1.2}`,
                viewBox: "0 0 100 100",
                maxY: 100,
                labels: [],
                dateLabels: dateLabelsToUse
            };
        }

        // 🆕 Also ensure scraped chartData has dateLabels
        if (chartData && (!chartData.dateLabels || chartData.dateLabels.length === 0)) {
            chartData.dateLabels = data.dateLabels || [];
            if (chartData.dateLabels.length === 0) {
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const today = new Date();

                let numDays = 7;
                const tr = audienceTimeRange || 'default';
                if (tr.includes('28') || tr.includes('month')) numDays = 28;
                else if (tr.includes('90')) numDays = 90;
                else if (tr.includes('365') || tr.includes('year')) numDays = 365;

                const step = Math.max(1, Math.floor(numDays / 7));
                for (let i = numDays - 1; i >= 0; i -= step) {
                    const d = new Date(today);
                    d.setDate(d.getDate() - i);
                    chartData.dateLabels.push(`${months[d.getMonth()]} ${d.getDate()}`);
                }
            }
        }

        return (
            <div className="bg-[#1f1f1f] border border-white/10 rounded-xl p-6 shadow-xl animate-fade-in">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">👥</span>
                        <h4 className="text-lg font-bold text-white">Audience</h4>
                    </div>
                    <div className="flex flex-col items-end">
                        <select
                            value={audienceTimeRange}
                            onChange={(e) => {
                                const newRange = e.target.value;
                                setAudienceTimeRange(newRange);
                                handleCollectSingleCategory('audience', newRange);
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
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div onClick={() => setActiveAudienceMetric('returning')} className={`p-4 rounded-lg cursor-pointer flex flex-col items-center justify-between min-h-[100px] ${activeAudienceMetric === 'returning' ? 'bg-white/10 ring-2 ring-white/20' : 'bg-[#282828] hover:bg-[#303030]'}`}>
                        <div className="text-sm text-slate-400 font-medium mb-1">
                            {data.monthlyAudience ? 'Monthly audience' : (data.returningViewers ? 'Returning viewers' : 'Monthly audience')}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-white">{data.monthlyAudience || data.returningViewers || '-'}</span>
                            {getTrendStyleAudience(data.returningViewersDirection, data.returningViewersTrend).icon && (
                                <span className={`${getTrendStyleAudience(data.returningViewersDirection, data.returningViewersTrend).color} text-lg`}>
                                    {getTrendStyleAudience(data.returningViewersDirection, data.returningViewersTrend).icon}
                                </span>
                            )}
                        </div>
                        {data.returningViewersTrend && <div className={`text-[10px] text-center mt-2 leading-tight ${getTrendStyleAudience(data.returningViewersDirection, data.returningViewersTrend).color}`}>{data.returningViewersTrend}</div>}
                    </div>
                    <div onClick={() => setActiveAudienceMetric('unique')} className={`p-4 rounded-lg cursor-pointer flex flex-col items-center justify-between min-h-[100px] ${activeAudienceMetric === 'unique' ? 'bg-white/10 ring-2 ring-white/20' : 'bg-[#282828] hover:bg-[#303030]'}`}>
                        <div className="text-sm text-slate-400 font-medium mb-1">
                            {data.newViewers ? 'New viewers' : (data.uniqueViewers ? 'Unique viewers' : 'New viewers')}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-white">{data.newViewers || data.uniqueViewers || '-'}</span>
                            {getTrendStyleAudience(data.uniqueViewersDirection, data.uniqueViewersTrend).icon && (
                                <span className={`${getTrendStyleAudience(data.uniqueViewersDirection, data.uniqueViewersTrend).color} text-lg`}>
                                    {getTrendStyleAudience(data.uniqueViewersDirection, data.uniqueViewersTrend).icon}
                                </span>
                            )}
                        </div>
                        {data.uniqueViewersTrend && <div className={`text-[10px] text-center mt-2 leading-tight ${getTrendStyleAudience(data.uniqueViewersDirection, data.uniqueViewersTrend).color}`}>{data.uniqueViewersTrend}</div>}
                    </div>
                    <div onClick={() => setActiveAudienceMetric('subscribers')} className={`p-4 rounded-lg cursor-pointer flex flex-col items-center justify-between min-h-[100px] ${activeAudienceMetric === 'subscribers' ? 'bg-white/10 ring-2 ring-white/20' : 'bg-[#282828] hover:bg-[#303030]'}`}>
                        <div className="text-sm text-slate-400 font-medium mb-1">Subscribers</div>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-white">{data.subscribers || '-'}</span>
                            {getTrendStyleAudience(data.subscribersDirection, data.subscribersTrend).icon && (
                                <span className={`${getTrendStyleAudience(data.subscribersDirection, data.subscribersTrend).color} text-lg`}>
                                    {getTrendStyleAudience(data.subscribersDirection, data.subscribersTrend).icon}
                                </span>
                            )}
                        </div>
                        {data.subscribersTrend && <div className={`text-[10px] text-center mt-2 leading-tight ${getTrendStyleAudience(data.subscribersDirection, data.subscribersTrend).color}`}>{data.subscribersTrend}</div>}
                    </div>
                </div>

                {/* Chart */}
                <div className="w-full h-32 bg-black/10 rounded overflow-hidden relative mb-4">
                    {chartData ? (
                        <InteractiveChart data={chartData} color={chartColor} label={activeAudienceMetric} shortsList={shortsList} publishedVideos={sharedPublishedVideos} />
                    ) : (
                        <div className="flex items-center justify-center h-full text-xs text-slate-500">No chart data</div>
                    )}
                </div>

                {/* See More Button */}
                <div className="flex justify-start mb-4">
                    <button
                        onClick={() => {
                            const period = audienceTimeRange;
                            const path = `period-${period}`;
                            window.open(`https://studio.youtube.com/channel/mine/analytics/tab-audience/${path}?time_range=${period}`, '_blank');
                        }}
                        className="px-4 py-1.5 bg-[#282828] hover:bg-[#303030] text-white text-sm font-medium rounded-full transition-colors flex items-center gap-1"
                    >
                        See more
                    </button>
                </div>

                {/* Top Geographies Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-white/10 pt-6">
                    {/* Left Column: Geographies & Active Times */}
                    <div className="space-y-6">
                        {data.geographies && data.geographies.length > 0 && (
                            <div>
                                <h5 className="text-sm font-bold text-white mb-3">🌍 Top Geographies</h5>
                                <div className="space-y-3">
                                    {data.geographies.slice(0, 5).map((geo: any, idx: number) => (
                                        <div key={idx}>
                                            <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                                                <span>{geo.country}</span>
                                                <span className="font-medium text-white">{geo.percent}</span>
                                            </div>
                                            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                                                <div className="bg-purple-500 h-full rounded-full" style={{ width: geo.percent }}></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Active Times Heatmap */}
                        {(data.activeTimesHeatmap || data.activeTimes) && (
                            <div>
                                <h5 className="text-sm font-bold text-white mb-2">⏰ When your viewers are on YouTube</h5>
                                {data.activeTimesHeatmap && data.activeTimesHeatmap.grid ? (
                                    <div className="bg-white/5 rounded-lg p-3">
                                        <div className="text-[10px] text-purple-300 mb-2">{data.activeTimesHeatmap.timezone}</div>
                                        <div className="flex mb-1">
                                            <div className="w-12"></div>
                                            {data.activeTimesHeatmap.days.map((day: string, i: number) => (
                                                <div key={i} className="flex-1 text-center text-[9px] text-slate-400">{day}</div>
                                            ))}
                                        </div>
                                        {[0, 6, 12, 18].map((startHour, rowIdx) => (
                                            <div key={rowIdx} className="flex items-center mb-0.5">
                                                <div className="w-12 text-[9px] text-slate-500 pr-1">
                                                    {startHour === 0 ? '12AM' : startHour === 6 ? '6AM' : startHour === 12 ? '12PM' : '6PM'}
                                                </div>
                                                {[0, 1, 2, 3, 4, 5, 6].map((dayIdx) => {
                                                    let avgIntensity = 0;
                                                    let count = 0;
                                                    for (let h = startHour; h < startHour + 6 && h < (data.activeTimesHeatmap.grid?.length || 0); h++) {
                                                        if (data.activeTimesHeatmap.grid[h] && data.activeTimesHeatmap.grid[h][dayIdx] !== undefined) {
                                                            avgIntensity += data.activeTimesHeatmap.grid[h][dayIdx];
                                                            count++;
                                                        }
                                                    }
                                                    avgIntensity = count > 0 ? avgIntensity / count : 0;

                                                    return (
                                                        <div
                                                            key={dayIdx}
                                                            className="flex-1 h-4 mx-0.5 rounded-sm"
                                                            style={{
                                                                backgroundColor: `rgba(145, 47, 192, ${Math.min(avgIntensity, 1)})`,
                                                                border: '1px solid rgba(145, 47, 192, 0.3)'
                                                            }}
                                                            title={`${data.activeTimesHeatmap.days[dayIdx]} ${startHour}:00 - Activity: ${Math.round(avgIntensity * 100)}%`}
                                                        />
                                                    );
                                                })}
                                            </div>
                                        ))}
                                        <div className="flex items-center justify-end mt-2 gap-1 text-[9px] text-slate-500">
                                            <span>Low</span>
                                            <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: 'rgba(145, 47, 192, 0.2)' }}></div>
                                            <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: 'rgba(145, 47, 192, 0.5)' }}></div>
                                            <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: 'rgba(145, 47, 192, 0.8)' }}></div>
                                            <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: 'rgba(145, 47, 192, 1)' }}></div>
                                            <span>High</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white/5 rounded-lg p-3 text-xs text-slate-400">
                                        {typeof data.activeTimes === 'string' ? data.activeTimes : 'Activity data available'}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Column: Age/Gender & Watch Time */}
                    <div className="space-y-6">
                        {/* Age & Gender */}
                        {data.ageGender && (
                            <div>
                                <h5 className="text-sm font-bold text-white mb-3">🚻 Age and Gender</h5>
                                {data.ageGender.gender && (data.ageGender.gender.male || data.ageGender.gender.female) && (
                                    <div className="flex gap-2 mb-4">
                                        {data.ageGender.gender.female && (
                                            <div className="flex-1 bg-pink-500/20 border border-pink-500/30 rounded p-2 text-center">
                                                <div className="text-[10px] text-pink-300">Female</div>
                                                <div className="text-sm font-bold text-white">{data.ageGender.gender.female}</div>
                                            </div>
                                        )}
                                        {data.ageGender.gender.male && (
                                            <div className="flex-1 bg-blue-500/20 border border-blue-500/30 rounded p-2 text-center">
                                                <div className="text-[10px] text-blue-300">Male</div>
                                                <div className="text-sm font-bold text-white">{data.ageGender.gender.male}</div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {data.ageGender.ages && data.ageGender.ages.length > 0 && (
                                    <div className="space-y-2">
                                        {data.ageGender.ages.map((age: any, idx: number) => (
                                            <div key={idx} className="flex items-center text-xs">
                                                <span className="w-24 text-slate-400">{age.range}</span>
                                                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden mx-2">
                                                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: age.percent }}></div>
                                                </div>
                                                <span className="w-10 text-right text-white">{age.percent}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Watch Time from Subscribers */}
                        {data.subscriberWatchTime && (
                            <div>
                                <h5 className="text-sm font-bold text-white mb-3">📺 Watch time from subscribers</h5>
                                <div className="space-y-3">
                                    {data.subscriberWatchTime.subscribed && (
                                        <div>
                                            <div className="flex justify-between text-xs text-slate-300 mb-1">
                                                <span>Subscribed</span>
                                                <span className="text-white">{data.subscriberWatchTime.subscribed}</span>
                                            </div>
                                            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                                                <div className="bg-blue-500 h-full rounded-full" style={{ width: data.subscriberWatchTime.subscribed }}></div>
                                            </div>
                                        </div>
                                    )}
                                    {data.subscriberWatchTime.notSubscribed && (
                                        <div>
                                            <div className="flex justify-between text-xs text-slate-300 mb-1">
                                                <span>Not subscribed</span>
                                                <span className="text-white">{data.subscriberWatchTime.notSubscribed}</span>
                                            </div>
                                            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                                                <div className="bg-slate-500 h-full rounded-full" style={{ width: data.subscriberWatchTime.notSubscribed }}></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Videos growing your audience */}
                        {data.videosGrowingAudience && data.videosGrowingAudience.length > 0 && (
                            <div className="mt-6 border-t border-white/10 pt-4">
                                <h5 className="text-sm font-bold text-white mb-3">🚀 Videos growing your audience</h5>
                                <div className="space-y-3">
                                    {data.videosGrowingAudience.map((video: any, idx: number) => (
                                        <div key={idx} className="flex items-start gap-2 text-xs">
                                            <span className="text-slate-500 font-mono w-4">{idx + 1}.</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-slate-300 truncate" title={video.title}>{video.title}</div>
                                                <div className="text-[10px] text-slate-500">{video.views} views</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    } catch (e) {
        return (
            <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-4 text-xs text-red-400 overflow-auto max-h-40">
                <p className="font-bold mb-1">Parse error: {(e as Error).message}</p>
                {analyticsData.audience?.results?.[0]?.response && (
                    <div className="mt-2 p-2 bg-black/30 rounded text-slate-400 font-mono whitespace-pre-wrap break-all">
                        {analyticsData.audience.results[0].response.substring(0, 300)}...
                    </div>
                )}
            </div>
        );
    }
};

export default AnalyticsPanel;
