
import { useState, useEffect, useRef } from 'react';
import { YPPPlan } from '../types';
import { analyzeYPPData, generateMarkdownReport } from '../utils/yppUtils';
import { askStudioService } from '../../../services/askStudioService';
import { yppService } from '../../../services/yppService';
import { intentStream } from '../../../core/IntentStream';
import { effectLogger } from '../../../core/EffectLogger';
import { contractManager } from '../../../core/ContractManager';

export const useYPP = (analyticsData: any) => {
    // State
    const [yppPlan, setYppPlan] = useState<YPPPlan | null>(null);

    // Initial Fetch from Backend
    useEffect(() => {
        const fetchSchedules = async () => {
            try {
                const response = await fetch('/api/schedules');
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.length > 0) {
                        setYppPlan({ schedule: data } as any);
                    } else {
                        // Fallback to localStorage for cold start
                        const saved = localStorage.getItem('yppPlan');
                        if (saved) setYppPlan(JSON.parse(saved));
                    }
                }
            } catch (e) {
                console.error('❌ [useYPP] Initial fetch failed:', e);
                const saved = localStorage.getItem('yppPlan');
                if (saved) setYppPlan(JSON.parse(saved));
            }
        };
        fetchSchedules();
    }, []);
    const [executionQueue, setExecutionQueue] = useState<number[]>(() => {
        const saved = localStorage.getItem('executionQueue');
        return saved ? JSON.parse(saved) : [];
    });
    const [executionStatus, setExecutionStatus] = useState<{ [key: number]: string }>({});
    const [isExecutingPlan, setIsExecutingPlan] = useState(false);
    const [isProcessingSingle, setIsProcessingSingle] = useState(false);
    const [currentProcessingIndex, setCurrentProcessingIndex] = useState<number | null>(null);
    const [selectedVideos, setSelectedVideos] = useState<Set<number>>(new Set());
    const [cancelledVideos, setCancelledVideos] = useState<Set<number>>(new Set());
    const [showYPPModal, setShowYPPModal] = useState(false);
    const [showYPPReport, setShowYPPReport] = useState(false);
    const [yppReportContent, setYppReportContent] = useState('');
    const [yppProgress, setYppProgress] = useState({
        currentSubs: 0,
        currentViews: 0,
        subsProgress: 0,
        viewsProgress: 0,
        estimatedDaysToYPP: null,
        lastUpdated: null
    });

    // Preferences
    const [videoPlatform, setVideoPlatform] = useState<'geminigen' | 'googleflow' | 'googlevids'>('geminigen');
    const [debugMode, setDebugMode] = useState(false);
    const [manualPlanInput, setManualPlanInput] = useState('');
    const [forceLMArena, setForceLMArena] = useState(false);
    const [isWaitingForManualPlan, setIsWaitingForManualPlan] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const yppPlanRef = useRef(yppPlan);

    // Persistence - Master Sync to Backend
    useEffect(() => {
        yppPlanRef.current = yppPlan;
        if (yppPlan) {
            localStorage.setItem('yppPlan', JSON.stringify(yppPlan));

            // Sync individual items to backend for industrial durability
            if (yppPlan.schedule) {
                yppPlan.schedule.forEach(async (item: any, idx: number) => {
                    const backendItem = {
                        ...item,
                        id: item.id || `item_${idx}_${Date.now()}`
                    };
                    try {
                        await fetch('/api/schedules', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(backendItem)
                        });
                    } catch (e) {
                        console.error('❌ [useYPP] Sync failed for item:', item.id, e);
                    }
                });
            }
        }
    }, [yppPlan]);

    useEffect(() => {
        if (yppProgress.currentSubs > 0) localStorage.setItem('yppProgress', JSON.stringify(yppProgress));
    }, [yppProgress]);

    useEffect(() => {
        localStorage.setItem('executionQueue', JSON.stringify(executionQueue));
    }, [executionQueue]);

    // Listeners
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (!message) return;

            // 🆕 Handle standardized YPP Plan result
            if (message.type === 'YPP_PLAN_RESULT') {
                if (message.isHeartbeat) return; // 🎯 Ignore heartbeats in the hook, handled by service promise

                if (message.error) {
                    console.error('Plan Generation Error:', message.error);
                } else {
                    const planData = message.payload;
                    if (planData) {
                        const newPlan = typeof planData === 'string' ? JSON.parse(planData) : planData;
                        console.log('✅ [Hook] YPP Plan received:', newPlan.schedule?.length, 'tasks');
                        setYppPlan(newPlan);
                        if (newPlan.schedule) {
                            setSelectedVideos(new Set(newPlan.schedule.map((_: any, idx: number) => idx)));
                        }
                        setShowYPPModal(false);
                    }
                }
            }

            // 🆕 Handle upload data saved confirmation
            if (message.type === 'YOUTUBE_DATA_SAVED') {
                console.log('📦 [Hook] Video data stored, extension is now handling the tab opening...');
                setExecutionStatus('🚀 Opening Studio Tab...');
            }

            if (message.type === 'YPP_REALTIME_DATA') {
                setYppProgress(prev => ({
                    ...prev,
                    currentSubs: message.data.subscribers || prev.currentSubs,
                    currentViews: message.data.publicWatchHours || prev.currentViews,
                    lastUpdated: new Date()
                }));
            }

            if (message.type === 'LMARENA_RESPONSE_RESULT') {
                handleManualPlanSubmit(message.response);
            }

            if (message.type === 'YOUTUBE_UPLOAD_STATUS') {
                setExecutionStatus(prev => {
                    const newStatus = { ...prev };
                    const activeKey = Object.keys(newStatus).find(k =>
                        newStatus[parseInt(k)]?.includes('Uploading') ||
                        newStatus[parseInt(k)]?.includes('Waiting') ||
                        newStatus[parseInt(k)]?.includes('Step')
                    );
                    if (activeKey) {
                        newStatus[parseInt(activeKey)] = `📡 ${message.status}`;
                    }
                    return newStatus;
                });
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // Selection Logic
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const toggleSelectAll = (checked: boolean) => {
        if (checked && yppPlan?.schedule) {
            setSelectedVideos(new Set(yppPlan.schedule.map((_, i) => i)));
        } else {
            setSelectedVideos(new Set());
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const toggleVideoSelection = (index: number) => {
        setSelectedVideos(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) newSet.delete(index);
            else newSet.add(index);
            return newSet;
        });
    };

    // Manual Plan Logic
    const handleManualPlanSubmit = (inputJson?: string) => {
        const rawInput = typeof inputJson === 'string' ? inputJson : manualPlanInput;
        const plan = yppService.parseManualPlan(rawInput);

        if (plan) {
            setYppPlan(plan as any); // Cast to match local type if needed
            if (plan.schedule) setSelectedVideos(new Set(plan.schedule.map((_: any, i: number) => i)));
            setManualPlanInput('');
            return true;
        }
        return false;
    };

    // Execution Logic
    const cancelVideo = (index: number) => {
        setCancelledVideos(prev => new Set(prev).add(index));
        setExecutionStatus(prev => ({ ...prev, [index]: '🚫 Cancelled' }));
        setIsProcessingSingle(false);
    };

    const processVideo = async (task: number | any) => {
        let index: number;
        let item: any;

        if (typeof task === 'number') {
            index = task;
            if (!yppPlanRef.current?.schedule[index]) return;
            item = yppPlanRef.current.schedule[index];
        } else {
            item = task;
            index = item.id;
        }

        if (isProcessingSingle && !isExecutingPlan && typeof task === 'number') return;
        if (!isExecutingPlan && typeof task === 'number') setIsProcessingSingle(true);

        if (cancelledVideos.has(index)) {
            setCancelledVideos(prev => { const s = new Set(prev); s.delete(index); return s; });
        }

        setExecutionStatus(prev => ({ ...prev, [index]: '⏳ Opening Generation Tool...' }));

        try {
            let videoBase64: string | null = null;

            const promptBlock = item.promptBlock || item.prompt; // Support both

            if (debugMode) {
                await new Promise(r => setTimeout(r, 1000));
                videoBase64 = "DUMMY_VIDEO_DATA";
            } else {
                if (!promptBlock) throw new Error("Missing promptBlock");

                const genConfig = yppService.generateVideoGenUrl(videoPlatform, promptBlock);
                if (genConfig.action === 'GOOGLE_VIDS_GENERATE') {
                    window.postMessage({ type: 'GOOGLE_VIDS_GENERATE', prompt: promptBlock, uploadData: { title: item.title, description: item.description, scheduleTime: item.publishTimeLocal } }, '*');
                } else if (genConfig.url) {
                    window.postMessage({ type: 'OPEN_GEMINIGEN_TAB', url: genConfig.url }, '*');
                }

                videoBase64 = await new Promise<string>((resolve, reject) => {
                    const videoHandler = (e: MessageEvent) => {
                        if (e.data && e.data.type === 'GEMINI_VIDEO_RESULT') {
                            if (e.data.payload && e.data.payload.length > 100) {
                                window.removeEventListener('message', videoHandler);
                                resolve(e.data.payload);
                            }
                        }
                    };
                    window.addEventListener('message', videoHandler);
                    setTimeout(() => { window.removeEventListener('message', videoHandler); reject(new Error("Timeout")); }, 600000);
                });

                setExecutionStatus(prev => ({ ...prev, [index]: '✅ Video Generated!' }));
            }

            if (!videoBase64) return;
            setExecutionStatus(prev => ({ ...prev, [index]: '📤 Preparing Upload...' }));

            if (cancelledVideos.has(index)) throw new Error("Cancelled by user");

            // 💎 Pillar 1: Formal Verification
            contractManager.verify('youtube_metadata_validity', {
                title: item.title,
                description: item.description
            });

            const uploadPayload = yppService.createUploadPayload(index, item, videoBase64);

            // 💎 Pillar 4: Intent Sourcing
            const intent = intentStream.propose('START_YOUTUBE_UPLOAD', {
                videoId: index,
                title: item.title,
                platform: videoPlatform
            }, 'agent');

            // 💎 Pillar 3: Causal Tracing
            effectLogger.logEffect(intent.id, `Starting YouTube upload for video ${index}`);

            window.postMessage({ type: 'PREPARE_YOUTUBE_UPLOAD', payload: uploadPayload, intentId: intent.id }, '*');
            setExecutionStatus(prev => ({ ...prev, [index]: '🚀 Uploading...' }));

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            await new Promise<void>((resolve, reject) => {
                const uploadHandler = (e: MessageEvent) => {
                    if (e.data.type === 'YOUTUBE_UPLOAD_COMPLETE' && Number(e.data.videoId) === index) {
                        window.removeEventListener('message', uploadHandler);
                        resolve();
                    }
                };
                window.addEventListener('message', uploadHandler);
                setTimeout(() => { window.removeEventListener('message', uploadHandler); resolve(); }, 900000);
            });

            setExecutionStatus(prev => ({ ...prev, [index]: '✅ Complete' }));

        } catch (e: any) {
            console.error("Processing Failed", e);
            setExecutionStatus(prev => ({ ...prev, [index]: `❌ Failed: ${e.message}` }));
        } finally {
            if (!isExecutingPlan && typeof task === 'number') setIsProcessingSingle(false);
        }
    };

    const executeFullPlan = async () => {
        if (!yppPlan?.schedule) return;
        const videos = Array.from(selectedVideos).sort((a, b) => a - b);
        if (videos.length === 0) return;

        setIsExecutingPlan(true);
        setExecutionQueue(videos);
        setCurrentProcessingIndex(null);
    };

    // Queue Effect
    useEffect(() => {
        const processQueue = async () => {
            if (executionQueue.length > 0 && currentProcessingIndex === null && (isExecutingPlan || isProcessingSingle)) {
                const next = executionQueue[0];
                setCurrentProcessingIndex(next);
                setExecutionQueue(prev => prev.slice(1));
                try {
                    await processVideo(next);
                } catch (e) { console.error(e); }
                finally { setCurrentProcessingIndex(null); }
            } else if (executionQueue.length === 0 && currentProcessingIndex === null && isExecutingPlan) {
                setIsExecutingPlan(false);
            }
        };
        processQueue();
    }, [executionQueue, currentProcessingIndex, isExecutingPlan, isProcessingSingle]);

    // Helpers
    const handleGenerateYPPReport = () => {
        if (!analyticsData) return;
        const report = analyzeYPPData(analyticsData);
        setYppReportContent(generateMarkdownReport(report));
        setShowYPPReport(true);
    };

    const openLMArena = () => {
        window.postMessage({ type: 'OPEN_LMARENA_TAB' }, '*');
    };

    // Plan Generation State
    const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

    const generateYppPlan = async (customInstructions?: string) => {
        setIsGeneratingPlan(true);
        try {
            const result = await askStudioService.generatePlan(
                customInstructions || "Generate a YPP Daily Strategy based on the latest analytics.",
                {
                    analytics: analyticsData,
                    forceLMArena: forceLMArena
                }
            );

            console.log('[Hook] generateYppPlan result received:', result.success ? 'Success' : 'Failed');

            if (result.success && result.data) {
                setYppPlan(result.data);
                if (result.data.schedule) {
                    const newStatus: Record<number, string> = {};
                    result.data.schedule.forEach((_: any, idx: number) => {
                        newStatus[idx] = 'Wait for Execution';
                    });
                    setExecutionStatus(newStatus);
                }
            } else {
                setError(result.error || "Plan generation failed");
            }
        } catch (err: any) {
            setError(err.message || "Plan generation failed");
        } finally {
            setIsGeneratingPlan(false);
            setShowYPPModal(false);
        }
    };

    const handleCancelOperations = () => {
        setIsExecutingPlan(false);
        setIsGeneratingPlan(false);
        setIsProcessingSingle(false);
        // Also send generic cancel message if needed
    };

    return {
        yppPlan,
        setYppPlan,
        yppProgress,
        isExecutingPlan,
        isGeneratingPlan, // Exported
        generateYppPlan,  // Exported
        handleCancelOperations, // Exported
        processVideo,
        cancelVideo,
        executeFullPlan,
        openLMArena,
        setForceLMArena, // Explicitly export setter
        forceLMArena, // Exposing the state directly if possible, or use the getter?
        showYPPModal, setShowYPPModal,
        showYPPReport, setShowYPPReport,
        yppReportContent,
        handleGenerateYPPReport,
        handleManualPlanSubmit,
        manualPlanInput, setManualPlanInput,
        isWaitingForManualPlan, setIsWaitingForManualPlan,
        error, setError, // Export error state and setter
        videoPlatform, setVideoPlatform,
        debugMode, setDebugMode,
        selectedVideos, setSelectedVideos,
        toggleSelectAll: (checked: boolean) => {
            if (checked && yppPlan?.schedule) {
                const allIds = new Set(yppPlan.schedule.map((_, i) => i));
                setSelectedVideos(allIds);
            } else {
                setSelectedVideos(new Set());
            }
        },
        toggleVideoSelection: (idx: number) => {
            const newSet = new Set(selectedVideos);
            if (newSet.has(idx)) {
                newSet.delete(idx);
            } else {
                newSet.add(idx);
            }
            setSelectedVideos(newSet);
        },
        isProcessingSingle, setIsProcessingSingle,
        executionStatus, setExecutionStatus,
        executionQueue, setExecutionQueue
    };
};
