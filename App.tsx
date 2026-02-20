import React, { useState, useEffect, useCallback } from 'react';
import { generateViralMetadataFromTemplate } from './src/services/viralTemplateService';
import type { FormInput, OutputData, EditAction, TranscriptItem } from './src/types';
import { GenerationMode, VideoEngine } from './src/types';
import { useLocalization } from './src/contexts/LocalizationContext';
import { Header } from './src/components/Header';
import { InputForm } from './src/components/InputForm';
import { LoadingScreen } from './src/components/LoadingScreen';
import { OutputDisplay } from './src/components/OutputDisplay';
import { UploadStep } from './src/components/UploadStep';
import { PromptOutputDisplay } from './src/components/PromptOutputDisplay';
import { UploadScreen } from './src/components/UploadScreen';
import { Editor } from './src/components/Editor';
import { GeminiGenHandoff } from './src/components/GeminiGenHandoff';
import YouTubeAnalytics from './src/components/YouTubeAnalytics';
import { DebuggerUI } from './src/components/Aetheria/DebuggerUI';
import {
    generateFullPromptAndViralityAnalysis,
    generateVideoAndThumbnail,
    generateGmicloudVideo,
    processUploadedVideoWithAI,
    processEditedVideoWithAI,
    generateAnalysisForEditor,
    generateEditingPlan,
    trimVideo,
    constructGeminiGenUrl,
    constructGoogleVidsUrl,
    captureFrameFromVideo,
    generateSmartViralThumbnail
} from './src/services/geminiService';

type Step = 'input' | 'upload' | 'loading' | 'output' | 'prompt_output' | 'upload_for_editor' | 'editor' | 'geminigen_handoff' | 'youtube_analytics';
type ApiKeyStatus = 'checking' | 'ready' | 'needed';

interface JobData {
    formData: FormInput;
    fullPrompt: string | null;
    viralityAnalysis: any;
    marketingCopy: any;
}

const checkVideoApiSupport = () => {
    return typeof HTMLVideoElement.prototype.requestVideoFrameCallback === 'function' &&
        typeof window.VideoEncoder === 'function' &&
        typeof window.VideoDecoder === 'function' &&
        typeof window.EncodedVideoChunk === 'function' &&
        typeof window.MediaStreamTrackProcessor === 'function';
};

const HARDCODED_API_KEY = "";

