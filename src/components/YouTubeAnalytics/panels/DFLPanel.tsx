import React from 'react';
import { RefreshCw } from 'lucide-react';
import { DFLState, DFLMetrics, AdaptiveSchedule, TrendSurfing, DFLSignal, YPPPlan, SoundType } from '../types';

// Define Props Interface
export interface DFLPanelProps {
    dflState: DFLState;
    setDflState: React.Dispatch<React.SetStateAction<DFLState>>;
    lastSyncTime: string | null;
    toggleDFLSystem: () => void;
    showDFLPanel: boolean;
    setShowDFLPanel: (show: boolean) => void;
    dflMetrics: DFLMetrics;
    setDflMetrics: React.Dispatch<React.SetStateAction<DFLMetrics>>;
    adaptiveSchedule: AdaptiveSchedule;
    setAdaptiveSchedule: React.Dispatch<React.SetStateAction<AdaptiveSchedule>>;
    generateAdaptiveSchedule: (count: number) => string[]; // Logic uses strict string[] return
    addToast: (type: SoundType, message: string) => void;
    playSound: (type: SoundType, message?: string) => void;
    analyzeVelocityByTimeSlot: () => void;
    runDFLLearningCycle: () => void;
    viralProtocolCompliance: Record<string, number>;
    triggerViralContentGeneration: (signal: DFLSignal) => void;
    soundEnabled: boolean;
    setSoundEnabled: (enabled: boolean) => void;
    toastsEnabled: boolean;
    setToastsEnabled: (enabled: boolean) => void;
    soundVolume: number;
    setSoundVolume: (volume: number) => void;
    dflInterventions: any[];
    dflSignals: DFLSignal[];
    setViralMomentDetected: (detected: boolean) => void;
    viralMomentDetected: boolean;
    autoExecuteEnabled: boolean;
    setAutoExecuteEnabled: (enabled: boolean) => void;
    trendSurfing: TrendSurfing;
    isCollecting: boolean;
    handleCollectAnalytics: () => void;
    progress: string;
    collectionQueue: string[];
    sessionCompletedCategories: Set<string>;
    currentCollectionCategory: string | null;
    yppPlan: YPPPlan | null;
    setYppPlan: React.Dispatch<React.SetStateAction<YPPPlan | null>>;
}

// const GOLDEN_HOURS = [18, 19, 20, 21]; // Reserved for future use

