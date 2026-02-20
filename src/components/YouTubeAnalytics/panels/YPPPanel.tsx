import React from 'react';
import { RefreshCw, Zap, X, MessageSquare } from 'lucide-react';

export interface YPPPanelProps {
    yppPlan: any;
    setYppPlan: (plan: any) => void;
    yppProgress: {
        currentSubs: number;
        currentViews: number;
        subsProgress: number;
        viewsProgress: number;
        estimatedDaysToYPP: string | null;
        lastUpdated: Date | null;
    };
    forceLMArena: boolean;
    setForceLMArena: (value: boolean) => void;
    videoPlatform: string;
    setVideoPlatform: (platform: 'geminigen' | 'googleflow' | 'googlevids') => void;
    startAutoRefreshSequence: () => void;
    isGeneratingPlan: boolean;
    isExecutingPlan: boolean;
    isAutoRefreshing: boolean;
    handleCancelOperations: () => void;
    toggleManualInput: () => void;
    analyzePerformance: () => void;
    debugMode: boolean;
    setDebugMode: (value: boolean) => void;
    analyticsLogs: string[];
    setAnalyticsLogs: (logs: string[]) => void;
    executeFullPlan: () => void;
    selectedVideos: Set<number>;
    analyticsData: any;
    lastRefreshTime: Date | null;
    showCustomInput: boolean;
    setShowCustomInput: (value: boolean) => void;
    customInstructions: string;
    setCustomInstructions: (instructions: string) => void;
    generateYppPlan: () => void;
    isWaitingForManualPlan: boolean;
    setIsWaitingForManualPlan: (value: boolean) => void;
    manualPlanInput: string;
    setManualPlanInput: (input: string) => void;
    handleManualPlanSubmit: () => void;
    error: string | null;
    toggleSelectAll: (checked: boolean) => void;
    handlePlanSort: (key: string) => void;
    planSortConfig: { key: string; direction: 'asc' | 'desc' } | null;
    paginatedPlan: any[];
    toggleVideoSelection: (idx: number) => void;
    executionStatus: Record<number, string>;
    processVideo: (idx: number) => void;
    isProcessingSingle: boolean;
    cancelVideo: (idx: number) => void;
    planRowsPerPage: number;
    setPlanRowsPerPage: (num: number) => void;
    planPage: number;
    setPlanPage: (page: number) => void;
}