export default function App() {
    const { t, language } = useLocalization();
    const [step, setStep] = useState<Step>('input');
    const [jobData, setJobData] = useState<JobData | null>(null);
    const [outputData, setOutputData] = useState<OutputData | null>(null);
    const [loadingProgress, setLoadingProgress] = useState<{ percentage: number; messageKey: string; messageParams?: any } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isMuxing, setIsMuxing] = useState(false);
    const [videoBlobForPreview, setVideoBlobForPreview] = useState<Blob | null>(null);
    const [originalVideoBlobForPreview, setOriginalVideoBlobForPreview] = useState<Blob | null>(null);
    const [editorFile, setEditorFile] = useState<File | null>(null);

    const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus>('checking');
    const [isSelectingApiKey, setIsSelectingApiKey] = useState(false);
    const [isSystemKeySelectorAvailable, setIsSystemKeySelectorAvailable] = useState(true);
    const [manualApiKey, setManualApiKey] = useState<string>(HARDCODED_API_KEY);
    const [isManualOpen, setIsManualOpen] = useState(false);


    const isVideoApiSupported = checkVideoApiSupport();

    useEffect(() => {
        document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    }, [language]);

    useEffect(() => {
        if (window.aistudio) {
            setIsSystemKeySelectorAvailable(true);
            window.aistudio.hasSelectedApiKey().then(hasKey => {
                setApiKeyStatus(hasKey ? 'ready' : 'needed');
            }).catch(() => {
                setApiKeyStatus('needed');
            });
        } else {
            console.warn("window.aistudio not found - System Key Selector unavailable.");
            setIsSystemKeySelectorAvailable(false);
            setApiKeyStatus('ready');
        }
    }, []);

    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.slice(1);
            if (hash.startsWith('youtube_analytics')) {
                setStep('youtube_analytics');
            }
        };
        handleHashChange();
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    // 🎧 Listen for DFL Auto-Gen Triggers
    useEffect(() => {
        const handleTrigger = (event: MessageEvent) => {
            if (event.data && event.data.type === 'TRIGGER_GEMINIGEN_FLOW') {
                console.log("🚀 [App] Received Auto-Gen Trigger:", event.data);
                const { prompt, scheduleTime, marketingCopy } = event.data;

                // Construct minimal job data
                const formData: FormInput = {
                    prompt: prompt,
                    duration: 8, // 🚀 YPP SPRINT: 8s optimal for Veo 3.1 Fast Shorts
                    aspectRatio: '9:16' as any, // Type assertion for compatibility
                    style: ['viral'] as any, // Type assertion for compatibility
                    externalHookText: '',
                    thumbnailTitle: '',
                    embeddedHookText: '',
                    editingInstructions: '',
                    hookType: 'time_based' as any,
                    generationMode: 'ai_generation' as any, // Type assertion for compatibility
                    engine: VideoEngine.GEMINIGEN,
                    gmicloudModel: 'model',
                    gmicloudApiKey: '',
                    geminigenApiKey: '',
                    processAudio: false
                };

                // Construct Virality Analysis with DFL Schedule
                const viralityAnalysis = {
                    advice: {
                        recommendedTimes: scheduleTime ? [scheduleTime] : ["18:00"],
                        publishingSchedule: "Adaptive DFL Schedule"
                    }
                };

                setJobData({
                    formData,
                    fullPrompt: prompt,
                    viralityAnalysis: viralityAnalysis as any,
                    marketingCopy: marketingCopy || null
                });

                setStep('geminigen_handoff');
            }
        };
        window.addEventListener('message', handleTrigger);
        return () => window.removeEventListener('message', handleTrigger);
    }, []);

    const handleSelectKey = useCallback(() => {
        if (isSelectingApiKey) return;
        setIsSelectingApiKey(true);

        try {
            if (window.aistudio) {
                window.aistudio.openSelectKey().catch(e => {
                    console.error("Dialog open error:", e);
                    setIsSystemKeySelectorAvailable(false);
                });
                setApiKeyStatus('ready');
            } else {
                setIsSystemKeySelectorAvailable(false);
            }
        } catch (e) {
            console.error("API Key selection failed or was cancelled", e);
            setIsSystemKeySelectorAvailable(false);
        } finally {
            setTimeout(() => setIsSelectingApiKey(false), 1000);
        }
    }, [isSelectingApiKey]);

    const resetApp = useCallback(() => {
        setStep('input');
        setJobData(null);
        setOutputData(null);
        setLoadingProgress(null);
        setError(null);
        setIsMuxing(false);
        setVideoBlobForPreview(null);
        setOriginalVideoBlobForPreview(null);
        setEditorFile(null);
    }, []);

    const handleError = (err: any) => {
        console.error("An error occurred:", err);

        let message = '';

        if (err && typeof err === 'object') {
            if (err.error) {
                if (err.error.code === 429 || err.error.status === 'RESOURCE_EXHAUSTED') {
                    message = t('error.quotaExceeded');
                }
            }
            if (err.status === 429) {
                message = t('error.quotaExceeded');
            }
        }

        if (!message) {
            const rawMessage = err instanceof Error ? err.message : String(err);

            if (rawMessage.includes('{"error":')) {
                try {
                    const jsonMatch = rawMessage.match(/(\{.*"error":.*})/);
                    const jsonStr = jsonMatch ? jsonMatch[0] : rawMessage;
                    const parsed = JSON.parse(jsonStr);
                    if (parsed.error && (parsed.error.code === 429 || parsed.error.status === 'RESOURCE_EXHAUSTED')) {
                        message = t('error.quotaExceeded');
                    }
                } catch (e) {
                    console.warn('[App.tsx] Failed to parse error JSON:', e);
                }
            }

            if (!message) {
                if (rawMessage.toLowerCase().includes('quota') || rawMessage.includes('429') || rawMessage.includes('RESOURCE_EXHAUSTED')) {
                    message = t('error.quotaExceeded');
                } else if (rawMessage.includes('Requested entity was not found') || rawMessage.includes('API key not valid')) {
                    message = t('error.apiKeyInvalid');
                    if (isSystemKeySelectorAvailable && !manualApiKey) {
                        setApiKeyStatus('needed');
                    }
                } else if (rawMessage.includes('API Key')) {
                    message = t('error.apiKeyMissing');
                } else if (!rawMessage || rawMessage === '[object Object]') {
                    message = t('error.systemError');
                } else {
                    message = rawMessage;
                }
            }
        }

        setError(message);
        setStep('input');
    };



    const processGeneratedVideo = async (
        rawVideoSource: Blob | string,
        jobData: JobData,
        activeApiKey: string | undefined
    ) => {
        try {
            const { formData, fullPrompt } = jobData;
            let { viralityAnalysis, marketingCopy } = jobData;
            const modelName = formData.engine === VideoEngine.GEMINIGEN ? 'GeminiGen' : 'AI Model';

            setStep('loading');

            // 1. Convert URL to Blob if needed (fallback if UserScript didn't send Blob)
            let videoBlob: Blob;
            if (typeof rawVideoSource === 'string') {
                try {
                    const res = await fetch(rawVideoSource);
                    if (!res.ok) throw new Error("Failed to fetch video from URL");
                    videoBlob = await res.blob();
                } catch (e) {
                    console.warn("Could not fetch video blob from URL, proceeding with URL only (limited features).", e);
                    // Fallback to simple output if we absolutely can't get the blob
                    // Use template generator for metadata even in fallback
                    const templateData = generateViralMetadataFromTemplate(fullPrompt || "AI Video", formData.aspectRatio);

                    setOutputData({
                        videoUrl: rawVideoSource,
                        thumbnailUrl: '',
                        marketingCopy: marketingCopy || templateData.marketingCopy,
                        fullPrompt,
                        aspectRatio: formData.aspectRatio,
                        viralityAnalysis: viralityAnalysis || templateData.viralityAnalysis
                    });
                    setLoadingProgress({ percentage: 100, messageKey: 'loading.progress.complete', messageParams: { model: modelName } });
                    setStep('output');
                    return;
                }
            } else {
                videoBlob = rawVideoSource;
            }

            setVideoBlobForPreview(videoBlob);

            // 2. Generate Thumbnail (Extract from video)
            setLoadingProgress({ percentage: 40, messageKey: 'loading.progress.upload.generatingThumbnailImage', messageParams: { model: modelName } });
            let thumbnailBlob: Blob;
            try {
                // Use smart algorithm to find the "climax" frame
                console.log("🧠 Analyzing video for maximum retention frame...");
                thumbnailBlob = await generateSmartViralThumbnail(videoBlob);
            } catch (e) {
                console.warn("Smart thumbnail failed, falling back to 1s", e);
                try {
                    thumbnailBlob = await captureFrameFromVideo(videoBlob, 1);
                } catch {
                    thumbnailBlob = await captureFrameFromVideo(videoBlob, 0);
                }
            }
            const thumbnailUrl = URL.createObjectURL(thumbnailBlob);

            // 3. Generate Missing Analysis (if coming from GeminiGen)
            if (!marketingCopy || !viralityAnalysis) {
                setLoadingProgress({ percentage: 50, messageKey: 'loading.progress.generateAnalysis', messageParams: { model: modelName } });

                // Check if we have an API key to run real analysis
                if (activeApiKey) {
                    try {
                        const analysisResult = await generateAnalysisForEditor(
                            formData,
                            [],
                            t,
                            activeApiKey,
                            'gemini-2.0-flash-exp',
                            undefined,
                            thumbnailUrl
                        );
                        marketingCopy = analysisResult.marketingCopy;
                        viralityAnalysis = analysisResult.viralityAnalysis;
                    } catch (e) {
                        console.warn("Failed to generate AI analysis, falling back to template:", e);
                        const templateData = generateViralMetadataFromTemplate(fullPrompt || "AI Video", formData.aspectRatio);
                        marketingCopy = templateData.marketingCopy;
                        viralityAnalysis = templateData.viralityAnalysis;
                    }
                } else {
                    console.log("No API key available for analysis, using viral template generator.");
                    const templateData = generateViralMetadataFromTemplate(fullPrompt || "AI Video", formData.aspectRatio);
                    marketingCopy = templateData.marketingCopy;
                    viralityAnalysis = templateData.viralityAnalysis;
                }
            }

            // 4. Synthesize Video (Replace first frame with thumbnail to ensure consistency, keep duration)
            let finalVideoBlob = videoBlob;
            let skipProcessing = false;

            // 🔥 GEMINIGEN FIX: Skip processing if video is already correct aspect ratio
            // This avoids the "audio only" bug caused by canvas rendering issues
            try {
                const tempVideo = document.createElement('video');
                tempVideo.src = URL.createObjectURL(videoBlob);
                await new Promise((resolve) => {
                    tempVideo.onloadedmetadata = () => {
                        console.log(`📐 Original video: ${tempVideo.videoWidth}x${tempVideo.videoHeight}`);
                        console.log(`📐 Target aspect ratio: ${formData.aspectRatio}`);

                        // Check if aspect ratios match (with tolerance)
                        const targetRatio = formData.aspectRatio === '9:16' ? 9 / 16 :
                            formData.aspectRatio === '16:9' ? 16 / 9 : 1;
                        const actualRatio = tempVideo.videoWidth / tempVideo.videoHeight;
                        const ratioDiff = Math.abs(actualRatio - targetRatio);

                        // Check Duration (Critical Fix)
                        const targetDuration = formData.duration || 5;
                        const durationDiff = Math.abs(tempVideo.duration - targetDuration);

                        // Only skip if BOTH aspect ratio AND duration are correct
                        // And we accept that thumbnail might not be burned in if we skip
                        if (ratioDiff < 0.1 && durationDiff < 1.0) {
                            console.log(`✅ Video matches target (Ratio & Duration), skipping processing`);
                            skipProcessing = true;
                        } else {
                            console.log(`⚠️ Video needs processing: RatioDiff=${ratioDiff.toFixed(2)}, DurationDiff=${durationDiff.toFixed(2)}s`);
                            skipProcessing = false;
                        }

                        URL.revokeObjectURL(tempVideo.src);
                        resolve(null);
                    };
                });
            } catch (e) {
                console.warn("Could not check video aspect ratio:", e);
            }

            if (!skipProcessing) {
                try {
                    setLoadingProgress({ percentage: 70, messageKey: 'loading.progress.upload.encoding', messageParams: { model: modelName } });

                    console.log(`🎬 Synthesizing video. Max Duration: ${formData.duration}s`);

                    // Use renderVideoWithEdits to "burn in" the thumbnail as the first frame
                    // This satisfies the requirement to "synthesize with thumbnail" and "keep duration unchanged"

                    // 🔥 FORCE DURATION: Ensure it's a number and defaults to 5 if missing
                    const enforcedDuration = Number(formData.duration) || 5;
                    console.log(`✂️ Enforcing duration limit: ${enforcedDuration}s`);

                    const result = await processEditedVideoWithAI(
                        new File([videoBlob], "generated.mp4", { type: 'video/mp4' }),
                        [], // No extra edits
                        { ...formData, duration: enforcedDuration }, // Pass explicit number
                        (p) => {
                            const adjusted = 70 + (p.percentage * 0.2);
                            setLoadingProgress({ percentage: adjusted, messageKey: 'loading.progress.upload.encoding', messageParams: { model: modelName } });
                        },
                        (m) => setIsMuxing(m),
                        t,
                        activeApiKey,
                        viralityAnalysis // Pass analysis to potentially use recommended timestamp for thumb
                    );

                    const res = await fetch(result.videoUrl);
                    finalVideoBlob = await res.blob();

                } catch (e) {
                    console.warn("❌ Video synthesis failed. Using original video.", e);
                    // Fallback: If synthesis failed, but we need to enforce duration (e.g. 5s requested, 10s received)
                    if (formData.duration) {
                        try {
                            console.log(`⚠️ Attempting fallback trim to ${formData.duration}s...`);
                            const trimmed = await trimVideo(videoBlob, formData.duration, formData.aspectRatio);
                            finalVideoBlob = trimmed;
                        } catch (trimErr) {
                            console.error("❌ Fallback trim also failed. Using original video as-is:", trimErr);
                            // Last resort: use original video unchanged
                            finalVideoBlob = videoBlob;
                        }
                    }
                }
            } else {
                console.log("⏭️ Skipping video processing, using original");
            }

            const finalVideoUrl = URL.createObjectURL(finalVideoBlob);
            setVideoBlobForPreview(null);

            setOutputData({
                videoUrl: finalVideoUrl,
                thumbnailUrl,
                marketingCopy: marketingCopy,
                fullPrompt,
                aspectRatio: formData.aspectRatio,
                viralityAnalysis
            });
            setLoadingProgress({ percentage: 100, messageKey: 'loading.progress.complete', messageParams: { model: modelName } });
            setStep('output');

        } catch (err) {
            handleError(err);
        }
    };

    const handleGeminiGenHandoffComplete = (videoSource: Blob | string) => {
        if (!jobData) {
            handleError(new Error("Session expired. Please start over."));
            return;
        }
        const activeApiKey = manualApiKey || HARDCODED_API_KEY || undefined;
        processGeneratedVideo(videoSource, jobData, activeApiKey);
    };

    const handleSubmit = async (formData: FormInput) => {
        setError(null);

        const activeApiKey = manualApiKey || HARDCODED_API_KEY || undefined;

        if (formData.engine === VideoEngine.VEO) {
            if (!activeApiKey && isSystemKeySelectorAvailable && apiKeyStatus !== 'ready') {
                handleSelectKey();
                return;
            }
        }

        setJobData({ formData, fullPrompt: null, viralityAnalysis: null, marketingCopy: null });

        if (formData.generationMode === GenerationMode.SMART_EDITOR) {
            if (!isVideoApiSupported) {
                handleError(new Error(t('error.videoApiNotSupported')));
                return;
            }
            setStep('upload_for_editor');
            return;
        }

        setStep('loading');
        setLoadingProgress({ percentage: 5, messageKey: 'loading.progress.generatePrompt' });

        // 如果使用 GeminiGen，引擎不需要调用 AI 生成 Prompt，直接进入 handoff 步骤
        if (formData.engine === VideoEngine.GEMINIGEN) {
            // 直接使用用户在表单中提供的 prompt（或空字符串）
            const currentJobData: JobData = {
                formData,
                fullPrompt: formData.prompt || null,
                viralityAnalysis: null,
                marketingCopy: null,
            };
            setJobData(currentJobData);
            const url = constructGeminiGenUrl(formData, currentJobData.fullPrompt ?? undefined);
            window.open(url, '_blank');
            setStep('geminigen_handoff');
            return;
        }

        // 🎬 Google Vids (Veo 3.1) - Similar to GeminiGen but uses Google Vids
        if (formData.engine === VideoEngine.GOOGLEVIDS) {
            const currentJobData: JobData = {
                formData,
                fullPrompt: formData.prompt || null,
                viralityAnalysis: null,
                marketingCopy: null,
            };
            setJobData(currentJobData);

            // Use constructGoogleVidsUrl to get prompt and aspectRatio
            const { prompt, aspectRatio } = constructGoogleVidsUrl(formData, currentJobData.fullPrompt ?? undefined);

            // Send message to content script to handle automation
            window.postMessage({
                type: 'GOOGLE_VIDS_GENERATE',
                prompt: prompt,
                aspectRatio: aspectRatio,
                uploadData: {
                    title: formData.prompt?.substring(0, 50) || 'AI Generated Video',
                    description: formData.prompt || '',
                }
            }, '*');

            setStep('geminigen_handoff'); // Reuse handoff UI
            return;
        }

        // 非 GeminiGen 引擎需要调用 AI 生成完整 Prompt 与分析数据
        try {
            const { fullPrompt, viralityAnalysis, marketingCopy } = await generateFullPromptAndViralityAnalysis(formData, t, activeApiKey);

            const currentJobData = { formData, fullPrompt, viralityAnalysis, marketingCopy };
            setJobData(currentJobData);

            if (formData.generationMode === GenerationMode.PROMPT_ONLY) {
                setStep('prompt_output');
                return;
            }

            if (formData.engine === VideoEngine.VEO || formData.engine === VideoEngine.GMICLOUD) {
                const modelName = formData.engine === VideoEngine.GMICLOUD ? (formData.gmicloudModel || 'GMICloud') : 'Veo';

                setLoadingProgress({
                    percentage: 15,
                    messageKey: formData.engine === VideoEngine.VEO ? 'loading.progress.initiateVeo' : 'loading.progress.gmicloudSubmitted',
                    messageParams: { model: modelName }
                });

                let videoBlobFromEngine: Blob;

                if (formData.engine === VideoEngine.VEO) {
                    videoBlobFromEngine = await generateVideoAndThumbnail(fullPrompt, formData, (progress) => {
                        const adjustedPercentage = 15 + (progress.percentage - 15) * 0.6;
                        setLoadingProgress({ ...progress, percentage: adjustedPercentage });
                    }, t, activeApiKey);
                } else {
                    videoBlobFromEngine = await generateGmicloudVideo(fullPrompt, formData, (progress) => {
                        const adjustedPercentage = 15 + (progress.percentage - 15) * 0.6;
                        setLoadingProgress({ ...progress, percentage: adjustedPercentage });
                    }, t);
                }

                processGeneratedVideo(videoBlobFromEngine, currentJobData, activeApiKey);
            }

        } catch (err) {
            handleError(err);
        }
    };

    const handleUpload = async (file: File) => {
        if (!jobData) {
            handleError(new Error("Job data is missing."));
            return;
        }
        const activeApiKey = manualApiKey || HARDCODED_API_KEY || undefined;

        setStep('loading');
        setError(null);

        try {
            setLoadingProgress({ percentage: 5, messageKey: 'loading.progress.upload.parsing' });
            const editingPlan = await generateEditingPlan(jobData.formData.editingInstructions, t, activeApiKey);

            const plannedFormData = {
                ...jobData.formData,
                duration: editingPlan.duration,
                aspectRatio: editingPlan.aspectRatio,
            };

            setLoadingProgress({ percentage: 10, messageKey: 'loading.progress.generateAnalysis' });
            const { viralityAnalysis, marketingCopy } = await generateAnalysisForEditor(plannedFormData, [], t, activeApiKey, plannedFormData.engine === VideoEngine.GEMINIGEN ? 'GeminiGen' : 'AI Model');

            const updatedJobData = { ...jobData, formData: plannedFormData, viralityAnalysis, marketingCopy, fullPrompt: jobData.formData.editingInstructions };
            setJobData(updatedJobData);

            const { videoUrl, thumbnailUrl, finalAspectRatio } = await processUploadedVideoWithAI(
                updatedJobData.formData,
                file,
                (progress) => {
                    const adjustedPercentage = 15 + (progress.percentage * 0.85);
                    setLoadingProgress({ ...progress, percentage: adjustedPercentage });
                    if (progress.videoBlob) setVideoBlobForPreview(progress.videoBlob);
                    if (progress.originalVideoBlob) setOriginalVideoBlobForPreview(progress.originalVideoBlob);
                },
                (isMuxing) => setIsMuxing(isMuxing),
                t,
                activeApiKey
            );

            setOutputData({
                videoUrl,
                thumbnailUrl,
                marketingCopy: updatedJobData.marketingCopy,
                fullPrompt: updatedJobData.fullPrompt,
                aspectRatio: finalAspectRatio,
                viralityAnalysis: updatedJobData.viralityAnalysis
            });
            setStep('output');

        } catch (err) {
            handleError(err);
        } finally {
            setVideoBlobForPreview(null);
            setOriginalVideoBlobForPreview(null);
        }
    };

    const handleEditorUpload = (file: File) => {
        setEditorFile(file);
        setStep('editor');
    };

    const [isEditorProcessing, setIsEditorProcessing] = useState(false);
    const [editorProgress, setEditorProgress] = useState(0);

    const handleExportFromEditor = async (actions: EditAction[], finalDuration: number, finalAspectRatio: string, model: string, transcript?: TranscriptItem[]) => {
        if (!jobData || !editorFile) {
            handleError(new Error("Job or file data is missing for export."));
            return;
        }
        const activeApiKey = manualApiKey || HARDCODED_API_KEY || undefined;

        setIsEditorProcessing(true);
        setEditorProgress(0);
        setError(null);
        setOutputData(null);

        try {
            console.log("Starting export in-place...", { actions, finalDuration });

            const plannedFormData = {
                ...jobData.formData,
                duration: finalDuration,
                aspectRatio: finalAspectRatio as any,
            };

            // 0. Capture Thumbnail for Analysis (and potential reuse)
            let analysisThumbnail: string | null = null;
            try {
                // Capture at 1s to avoid black frames, similar to processEditedVideoWithAI
                const thumbBlob = await captureFrameFromVideo(editorFile, 1);
                analysisThumbnail = URL.createObjectURL(thumbBlob);
            } catch (e) {
                console.warn("Failed to capture thumbnail for analysis:", e);
            }

            // Start Analysis in Background (don't await yet)
            const analysisPromise = generateAnalysisForEditor(plannedFormData, actions, t, activeApiKey, model, transcript, analysisThumbnail)
                .then(result => result)
                .catch(e => {
                    console.warn("Background analysis failed:", e);
                    return { viralityAnalysis: null, marketingCopy: null };
                });

            // Start Video Processing (await this one)
            const { videoUrl, thumbnailUrl } = await processEditedVideoWithAI(
                editorFile,
                actions,
                plannedFormData,
                (progress) => {
                    setEditorProgress(progress.percentage);
                },
                (isMuxing) => setIsMuxing(isMuxing),
                t,
                activeApiKey,
                (await analysisPromise).viralityAnalysis // Pass the analysis result
            );

            setIsEditorProcessing(false);
            setEditorProgress(100);

            const analysisResult = await analysisPromise;

            setOutputData({
                videoUrl,
                thumbnailUrl,
                marketingCopy: analysisResult.marketingCopy || {
                    title: null, description: null, tags: [],
                    comment1: { type: '', content: null }, comment2: { type: '', content: null }
                },
                fullPrompt: jobData.formData.editingInstructions,
                aspectRatio: finalAspectRatio,
                viralityAnalysis: analysisResult.viralityAnalysis
            });
            setStep('output');

        } catch (err) {
            console.error("Export failed:", err);
            handleError(err);
            setIsEditorProcessing(false);
        } finally {
            setVideoBlobForPreview(null);
            setOriginalVideoBlobForPreview(null);
        }
    };

    const activeApiKey = manualApiKey || HARDCODED_API_KEY;

    function renderStep() {
        switch (step) {
            case 'input':
                return (
                    <>
                        <Header
                            onOpenManual={() => setIsManualOpen(true)}
                            onNavigateToAnalytics={() => setStep('youtube_analytics')}
                        />
                        <main className="container mx-auto px-4 pb-12 flex-grow overflow-y-auto custom-scrollbar">
                            <InputForm
                                initialValues={jobData?.formData}
                                onSubmit={handleSubmit}
                                disabled={false}
                                isVideoApiSupported={isVideoApiSupported}
                                apiKeyStatus={apiKeyStatus}
                                onSelectKey={handleSelectKey}
                                isSelectingApiKey={isSelectingApiKey}
                                isSystemKeySelectorAvailable={isSystemKeySelectorAvailable}
                                manualApiKey={manualApiKey}
                                onManualApiKeyChange={setManualApiKey}
                            />
                            {error && (
                                <div className="mt-8 max-w-2xl mx-auto bg-red-900/50 border border-red-500/50 backdrop-blur-md text-red-200 p-4 rounded-lg text-center shadow-lg">
                                    <h3 className="font-bold text-lg mb-2">{t('error.title')}</h3>
                                    <p dangerouslySetInnerHTML={{ __html: error.replace(/\n/g, '<br />') }} />
                                </div>
                            )}
                        </main>
                    </>
                );
            case 'upload':
                return jobData ? <UploadStep jobData={jobData} onUpload={handleUpload} onBack={resetApp} isVideoApiSupported={isVideoApiSupported} /> : null;
            case 'loading':
                return (
                    <div className="flex-grow flex items-center justify-center">
                        <LoadingScreen
                            progress={loadingProgress}
                            videoBlobForPreview={videoBlobForPreview}
                            originalVideoBlobForPreview={originalVideoBlobForPreview}
                            previewAspectRatio={jobData?.formData.aspectRatio ?? null}
                            trimDuration={jobData?.formData.duration ?? null}
                            engine={jobData?.formData.engine ?? null}
                        />
                    </div>
                );
            case 'output':
                return outputData ? (
                    <div className="flex-grow overflow-y-auto custom-scrollbar h-full relative">
                        <OutputDisplay
                            output={outputData}
                            onReset={resetApp}
                            isMuxing={isMuxing}
                            onNext={() => {
                                console.log("🔄 [App] Video flow complete, triggering next item...");
                                // 1. Notify Analytics to advance queue
                                window.postMessage({ type: 'QUEUE_ITEM_COMPLETE' }, '*');

                                // 2. Reset App State for next run
                                resetApp();

                                // 3. Switch back to Analytics view to show progress
                                setStep('youtube_analytics');
                            }}
                        />
                    </div>
                ) : null;
            case 'prompt_output':
                return jobData && jobData.fullPrompt ? <PromptOutputDisplay prompt={jobData.fullPrompt} onReset={resetApp} /> : null;
            case 'upload_for_editor':
                return <UploadScreen onVideoUpload={handleEditorUpload} />;
            case 'editor':
                return editorFile && jobData ? (
                    <Editor
                        videoFile={editorFile}
                        initialInstructions={jobData?.formData.editingInstructions || ''}
                        onReset={() => {
                            setEditorFile(null);
                            setStep('input');
                            setJobData(null);
                        }}
                        onExport={handleExportFromEditor}
                        apiKey={manualApiKey}
                        onApiKeyChange={setManualApiKey}
                        outputData={outputData}
                        isProcessing={isEditorProcessing}
                        progress={editorProgress}
                        isMuxing={isMuxing}
                        onCloseOutput={() => setOutputData(null)}
                    />
                ) : null;
            case 'geminigen_handoff':
                return jobData ? (
                    <GeminiGenHandoff
                        formData={jobData.formData}
                        fullPrompt={jobData.fullPrompt || undefined}
                        onVideoSubmit={(url) => {
                            // Directly pass the URL to avoid CORS issues with client-side fetch
                            handleGeminiGenHandoffComplete(url);
                        }}
                        onBack={() => setStep('input')}
                    />
                ) : null;
            case 'youtube_analytics':
                return (
                    <YouTubeAnalytics apiKey={activeApiKey} />
                );
            default:
                return null;
        }
    }

    return (
        <div className="h-full text-slate-300 flex flex-col font-sans bg-transparent overflow-auto custom-scrollbar">
            {renderStep()}
            <DebuggerUI />
        </div>
    );
}

