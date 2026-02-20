/**
 * Cross-Platform Distribution Panel
 * Migrated from components/YouTubeAnalytics/CrossPlatformPanel.tsx
 * 
 * UI component for X (Twitter) and TikTok distribution controls
 * with external analytics display and DFL weights visualization.
 */

import React, { useState, useEffect } from 'react';
import { crossPlatformService, CrossPlatformOutput } from '@/services/crossPlatformService';

interface ExternalAnalytics {
    x: {
        posts: Array<{
            text: string;
            metrics: { views: number; likes: number; reposts: number; replies: number };
            engagementRate: string;
        }>;
        profile: { name: string; followers: number };
        lastScraped: string;
    };
    tiktok: {
        videos: Array<{
            title: string;
            metrics: { views: number; likes: number; comments: number };
            engagementRate: number;
        }>;
        summary: { totalViews: number; avgEngagementRate: number };
        lastScraped: string;
    };
}

interface ViralWeights {
    conflictMultiplier: number;
    mysteryMultiplier: number;
    unexpectedMultiplier: number;
    emotionalMultiplier: number;
}

interface CrossPlatformPanelProps {
    currentPlanItem?: {
        id: string;
        title: string;
        description: string;
        tags: string | string[];
        publishedUrl?: string;
        videoUrl?: string;
    };
    selectedItems?: any[];
    youtubeVideoUrl?: string;
    videoBlobs?: Record<string, string>;
}