const DFLPanel: React.FC<DFLPanelProps> = ({
    dflState,
    setDflState,
    lastSyncTime,
    toggleDFLSystem,
    showDFLPanel,
    setShowDFLPanel,
    dflMetrics,
    setDflMetrics,
    adaptiveSchedule,
    setAdaptiveSchedule,
    generateAdaptiveSchedule,
    addToast,
    playSound,
    analyzeVelocityByTimeSlot,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    runDFLLearningCycle: _runDFLLearningCycle,
    viralProtocolCompliance,
    triggerViralContentGeneration,
    soundEnabled,
    setSoundEnabled,
    toastsEnabled,
    setToastsEnabled,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    soundVolume: _soundVolume,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setSoundVolume: _setSoundVolume,
    dflInterventions,
    dflSignals,
    setViralMomentDetected,
    viralMomentDetected,
    autoExecuteEnabled,
    setAutoExecuteEnabled,
    trendSurfing,
    isCollecting,
    handleCollectAnalytics,
    progress,
    collectionQueue,
    sessionCompletedCategories,
    currentCollectionCategory,
    yppPlan,
    setYppPlan
}) => {

    const getNextOptimalSlot = () => {
        if (!adaptiveSchedule.optimalSlots || adaptiveSchedule.optimalSlots.length === 0) return { date: new Date(), reason: 'No data' };

        const now = new Date();
        const nextHour = adaptiveSchedule.optimalSlots.find(h => h > now.getHours()) || adaptiveSchedule.optimalSlots[0];
        const date = new Date();
        if (nextHour <= now.getHours()) date.setDate(date.getDate() + 1);
        date.setHours(nextHour, 0, 0, 0);

        return { date, reason: `Next optimal slot: ${nextHour}:00` };
    };

    const nextOptimal = getNextOptimalSlot();

    return (
        <div className={`bg-gradient-to-r ${dflState.isActive ? 'from-emerald-900/50 to-cyan-900/50 border-emerald-500/40' : 'from-slate-900/50 to-gray-900/50 border-slate-700/40'} border rounded-2xl p-6 mb-8 transition-all duration-500`}>
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                    🧠 DFL System
                    <span className={`text-xs px-2 py-1 rounded-full ${dflState.isActive ? 'bg-emerald-500/30 text-emerald-300 animate-pulse' : 'bg-slate-700/50 text-slate-400'}`}>
                        {dflState.isActive ? '● ACTIVE' : '○ INACTIVE'}
                    </span>
                    {dflState.learningPhase !== 'idle' && (
                        <span className="text-xs bg-cyan-500/20 text-cyan-300 px-2 py-1 rounded-full flex items-center gap-1">
                            <RefreshCw className="w-3 h-3 animate-spin" /> {dflState.learningPhase}
                        </span>
                    )}
                    {lastSyncTime && (
                        <span className="text-[10px] text-slate-400 font-mono border border-slate-700 px-2 py-1 rounded bg-black/30">
                            Synced: {lastSyncTime}
                        </span>
                    )}
                </h2>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            if (confirm('Reset all DFL data? This will clear current metrics.')) {
                                setDflState(prev => ({ ...prev, topPerformers: [], bestTitlePatterns: [] }));
                                setDflMetrics({
                                    firstHourVelocity: 0,
                                    swipeAwayRate: 0,
                                    rewatchRatio: 0,
                                    subsConversion: 0,
                                    sessionContribution: 0,
                                    retentionAt3s: 0,
                                    viralPotential: 0
                                });
                                localStorage.removeItem('dflState');
                                localStorage.removeItem('dflMetrics');
                                window.location.reload();
                            }
                        }}
                        className="text-xs text-slate-500 hover:text-white underline"
                    >
                        Reset Data
                    </button>
                    <button
                        onClick={toggleDFLSystem}
                        className={`px-4 py-2 rounded-lg font-semibold transition-all ${dflState.isActive ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
                    >
                        {dflState.isActive ? '🛑 Deactivate' : '🚀 Activate DFL'}
                    </button>
                    <button
                        onClick={() => setShowDFLPanel(!showDFLPanel)}
                        className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg transition-colors"
                    >
                        {showDFLPanel ? '▲ Collapse' : '▼ Expand'}
                    </button>
                </div>
            </div>

            {/* DFL Quick Stats Row */}
            <div className="grid grid-cols-5 gap-4 mb-4">
                <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                    <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                        {dflMetrics.viralPotential}%
                    </div>
                    <div className="text-xs text-slate-400 mt-1">Viral Potential</div>
                </div>
                <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                    <div className="text-2xl font-black text-orange-400">
                        {dflMetrics.firstHourVelocity.toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">1st Hour Velocity</div>
                </div>
                <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                    <div className="text-2xl font-black text-purple-400">
                        {dflMetrics.rewatchRatio.toFixed(2)}x
                    </div>
                    <div className="text-xs text-slate-400 mt-1">Rewatch Ratio</div>
                </div>
                <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                    <div className="text-2xl font-black text-rose-400">
                        {dflMetrics.swipeAwayRate.toFixed(1)}%
                    </div>
                    <div className="text-xs text-slate-400 mt-1">Swipe-Away Rate</div>
                </div>
                <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                    <div className="text-2xl font-black text-blue-400">
                        {dflState.algorithmScore}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">Algorithm Score</div>
                </div>
            </div>

            {/* 📊 Adaptive Push Prediction Panel (Summary) */}
            <div className={`rounded-xl p-4 border mb-4 ${adaptiveSchedule.enabled ? 'bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border-cyan-500/30' : 'bg-black/20 border-white/5'}`}>
                {/* ... (Keep existing summary panel) ... */}
                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                    📊 Adaptive Push Prediction
                    {adaptiveSchedule.enabled && (
                        <span className="text-xs bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded">
                            {adaptiveSchedule.confidenceScore}% Confidence
                        </span>
                    )}
                </h3>

                <div className="flex items-center justify-between mb-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={adaptiveSchedule.enabled}
                            onChange={() => setAdaptiveSchedule(prev => ({ ...prev, enabled: !prev.enabled }))}
                            className="w-5 h-5 rounded bg-slate-700 border-slate-600"
                        />
                        <div>
                            <span className="text-sm text-white font-medium">Enable Adaptive Scheduling</span>
                            <p className="text-xs text-slate-400">Optimize publish times based on velocity data</p>
                        </div>
                    </label>

                    {adaptiveSchedule.enabled && (
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={adaptiveSchedule.burstQueueEnabled}
                                onChange={() => setAdaptiveSchedule(prev => ({ ...prev, burstQueueEnabled: !prev.burstQueueEnabled }))}
                                className="w-5 h-5 rounded bg-slate-700 border-slate-600 accent-orange-500"
                            />
                            <div>
                                <span className="text-sm text-orange-300 font-bold flex items-center gap-1">
                                    🚀 Burst Mode
                                    <span className="text-[10px] bg-orange-500/20 px-1 rounded border border-orange-500/30">EXPERIMENTAL</span>
                                </span>
                                <p className="text-xs text-slate-400">Compress uploads into Peak Window</p>
                            </div>
                        </label>
                    )}
                </div>

                {adaptiveSchedule.enabled && (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-black/30 rounded-lg p-3">
                            <div className="text-xs text-slate-400 mb-2">🎯 Top 5 Optimal Hours</div>
                            <div className="flex gap-2">
                                {adaptiveSchedule.optimalSlots.slice(0, 5).map((hour, i) => (
                                    <span
                                        key={hour}
                                        className={`px-2 py-1 rounded text-xs font-mono ${i === 0 ? 'bg-emerald-500/30 text-emerald-300 ring-1 ring-emerald-500' :
                                            i === 1 ? 'bg-cyan-500/20 text-cyan-300' :
                                                'bg-slate-700 text-slate-300'
                                            }`}
                                    >
                                        {hour}:00
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="bg-black/30 rounded-lg p-3">
                            <div className="text-xs text-slate-400 mb-2">🔥 Peak Window</div>
                            <div className="text-lg font-bold text-orange-400">
                                {adaptiveSchedule.peakWindow.start}:00 - {adaptiveSchedule.peakWindow.end}:00
                            </div>
                            <div className="text-xs text-slate-500">Best consecutive 3-hour block</div>
                        </div>
                    </div>
                )}

                {/* Action Buttons for Summary Panel */}
                <div className="mt-3 flex justify-end gap-3">
                    <button
                        onClick={() => {
                            const times = generateAdaptiveSchedule(5);
                            console.log("Generated Schedule:", times);
                            addToast('success', `Generated ${times.length} slots: ${times.join(', ')}`);
                            playSound('schedule', 'Schedule Generated');
                        }}
                        className="text-xs bg-cyan-900/50 hover:bg-cyan-800/50 text-cyan-300 px-3 py-1.5 rounded border border-cyan-500/30 transition-colors"
                    >
                        Apply Adaptive Schedule
                    </button>
                    <button
                        onClick={() => {
                            analyzeVelocityByTimeSlot();
                            playSound('success', 'Manual analysis complete');
                        }}
                        className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                    >
                        <RefreshCw className="w-3 h-3" /> Force Re-analysis
                    </button>
                    <button
                        onClick={() => {
                            if (!confirm('⚡ FORCE TRIGGER: DFL Auto-Generate?\n\nThis will immediately start the content generation flow based on current trends.')) return;

                            const mockViralPotential = 95;
                            const mockTrend = dflState.bestTitlePatterns[0] || 'VIRAL_MOMENT';

                            addToast('info', `⚡ DFL Triggered! (Viral Potential: ${mockViralPotential}%)`);
                            playSound('viral', 'Viral Event Detected');

                            const prompt = `[ROLE]
You are a viral content expert specializing in YouTube Shorts.`;

                            window.postMessage({
                                type: 'TRIGGER_GEMINIGEN_FLOW',
                                prompt: prompt,
                                autoStart: true,
                                marketingCopy: {
                                    title: `🔥 ${mockTrend} - You Won't Believe This! #Shorts`,
                                    description: `Check out this viral moment about ${mockTrend}! \n\nSubscribe for more daily content!`,
                                    tags: ["#Shorts", "#Viral", `#${mockTrend.replace(/\s+/g, '')}`, "#Trending"]
                                }
                            }, '*');
                        }}
                        className="text-xs bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded border border-purple-400/30 transition-colors flex items-center gap-1"
                    >
                        ⚡ Force Auto-Gen
                    </button>
                </div>
            </div>

            {/* Expanded DFL Panel */}
            {showDFLPanel && (
                <div className="space-y-4 animate-fade-in">
                    {/* Compliance & Insights */}
                    <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                            🎯 7-Point Viral Protocol
                            <span className="text-xs text-slate-400">(Injected into AI prompts when active)</span>
                        </h3>
                        <div className="grid grid-cols-7 gap-2">
                            {Object.entries(viralProtocolCompliance).map(([key, value]) => (
                                <div key={key} className="text-center">
                                    <div className={`w-full h-2 rounded-full ${value >= 70 ? 'bg-emerald-500' : value >= 40 ? 'bg-yellow-500' : 'bg-slate-600'} mb-1`}>
                                        <div className="h-full rounded-full bg-white/30" style={{ width: `${value}%` }}></div>
                                    </div>
                                    <div className="text-[10px] text-slate-400 uppercase">{key}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Learning Insights */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                            <h3 className="text-sm font-bold text-white mb-3">📊 Top Performers</h3>
                            {dflState.topPerformers.length > 0 ? (
                                <div className="space-y-2">
                                    {dflState.topPerformers.slice(0, 5).map((p, i) => (
                                        <div key={i} className="flex justify-between items-center text-xs group">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <span className="text-slate-300 truncate max-w-[180px]" title={p.title}>{p.title}</span>
                                                {p.videoId && (
                                                    <button
                                                        onClick={async () => {
                                                            if (!confirm(`🚀 Ignite engagement for "${p.title}"?\n\nThis will trigger tactical engagement from the backend.`)) return;

                                                            try {
                                                                const response = await fetch('/api/ignite', {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({
                                                                        videoId: p.videoId,
                                                                        title: p.title,
                                                                        text: `Wait for the end! 🤯 #${p.pattern || 'Viral'}`
                                                                    })
                                                                });
                                                                if (response.ok) {
                                                                    addToast('success', 'Ignite command sent to backend装甲集群！');
                                                                } else {
                                                                    throw new Error('Backend rejection');
                                                                }
                                                            } catch (e) {
                                                                console.error("❌ [Ignite] Failed:", e);
                                                                addToast('error', 'Ignite command failed to dispatch.');
                                                            }
                                                        }}
                                                        className="opacity-0 group-hover:opacity-100 bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 px-1.5 py-0.5 rounded text-[10px] transition-opacity"
                                                        title="Auto-Comment to Boost Engagement (Server-Side)"
                                                    >
                                                        💬 Boost
                                                    </button>
                                                )}
                                            </div>
                                            <span className="text-emerald-400 font-mono">{p.views.toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-500 italic">No data yet. Collect analytics to learn.</p>
                            )}
                        </div>
                        <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                            <h3 className="text-sm font-bold text-white mb-3">🏷️ Best Title Patterns</h3>
                            {dflState.bestTitlePatterns.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {dflState.bestTitlePatterns.map((pattern, i) => (
                                        <span key={i} className="bg-purple-500/20 text-purple-300 px-2 py-1 rounded text-xs">{pattern}</span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-500 italic">Patterns extracted from top performers</p>
                            )}
                        </div>
                    </div>

                    {/* Intervention Controls */}
                    <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                        <h3 className="text-sm font-bold text-white mb-3">🎯 Intervention Controls</h3>
                        <div className="flex items-center gap-6 flex-wrap">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={dflState.autoCommentEnabled}
                                    onChange={() => setDflState(prev => ({ ...prev, autoCommentEnabled: !prev.autoCommentEnabled }))}
                                    className="w-4 h-4 rounded bg-slate-700 border-slate-600"
                                />
                                <span className="text-sm text-slate-300">Auto-Comment (Low Engagement)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={dflState.dynamicScheduleEnabled}
                                    onChange={() => setDflState(prev => ({ ...prev, dynamicScheduleEnabled: !prev.dynamicScheduleEnabled }))}
                                    className="w-4 h-4 rounded bg-slate-700 border-slate-600"
                                />
                                <span className="text-sm text-slate-300">Dynamic Schedule Adjust</span>
                            </label>

                            <button
                                onClick={() => {
                                    if (confirm("🧪 Trigger Test Viral Loop? This will generate 3 viral videos immediately.")) {
                                        const mockSignal: DFLSignal = {
                                            type: 'velocity_spike',
                                            intensity: 'extreme',
                                            source: 'Manual Test Trigger',
                                            timestamp: new Date(),
                                            actionTaken: 'triggered_test_loop'
                                        };
                                        triggerViralContentGeneration(mockSignal);
                                    }
                                }}
                                className="px-3 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-400 text-xs rounded border border-red-500/30 transition-colors flex items-center gap-1"
                            >
                                🧪 Test Viral Loop
                            </button>
                        </div>
                    </div>

                    {/* Sound Controls */}
                    <div className={`rounded-xl p-4 border ${soundEnabled ? 'bg-gradient-to-r from-violet-900/30 to-purple-900/30 border-violet-500/30' : 'bg-black/20 border-white/5'}`}>
                        {/* ... (Existing Sound Controls code you can copy or I can include) ... */}
                        {/* Including abbreviated Sound Controls for completeness */}
                        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                            🔊 Sound Notifications
                            {soundEnabled && <span className="text-xs bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded animate-pulse">LISTENING</span>}
                        </h3>
                        {/* ... toggles and slider ... */}
                        <div className="flex items-center justify-between mb-4">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" checked={soundEnabled} onChange={() => setSoundEnabled(!soundEnabled)} className="w-5 h-5 rounded bg-slate-700 border-slate-600" />
                                <span className="text-sm text-white font-medium">🔊 Audio Alerts</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" checked={toastsEnabled} onChange={() => setToastsEnabled(!toastsEnabled)} className="w-5 h-5 rounded bg-slate-700 border-slate-600" />
                                <span className="text-sm text-white font-medium">📝 Text Alerts</span>
                            </label>
                        </div>
                    </div>

                    {/* 📊 Detailed Adaptive Push Prediction Panel (Heatmap etc.) */}
                    <div className={`rounded-xl p-4 border ${adaptiveSchedule.enabled ? 'bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border-cyan-500/30' : 'bg-black/20 border-white/5'}`}>
                        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                            📊 Deep Velocity Analysis
                        </h3>

                        {/* Data Collection Controls */}
                        <div className="flex gap-2 mb-4">
                            <button
                                onClick={handleCollectAnalytics}
                                disabled={isCollecting}
                                className={`text-xs px-3 py-1.5 rounded transition-colors flex items-center gap-1 ${isCollecting
                                    ? 'bg-purple-600/50 text-purple-200 cursor-not-allowed animate-pulse'
                                    : 'bg-purple-600/30 hover:bg-purple-600/50 text-purple-300'
                                    }`}
                            >
                                {isCollecting ? '📥 Collecting...' : '📥 Run Full Data Cycle'}
                            </button>
                            <button
                                onClick={analyzeVelocityByTimeSlot}
                                className="text-xs bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 px-3 py-1.5 rounded transition-colors"
                            >
                                🔄 Analyze Now
                            </button>
                        </div>

                        {/* Progress Bar */}
                        {isCollecting && (
                            <div className="mb-4 animate-fade-in">
                                <div className="flex justify-between text-xs text-purple-300 mb-1">
                                    <span className="font-mono">{progress || 'Initializing...'}</span>
                                    <span className="font-bold">{Math.max(5, Math.round(((13 - collectionQueue.length) / 13) * 100))}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden border border-white/5">
                                    <div
                                        className="h-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-cyan-500 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                                        style={{ width: `${Math.max(5, ((13 - collectionQueue.length) / 13) * 100)}%` }}
                                    ></div>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {['yppSprint', 'channelOverview', 'videoPerformance', 'audience', 'traffic', 'engagement', 'comments'].map(cat => (
                                        <span key={cat} className={`text-[10px] px-1.5 py-0.5 rounded ${sessionCompletedCategories.has(cat) ? 'bg-green-500/20 text-green-400' : currentCollectionCategory === cat ? 'bg-purple-500/30 text-purple-300 animate-pulse' : 'bg-slate-800 text-slate-600'}`}>
                                            {sessionCompletedCategories.has(cat) ? '✅' : currentCollectionCategory === cat ? '⏳' : '⏸️'} {cat.replace('channel', '').substring(0, 6)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Heatmap */}
                        <div className="bg-black/20 rounded-lg p-3">
                            <div className="text-xs text-slate-400 mb-2">⏰ 24-Hour Velocity Heatmap</div>
                            <div className="flex gap-0.5">
                                {adaptiveSchedule.timeSlotData.slice(6, 24).map((slot) => {
                                    const maxVelocity = Math.max(...adaptiveSchedule.timeSlotData.map(s => s.avgVelocity));
                                    const intensity = maxVelocity > 0 ? slot.avgVelocity / maxVelocity : 0;
                                    const isOptimal = adaptiveSchedule.optimalSlots.includes(slot.hour);

                                    return (
                                        <div
                                            key={slot.hour}
                                            className={`relative group h-8 flex-1 rounded-sm cursor-pointer transition-all ${isOptimal ? 'ring-1 ring-cyan-400' : ''}`}
                                            style={{ backgroundColor: `rgba(16, 185, 129, ${0.1 + intensity * 0.9})` }}
                                            title={`${slot.hour}:00 - ${slot.avgVelocity} avg views/hr (${slot.sampleSize} samples)`}
                                        >
                                            <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] text-slate-500">{slot.hour}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Next Optimal Slot */}
                        <div className="mt-4 bg-gradient-to-r from-emerald-900/30 to-cyan-900/30 rounded-lg p-3 border border-emerald-500/20">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-xs text-slate-400">🚀 Next Optimal Publish Time</div>
                                    <div className="text-lg font-bold text-emerald-400">
                                        {`${nextOptimal.date.getMonth() + 1}/${nextOptimal.date.getDate()} ${nextOptimal.date.getHours()}:00`}
                                    </div>
                                    <div className="text-[10px] text-slate-500">{nextOptimal.reason}</div>
                                </div>
                            </div>
                        </div>

                        {/* Apply to Current Plan Button */}
                        {yppPlan && yppPlan.schedule && yppPlan.schedule.length > 0 && adaptiveSchedule.confidenceScore >= 30 && (
                            <div className="mt-4 pt-4 border-t border-white/10">
                                <button
                                    onClick={() => {
                                        const newSchedules = generateAdaptiveSchedule(yppPlan.schedule.length);
                                        const updatedPlan = {
                                            ...yppPlan,
                                            schedule: yppPlan.schedule.map((item: any, idx: number) => ({
                                                ...item,
                                                publishTimeLocal: newSchedules[idx]
                                            }))
                                        };
                                        setYppPlan(updatedPlan);
                                        localStorage.setItem('yppPlan', JSON.stringify(updatedPlan));
                                        addToast('success', `Adaptive schedule applied to ${yppPlan.schedule.length} videos!`);
                                    }}
                                    className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-lg transition-all shadow-lg"
                                >
                                    📅 Apply Adaptive Schedule to Current Plan ({yppPlan.schedule.length} videos)
                                </button>
                            </div>
                        )}
                    </div>

                    {/* 🚀 DFL 2.0: Auto-Execute & Trend Surfing */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className={`rounded-xl p-4 border ${autoExecuteEnabled ? 'bg-amber-500/10 border-amber-500/30' : 'bg-black/20 border-white/5'}`}>
                            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                                ⚡ Auto-Execute Mode
                                {autoExecuteEnabled && <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded animate-pulse">ARMED</span>}
                            </h3>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={autoExecuteEnabled}
                                    onChange={() => setAutoExecuteEnabled(!autoExecuteEnabled)}
                                    className="w-5 h-5 rounded bg-slate-700 border-slate-600"
                                />
                                <div>
                                    <span className="text-sm text-white font-medium">Enable Auto-Generate</span>
                                    <p className="text-xs text-slate-400">Trigger on HIGH/EXTREME signals</p>
                                </div>
                            </label>
                        </div>
                        <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                            <h3 className="text-sm font-bold text-white mb-3">🌊 Trend Surfing</h3>
                            {trendSurfing.detectedTrend ? (
                                <div className="space-y-2">
                                    <div className="text-xs text-emerald-400 truncate">Trend: "{trendSurfing.detectedTrend}"</div>
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {trendSurfing.suggestedVariations.slice(0, 4).map((v, i) => (
                                            <span key={i} className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded">{v}</span>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xs text-slate-500 italic">No active trends detected.</p>
                            )}
                        </div>
                    </div>

                    {/* 🚨 Viral Signals Panel */}
                    {dflSignals.length > 0 && (
                        <div className={`rounded-xl p-4 border ${viralMomentDetected ? 'bg-red-500/10 border-red-500/30 animate-pulse' : 'bg-black/20 border-white/5'}`}>
                            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                                🚨 Viral Signals
                                {viralMomentDetected && <span className="text-xs bg-red-500/30 text-red-300 px-2 py-0.5 rounded">VIRAL MOMENT!</span>}
                                <button onClick={() => setViralMomentDetected(false)} className="ml-auto text-xs text-slate-400 hover:text-white">Dismiss</button>
                            </h3>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {dflSignals.slice(0, 5).map((signal, i) => (
                                    <div key={i} className={`flex items-center justify-between text-xs px-3 py-2 rounded ${signal.intensity === 'extreme' ? 'bg-red-500/20 border-l-2 border-red-500' : 'bg-slate-700/50'}`}>
                                        <div>
                                            <span className="font-bold text-yellow-400">[{signal.intensity.toUpperCase()}]</span>
                                            <span className="text-slate-300 ml-2">{signal.source}</span>
                                        </div>
                                        <span className="text-slate-500">{new Date(signal.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recent Interventions */}
                    {dflInterventions.length > 0 && (
                        <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                            <h3 className="text-sm font-bold text-white mb-3">📋 Recent Interventions</h3>
                            <div className="space-y-2 max-h-32 overflow-y-auto">
                                {dflInterventions.slice(0, 5).map((int, i) => (
                                    <div key={i} className="flex justify-between items-center text-xs bg-black/30 px-3 py-2 rounded">
                                        <span className="text-slate-300">{int.type === 'auto_comment' ? '💬' : '📅'} {int.reason}</span>
                                        <span className={`px-2 py-0.5 rounded ${int.status === 'executed' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-yellow-500/20 text-yellow-300'}`}>{int.status}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {dflState.lastLearningCycle && (
                        <div className="text-xs text-slate-500 text-center">Last learning cycle: {new Date(dflState.lastLearningCycle).toLocaleTimeString()}</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DFLPanel;