const YPPPanel: React.FC<YPPPanelProps> = ({
    yppPlan,
    setYppPlan,
    forceLMArena,
    setForceLMArena,
    videoPlatform,
    setVideoPlatform,
    startAutoRefreshSequence,
    isGeneratingPlan,
    isExecutingPlan,
    isAutoRefreshing,
    handleCancelOperations,
    toggleManualInput,
    analyzePerformance,
    debugMode,
    setDebugMode,
    analyticsLogs,
    setAnalyticsLogs,
    executeFullPlan,
    selectedVideos,
    analyticsData,
    lastRefreshTime,
    showCustomInput,
    setShowCustomInput,
    customInstructions,
    setCustomInstructions,
    generateYppPlan,
    isWaitingForManualPlan,
    setIsWaitingForManualPlan,
    manualPlanInput,
    setManualPlanInput,
    handleManualPlanSubmit,
    error,
    toggleSelectAll,
    handlePlanSort,
    planSortConfig,
    paginatedPlan,
    toggleVideoSelection,
    executionStatus,
    processVideo,
    isProcessingSingle,
    cancelVideo,
    planRowsPerPage,
    setPlanRowsPerPage,
    planPage,
    setPlanPage
}) => {
    return (
        <div className="bg-gradient-to-r from-orange-900/40 to-red-900/40 border border-orange-500/30 rounded-2xl p-8 mb-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">📅 YPP Daily Strategy</h2>
                <div className="flex items-center gap-4 relative">
                    <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer hover:text-white transition-colors"><input type="checkbox" checked={forceLMArena} onChange={(e) => setForceLMArena(e.target.checked)} className="w-4 h-4 rounded border-slate-500 bg-black/20 text-orange-500 focus:ring-orange-500" />Force LMArena</label>
                    <select value={videoPlatform} onChange={(e) => setVideoPlatform(e.target.value as 'geminigen' | 'googleflow' | 'googlevids')} className="px-3 py-1.5 bg-black/50 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500">
                        <option value="geminigen">🎬 GeminiGen</option>
                        <option value="googleflow">🌊 Google Flow</option>
                        <option value="googlevids">🎥 Google Vids</option>
                    </select>
                    <button onClick={startAutoRefreshSequence} disabled={isGeneratingPlan || isExecutingPlan || isAutoRefreshing} className="px-6 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-bold transition-colors disabled:opacity-50 flex items-center gap-2">
                        {isAutoRefreshing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        {isAutoRefreshing ? 'Refreshing Data...' : isGeneratingPlan ? 'Generating...' : '⚡ Auto-Refresh & Generate'}
                    </button>

                    {/* 🛑 CANCEL BUTTON (Only visible when busy) */}
                    {(isGeneratingPlan || isExecutingPlan || isAutoRefreshing) && (
                        <button
                            onClick={handleCancelOperations}
                            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold transition-colors flex items-center gap-2 animate-fade-in shadow-lg shadow-red-900/50"
                            title="Force Stop & Reset"
                        >
                            <X className="w-4 h-4" /> Cancel
                        </button>
                    )}
                    <button onClick={toggleManualInput} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-bold transition-colors">📋 Paste Plan</button>
                    <button onClick={analyzePerformance} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold transition-colors">📊 Analyze</button>
                    <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer hover:text-white transition-colors"><input type="checkbox" checked={debugMode} onChange={(e) => setDebugMode(e.target.checked)} className="w-4 h-4 rounded border-slate-500 bg-black/20 text-purple-500 focus:ring-purple-500" />Debug Mode</label>

                    {/* 📝 Real-time Analytics Logs */}
                    {analyticsLogs.length > 0 && (
                        <div className="absolute top-full right-0 mt-2 w-96 bg-black/95 backdrop-blur-xl rounded-lg p-4 font-mono text-xs text-green-400 text-left overflow-hidden border border-green-500/30 shadow-2xl z-50">
                            <div className="flex items-center gap-2 mb-2 border-b border-green-500/30 pb-1">
                                <span className="animate-pulse">🟢</span>
                                <span className="font-bold text-white">LIVE DATA STREAM</span>
                                <button onClick={() => setAnalyticsLogs([])} className="ml-auto text-slate-500 hover:text-white">✕</button>
                            </div>
                            <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
                                {analyticsLogs.map((log, i) => (
                                    <div key={i} className="truncate opacity-90 border-b border-white/5 pb-0.5 mb-0.5">
                                        <span className="text-slate-500 mr-2">[{new Date().toLocaleTimeString().split(' ')[0]}]</span>
                                        {log}
                                    </div>
                                ))}
                                <div ref={(el) => el?.scrollIntoView({ behavior: 'smooth' })} />
                            </div>
                        </div>
                    )}
                    {yppPlan && (
                        <button
                            onClick={executeFullPlan}
                            disabled={isExecutingPlan || selectedVideos.size === 0}
                            className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {isExecutingPlan ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : `🚀 Execute Selected (${selectedVideos.size})`}
                        </button>
                    )}
                </div>
            </div>

            {/* 📊 Data Status Indicator */}
            <div className="mb-4 p-4 bg-black/30 rounded-xl border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-bold text-slate-300">📊 可用数据 (Available Data for Plan):</span>
                    {lastRefreshTime && (
                        <span className="text-xs text-slate-500">
                            上次更新: {lastRefreshTime.toLocaleString()}
                        </span>
                    )}
                </div>
                <div className="flex flex-wrap gap-3">
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${analyticsData?.overview ? 'bg-green-600/30 text-green-400 border border-green-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                        {analyticsData?.overview ? '✅' : '❌'} Overview
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${analyticsData?.content ? 'bg-green-600/30 text-green-400 border border-green-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                        {analyticsData?.content ? '✅' : '❌'} Content
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${analyticsData?.audience ? 'bg-green-600/30 text-green-400 border border-green-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                        {analyticsData?.audience ? '✅' : '❌'} Audience
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${analyticsData?.yppSprint ? 'bg-blue-600/30 text-blue-400 border border-blue-500/30' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                        {analyticsData?.yppSprint ? '✅' : '➖'} YPP Sprint (可选)
                    </div>
                </div>
                {/* Show status message based on available data */}
                {(analyticsData?.overview || analyticsData?.content || analyticsData?.audience) ? (
                    <p className="mt-2 text-xs text-green-400">
                        ✅ 数据已就绪！可以点击 "Generate Plan" 生成计划
                    </p>
                ) : !analyticsData?.yppSprint ? (
                    <p className="mt-2 text-xs text-orange-400">
                        ⚠️ 请先收集数据：点击 "Collect Direct Analytics" 或 "Run YPP Sprint"
                    </p>
                ) : null}
            </div>

            {/* ✨ Custom Instructions Input */}
            <div className="mb-6">
                <button
                    onClick={() => setShowCustomInput(!showCustomInput)}
                    className="flex items-center gap-2 text-sm font-bold text-orange-400 hover:text-orange-300 transition-colors mb-2"
                >
                    <span>{showCustomInput ? '▼' : '▶'}</span> ✨ 定制生成选项 (Custom Instructions)
                </button>

                {showCustomInput && (
                    <div className="bg-black/30 border border-orange-500/20 rounded-xl p-4 animate-fade-in">
                        <p className="text-xs text-slate-400 mb-2">告诉 AI 你今天想做什么（例如："主题：办公室恶作剧，时间：18:00"）。AI 将优先执行你的指令。</p>
                        <textarea
                            value={customInstructions}
                            onChange={(e) => setCustomInstructions(e.target.value)}
                            placeholder="e.g. Generate 6 videos about 'Funny Cat Fails'. Schedule them for evening peak hours (19:00-22:00)."
                            className="w-full h-24 bg-black/40 border border-white/10 rounded-lg p-3 text-sm text-white placeholder-slate-600 focus:border-orange-500 outline-none resize-none"
                        />
                        <div className="flex justify-end mt-2">
                            <button
                                onClick={generateYppPlan}
                                disabled={isGeneratingPlan || !customInstructions.trim()}
                                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm rounded-lg font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {isGeneratingPlan ? 'Generating...' : '🚀 Generate with Instructions'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {isWaitingForManualPlan && (
                <div className="mt-6 p-4 bg-orange-900/20 border border-orange-500/30 rounded-xl animate-fade-in">
                    <textarea value={manualPlanInput} onChange={(e) => setManualPlanInput(e.target.value)} className="w-full h-40 bg-black/40 border border-white/10 rounded-lg p-3 text-xs font-mono text-slate-300 focus:border-orange-500 outline-none resize-y mb-4" placeholder='Paste JSON here...' />
                    <div className="flex gap-3 justify-end">
                        <button onClick={() => setIsWaitingForManualPlan(false)} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-sm font-bold transition-colors">Cancel</button>
                        <button onClick={() => handleManualPlanSubmit()} disabled={!manualPlanInput.trim()} className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50">✅ Process Plan</button>
                    </div>
                </div>
            )}

            {error && <div className="mb-6 p-4 bg-red-900/40 border border-red-500/50 rounded-xl flex items-center gap-3 animate-fade-in"><span className="text-2xl">⚠️</span><div className="text-red-200 text-sm font-medium">{error}</div></div>}

            {yppPlan && (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-black/40 p-6 rounded-xl border border-orange-500/20">
                        <h3 className="text-xl font-bold text-orange-400 mb-2">Current Stage: <span className="text-white text-2xl uppercase">{yppPlan?.algorithmStage || 'Audit'}</span></h3>
                        <p className="text-slate-300">{yppPlan?.stageAnalysis || 'Waiting for plan generation...'}</p>
                    </div>
                    {/* Scrollable Table Container */}
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto border border-white/10 rounded-t-xl relative scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-black/20">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-10 bg-[#1f1f1f] shadow-lg shadow-black/50">
                                <tr className="text-slate-400 border-b border-white/10">
                                    <th className="p-4 w-12 text-center bg-[#1f1f1f]">
                                        <input
                                            type="checkbox"
                                            checked={yppPlan?.schedule?.length > 0 && selectedVideos.size === yppPlan.schedule.length}
                                            onChange={(e) => toggleSelectAll(e.target.checked)}
                                            className="w-4 h-4 rounded border-slate-500 bg-black/20 text-purple-500 focus:ring-purple-500 cursor-pointer"
                                        />
                                    </th>

                                    <th className="p-4 bg-[#1f1f1f] cursor-pointer hover:text-white" onClick={() => handlePlanSort('status')}>
                                        Status {planSortConfig?.key === 'status' && (planSortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="p-4 bg-[#1f1f1f] cursor-pointer hover:text-white" onClick={() => handlePlanSort('publishTimeLocal')}>
                                        Time {planSortConfig?.key === 'publishTimeLocal' && (planSortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="p-4 bg-[#1f1f1f] cursor-pointer hover:text-white" onClick={() => handlePlanSort('type')}>
                                        Type {planSortConfig?.key === 'type' && (planSortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="p-4 bg-[#1f1f1f] cursor-pointer hover:text-white" onClick={() => handlePlanSort('title')}>
                                        Content Strategy {planSortConfig?.key === 'title' && (planSortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="p-4 bg-[#1f1f1f]">Action</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {paginatedPlan.map((item: any, idx: number) => (
                                    <tr key={idx} className={`border-b border-white/5 transition-colors ${selectedVideos.has(idx) ? 'bg-purple-900/10 hover:bg-purple-900/20' : 'hover:bg-white/5'}`}>
                                        <td className="p-4 text-center">
                                            <input
                                                type="checkbox"
                                                checked={selectedVideos.has(idx)}
                                                onChange={() => toggleVideoSelection(idx)}
                                                className="w-4 h-4 rounded border-slate-500 bg-black/20 text-purple-500 focus:ring-purple-500 cursor-pointer"
                                            />
                                        </td>
                                        <td className="p-4">
                                            {executionStatus[idx] ? (
                                                <div className="flex flex-col gap-1">
                                                    {/* 📊 Progress Bar Based on Status */}
                                                    {(() => {
                                                        const status = executionStatus[idx] || '';
                                                        let phase = 'pending';
                                                        let progress = 0;
                                                        let color = 'bg-slate-600';

                                                        if (status.includes('Opening') || status.includes('GeminiGen')) {
                                                            phase = 'generating'; progress = 20; color = 'bg-purple-500';
                                                        } else if (status.includes('Waiting') || status.includes('video')) {
                                                            phase = 'generating'; progress = 40; color = 'bg-purple-500';
                                                        } else if (status.includes('Uploading') || status.includes('Preparing')) {
                                                            phase = 'uploading'; progress = 60; color = 'bg-blue-500';
                                                        } else if (status.includes('📤') || status.includes('Upload')) {
                                                            phase = 'uploading'; progress = 75; color = 'bg-blue-500';
                                                        } else if (status.includes('Scheduling') || status.includes('Schedule')) {
                                                            phase = 'scheduling'; progress = 90; color = 'bg-cyan-500';
                                                        } else if (status.includes('✅') || status.includes('Published') || status.includes('Complete')) {
                                                            phase = 'done'; progress = 100; color = 'bg-green-500';
                                                        } else if (status.includes('❌') || status.includes('Error') || status.includes('Failed')) {
                                                            phase = 'error'; progress = 100; color = 'bg-red-500';
                                                        } else if (status.includes('Cancelled')) {
                                                            phase = 'cancelled'; progress = 0; color = 'bg-orange-500';
                                                        }

                                                        return (
                                                            <div className="w-full">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <div className={`w-20 h-1.5 ${phase === 'error' ? 'bg-red-900/50' : 'bg-slate-700'} rounded-full overflow-hidden`}>
                                                                        <div
                                                                            className={`h-full ${color} transition-all duration-500`}
                                                                            style={{ width: `${progress}%` }}
                                                                        ></div>
                                                                    </div>
                                                                    <span className={`text-[10px] font-bold uppercase ${phase === 'done' ? 'text-green-400' :
                                                                        phase === 'error' ? 'text-red-400' :
                                                                            phase === 'cancelled' ? 'text-orange-400' :
                                                                                'text-slate-400'
                                                                        }`}>{phase}</span>
                                                                </div>
                                                                <span className={`text-xs font-medium ${phase === 'done' ? 'text-green-300' :
                                                                    phase === 'error' ? 'text-red-300' :
                                                                        'text-slate-300'
                                                                    }`}>{status}</span>
                                                            </div>
                                                        );
                                                    })()}
                                                    {item.publishedUrl && (
                                                        <a href={item.publishedUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 underline flex items-center gap-1">
                                                            <span>📺 Watch</span>
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                                        </a>
                                                    )}
                                                </div>
                                            ) : <span className="text-slate-600 text-xs">⏸️ Pending</span>}
                                        </td>
                                        <td className="p-4">
                                            <input
                                                type="text"
                                                value={item?.publishTimeLocal || ''}
                                                onChange={(e) => {
                                                    if (!yppPlan?.schedule?.[idx]) return;
                                                    const newPlan = { ...yppPlan };
                                                    newPlan.schedule[idx].publishTimeLocal = e.target.value;
                                                    setYppPlan(newPlan);
                                                    localStorage.setItem('yppPlan', JSON.stringify(newPlan));
                                                }}
                                                className="bg-black/40 border border-white/20 rounded px-2 py-1 text-white text-sm font-bold focus:border-orange-500 outline-none w-48"
                                                placeholder="YYYY/MM/DD HH:MM"
                                            />
                                        </td>
                                        <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold ${item.type === 'Viral Hit' ? 'bg-purple-500/20 text-purple-300' : 'bg-green-500/20 text-green-300'}`}>{item.type}</span></td>
                                        <td className="p-4 max-w-md">
                                            <div className="font-bold text-white mb-1">{item.title}</div>
                                            <div className="text-slate-400 mb-2 line-clamp-2">{item.description}</div>
                                            {item.promptBlock && (
                                                <details className="mt-2 mb-2">
                                                    <summary className="text-xs text-purple-400 cursor-pointer hover:text-purple-300 font-semibold">
                                                        📝 View Full Prompt
                                                    </summary>
                                                    <div className="mt-2 p-2 bg-black/40 rounded text-xs text-slate-300 max-h-32 overflow-y-auto border border-purple-500/20">
                                                        {item.promptBlock}
                                                    </div>
                                                </details>
                                            )}
                                            {item.pinnedComment && (
                                                <div className="mt-2 mb-2 flex items-start gap-2 bg-blue-900/20 p-2 rounded border border-blue-500/20">
                                                    <MessageSquare className="w-3 h-3 text-blue-400 mt-0.5 flex-shrink-0" />
                                                    <div className="flex-1">
                                                        <div className="text-[10px] text-blue-300 font-bold mb-0.5">FIRST COMMENT STRATEGY</div>
                                                        <div className="text-xs text-slate-300 italic">"{item.pinnedComment}"</div>
                                                    </div>
                                                    <button
                                                        onClick={() => navigator.clipboard.writeText(item.pinnedComment)}
                                                        className="text-[10px] bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 px-1.5 py-0.5 rounded transition-colors"
                                                        title="Copy Comment"
                                                    >
                                                        Copy
                                                    </button>
                                                </div>
                                            )}
                                            <div className="flex flex-wrap gap-1">
                                                {(Array.isArray(item.tags) ? item.tags : (item.tags ? item.tags.split(',') : [])).slice(0, 3).map((tag: string, i: number) => <span key={i} className="text-xs bg-white/10 px-1 rounded text-slate-400">{tag.trim()}</span>)}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {/* 🔥 DYNAMIC BUTTON LOGIC 🔥 */}
                                            {item.publishedUrl ? (
                                                <a href={item.publishedUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded text-xs font-bold bg-red-600 hover:bg-red-500 text-white flex items-center gap-2 inline-flex shadow-lg shadow-red-900/50">
                                                    <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                                    Watch
                                                </a>
                                            ) : (
                                                <button onClick={() => processVideo(idx)} disabled={isExecutingPlan || isProcessingSingle} className={`px-3 py-1.5 rounded text-xs font-bold transition-colors flex items-center gap-2 ${isExecutingPlan || isProcessingSingle ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/50'}`}>
                                                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                                    {executionStatus[idx]?.includes('✅') ? 'Retry' : 'Run'}
                                                </button>
                                            )}
                                            {/* Cancel Button */}
                                            {!item.publishedUrl && (executionStatus[idx]?.includes('⏳') || executionStatus[idx]?.includes('📡') || executionStatus[idx]?.includes('📤')) && (
                                                <button
                                                    onClick={() => cancelVideo(idx)}
                                                    className="ml-2 px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded text-xs font-bold transition-colors flex items-center gap-1"
                                                    title="Cancel this video"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                    Cancel
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Footer */}
                    <div className="bg-[#1f1f1f] border-x border-b border-white/10 rounded-b-xl p-3 flex justify-end items-center gap-6 text-xs text-slate-400">
                        <div className="flex items-center gap-2">
                            <span>Rows per page:</span>
                            <select
                                value={planRowsPerPage}
                                onChange={(e) => {
                                    setPlanRowsPerPage(Number(e.target.value));
                                    setPlanPage(0);
                                }}
                                className="bg-transparent border-none text-slate-300 focus:ring-0 cursor-pointer"
                            >
                                <option value={10}>10</option>
                                <option value={30}>30</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                        <div>
                            {planPage * planRowsPerPage + 1}–{Math.min((planPage + 1) * planRowsPerPage, yppPlan.schedule.length)} of about {yppPlan.schedule.length}
                        </div>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setPlanPage(Math.max(0, planPage - 1))}
                                disabled={planPage === 0}
                                className="hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                            </button>
                            <button
                                onClick={() => setPlanPage(planPage + 1)}
                                disabled={(planPage + 1) * planRowsPerPage >= yppPlan.schedule.length}
                                className="hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default YPPPanel;
