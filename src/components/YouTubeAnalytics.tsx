
import React, { useState, useEffect } from 'react';
import { RefreshCw, Settings, MessageSquare, Bell, Zap, Layout, Activity, Monitor } from 'lucide-react';
import { useLocalization } from '../contexts/LocalizationContext';
import { YouTubeAnalyticsProps } from './YouTubeAnalytics/types';

// Hooks
import { useAnalyticsData } from './YouTubeAnalytics/hooks/useAnalyticsData';
import { useYPP } from './YouTubeAnalytics/hooks/useYPP';
import { useDFL } from './YouTubeAnalytics/hooks/useDFL';
import { useYouTubeData } from './YouTubeAnalytics/hooks/useYouTubeData';

// Panels
import DashboardPanel from './YouTubeAnalytics/panels/DashboardPanel';
import ContentPanel from './YouTubeAnalytics/panels/ContentPanel';
import AnalyticsPanel from './YouTubeAnalytics/panels/AnalyticsPanel';
import YPPPanel from './YouTubeAnalytics/panels/YPPPanel';
import { YPPModal } from './YouTubeAnalytics/modals/YPPModal';
import { YPPReportModal } from './YouTubeAnalytics/modals/YPPReportModal';
import IgnitePanel from './YouTubeAnalytics/panels/IgnitePanel';
import DFLPanel from './YouTubeAnalytics/panels/DFLPanel';
import TopicPanel from './YouTubeAnalytics/panels/TopicPanel';

// P3-P5 Advanced Panels
import { QualityGatePanel } from './YouTubeAnalytics/panels/QualityGatePanel';
import { CrossPlatformPanel } from './YouTubeAnalytics/panels/CrossPlatformPanel';
import { CalendarView } from './YouTubeAnalytics/panels/CalendarView';
import { TemplateEditor } from './YouTubeAnalytics/panels/TemplateEditor';
import { TelegramConfig } from './YouTubeAnalytics/panels/SettingsPanel';

// V2.0 Aetheria Industrial Components
import VPHInterceptorPanel from './Aetheria/VPHInterceptorPanel';
import PipelineMatrix from './Aetheria/PipelineMatrix';
import CTRMatrix from './Aetheria/CTRMatrix';
import EvoMapTerminal from './Aetheria/EvoMapTerminal';
import { useIntentStream } from '../hooks/useIntentStream';

const CONSTANTS = {
    CATEGORIES: [
        { id: 'yppSprint', name: 'YPP Sprint', icon: '⚡' },
        { id: 'channelOverview', name: 'Overview', icon: '📊' },
        { id: 'videoPerformance', name: 'Content', icon: '🎬' },
        { id: 'audience', name: 'Audience', icon: '👥' },
        { id: 'traffic', name: 'Traffic', icon: '🚦' },
        { id: 'engagement', name: 'Engagement', icon: '❤️' },
        { id: 'comments', name: 'Comments', icon: '💬' }
    ]
};