export const CrossPlatformPanel: React.FC<CrossPlatformPanelProps> = ({
    currentPlanItem,
    selectedItems = [],
    youtubeVideoUrl,
    videoBlobs
}) => {
    const [enableX, setEnableX] = useState(true);
    const [enableTikTok, setEnableTikTok] = useState(true);
    const [isDistributing, setIsDistributing] = useState(false);
    const [distributionStatus, setDistributionStatus] = useState<{ x: string; tiktok: string }>({
        x: 'idle', tiktok: 'idle'
    });
    const [externalAnalytics, setExternalAnalytics] = useState<ExternalAnalytics | null>(null);
    const [viralWeights, setViralWeights] = useState<ViralWeights | null>(null);
    const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

    // 🆕 V2.2: Local video file upload state
    const [localVideoFile, setLocalVideoFile] = useState<File | null>(null);
    const [localVideoPreview, setLocalVideoPreview] = useState<string>('');
    const [isDragOver, setIsDragOver] = useState(false);

    // Listen for external analytics updates
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'EXTERNAL_ANALYTICS_UPDATE') {
                loadExternalAnalytics();
            }
            if (event.data?.type === 'TIKTOK_UPLOAD_RESULT') {
                const success = event.data?.status === 'success' || event.data?.payload?.success === true;
                setDistributionStatus(prev => ({
                    ...prev,
                    tiktok: success ? 'complete' : 'failed'
                }));
                if (success) setTimeout(loadExternalAnalytics, 5000);
            }
            if (event.data?.type === 'X_POST_RESULT') {
                const success = event.data?.success === true || event.data?.payload?.success === true;
                setDistributionStatus(prev => ({
                    ...prev,
                    x: success ? 'complete' : 'failed'
                }));
                if (success) setTimeout(loadExternalAnalytics, 5000);
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    useEffect(() => {
        loadExternalAnalytics();
        loadViralWeights();
    }, []);

    const loadExternalAnalytics = () => {
        setIsLoadingAnalytics(true);
        window.postMessage({ type: 'GET_EXTERNAL_ANALYTICS' }, '*');
        const handler = (event: MessageEvent) => {
            if (event.data?.type === 'EXTERNAL_ANALYTICS_RESULT') {
                setExternalAnalytics(event.data.data);
                setIsLoadingAnalytics(false);
                window.removeEventListener('message', handler);
            }
        };
        window.addEventListener('message', handler);
        setTimeout(() => setIsLoadingAnalytics(false), 5000);
    };

    const loadViralWeights = () => {
        window.postMessage({ type: 'GET_VIRAL_WEIGHTS' }, '*');
        const handler = (event: MessageEvent) => {
            if (event.data?.type === 'VIRAL_WEIGHTS_RESULT') {
                setViralWeights(event.data.weights);
                window.removeEventListener('message', handler);
            }
        };
        window.addEventListener('message', handler);
    };

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('video/')) {
            setLocalVideoFile(file);
            setLocalVideoPreview(URL.createObjectURL(file));
        } else if (file) {
            alert('请选择视频文件 (MP4, MOV, WebM)');
        }
    };

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
    const handleDragLeave = () => setIsDragOver(false);
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('video/')) {
            setLocalVideoFile(file);
            setLocalVideoPreview(URL.createObjectURL(file));
        }
    };

    const handleClearFile = () => {
        setLocalVideoFile(null);
        if (localVideoPreview) URL.revokeObjectURL(localVideoPreview);
        setLocalVideoPreview('');
    };

    const handleDistribute = async () => {
        const itemsToDistribute = selectedItems.length > 0 ? selectedItems : (currentPlanItem ? [currentPlanItem] : []);
        const isBatchMode = itemsToDistribute.length > 1;

        if (itemsToDistribute.length === 0) { alert('请先选择一个或多个视频计划项'); return; }

        setIsDistributing(true);
        setDistributionStatus({ x: enableX ? 'pending' : 'skipped', tiktok: enableTikTok ? 'pending' : 'skipped' });

        const extStatus = await crossPlatformService.checkExtensionStatus();
        if (extStatus !== 'OK') {
            setIsDistributing(false);
            setDistributionStatus({ x: enableX ? 'failed' : 'skipped', tiktok: enableTikTok ? 'failed' : 'skipped' });
            alert('扩展桥接未就绪（请刷新页面并在 chrome://extensions 重载插件）');
            return;
        }

        const runtime = (window as any).chrome?.runtime;
        if (runtime?.sendMessage) runtime.sendMessage({ action: "FORCE_RESET_DISTRIBUTION" });

        for (let i = 0; i < itemsToDistribute.length; i++) {
            const item = itemsToDistribute[i];
            const itemVideoUrl = item.publishedUrl || item.videoUrl || youtubeVideoUrl || '';
            const content = crossPlatformService.generateCrossPlatformContent(item, itemVideoUrl);
            const payload: any = {};

            if (enableX) payload.x = content.x;

            const itemVideoData = videoBlobs?.[item.id];
            let videoDataToUse: string | null = null;

            if (isBatchMode) {
                videoDataToUse = itemVideoData || null;
                if (!videoDataToUse && localVideoFile) videoDataToUse = await fileToBase64(localVideoFile);
            } else {
                videoDataToUse = localVideoFile ? await fileToBase64(localVideoFile) : (itemVideoData || null);
            }

            if (enableTikTok) {
                if (!videoDataToUse && !itemVideoUrl) {
                    setDistributionStatus(prev => ({ ...prev, tiktok: 'failed' }));
                    alert('TikTok 分发缺少视频数据');
                } else {
                    payload.tiktok = { ...content.tiktok, videoData: videoDataToUse, sourceYouTubeUrl: itemVideoUrl };
                }
            }

            const response = await crossPlatformService.triggerCrossPlatformDistributionAsync(payload as CrossPlatformOutput);
            if (!response?.success) {
                setDistributionStatus({ x: enableX ? 'failed' : 'skipped', tiktok: enableTikTok ? 'failed' : 'skipped' });
                setIsDistributing(false);
                return;
            }
            if (response?.state) setDistributionStatus(response.state);
            if (i < itemsToDistribute.length - 1) await new Promise(resolve => setTimeout(resolve, 3000));
        }

        setIsDistributing(false);
    };

    const handleRefreshAnalytics = () => {
        window.postMessage({ type: 'TRIGGER_EXTERNAL_ANALYTICS_SCRAPE', platform: 'all' }, '*');
        setTimeout(loadExternalAnalytics, 3000);
    };

    const formatNumber = (num: number): string => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    };

    const formatTimeAgo = (timestamp: string): string => {
        if (!timestamp) return 'Never';
        const diff = Date.now() - new Date(timestamp).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    return (
        <div className="bg-gradient-to-br from-slate-800/90 to-slate-900/90 rounded-xl p-4 border border-white/10 shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">🌐 Cross-Platform Distribution</h3>
                <button onClick={handleRefreshAnalytics} disabled={isLoadingAnalytics}
                    className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors disabled:opacity-50">
                    {isLoadingAnalytics ? '⏳' : '🔄'} Refresh
                </button>
            </div>

            {/* Target Indicator */}
            {selectedItems.length > 1 ? (
                <div className="mb-4 p-2 bg-purple-500/10 rounded border border-purple-500/30 text-xs animate-pulse">
                    <div className="text-purple-400 uppercase font-bold text-[10px] mb-1 flex items-center gap-1">
                        <span className="w-2 h-2 bg-purple-500 rounded-full"></span> Batch Mode Active
                    </div>
                    <div className="text-white font-medium">{selectedItems.length} videos selected for distribution</div>
                </div>
            ) : currentPlanItem && (
                <div className="mb-4 p-2 bg-white/5 rounded border border-white/10 text-xs">
                    <div className="text-slate-500 uppercase font-bold text-[10px] mb-1">Target Video</div>
                    <div className="text-white font-medium truncate" title={currentPlanItem.title}>{currentPlanItem.title}</div>
                </div>
            )}

            {/* Local Video File Upload */}
            <div className="mb-4 p-3 bg-gradient-to-r from-teal-500/10 to-cyan-500/10 rounded-lg border border-teal-500/30">
                <div className="text-xs text-teal-400 uppercase font-bold mb-2 flex items-center gap-1">📁 TikTok Video Source</div>
                {!localVideoFile ? (
                    <div className={`border-2 border-dashed rounded-lg p-4 text-center transition-all cursor-pointer ${isDragOver ? 'border-teal-400 bg-teal-500/20' : 'border-white/20 hover:border-teal-400/50 hover:bg-white/5'}`}
                        onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                        onClick={() => document.getElementById('video-file-input')?.click()}>
                        <input id="video-file-input" type="file" accept="video/*" onChange={handleFileSelect} className="hidden" />
                        <div className="text-2xl mb-1">🎬</div>
                        <div className="text-sm text-white">拖放视频文件或点击选择</div>
                        <div className="text-xs text-slate-500 mt-1">MP4, MOV, WebM (最大 50MB)</div>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        {localVideoPreview && <video src={localVideoPreview} className="w-16 h-16 object-cover rounded" muted />}
                        <div className="flex-1 min-w-0">
                            <div className="text-white text-sm truncate" title={localVideoFile.name}>{localVideoFile.name}</div>
                            <div className="text-xs text-slate-400">{(localVideoFile.size / 1024 / 1024).toFixed(2)} MB</div>
                        </div>
                        <button onClick={handleClearFile} className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30">✕ 移除</button>
                    </div>
                )}
            </div>

            {/* Platform Toggle Cards */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className={`p-3 rounded-lg border transition-all cursor-pointer ${enableX ? 'bg-blue-500/20 border-blue-500/50' : 'bg-slate-700/30 border-white/10 opacity-60'}`}
                    onClick={() => setEnableX(!enableX)}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-lg">📱 X</span>
                        <input type="checkbox" checked={enableX} onChange={(e) => setEnableX(e.target.checked)} className="w-4 h-4" />
                    </div>
                    {externalAnalytics?.x && (
                        <div className="text-xs text-slate-400">
                            <div>{externalAnalytics.x.posts?.length || 0} posts tracked</div>
                            <div className="text-blue-400">{formatTimeAgo(externalAnalytics.x.lastScraped)}</div>
                        </div>
                    )}
                    {distributionStatus.x !== 'idle' && (
                        <div className={`text-xs mt-1 ${distributionStatus.x === 'complete' ? 'text-green-400' : distributionStatus.x === 'pending' ? 'text-yellow-400' : 'text-red-400'}`}>
                            {distributionStatus.x === 'complete' ? '✅ Posted' : distributionStatus.x === 'pending' ? '⏳ Posting...' : distributionStatus.x === 'skipped' ? '⏭️ Skipped' : '❌ Failed'}
                        </div>
                    )}
                </div>
                <div className={`p-3 rounded-lg border transition-all cursor-pointer ${enableTikTok ? 'bg-pink-500/20 border-pink-500/50' : 'bg-slate-700/30 border-white/10 opacity-60'}`}
                    onClick={() => setEnableTikTok(!enableTikTok)}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-lg">🎵 TikTok</span>
                        <input type="checkbox" checked={enableTikTok} onChange={(e) => setEnableTikTok(e.target.checked)} className="w-4 h-4" />
                    </div>
                    {externalAnalytics?.tiktok && (
                        <div className="text-xs text-slate-400">
                            <div>{externalAnalytics.tiktok.videos?.length || 0} videos tracked</div>
                            <div className="text-pink-400">{formatTimeAgo(externalAnalytics.tiktok.lastScraped)}</div>
                        </div>
                    )}
                    {distributionStatus.tiktok !== 'idle' && (
                        <div className={`text-xs mt-1 ${distributionStatus.tiktok === 'complete' ? 'text-green-400' : distributionStatus.tiktok === 'pending' ? 'text-yellow-400' : 'text-red-400'}`}>
                            {distributionStatus.tiktok === 'complete' ? '✅ Uploaded' : distributionStatus.tiktok === 'pending' ? '⏳ Uploading...' : distributionStatus.tiktok === 'skipped' ? '⏭️ Skipped' : '❌ Failed'}
                        </div>
                    )}
                </div>
            </div>

            {/* Distribute Button */}
            <button onClick={handleDistribute} disabled={isDistributing || (!enableX && !enableTikTok)}
                className={`w-full py-3 rounded-lg font-bold text-white transition-all ${isDistributing ? 'bg-yellow-500/50 cursor-wait' :
                    (!enableX && !enableTikTok) ? 'bg-slate-600 cursor-not-allowed opacity-50' :
                        'bg-gradient-to-r from-blue-500 to-pink-500 hover:from-blue-600 hover:to-pink-600 shadow-lg'}`}>
                {isDistributing ? (
                    <span className="flex items-center justify-center gap-2"><span className="animate-spin">🔄</span> Distributing...</span>
                ) : (
                    <span className="flex items-center justify-center gap-2">
                        🚀 Distribute to {[enableX && 'X', enableTikTok && 'TikTok'].filter(Boolean).join(' & ')}
                    </span>
                )}
            </button>

            {/* External Analytics Summary */}
            {(externalAnalytics?.x?.posts?.length || externalAnalytics?.tiktok?.videos?.length) && (
                <div className="mt-4 pt-4 border-t border-white/10">
                    <h4 className="text-sm font-semibold text-slate-300 mb-2">📊 External Performance</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        {externalAnalytics?.x?.posts?.length > 0 && (
                            <div className="bg-blue-500/10 rounded p-2">
                                <div className="text-blue-400 font-medium">X Performance</div>
                                <div className="text-slate-400">
                                    Avg Engagement: {(externalAnalytics.x.posts.reduce((sum, p) =>
                                        sum + parseFloat(p.engagementRate || '0'), 0) / externalAnalytics.x.posts.length).toFixed(2)}%
                                </div>
                            </div>
                        )}
                        {externalAnalytics?.tiktok?.summary && (
                            <div className="bg-pink-500/10 rounded p-2">
                                <div className="text-pink-400 font-medium">TikTok Performance</div>
                                <div className="text-slate-400">Total Views: {formatNumber(externalAnalytics.tiktok.summary.totalViews)}</div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* DFL Viral Weights */}
            {viralWeights && (
                <div className="mt-4 pt-4 border-t border-white/10">
                    <h4 className="text-sm font-semibold text-slate-300 mb-2">📈 DFL Viral Weights</h4>
                    <div className="flex flex-wrap gap-2">
                        <span className={`px-2 py-1 rounded text-xs ${viralWeights.conflictMultiplier > 1 ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-400'}`}>
                            Conflict: {viralWeights.conflictMultiplier.toFixed(1)}x
                        </span>
                        <span className={`px-2 py-1 rounded text-xs ${viralWeights.mysteryMultiplier > 1 ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-700 text-slate-400'}`}>
                            Mystery: {viralWeights.mysteryMultiplier.toFixed(1)}x
                        </span>
                        <span className={`px-2 py-1 rounded text-xs ${viralWeights.unexpectedMultiplier > 1 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-700 text-slate-400'}`}>
                            Unexpected: {viralWeights.unexpectedMultiplier.toFixed(1)}x
                        </span>
                        <span className={`px-2 py-1 rounded text-xs ${viralWeights.emotionalMultiplier > 1 ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                            Emotional: {viralWeights.emotionalMultiplier.toFixed(1)}x
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CrossPlatformPanel;
export type { CrossPlatformPanelProps, ExternalAnalytics, ViralWeights };