export const YouTubeAnalytics: React.FC<YouTubeAnalyticsProps> = ({ apiKey }) => {
    const { t } = useLocalization();

    // UI State
    const [activeTab, setActiveTab] = useState<'dashboard' | 'content' | 'analytics' | 'ypp' | 'ignite' | 'dfl' | 'research' | 'quality' | 'crossplatform' | 'calendar' | 'templates'>('dashboard');
    const [showSettings, setShowSettings] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);

    // Panel Specific State
    const [activeMetric, setActiveMetric] = useState('views');
    const [activeAudienceMetric, setActiveAudienceMetric] = useState('returning');
    const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);

    // YPP Panel States
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [customInstructions, setCustomInstructions] = useState('');
    const [planRowsPerPage, setPlanRowsPerPage] = useState(10);
    const [planPage, setPlanPage] = useState(0);
    const [planSortConfig, setPlanSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

    // Hooks - Business Logic
    const {
        analyticsData,
        isCollecting,
        progress,
        handleManualCollect,
        handleRetry,

        // Time Ranges
        timeRange,
        setTimeRange,
        overviewTimeRange,
        setOverviewTimeRange,
        contentTimeRange,
        setContentTimeRange,
        audienceTimeRange,
        setAudienceTimeRange,

        // Custom Query
        customResult,
        isCustomCollecting,
        customQuery,
        setCustomQuery,
        askAsJson,
        setAskAsJson,
        handleCustomQuerySubmit // Hook handles logic
    } = useAnalyticsData();

    const {
        shortsList,
        commentsData,
        notifications,
        analyticsLogs,
        setAnalyticsLogs,
        extensionStatus,
        isExtensionInvalidated,
        checkExtensionStatus,
        commentsQueueStatus,
        collectSingleCategory
    } = useYouTubeData();

    // DFL & YPP Interdependency
    // Initialize YPP first
    const ypp = useYPP(analyticsData);

    // V2.0 Intent Stream
    const { intents } = useIntentStream();

    // Initialize DFL
    const dfl = useDFL(
        analyticsData,
        ypp.setYppPlan,
        ypp.executeFullPlan
    );

    // Derived State
    const lastUpdated = analyticsData?.overview?.metadata?.fetchTime
        ? new Date(analyticsData.overview.metadata.fetchTime)
        : null;

    // Tabs Configuration
    const tabs = [
        { id: 'dashboard', label: 'Dashboard', icon: <Layout size={16} /> },
        { id: 'content', label: 'Content', icon: <VideoIcon /> },
        { id: 'analytics', label: 'Analytics', icon: <Activity size={16} /> },
        { id: 'ypp', label: 'YPP Sprint', icon: <Zap size={16} />, highlight: true },
        { id: 'ignite', label: 'Ignite', icon: <MessageSquare size={16} /> },
        { id: 'dfl', label: 'DFL System', icon: <Monitor size={16} />, color: 'text-purple-400' },
        { id: 'research', label: 'Topic Research', icon: <SearchIcon /> },
        { id: 'quality', label: 'Quality Gate', icon: <span>🔍</span>, color: 'text-orange-400' },
        { id: 'crossplatform', label: 'Cross-Platform', icon: <span>🌐</span>, color: 'text-cyan-400' },
        { id: 'calendar', label: 'Calendar', icon: <span>📅</span>, color: 'text-green-400' },
        { id: 'templates', label: 'Templates', icon: <span>📝</span>, color: 'text-indigo-400' }
    ];

    // 🔗 Deep Linking & Hash Routing
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.slice(1);
            if (hash.startsWith('youtube_analytics/')) {
                const subTab = hash.split('/')[1];
                const validTabs = ['dashboard', 'content', 'analytics', 'ypp', 'ignite', 'dfl', 'research', 'quality', 'crossplatform', 'calendar', 'templates'];
                if (validTabs.includes(subTab)) {
                    setActiveTab(subTab as any);
                }
            } else if (hash === 'youtube_analytics') {
                setActiveTab('dashboard');
            }
        };
        handleHashChange();
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    const handleTabChange = (tabId: any) => {
        setActiveTab(tabId);
        window.location.hash = `youtube_analytics/${tabId}`;
    };

    const startAutoRefreshSequence = async () => {
        setIsAutoRefreshing(true);
        try {
            // 1. Scrape Overview
            collectSingleCategory('overview', overviewTimeRange);
            await new Promise(r => setTimeout(r, 8000));

            // 2. Scrape Content
            collectSingleCategory('content', contentTimeRange);
            await new Promise(r => setTimeout(r, 8000));

            // 3. Scrape Audience
            collectSingleCategory('audience', audienceTimeRange);
            await new Promise(r => setTimeout(r, 8000));

            // 4. Generate Plan
            await ypp.generateYppPlan();

        } catch (e) {
            console.error("Auto Refresh Sequence Failed", e);
        } finally {
            setIsAutoRefreshing(false);
        }
    };

    const handleCancelOperations = () => {
        setIsAutoRefreshing(false);
        ypp.handleCancelOperations();
    };

    return (
        <div className="flex bg-[#0f0f0f] text-white min-h-screen font-sans">
            {/* Sidebar */}
            <div className="w-64 bg-[#1f1f1f] border-r border-white/10 flex flex-col p-4">
                <div className="flex items-center gap-3 mb-8 px-2">
                    <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-lg">▶</span>
                    </div>
                    <div>
                        <h1 className="font-bold text-lg tracking-tight">Studio AI</h1>
                        <div className="text-[10px] text-slate-400">Advanced Analytics</div>
                    </div>
                </div>

                <div className="space-y-1 flex-1">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id as any)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === tab.id
                                ? 'bg-white/10 text-white font-medium shadow-lg'
                                : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            <span className={tab.highlight ? 'text-yellow-400' : (tab.color || '')}>{tab.icon}</span>
                            <span>{tab.label}</span>
                            {tab.id === 'ypp' && ypp.isExecutingPlan && (
                                <span className="ml-auto w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Status Footer */}
                <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                        <span>Extension Status</span>
                        <span className={`${extensionStatus === 'connected' ? 'text-green-500' : 'text-red-500 animate-pulse'}`}>
                            {extensionStatus === 'connected' ? '● Connected' : '● Disconnected'}
                        </span>
                    </div>
                    {isExtensionInvalidated && (
                        <div className="text-[10px] text-red-400 bg-red-900/20 p-2 rounded mb-2">
                            Extension invalidated. Refresh page.
                        </div>
                    )}
                    <button
                        onClick={() => checkExtensionStatus()}
                        className="w-full py-1.5 bg-white/5 hover:bg-white/10 rounded text-xs text-slate-400 flex items-center justify-center gap-2"
                    >
                        <RefreshCw size={12} /> Check Connection
                    </button>
                    <div className="text-[10px] text-slate-600 text-center mt-2">v3.5.0 • DFL Active</div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto">
                {/* Header */}
                <header className="sticky top-0 z-10 bg-[#0f0f0f]/90 backdrop-blur-md border-b border-white/10 px-8 py-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            {tabs.find(t => t.id === activeTab)?.icon}
                            {tabs.find(t => t.id === activeTab)?.label}
                        </h2>
                    </div>
                    <div className="flex items-center gap-3">
                        {activeTab === 'dashboard' && (
                            <div className="flex items-center gap-2 bg-[#1f1f1f] rounded-lg p-1 border border-white/10">
                                <select
                                    className="bg-transparent text-xs text-white outline-none p-1"
                                    value={overviewTimeRange}
                                    onChange={(e) => {
                                        setOverviewTimeRange(e.target.value);
                                        collectSingleCategory('overview', e.target.value);
                                    }}
                                >
                                    <option value="default">Last 28 Days</option>
                                    <option value="week">Last 7 Days</option>
                                    <option value="month">This Month</option>
                                    <option value="year">Last 365 Days</option>
                                </select>
                            </div>
                        )}

                        <button className="p-2 hover:bg-white/10 rounded-full relative">
                            <Bell size={20} className="text-slate-400" />
                            {notifications.length > 0 && (
                                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                            )}
                        </button>
                        <button
                            className="p-2 hover:bg-white/10 rounded-full"
                            onClick={() => setShowSettings(!showSettings)}
                        >
                            <Settings size={20} className="text-slate-400" />
                        </button>
                    </div>
                </header>

                <main className="p-8 max-w-7xl mx-auto">
                    {/* Progress Bar */}
                    {isCollecting && (
                        <div className="mb-6 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-blue-300">COLLECTING DATA...</span>
                                <span className="text-xs text-blue-400">{progress}</span>
                            </div>
                            <div className="h-1 bg-blue-500/20 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 animate-pulse rounded-full w-full"></div>
                            </div>
                        </div>
                    )}

                    {/* Tab Content */}
                    <div className="animate-fade-in">
                        {activeTab === 'dashboard' && (
                            <DashboardPanel
                                analyticsData={analyticsData}
                                overviewTimeRange={overviewTimeRange}
                                setOverviewTimeRange={setOverviewTimeRange}
                                handleCollectSingleCategory={collectSingleCategory}
                                activeMetric={activeMetric}
                                setActiveMetric={setActiveMetric}
                                shortsList={shortsList}
                            />
                        )}

                        {activeTab === 'content' && (
                            <ContentPanel
                                analyticsData={analyticsData}
                                contentTimeRange={contentTimeRange}
                                setContentTimeRange={setContentTimeRange}
                                handleCollectSingleCategory={collectSingleCategory}
                                activeContentMetric={activeMetric} // Sharing view state for now
                                setActiveContentMetric={setActiveMetric}
                                shortsList={shortsList}
                            />
                        )}

                        {activeTab === 'analytics' && (
                            <AnalyticsPanel
                                analyticsData={analyticsData}
                                audienceTimeRange={audienceTimeRange}
                                setAudienceTimeRange={setAudienceTimeRange}
                                handleCollectSingleCategory={collectSingleCategory}
                                activeAudienceMetric={activeAudienceMetric}
                                setActiveAudienceMetric={setActiveAudienceMetric}
                                shortsList={shortsList}
                            />
                        )}

                        {activeTab === 'ypp' && (
                            <>
                                <YPPPanel
                                    yppPlan={ypp.yppPlan}
                                    setYppPlan={ypp.setYppPlan}
                                    yppProgress={ypp.yppProgress}
                                    forceLMArena={ypp.forceLMArena}
                                    setForceLMArena={ypp.setForceLMArena}
                                    videoPlatform={ypp.videoPlatform}
                                    setVideoPlatform={ypp.setVideoPlatform}
                                    startAutoRefreshSequence={startAutoRefreshSequence}
                                    isGeneratingPlan={ypp.isGeneratingPlan}
                                    isExecutingPlan={ypp.isExecutingPlan}
                                    isAutoRefreshing={isAutoRefreshing}
                                    handleCancelOperations={handleCancelOperations}
                                    toggleManualInput={() => ypp.setIsWaitingForManualPlan(!ypp.isWaitingForManualPlan)}
                                    analyzePerformance={() => ypp.handleGenerateYPPReport()}
                                    debugMode={ypp.debugMode}
                                    setDebugMode={ypp.setDebugMode}
                                    analyticsLogs={analyticsLogs}
                                    setAnalyticsLogs={setAnalyticsLogs}

                                    executeFullPlan={ypp.executeFullPlan}
                                    selectedVideos={ypp.selectedVideos} // Note: This might need to be exposed from useYPP if not already. Steps showed useYPP having 'selectedVideos'.
                                    analyticsData={analyticsData}
                                    lastRefreshTime={lastUpdated}

                                    showCustomInput={showCustomInput}
                                    setShowCustomInput={setShowCustomInput}
                                    customInstructions={customInstructions}
                                    setCustomInstructions={setCustomInstructions}

                                    generateYppPlan={() => ypp.generateYppPlan()}

                                    isWaitingForManualPlan={ypp.isWaitingForManualPlan}
                                    setIsWaitingForManualPlan={ypp.setIsWaitingForManualPlan}

                                    manualPlanInput={ypp.manualPlanInput}
                                    setManualPlanInput={ypp.setManualPlanInput}
                                    handleManualPlanSubmit={() => ypp.handleManualPlanSubmit()}

                                    error={ypp.error}
                                    toggleSelectAll={ypp.toggleSelectAll}
                                    handlePlanSort={(key) => {
                                        const direction = planSortConfig?.key === key && planSortConfig.direction === 'asc' ? 'desc' : 'asc';
                                        setPlanSortConfig({ key, direction });
                                    }}
                                    planSortConfig={planSortConfig}
                                    paginatedPlan={(() => {
                                        const schedule = [...(ypp.yppPlan?.schedule || [])];
                                        if (planSortConfig) {
                                            schedule.sort((a, b) => {
                                                const valA = a?.[planSortConfig.key] ?? '';
                                                const valB = b?.[planSortConfig.key] ?? '';
                                                if (valA < valB) return planSortConfig.direction === 'asc' ? -1 : 1;
                                                if (valA > valB) return planSortConfig.direction === 'asc' ? 1 : -1;
                                                return 0;
                                            });
                                        }
                                        const start = planPage * planRowsPerPage;
                                        return schedule.slice(start, start + planRowsPerPage);
                                    })()}
                                    toggleVideoSelection={ypp.toggleVideoSelection}
                                    executionStatus={ypp.executionStatus}
                                    processVideo={ypp.processVideo}
                                    isProcessingSingle={ypp.isProcessingSingle}
                                    cancelVideo={ypp.cancelVideo}

                                    planRowsPerPage={planRowsPerPage}
                                    setPlanRowsPerPage={setPlanRowsPerPage}
                                    planPage={planPage}
                                    setPlanPage={setPlanPage}
                                />
                                <YPPModal
                                    isOpen={ypp.showYPPModal}
                                    onClose={() => ypp.setShowYPPModal(false)}
                                    onConfirm={() => ypp.generateYppPlan()}
                                />
                                <YPPReportModal
                                    isOpen={ypp.showYPPReport}
                                    onClose={() => ypp.setShowYPPReport(false)}
                                    content={ypp.yppReportContent}
                                />
                            </>
                        )}

                        {activeTab === 'ignite' && (
                            <IgnitePanel
                                customQuery={customQuery}
                                setCustomQuery={setCustomQuery}
                                handleCustomQuerySubmit={handleCustomQuerySubmit}
                                isCustomCollecting={isCustomCollecting}
                                askAsJson={askAsJson}
                                setAskAsJson={setAskAsJson}
                                customResult={customResult}
                            />
                        )}

                        {activeTab === 'dfl' && (
                            <div className="flex gap-6 h-[calc(100vh-180px)]">
                                {/* Left: Intelligence (Radar Interceptor) */}
                                <div className="w-[350px] flex-shrink-0">
                                    <VPHInterceptorPanel />
                                </div>

                                {/* Center: Mission Control (Pipeline Matrix) */}
                                <div className="flex-1 min-w-0">
                                    <PipelineMatrix intents={intents} />
                                </div>

                                {/* Right: Telemetry (CTR & Terminal) */}
                                <div className="w-[380px] flex-shrink-0 flex flex-col gap-6">
                                    <div className="h-[320px]">
                                        <CTRMatrix intents={intents} />
                                    </div>
                                    <div className="flex-1">
                                        <EvoMapTerminal />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'research' && (
                            <TopicPanel
                                categories={CONSTANTS.CATEGORIES}
                                handleCollectCategory={(id) => {
                                    const map: Record<string, 'overview' | 'content' | 'audience'> = {
                                        'channelOverview': 'overview',
                                        'videoPerformance': 'content',
                                        'audience': 'audience',
                                        'engagement': 'content',
                                        'traffic': 'content'
                                    };
                                    if (map[id]) collectSingleCategory(map[id], overviewTimeRange);
                                }}
                                analyticsData={analyticsData}
                            />
                        )}

                        {activeTab === 'quality' && (
                            <QualityGatePanel
                                schedule={ypp.yppPlan?.schedule || []}
                                onUpdateItem={(id, updates) => {
                                    if (!ypp.yppPlan) return;
                                    const newSchedule = ypp.yppPlan.schedule.map((item: any) =>
                                        item.id === id ? { ...item, ...updates } : item
                                    );
                                    ypp.setYppPlan({ ...ypp.yppPlan, schedule: newSchedule });
                                }}
                                onRequeue={(item) => {
                                    if (!ypp.yppPlan) return;
                                    const newSchedule = ypp.yppPlan.schedule.map((s: any) =>
                                        s.id === item.id ? { ...s, status: 'pending', qualityCheck: undefined } : s
                                    );
                                    ypp.setYppPlan({ ...ypp.yppPlan, schedule: newSchedule });
                                }}
                            />
                        )}

                        {activeTab === 'crossplatform' && (
                            <CrossPlatformPanel
                                currentPlanItem={ypp.yppPlan?.schedule?.[0]}
                                youtubeVideoUrl={undefined}
                            />
                        )}

                        {activeTab === 'calendar' && (
                            <CalendarView
                                schedule={ypp.yppPlan?.schedule || []}
                                onSelectItem={(item) => console.log('📅 Selected:', item.title)}
                            />
                        )}

                        {activeTab === 'templates' && (
                            <TemplateEditor
                                onSave={(template) => console.log('💾 Template saved:', template.name)}
                            />
                        )}
                    </div>

                    {/* Settings Overlay */}
                    {showSettings && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
                            <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
                                <TelegramConfig onConfigChange={(config) => console.log('📱 Telegram config updated:', config.enabled)} />
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* Global Confetti (if needed) */}
            {showConfetti && <div className="fixed inset-0 pointer-events-none z-50">CONFETTI</div>}
        </div>
    );
};

// Simple Icons
const VideoIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>;
const SearchIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;

export default YouTubeAnalytics;
