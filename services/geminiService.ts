
import { GoogleGenAI, Type } from "@google/genai";
import { AspectRatio } from '../types';
import type { FormInput, EditAction, TranscriptItem, GmicloudModelInfo, AiEditPlanData } from '../types';

export type Translator = (key: string, params?: any) => string;
export type ProgressCallback = (progress: { percentage: number; messageKey: string; messageParams?: any; videoBlob?: Blob; originalVideoBlob?: Blob }) => void;

export const getAiClient = (t: Translator, apiKey?: string, accessToken?: string) => {
    // 优先使用 OAuth access token (如果 SDK 支持)
    if (accessToken) {
        console.log("🔑 Using OAuth Access Token:", accessToken.substring(0, 20) + "...");
        try {
            // 使用类型断言，因为 TypeScript 定义可能不包含 accessToken
            return new GoogleGenAI({ accessToken } as any);
        } catch (e) {
            console.warn("⚠️ Failed to use OAuth token, falling back to API key", e);
            // 继续尝试使用 API key
        }
    }

    // 回退到 API key 方式
    let key = apiKey || '';
    // Safely check for process.env (it might not exist in browser)
    if (!key && typeof process !== 'undefined' && process.env) {
        key = process.env.API_KEY || '';
    }
    key = key.trim();

    // Ignore placeholder keys that might be in .env templates
    if (key.startsWith('PLACEHOLDER') || key.includes('YOUR_API_KEY')) {
        console.warn("Found placeholder API key, ignoring.");
        key = '';
    }
    if (!key) {
        throw new Error(t('error.apiKeyMissing'));
    }
    console.log("Using API Key:", key.substring(0, 10) + "...");
    return new GoogleGenAI({ apiKey: key });
};

/**
 * Create AI client with automatic OAuth support
 * Prioritizes OAuth access token over API key
 */
export async function createAiClient(t: Translator, apiKey?: string) {
    try {
        // Try to get OAuth token
        if (typeof window !== 'undefined') {
            const oauthService = await import('./oauthService');
            const { isAuthenticated, getAccessToken } = oauthService;
            
            if (isAuthenticated()) {
                const accessToken = getAccessToken();
                if (accessToken) {
                    console.log("🔑 Using OAuth authentication");
                    return new GoogleGenAI({ accessToken } as any);
                }
            }
        }
    } catch (e) {
        console.debug("OAuth not available, falling back to API key");
    }

    // Fallback to API key
    return getAiClient(t, apiKey);
}

export async function getAvailableModels(t: Translator, apiKey?: string): Promise<string[]> {
    const ai = getAiClient(t, apiKey);
    const fallbackModels = [
        'gemini-2.0-flash-exp',
        'gemini-1.5-flash',
        'gemini-1.5-flash-001',
        'gemini-1.5-pro',
        'gemini-1.5-pro-001',
        'gemini-1.5-pro-002'
    ];

    try {
        const response = await ai.models.list();
        const models = (response as any).models || [];
        const modelNames = models.map((m: any) => m.name.replace('models/', ''));

        if (modelNames.length === 0) return fallbackModels;
        return modelNames;
    } catch (e) {
        console.error("Failed to list models, using fallback list.", e);
        return fallbackModels;
    }
}

/**
 * Centralized error handler to parse SDK errors and return user-friendly messages.
 */
const handleGeminiError = (e: any, t: Translator) => {
    console.error("Gemini Operation Failed:", e);
    const msg = e.message || e.toString();

    // Check for Rpc failed (Google SDK Network/VPN Error)
    if (msg.includes('Rpc failed') || msg.includes('error code: 6') || msg.includes('XHR error') || msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        throw new Error(t('error.systemError') + " (Network/RPC Failure: The connection to Google's AI servers failed. Please check your internet connection, firewall, or VPN.)");
    }

    // Check for raw JSON string error (e.g. "{\"error\":{\"code\":429...}}")
    if (typeof msg === 'string' && (msg.includes('"code":429') || msg.includes('"status":"RESOURCE_EXHAUSTED"'))) {
        throw new Error(t('error.quotaExceeded'));
    }

    // Detect Quota Limit (429)
    if (
        msg.includes('429') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.toLowerCase().includes('quota') ||
        (e.error && e.error.code === 429) ||
        e.status === 429
    ) {
        throw new Error(t('error.quotaExceeded'));
    }

    // Detect Model Not Found (404 on models/...)
    if (msg.includes('models/') && (msg.includes('not found') || e.status === 404)) {
        // Extract model name if possible
        const modelMatch = msg.match(/models\/([^ ]+)/);
        const modelName = modelMatch ? modelMatch[1] : 'Unknown';
        throw new Error(t('error.modelNotFound', { model: modelName }));
    }

    // Detect API Key / Permissions (404/403)
    if (
        msg.includes('Requested entity was not found') ||
        msg.includes('PERMISSION_DENIED') ||
        msg.includes('API key not valid') ||
        e.status === 404 ||
        e.status === 403
    ) {
        throw new Error(t('error.apiKeyInvalid'));
    }

    // Pass through other errors
    throw e;
};

function safeJsonParse(text: string, fallback: any = {}) {
    if (!text) return fallback;

    let textToParse = text;

    // Attempt to strip markdown code blocks if present
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
        textToParse = jsonMatch[1];
    }

    try {
        return JSON.parse(textToParse);
    } catch (e) {
        try {
            let repaired = textToParse.trim();
            const quoteCount = (repaired.match(/(?<!\\)"/g) || []).length;
            if (quoteCount % 2 !== 0) {
                repaired += '"';
            }
            const openBraces = (repaired.match(/{/g) || []).length;
            const closeBraces = (repaired.match(/}/g) || []).length;
            const openBrackets = (repaired.match(/\[/g) || []).length;
            const closeBrackets = (repaired.match(/]/g) || []).length;

            if (openBrackets > closeBrackets) {
                repaired += ']'.repeat(openBrackets - closeBrackets);
            }

            if (openBraces > closeBraces) {
                repaired += '}'.repeat(openBraces - closeBraces);
            }

            return JSON.parse(repaired);
        } catch (e2) {
            console.warn("JSON Parse Warning (Recoverable):", e);
        }

        if (fallback !== undefined) return fallback;

        throw new Error("Failed to parse valid JSON from AI response. The response might be truncated or malformed.");
    }
}

const sanitizeAnalysisResponse = (data: any) => {
    const safeData = (data && typeof data === 'object' && !Array.isArray(data)) ? { ...data } : {};

    if (!safeData.viralityAnalysis || typeof safeData.viralityAnalysis !== 'object') {
        safeData.viralityAnalysis = {};
    }

    const va = safeData.viralityAnalysis;

    if (!va.advice || typeof va.advice !== 'object') {
        va.advice = {};
    }
    const advice = va.advice;

    if (!advice.thumbnailAdvice) advice.thumbnailAdvice = "High contrast, expressive face, bright colors.";
    if (!advice.recommendedTimes) advice.recommendedTimes = ["18:00", "21:00"];
    if (!advice.publishingSchedule) advice.publishingSchedule = "Daily at peak hours";
    if (!advice.ctaAdvice) advice.ctaAdvice = "Subscribe for more content";

    if (!va.score || typeof va.score !== 'object') va.score = { score: 85, grade: 'B' };
    if (!va.metrics || typeof va.metrics !== 'object') va.metrics = { playCount: 1000, ctr: 5.0, retention: 60 };

    if (!safeData.marketingCopy || typeof safeData.marketingCopy !== 'object') {
        safeData.marketingCopy = {};
    }
    const mc = safeData.marketingCopy;
    if (!mc.title) mc.title = "Viral Video";
    if (!mc.description) mc.description = "Check this out!";
    if (!Array.isArray(mc.tags)) mc.tags = ["#viral", "#trending"];
    if (!mc.comment1 || typeof mc.comment1 !== 'object') mc.comment1 = { type: "Engagement", content: "What do you think?" };
    if (!mc.comment2 || typeof mc.comment2 !== 'object') mc.comment2 = { type: "Hook", content: "Watch till the end!" };

    return safeData;
};

export async function fetchWithFailover(
    targetUrl: string,
    options: RequestInit = {},
    config: { suppressLogs?: boolean, dontRetryOn?: number[] } = {}
): Promise<Response> {
    let lastError: any = null;

    interface Strategy {
        type: string;
        getUrl: (originalUrl: string) => string;
    }

    const strategies: Strategy[] = [];
    const isPost = options.method === 'POST' || options.method === 'PUT';
    const hasCustomHeaders = options.headers && Object.keys(options.headers).length > 0;

    strategies.push({ type: 'Direct', getUrl: (u) => u });
    strategies.push({ type: 'CorsProxy.io', getUrl: (u) => `https://corsproxy.io/?${encodeURIComponent(u)}` });
    strategies.push({ type: 'ThingProxy', getUrl: (u) => `https://thingproxy.freeboard.io/fetch/${u}` });

    if (!isPost && !hasCustomHeaders) {
        strategies.push({ type: 'CodeTabs', getUrl: (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}` });
        strategies.push({ type: 'AllOrigins', getUrl: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}` });
    }

    for (const strategy of strategies) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000);

        const originalSignal = options.signal;
        if (originalSignal) {
            originalSignal.addEventListener('abort', () => controller.abort());
        }

        try {
            const url = strategy.getUrl(targetUrl);

            if (!config.suppressLogs) {
                console.log(`[Fetch] Attempting ${strategy.type}: ${url}`);
            }

            const fetchOpts = {
                ...options,
                signal: controller.signal,
                mode: 'cors' as RequestMode
            };

            const res = await fetch(url, fetchOpts);

            clearTimeout(timeoutId);

            if (config.dontRetryOn && config.dontRetryOn.includes(res.status)) {
                return res;
            }

            if (res.ok) return res;

            if (strategy.type === 'Direct' && (res.status === 403 || res.status === 401 || res.status === 0 || res.type === 'opaque')) {
                if (!config.suppressLogs) console.warn(`[Fetch] Direct access forbidden or blocked (${res.status}). Switching to proxy fallback...`);
                continue;
            }

            const isOfficialEndpoint = targetUrl.includes('gmicloud.ai') || targetUrl.includes('geminigen.ai');
            if ([404, 422, 500, 502, 503, 504].includes(res.status)) {
                if (isOfficialEndpoint) {
                    if (!config.suppressLogs) console.warn(`[Fetch] ${strategy.type} returned ${res.status}. Retrying with next strategy...`);
                    lastError = new Error(`Status ${res.status} from ${strategy.type}`);
                    continue;
                }
                return res;
            }

            if (res.status === 401 || res.status === 403) {
                return res;
            }

            if (!config.suppressLogs) console.warn(`[Fetch] ${strategy.type} failed with status: ${res.status}`);
            lastError = new Error(`Status ${res.status} from ${strategy.type}`);

        } catch (e: any) {
            clearTimeout(timeoutId);
            if (!config.suppressLogs) console.warn(`[Fetch] ${strategy.type} network error:`, e.message);
            lastError = e;
        }
    }

    throw lastError || new Error(`All fetch attempts failed for ${targetUrl}. Please check your network connection or VPN.`);
}

export async function getGmicloudModels(apiKey: string, baseUrl?: string): Promise<GmicloudModelInfo[]> {
    try {
        const cleanApiKey = apiKey ? apiKey.replace(/[^\x20-\x7E]/g, '').trim() : '';
        if (!cleanApiKey) return [];

        const targetUrl = baseUrl
            ? `${baseUrl.replace(/\/$/, '')}/api/v1/ie/requestqueue/apikey/models`
            : 'https://console.gmicloud.ai/api/v1/ie/requestqueue/apikey/models';

        const fetchOptions = {
            headers: {
                'Authorization': `Bearer ${cleanApiKey}`,
                'X-Organization-ID': '0',
            },
            credentials: 'omit' as RequestCredentials,
            referrerPolicy: 'no-referrer' as ReferrerPolicy
        };

        const response = await fetchWithFailover(targetUrl, fetchOptions);

        if (response.ok) {
            const data = await response.json();
            if (data && Array.isArray(data.model_ids)) {
                return data.model_ids.map((id: string) => ({
                    id: id,
                    name: id
                }));
            }
        }
        throw new Error(`Status: ${response.status}`);
    } catch (e) {
        return [];
    }
}

export async function generateFullPromptAndViralityAnalysis(
    formData: FormInput,
    t: Translator,
    apiKey?: string,
    model: string = 'gemini-2.0-flash-exp'
) {
    try {
        const ai = await createAiClient(t, apiKey);

        // --- FEEDBACK LOOP INJECTION ---
        // Fetch insights from past analytics to optimize this new generation
        const { analyticsService } = require('./analyticsService');
        const topTopics = analyticsService.getTopPerformingTopics();
        let systemInstruction = t('gemini.systemInstruction.main');

        if (topTopics && topTopics.length > 0) {
            console.log("🧠 [Gemini Service] Injecting Analytics Insights:", topTopics);
            const insightsText = `
            CRITICAL OPTIMIZATION INSTRUCTION:
            The user's channel has had success with the following topics/styles recently:
            ${topTopics.map((t: string) => `- ${t}`).join('\n')}
            
            PLEASE PRIORITIZE these successful elements in your prompt generation and virality analysis. 
            Align the new content with what is already working for this channel to maximize YPP growth.
            `;
            systemInstruction += insightsText;
        }
        // -------------------------------

        const response = await ai.models.generateContent({
            model: model,
            contents: `Generate a detailed video prompt and virality analysis for: ${JSON.stringify(formData)}`,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                maxOutputTokens: 8192,
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        fullPrompt: { type: Type.STRING },
                        viralityAnalysis: {
                            type: Type.OBJECT,
                            properties: {
                                score: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, grade: { type: Type.STRING } } },
                                metrics: { type: Type.OBJECT, properties: { playCount: { type: Type.NUMBER }, ctr: { type: Type.NUMBER }, retention: { type: Type.NUMBER } } },
                                advice: { type: Type.OBJECT, properties: { recommendedTimes: { type: Type.ARRAY, items: { type: Type.NUMBER } }, visualStyle: { type: Type.STRING }, callToAction: { type: Type.STRING } } }
                            }
                        },
                        marketingCopy: {
                            type: Type.OBJECT,
                            properties: {
                                title: { type: Type.STRING },
                                description: { type: Type.STRING },
                                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                                comment1: { type: Type.OBJECT, properties: { type: { type: Type.STRING }, content: { type: Type.STRING } } },
                                comment2: { type: Type.OBJECT, properties: { type: { type: Type.STRING }, content: { type: Type.STRING } } }
                            }
                        }
                    }
                }
            }
        });

        const text = response.text;
        if (!text) throw new Error("Empty response from AI");
        const parsed = safeJsonParse(text);
        return sanitizeAnalysisResponse(parsed);

    } catch (error: any) {
        console.warn("AI Analysis failed or API Key missing, using fallback data:", error.message);
        // Fallback for when API key is missing (e.g. GeminiGen mode) or AI fails
        return {
            fullPrompt: formData.prompt || formData.editingInstructions || "Video content",
            viralityAnalysis: {
                score: { score: 85, grade: 'B' },
                metrics: { playCount: 1000, ctr: 5.0, retention: 60 },
                advice: { recommendedTimes: [], visualStyle: "Standard", callToAction: "Watch more" }
            },
            marketingCopy: {
                title: formData.thumbnailTitle || "My Video",
                description: "Generated video content",
                tags: ["#video", "#ai"],
                comment1: { type: "Engagement", content: "Nice video!" },
                comment2: { type: "Hook", content: "Wait for it..." }
            }
        };
    }
}

export async function generateAnalysisForEditor(
    formData: FormInput,
    actions: EditAction[],
    t: Translator,
    apiKey?: string,
    model: string = 'gemini-2.0-flash-exp',
    transcript?: TranscriptItem[],
    thumbnailUrl?: string | null
) {
    const ai = await createAiClient(t, apiKey);
    try {
        const actionsSummary = actions.map(a =>
            a.type === 'CUT' ? `Cut: ${a.startTime}-${a.endTime}s` : `Text: "${a.text}" at ${a.startTime}s`
        ).join('\n');

        // Filter transcript to exclude cut segments
        const activeTranscript = transcript ? transcript.filter(item => {
            const cuts = actions.filter(a => a.type === 'CUT');
            return !cuts.some(cut =>
                (item.start >= cut.startTime && item.start < cut.endTime) ||
                (item.end > cut.startTime && item.end <= cut.endTime)
            );
        }) : [];

        const transcriptSummary = activeTranscript.length > 0
            ? activeTranscript.map(t => `[${t.start.toFixed(1)}s] ${t.text}`).join('\n').slice(0, 2000)
            : "No transcript available (or all content was cut).";

        const prompt = `
        ROLE: World-Class Viral Content Strategist & YouTube/TikTok Algorithm Expert.
        TASK: Generate EXTREME CLICKBAIT and HIGH-VIRALITY metadata for this video.
        
        CONTEXT:
        User Request: ${JSON.stringify(formData)}
        Edits Applied:
        ${actionsSummary}
        
        ACTUAL VIDEO TRANSCRIPT (THE TRUTH):
        ${transcriptSummary}

        IMPORTANT: The user wants "algorithm recognized extremely biased marketing content". Do not be subtle. Be bold, controversial, and attention-grabbing.

        INSTRUCTIONS:
        1.  **Title**: Write a SHOCKING, MUST-CLICK title (Max 80 chars). 
            - Use strong emotional triggers (Fear, Curiosity, Greed, Shock).
            - Use ALL CAPS for emphasis on key words.
            - Example: "I Found This in a TRASH CAN and You Won't Believe It!" or "The SECRET They Don't Want You To Know".
        2.  **Description**: Write a high-retention description.
            - First line must be a hook.
            - Use short, punchy sentences.
            - Tease the ending.
        3.  **Tags**: 15+ high-volume, trending tags. Mix broad and specific.
        4.  **Virality Score**: Be critical. If it's boring, give it a low score.
        5.  **Strict Content Rule**: Base it on the visual/transcript, but HYPE IT UP to the max.

        OUTPUT FORMAT: JSON only.
        `;

        const contents: any[] = [{ text: prompt }];
        if (thumbnailUrl && thumbnailUrl.startsWith('data:image')) {
            const base64Image = thumbnailUrl.split(',')[1];
            contents.push({
                inlineData: {
                    mimeType: "image/jpeg", // Assuming JPEG from captureFrameFromVideo
                    data: base64Image
                }
            });
        }

        const response = await ai.models.generateContent({
            model: model,
            contents: contents,
            config: {
                systemInstruction: t('gemini.systemInstruction.editorAnalysis'),
                responseMimeType: "application/json",
                maxOutputTokens: 8192,
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        viralityAnalysis: {
                            type: Type.OBJECT,
                            properties: {
                                score: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, grade: { type: Type.STRING } } },
                                metrics: { type: Type.OBJECT, properties: { playCount: { type: Type.NUMBER }, ctr: { type: Type.NUMBER }, retention: { type: Type.NUMBER } } },
                                advice: { type: Type.OBJECT, properties: { recommendedTimes: { type: Type.ARRAY, items: { type: Type.STRING } }, publishingSchedule: { type: Type.STRING }, thumbnailAdvice: { type: Type.STRING }, ctaAdvice: { type: Type.STRING } } }
                            }
                        },
                        marketingCopy: {
                            type: Type.OBJECT,
                            properties: {
                                title: { type: Type.STRING },
                                description: { type: Type.STRING },
                                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                                comment1: { type: Type.OBJECT, properties: { type: { type: Type.STRING }, content: { type: Type.STRING } } },
                                comment2: { type: Type.OBJECT, properties: { type: { type: Type.STRING }, content: { type: Type.STRING } } }
                            }
                        }
                    }
                }
            }
        });
        const parsed = safeJsonParse(response.text || "{}");

        // --- MANUAL SANITIZATION ---
        // The AI sometimes ignores negative constraints. We enforce them here.

        if (parsed.marketingCopy) {
            // 1. Sanitize Title: Remove hashtags and truncate
            let title = parsed.marketingCopy.title || "";
            title = title.replace(/#[a-zA-Z0-9_]+/g, '').trim(); // Remove hashtags
            if (title.length > 80) title = title.substring(0, 77) + "...";
            parsed.marketingCopy.title = title;

            // 2. Sanitize Description: Remove hashtags and truncate
            let desc = parsed.marketingCopy.description || "";
            desc = desc.replace(/#[a-zA-Z0-9_]+/g, '').trim(); // Remove hashtags

            // Check for banned phrases
            const bannedPhrases = ["check this out", "watch this", "must see", "wait for it"];
            const lowerDesc = desc.toLowerCase();
            if (bannedPhrases.some(p => lowerDesc.includes(p)) || desc.length < 10) {
                desc = `${title}. Watch the full video to see what happens!`;
            }
            if (desc.length > 300) desc = desc.substring(0, 297) + "...";
            parsed.marketingCopy.description = desc;

            // 3. Enforce Tag Limit
            if (Array.isArray(parsed.marketingCopy.tags)) {
                parsed.marketingCopy.tags = parsed.marketingCopy.tags.slice(0, 10);
            }
        }
        // ---------------------------

        return sanitizeAnalysisResponse(parsed);
    } catch (e) {
        handleGeminiError(e, t);
        throw e;
    }
}

export async function generateEditingPlan(
    instructions: string,
    t: Translator,
    apiKey?: string
): Promise<{ duration: number; aspectRatio: AspectRatio }> {
    const ai = await createAiClient(t, apiKey);
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: t('gemini.prompt.createPlan', { instructions }),
            config: {
                systemInstruction: t('gemini.systemInstruction.createPlan'),
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        duration: { type: Type.NUMBER },
                        aspectRatio: { type: Type.STRING, enum: ["9:16", "16:9", "1:1"] }
                    }
                }
            }
        });
        const json = safeJsonParse(response.text || "{}");
        return {
            duration: json.duration || 15,
            aspectRatio: (json.aspectRatio as AspectRatio) || AspectRatio.VERTICAL
        };
    } catch (e) {
        handleGeminiError(e, t);
        throw e;
    }
}

export async function generateThumbnailPrompt(
    description: string,
    t: Translator,
    apiKey?: string
): Promise<string> {
    const ai = await createAiClient(t, apiKey);
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: t('gemini.prompt.createThumbnailPrompt', { description }),
            config: {
                systemInstruction: t('gemini.systemInstruction.createThumbnailPrompt'),
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        prompt: { type: Type.STRING }
                    }
                }
            }
        });
        const json = safeJsonParse(response.text || "{}");
        return json.prompt || description;
    } catch (e) {
        handleGeminiError(e, t);
        throw e;
    }
}

export async function generateImageForThumbnail(
    prompt: string,
    aspectRatio: string,
    t: Translator,
    apiKey?: string
): Promise<string> {
    const ai = await createAiClient(t, apiKey);
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                aspectRatio: aspectRatio as any,
                outputMimeType: 'image/jpeg'
            }
        });
        const base64 = response.generatedImages?.[0]?.image?.imageBytes;
        if (!base64) throw new Error("No image generated");
        return `data:image/jpeg;base64,${base64}`;
    } catch (e) {
        handleGeminiError(e, t);
        throw e;
    }
}

export async function generateVideoAndThumbnail(
    rawPrompt: string,
    formData: FormInput,
    onProgress: ProgressCallback,
    t: Translator,
    apiKey?: string
): Promise<Blob> {
    const ai = await createAiClient(t, apiKey);
    const apiKeyToUse = apiKey || process.env.API_KEY;

    // 🛡️ SAFETY FILTER: Sanitize prompt before sending to Veo API
    const { sanitizePromptForVideoGen } = await import('./yppService');
    const prompt = sanitizePromptForVideoGen(rawPrompt);
    if (prompt !== rawPrompt) {
        console.log('🛡️ [Veo] Prompt was sanitized for safety');
    }

    try {
        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: prompt,
            config: {
                numberOfVideos: 1,
                resolution: '720p',
                aspectRatio: formData.aspectRatio === '9:16' ? '9:16' : '16:9',
            }
        });

        onProgress({ percentage: 25, messageKey: 'loading.progress.veoSubmitted' });

        let checks = 0;
        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await ai.operations.getVideosOperation({ operation: operation });
            checks++;
            const progressPercentage = 25 + Math.min(65, checks * 5);
            onProgress({ percentage: progressPercentage, messageKey: 'loading.progress.veoWorking' });
        }

        onProgress({ percentage: 95, messageKey: 'loading.progress.veoFinalizing' });

        if (operation.error) {
            throw new Error(`Veo generation failed: ${operation.error.message}`);
        }

        const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!videoUri) throw new Error(t('error.veoUriMissing'));

        const separator = videoUri.includes('?') ? '&' : '?';
        const fetchUrl = `${videoUri}${separator}key=${apiKeyToUse}`;

        const videoResponse = await fetch(fetchUrl);
        if (!videoResponse.ok) {
            if (videoResponse.status === 429) throw new Error(t('error.quotaExceeded'));
            throw new Error(t('error.veoFetchFailed', { status: videoResponse.status }));
        }
        const videoBlob = await videoResponse.blob();
        const mp4Blob = new Blob([videoBlob], { type: 'video/mp4' });

        if (mp4Blob.size < 1024 || mp4Blob.type.includes('text') || mp4Blob.type.includes('json')) {
            let errorText = "";
            try { errorText = await mp4Blob.text(); } catch (e) {
                console.warn('[geminiService.ts] Failed to read blob text:', e);
            }
            if (errorText && (errorText.includes('Error') || errorText.includes('Exception'))) {
                throw new Error(`Veo Download Error: ${errorText.slice(0, 200)}`);
            }
            throw new Error(t('error.veoVideoEmpty'));
        }

        return mp4Blob;

    } catch (err: any) {
        handleGeminiError(err, t);
        throw err;
    }
}

export async function generateGmicloudVideo(
    prompt: string,
    formData: FormInput,
    onProgress: ProgressCallback,
    t: Translator
): Promise<Blob> {
    const modelName = formData.gmicloudModel || 'GMICloud';
    onProgress({ percentage: 20, messageKey: 'loading.progress.gmicloudSubmitted', messageParams: { model: modelName } });

    const rawApiKey = formData.gmicloudApiKey || '';
    const apiKey = rawApiKey.replace(/[^\x20-\x7E]/g, '').trim();
    const model = formData.gmicloudModel;
    const baseUrl = formData.gmicloudBaseUrl;

    if (!apiKey) throw new Error("GMICloud API Key required");

    const isSora = (model || '').toLowerCase().includes('sora');
    const payloadObj: any = {
        prompt: prompt,
        negativePrompt: "blurry, distorted, low quality, text, watermark",
        personGeneration: "allow_adult",
        seed: null
    };

    if (isSora) {
        const target = formData.duration || 5;
        const supported = [4, 8, 12];
        const soraGenerationDuration = supported.reduce((prev, curr) => {
            return (Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev);
        });
        payloadObj.Seconds = soraGenerationDuration;
        const sizeMap: Record<string, string> = {
            "16:9": "1280x720",
            "9:16": "720x1280"
        };
        payloadObj.Size = sizeMap[formData.aspectRatio || "16:9"] || "1280x720";
    } else {
        payloadObj.durationSeconds = formData.duration ? String(Math.round(formData.duration)) : "5";
        payloadObj.aspectRatio = formData.aspectRatio || "16:9";
    }

    let response;
    try {
        const targetUrl = baseUrl
            ? `${baseUrl.replace(/\/$/, '')}/api/v1/ie/requestqueue/apikey/requests`
            : 'https://console.gmicloud.ai/api/v1/ie/requestqueue/apikey/requests';

        const fetchOptions = {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'X-Organization-ID': '0'
            },
            body: JSON.stringify({
                model: model || 'Veo3',
                payload: payloadObj
            }),
            credentials: 'omit' as RequestCredentials,
            referrerPolicy: 'no-referrer' as ReferrerPolicy
        };

        response = await fetchWithFailover(targetUrl, fetchOptions);

    } catch (e: any) {
        throw new Error("Network Error: Failed to connect to GMI Cloud API via proxies. Please check your internet connection.");
    }

    if (!response.ok) {
        let errorMessage = `GMICloud Error: ${response.status}`;
        try {
            const err = await response.json();
            if (err.message) errorMessage = `GMICloud Error: ${err.message}`;
            if (err.error) errorMessage = `GMICloud Error: ${JSON.stringify(err.error)}`;
        } catch (e) {
            // Response is not JSON - use default error message
            console.warn('[geminiService.ts] Failed to parse GMICloud error response:', e);
        }
        throw new Error(errorMessage);
    }

    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        throw new Error(`Received invalid (non-JSON) response from GMICloud Proxy.`);
    }

    let taskId = data.id || data.uuid || data.request_id || data.requestId;
    if (!taskId && data.data) taskId = data.data.id;

    if (!taskId) {
        const msg = data.message || data.error || JSON.stringify(data);
        throw new Error(`No Task ID received from GMICloud. Proxy returned: ${msg}`);
    }

    console.log(`GMICloud Task Started. ID: ${taskId}`);

    onProgress({ percentage: 30, messageKey: 'loading.progress.gmicloudWorking', messageParams: { model: modelName } });

    let status = 'PENDING';
    let videoUrl = '';
    let checks = 0;
    const maxChecks = 240;
    const pollBaseUrl = baseUrl ? baseUrl.replace(/\/$/, '') : 'https://console.gmicloud.ai';

    while (status !== 'COMPLETED' && status !== 'SUCCEEDED' && status !== 'SUCCESS' && checks < maxChecks) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        checks++;

        try {
            const pollUrl = `${pollBaseUrl}/api/v1/ie/requestqueue/apikey/requests/${taskId}`;
            const pollRes = await fetchWithFailover(pollUrl, {
                headers: { 'Authorization': `Bearer ${apiKey}` },
                credentials: 'omit',
                referrerPolicy: 'no-referrer'
            });

            if (!pollRes.ok) continue;

            const pollData = await pollRes.json();
            const taskData = pollData.data || pollData;
            status = String(taskData.status || taskData.state || '').toUpperCase();

            if (['FAILED', 'FAILURE', 'ERROR', 'CANCELED'].includes(status)) {
                throw new Error(`Task failed: ${taskData.error_message || taskData.message || status}`);
            }

            if (['COMPLETED', 'SUCCEEDED', 'SUCCESS'].includes(status)) {
                videoUrl = taskData.video_url || taskData.video || taskData.output || '';
                if (!videoUrl) {
                    const jsonString = JSON.stringify(taskData);
                    const urlMatch = jsonString.match(/"(https?:\/\/[^"]+\.(?:mp4|mov|webm)[^"]*)"/i);
                    if (urlMatch) videoUrl = urlMatch[1];
                }
            }
        } catch (e) {
            continue;
        }
        onProgress({ percentage: 30 + (checks / maxChecks) * 60, messageKey: 'loading.progress.gmicloudWorking', messageParams: { model: modelName } });
    }

    if (!videoUrl) throw new Error("Generation timed out or no URL returned.");

    onProgress({ percentage: 90, messageKey: 'loading.progress.veoFinalizing', messageParams: { model: modelName } });

    try {
        const vidRes = await fetchWithFailover(videoUrl, { method: 'GET', credentials: 'omit', referrerPolicy: 'no-referrer' });
        if (!vidRes.ok) throw new Error(`Download failed with status: ${vidRes.status}`);
        const blob = await vidRes.blob();
        if (blob.size < 1024) throw new Error(`Downloaded file is invalid.`);
        return new Blob([blob], { type: 'video/mp4' });
    } catch (e: any) {
        throw new Error(`Video generated at ${videoUrl}, but download failed. Open URL manually.`);
    }
}

export function constructGeminiGenUrl(formData: FormInput, promptOverride?: string): string {
    // 🚀 YPP SPRINT: Use the Pro Studio main page, NOT /app/video-gen (old interface)
    // The Pro Studio interface allows proper model selection (Veo 3.1 Fast)
    const baseUrl = "https://geminigen.ai";
    const params = new URLSearchParams();

    // 🛡️ CONTENT SAFETY FILTER - Pre-emptive sanitization for GeminiGen
    // This prevents PUBLIC_ERROR_PROMINENT_PEOPLE_FILTER_FAILED errors
    const sanitizeGeminiGenPrompt = (text: string): string => {
        if (!text) return text;

        // Phase 1: Soft replacements (replace sensitive terms with safe alternatives)
        const sensitiveTerms: Record<string, string> = {
            // Children-related
            'child': 'person', 'children': 'people',
            'kid': 'person', 'kids': 'people',
            'baby': 'person', 'babies': 'people',
            'toddler': 'person', 'infant': 'person',
            'boy': 'man', 'girl': 'woman',
            'teen': 'adult', 'teenager': 'adult',
            'minor': 'person', 'underage': 'person',
            // Prominent people / celebrities
            'celebrity': 'person', 'celebrities': 'people',
            'famous': 'interesting', 'famous person': 'interesting person',
            'star': 'person', 'movie star': 'person',
            'politician': 'person', 'president': 'leader',
            'influencer': 'person', 'youtuber': 'person',
            // Deepfake-specific (triggers Gemini filter)
            'deepfake': 'AI-generated', 'deep fake': 'AI-generated',
            'face-swap': 'visual effect', 'faceswap': 'visual effect',
            // Violence
            'kill': 'defeat', 'murder': 'disappear',
            'blood': 'paint', 'gore': 'mess',
            'weapon': 'object', 'gun': 'device'
        };

        let sanitized = text;
        Object.keys(sensitiveTerms).forEach(term => {
            const regex = new RegExp(`\\b${term}\\b`, 'gi');
            if (regex.test(sanitized)) {
                console.log(`🛡️ [GeminiGen Safety] Replacing "${term}" with "${sensitiveTerms[term]}"`);
                sanitized = sanitized.replace(regex, sensitiveTerms[term]);
            }
        });

        // Phase 2: Hard block for specific names (replace entire prompt with safe fallback)
        const hardBlockTerms = ['elon', 'trump', 'biden', 'taylor swift', 'kardashian', 'beyonce', 'obama', 'putin', 'xi jinping'];
        const lowerSanitized = sanitized.toLowerCase();
        for (const term of hardBlockTerms) {
            if (lowerSanitized.includes(term)) {
                console.warn(`🛡️ [GeminiGen Safety] HARD BLOCK: Prompt contains "${term}", using safe fallback`);
                return 'Abstract digital art with colorful geometric patterns and smooth motion';
            }
        }

        console.log(`🛡️ [GeminiGen Safety] Sanitized prompt: ${sanitized.substring(0, 80)}...`);
        return sanitized;
    };

    // 1. Prompt - sanitize and encode properly
    let promptToUse = promptOverride || formData.prompt || '';
    promptToUse = sanitizeGeminiGenPrompt(promptToUse);
    if (promptToUse) params.append('prompt', promptToUse);

    // 2. Model - Always use Veo 3.1 Fast for YPP Sprint (faster generation)
    params.append('model', 'veo-3.1-fast');

    // 3. Aspect Ratio - Always 9:16 for Shorts
    params.append('aspect_ratio', '9:16');

    // 4. Duration - Default 9 seconds (Golden Loop Duration based on channel analytics)
    const duration = formData.duration || 9;
    params.append('duration', duration.toString());

    console.log('🎬 [GeminiGen] Constructed URL with Veo 3.1 Fast, 9:16 aspect ratio');
    return `${baseUrl}?${params.toString()}`;
}

/**
 * 🎬 GOOGLE VIDS (VEO 3.1) URL CONSTRUCTION
 * Constructs a URL for Google Vids with prompt parameters for automated video generation.
 * This is an alternative to GeminiGen that uses Google's native Veo 3.1 in Google Vids.
 * 
 * URL: https://docs.google.com/videos/u/0/create
 * After creation, automation will:
 * 1. Click "Veo 3.1" entry point
 * 2. Fill in the prompt textarea
 * 3. Click "Generate" button
 */
export function constructGoogleVidsUrl(formData: FormInput, promptOverride?: string): { url: string, prompt: string, aspectRatio: string } {
    // Google Vids create page URL
    const baseUrl = "https://docs.google.com/videos/u/0/create";

    // Sanitize prompt (reuse same logic as GeminiGen)
    const sanitizePrompt = (text: string): string => {
        if (!text) return text;

        const sensitiveTerms: Record<string, string> = {
            'child': 'person', 'children': 'people',
            'kid': 'person', 'kids': 'people',
            'baby': 'person', 'babies': 'people',
            'celebrity': 'person', 'celebrities': 'people',
            'famous': 'interesting',
            'deepfake': 'AI-generated', 'deep fake': 'AI-generated'
        };

        let sanitized = text;
        Object.keys(sensitiveTerms).forEach(term => {
            const regex = new RegExp(`\\b${term}\\b`, 'gi');
            if (regex.test(sanitized)) {
                sanitized = sanitized.replace(regex, sensitiveTerms[term]);
            }
        });

        const hardBlockTerms = ['elon', 'trump', 'biden', 'taylor swift', 'kardashian', 'beyonce', 'obama', 'putin'];
        const lowerSanitized = sanitized.toLowerCase();
        for (const term of hardBlockTerms) {
            if (lowerSanitized.includes(term)) {
                return 'Abstract digital art with colorful geometric patterns and smooth motion';
            }
        }

        return sanitized;
    };

    const prompt = sanitizePrompt(promptOverride || formData.prompt || '');

    // Default to 9:16 (Portrait) for Shorts
    const aspectRatio = formData.aspectRatio || '9:16';

    console.log('🎬 [GoogleVids] Constructed URL for Veo 3.1, aspect ratio:', aspectRatio);

    return {
        url: baseUrl,
        prompt: prompt,
        aspectRatio: aspectRatio
    };
}

async function processVideoOnCanvas(
    videoBlob: Blob,
    options: {
        prependImage?: string,
        prependDuration?: number,
        startTime?: number,
        endTime?: number,
        targetAspectRatio?: string
    }
): Promise<Blob> {
    if (videoBlob.size < 1024) throw new Error("Generated video file is too small.");
    if (videoBlob.type.includes('text') || videoBlob.type.includes('json')) throw new Error("Downloaded file is not a video.");

    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        const videoSrcUrl = URL.createObjectURL(videoBlob);
        video.src = videoSrcUrl;
        video.muted = true;
        video.playsInline = true;
        video.crossOrigin = 'anonymous';
        video.style.display = 'none';
        document.body.appendChild(video);

        const cleanup = () => {
            if (document.body.contains(video)) {
                document.body.removeChild(video);
            }
            URL.revokeObjectURL(videoSrcUrl);
        };

        video.onerror = () => {
            cleanup();
            reject(new Error("Video load failed. The file might be corrupt or unsupported."));
        };

        video.onloadedmetadata = async () => {
            // FIX: Declare recordingStartTime here so it's available to processLoop
            const recordingStartTime = 0;

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) { cleanup(); reject(new Error("Canvas context failed")); return; }

            let canvasWidth = video.videoWidth;
            let canvasHeight = video.videoHeight;

            if (options.targetAspectRatio) {
                const [wRatio, hRatio] = options.targetAspectRatio.split(':').map(Number);
                if (wRatio === 9 && hRatio === 16) { canvasWidth = 720; canvasHeight = 1280; }
                else if (wRatio === 16 && hRatio === 9) { canvasWidth = 1280; canvasHeight = 720; }
                else if (wRatio === 1 && hRatio === 1) { canvasWidth = 1024; canvasHeight = 1024; }
            }

            canvas.width = canvasWidth;
            canvas.height = canvasHeight;

            const scale = Math.max(canvasWidth / video.videoWidth, canvasHeight / video.videoHeight);
            const drawWidth = video.videoWidth * scale;
            const drawHeight = video.videoHeight * scale;
            const drawX = (canvasWidth - drawWidth) / 2;
            const drawY = (canvasHeight - drawHeight) / 2;

            const canvasStream = canvas.captureStream(30);
            let combinedStream = canvasStream;
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

            try {
                const source = audioCtx.createMediaElementSource(video);
                const dest = audioCtx.createMediaStreamDestination();
                source.connect(dest);
                if (dest.stream.getAudioTracks().length > 0) {
                    combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
                }
            } catch (e) { console.warn("Audio muxing failed", e); }

            const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm;codecs=vp9' });
            const chunks: Blob[] = [];

            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                cleanup(); audioCtx.close();
                if (blob.size < 1024) reject(new Error("Processed video is empty."));
                else resolve(blob);
            };

            recorder.start();

            const drawFrame = () => {
                ctx.fillStyle = 'black';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);
            };

            const attemptPlay = async () => {
                try { await video.play(); }
                catch (e) { video.muted = true; await video.play(); }
            };

            if (options.prependImage) {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = async () => {
                    const durationMs = (options.prependDuration || 3) * 1000;
                    const fps = 30;
                    const frames = (durationMs / 1000) * fps;
                    const imgScale = Math.max(canvasWidth / img.width, canvasHeight / img.height);
                    const imgDrawW = img.width * imgScale;
                    const imgDrawH = img.height * imgScale;
                    const imgX = (canvasWidth - imgDrawW) / 2;
                    const imgY = (canvasHeight - imgDrawH) / 2;

                    for (let i = 0; i < frames; i++) {
                        ctx.fillStyle = 'black';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, imgX, imgY, imgDrawW, imgDrawH);
                        await new Promise(r => setTimeout(r, 1000 / fps));
                    }

                    if (options.startTime) {
                        video.currentTime = options.startTime;
                        await new Promise(r => { const onSeek = () => { video.removeEventListener('seeked', onSeek); r(null); }; video.addEventListener('seeked', onSeek); });
                    }

                    try { await attemptPlay(); } catch (e) { recorder.stop(); reject(e); return; }

                    const processVideo = () => {
                        if (video.paused || video.ended) return;
                        if (options.endTime && video.currentTime >= options.endTime) { video.pause(); recorder.stop(); return; }
                        drawFrame(); requestAnimationFrame(processVideo);
                    };
                    video.onplay = () => processVideo();
                    video.onended = () => recorder.stop();
                };
                img.src = options.prependImage;
            } else {
                if (options.startTime) {
                    video.currentTime = options.startTime;
                    await new Promise(r => { const onSeek = () => { video.removeEventListener('seeked', onSeek); r(null); }; video.addEventListener('seeked', onSeek); });
                }
                try { await attemptPlay(); } catch (e) { recorder.stop(); reject(e); return; }
                const processVideo = () => {
                    if (video.paused || video.ended) return;
                    if (options.endTime && video.currentTime >= options.endTime) { video.pause(); recorder.stop(); return; }
                    drawFrame(); requestAnimationFrame(processVideo);
                };
                video.onplay = () => processVideo();
                video.onended = () => recorder.stop();
            }
        };
    });
}

export async function trimVideo(videoBlob: Blob, duration: number, targetAspectRatio?: string): Promise<Blob> {
    return processVideoOnCanvas(videoBlob, { startTime: 0, endTime: duration, targetAspectRatio: targetAspectRatio });
}

export async function prependImageToVideo(imageUrl: string, videoBlob: Blob, targetAspectRatio?: string): Promise<Blob> {
    return processVideoOnCanvas(videoBlob, { prependImage: imageUrl, prependDuration: 3, targetAspectRatio: targetAspectRatio });
}

export async function captureFrameFromVideo(videoBlob: Blob, time: number = 0): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.src = URL.createObjectURL(videoBlob);
        video.crossOrigin = 'anonymous';
        video.muted = true;

        // Critical: Wait for metadata to know duration if time is relative (not implemented here but good practice)
        // For this simple function, we assume time is absolute and valid.

        video.onloadedmetadata = () => {
            video.currentTime = time;
        };

        video.onseeked = () => {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                canvas.toBlob((blob) => {
                    URL.revokeObjectURL(video.src);
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error("Canvas to Blob failed"));
                    }
                }, 'image/jpeg', 0.9);
            } else {
                reject(new Error("Canvas context failed"));
            }
        };

        video.onerror = () => {
            reject(new Error("Video load failed for frame capture"));
        };
    });
}

export async function generateSmartViralThumbnail(videoBlob: Blob): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.src = URL.createObjectURL(videoBlob);
        video.crossOrigin = 'anonymous';
        video.muted = true;

        video.onloadedmetadata = async () => {
            const duration = video.duration;
            if (!duration || duration < 1) {
                // Short video or unknown duration, fallback to 0.5s
                try {
                    const blob = await captureFrameFromVideo(videoBlob, 0.5);
                    resolve(blob);
                } catch (e) {
                    resolve(videoBlob); // Should not happen, but fallback
                }
                return;
            }

            // Strategy: Capture 3 candidates (Start, Middle-Climax, End-Action)
            // We look for the "most detailed" frame which often correlates with larger JPEG size
            const candidates = [
                duration * 0.2, // Intro
                duration * 0.6, // Climax (Golden Ratio-ish)
                duration * 0.8  // Resolution
            ];

            let bestBlob: Blob | null = null;
            let maxSize = 0;

            try {
                for (const time of candidates) {
                    const blob = await captureFrameFromVideo(videoBlob, time);
                    if (blob.size > maxSize) {
                        maxSize = blob.size;
                        bestBlob = blob;
                    }
                }
                resolve(bestBlob!);
            } catch (e) {
                console.warn("Smart thumbnail generation failed, falling back to simple capture.", e);
                // Fallback to simple capture at 1s
                captureFrameFromVideo(videoBlob, 1).then(resolve).catch(reject);
            }
        };

        video.onerror = () => {
            reject(new Error("Video load failed for smart thumbnail"));
        };
    });
}

export async function processUploadedVideoWithAI(
    formData: FormInput,
    file: File,
    onProgress: ProgressCallback,
    setIsMuxing: (isMuxing: boolean) => void,
    t: Translator,
    apiKey?: string
): Promise<{ videoUrl: string; thumbnailUrl: string; finalAspectRatio: string }> {
    onProgress({ percentage: 20, messageKey: 'loading.progress.upload.analyzing' });
    const videoUrl = URL.createObjectURL(file);
    onProgress({ percentage: 100, messageKey: 'loading.progress.complete' });
    return { videoUrl, thumbnailUrl: '', finalAspectRatio: formData.aspectRatio };
}

export async function processEditedVideoWithAI(
    file: File,
    actions: EditAction[],
    formData: FormInput,
    onProgress: ProgressCallback,
    setIsMuxing: (isMuxing: boolean) => void,
    t: Translator,
    apiKey?: string,
    viralityAnalysis?: any // Added parameter
): Promise<{ videoUrl: string; thumbnailUrl: string }> {
    onProgress({ percentage: 10, messageKey: 'loading.progress.upload.analyzing' });

    // 1. Generate Viral Thumbnail (Extract from video)
    let thumbnailUrl = '';
    try {
        onProgress({ percentage: 15, messageKey: 'loading.progress.upload.generatingThumbnailImage' });
        // Capture a frame from the middle of the video or start
        const thumbnailBlob = await captureFrameFromVideo(file, 1); // Capture at 1s to avoid black start
        thumbnailUrl = URL.createObjectURL(thumbnailBlob);
    } catch (e) {
        console.warn("Thumbnail generation failed, proceeding without it.", e);
    }

    // 2. Render the video with edits AND the thumbnail as the first frame
    onProgress({ percentage: 30, messageKey: 'loading.progress.upload.encoding' });

    const processedBlob = await renderVideoWithEdits(file, actions, {
        targetAspectRatio: formData.aspectRatio,
        prependImage: thumbnailUrl, // Pass the generated thumbnail
        replaceFirstFrame: true, // Critical: Do NOT add duration, just overlay on start
        maxDuration: formData.duration // Enforce strict duration limit
    }, (percentage) => {
        // Map render progress (0-100) to overall progress (30-90)
        const overallProgress = 30 + (percentage * 0.6);
        onProgress({ percentage: overallProgress, messageKey: 'loading.progress.upload.encoding' });
    }); // Do NOT pass viralityAnalysis to prevent auto-prepending thumbnail

    const videoUrl = URL.createObjectURL(processedBlob);

    onProgress({ percentage: 100, messageKey: 'loading.progress.complete' });
    return { videoUrl, thumbnailUrl };
}

async function renderVideoWithEdits(
    videoFile: File | Blob,
    actions: EditAction[],
    options: { targetAspectRatio?: string; prependImage?: string; replaceFirstFrame?: boolean; maxDuration?: number },
    onProgress?: (percentage: number) => void,
    viralityAnalysis?: any // Added parameter
): Promise<Blob> {
    if (videoFile.size < 1024) throw new Error("Input video is too small.");

    // Load Thumbnail Image if present (Async, outside the Promise constructor)
    let thumbnailImg: HTMLImageElement | null = null;
    if (options.prependImage) {
        await new Promise<void>((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                thumbnailImg = img;
                resolve();
            };
            img.onerror = () => {
                console.warn("Failed to load thumbnail for burning");
                resolve();
            };
            img.src = options.prependImage!;
        });
    }

    return new Promise((resolve, reject) => {
        // Create a visible preview container for real-time video/audio feedback
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.top = '50%';
        container.style.left = '50%';
        container.style.transform = 'translate(-50%, -50%)';
        container.style.zIndex = '10000';
        container.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
        container.style.padding = '30px';
        container.style.borderRadius = '16px';
        container.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.5)';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'center';
        container.style.gap = '20px';
        document.body.appendChild(container);

        // Title
        const title = document.createElement('div');
        title.textContent = '正在合成视频...';
        title.style.color = 'white';
        title.style.fontSize = '20px';
        title.style.fontWeight = 'bold';
        title.style.marginBottom = '10px';
        container.appendChild(title);

        // Progress text
        const progressText = document.createElement('div');
        progressText.textContent = '0%';
        progressText.style.color = '#a78bfa';
        progressText.style.fontSize = '16px';
        progressText.style.fontWeight = '600';
        container.appendChild(progressText);

        // Cleanup helper
        const cleanupUI = () => {
            if (document.body.contains(container)) document.body.removeChild(container);
        };

        // State to track readiness
        let isMetadataLoaded = false;

        // We need a way to call the internal logic
        let internalStartCallback: (() => void) | null = null;

        // Auto-start logic
        // Auto-start logic
        const autoStartProcessing = () => {
            if (internalStartCallback) {
                console.log("Auto-starting processing...");
                internalStartCallback();
            } else {
                console.log("Waiting for internal callback...");
                // It will be called from onloadedmetadata when ready
            }
        };

        const video = document.createElement('video');
        video.src = URL.createObjectURL(videoFile);
        // 🔥 FIX: Remove crossOrigin for Blob URLs (causes CORS issues)
        // crossOrigin is only needed for external URLs, not Blob URLs
        video.preload = "auto";
        video.muted = false;
        video.volume = 1.0; // Full volume for recording
        video.style.maxWidth = '600px';
        video.style.maxHeight = '400px';
        video.style.borderRadius = '8px';

        console.log(`📹 Video element created. Source: ${video.src.substring(0, 50)}...`);
        console.log(`📹 Video file size: ${videoFile.size} bytes, type: ${videoFile.type}`);

        container.appendChild(video);

        const cleanup = () => {
            URL.revokeObjectURL(video.src);
            if (document.body.contains(container)) {
                document.body.removeChild(container);
            }
        };

        video.onerror = () => {
            cleanup();
            reject(new Error("Video load failed."));
        };

        video.onloadedmetadata = async () => {
            console.log("Step 1: Export Video metadata loaded");
            isMetadataLoaded = true;

            // FIX: Declare recordingStartTime here so it's available to processLoop
            let recordingStartTime = 0;

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) { cleanup(); reject(new Error("Canvas context failed")); return; }

            // Determine Canvas Size based on Aspect Ratio
            let canvasWidth = video.videoWidth;
            let canvasHeight = video.videoHeight;

            if (options.targetAspectRatio) {
                const [wRatio, hRatio] = options.targetAspectRatio.split(':').map(Number);
                // Standardize resolutions for common aspect ratios
                if (wRatio === 9 && hRatio === 16) { canvasWidth = 720; canvasHeight = 1280; }
                else if (wRatio === 16 && hRatio === 9) { canvasWidth = 1280; canvasHeight = 720; }
                else if (wRatio === 1 && hRatio === 1) { canvasWidth = 1024; canvasHeight = 1024; }
            }

            canvas.width = canvasWidth;
            canvas.height = canvasHeight;

            // Calculate drawing dimensions (contain)
            const scale = Math.min(canvasWidth / video.videoWidth, canvasHeight / video.videoHeight);
            const drawWidth = video.videoWidth * scale;
            const drawHeight = video.videoHeight * scale;
            const drawX = (canvasWidth - drawWidth) / 2;
            const drawY = (canvasHeight - drawHeight) / 2;

            // Setup Audio Mixing
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const dest = audioCtx.createMediaStreamDestination();
            let source: MediaElementAudioSourceNode | null = null;

            try {
                source = audioCtx.createMediaElementSource(video);
                source.connect(dest);
                // Connect to destination so user can hear it (helps with browser throttling too)
                source.connect(audioCtx.destination);
            } catch (e) {
                console.warn("Audio setup failed:", e);
            }

            // Setup MediaRecorder
            const canvasStream = canvas.captureStream(30); // 30 FPS

            // 🔥 CRITICAL FIX: Verify video tracks are captured
            const videoTracks = canvasStream.getVideoTracks();
            console.log(`📹 Canvas Video Tracks: ${videoTracks.length}`, videoTracks);

            if (videoTracks.length === 0) {
                cleanup();
                reject(new Error("❌ Canvas无法捕获视频轨道。这可能是由于:\n1. 视频源有CORS限制\n2. 浏览器不支持canvas.captureStream\n3. Canvas未正确渲染\n\n建议: 请直接下载原始视频,或使用其他浏览器(Chrome/Edge)。"));
                return;
            }

            const combinedTracks = [...videoTracks];
            if (dest.stream.getAudioTracks().length > 0) {
                combinedTracks.push(dest.stream.getAudioTracks()[0]);
                console.log(`🔊 Audio track added`);
            } else {
                console.warn(`⚠️ No audio track available`);
            }
            const combinedStream = new MediaStream(combinedTracks);

            console.log(`🎬 Combined Stream: ${combinedStream.getVideoTracks().length} video + ${combinedStream.getAudioTracks().length} audio`);

            // Determine supported MIME type
            const mimeTypes = [
                'video/mp4;codecs=avc1.42E01E,mp4a.40.2', // Standard MP4 (H.264 + AAC)
                'video/mp4', // Generic MP4
                'video/webm;codecs=vp9,opus', // High quality WebM
                'video/webm;codecs=vp8,opus', // Standard WebM
                'video/webm' // Generic WebM
            ];

            let selectedMimeType = 'video/webm';
            for (const type of mimeTypes) {
                if (MediaRecorder.isTypeSupported(type)) {
                    selectedMimeType = type;
                    // Prefer MP4 if supported
                    if (type.includes('mp4')) break;
                }
            }

            console.log(`Export: Using MIME type: ${selectedMimeType}`);
            console.log(`Export: Max Duration set to: ${options.maxDuration}`);

            const recorder = new MediaRecorder(combinedStream, {
                mimeType: selectedMimeType,
                videoBitsPerSecond: 5000000 // 5 Mbps
            });

            const chunks: Blob[] = [];
            recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
            recorder.onstop = async () => {
                // Preserve// The export button is now handled automatically – see the useEffect below that watches `outputData`.mmended thumbnail frame, embed it as the first frame
                // FIX: Strictly use the recorder's MIME type for the Blob
                let finalBlob = new Blob(chunks, { type: selectedMimeType });
                console.log(`Export: Final Blob size: ${finalBlob.size}, Type: ${finalBlob.type}`);
                // Check if viralityAnalysis is defined before accessing it
                if (typeof viralityAnalysis !== 'undefined' && viralityAnalysis?.advice?.recommendedTimes?.length) {
                    // Grab the first recommended timestamp (seconds)
                    const bestSec = Number(viralityAnalysis.advice.recommendedTimes[0]) || 0;
                    try {
                        const thumbBlob = await captureFrameFromVideo(finalBlob, bestSec);
                        // Prepend the thumbnail image to the video (same aspect ratio as original)
                        const thumbUrl = URL.createObjectURL(thumbBlob);
                        const videoUrl = URL.createObjectURL(finalBlob);
                        const mergedBlob = await prependImageToVideo(thumbUrl, finalBlob, options.targetAspectRatio);
                        finalBlob = mergedBlob;
                        // Cleanup temporary URLs
                        URL.revokeObjectURL(thumbUrl);
                        URL.revokeObjectURL(videoUrl);
                    } catch (e) {
                        console.warn('Failed to embed best thumbnail as first frame:', e);
                    }
                }
                cleanup();
                audioCtx.close();
                resolve(finalBlob);
            };

            // Prepare Actions
            const cuts = actions.filter(a => a.type === 'CUT').sort((a, b) => a.startTime - b.startTime);
            const texts = actions.filter(a => a.type === 'ADD_TEXT');

            const drawFrame = () => {
                // Clear canvas
                ctx.fillStyle = 'black';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                const currentTime = video.currentTime;

                // Draw Video
                ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);

                // Draw Text Overlays
                texts.forEach(text => {
                    if (currentTime >= text.startTime && currentTime < text.endTime && text.text) {
                        ctx.save();
                        ctx.fillStyle = 'white';
                        ctx.strokeStyle = 'black';
                        ctx.lineWidth = 4;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';

                        // Responsive font size
                        const fontSize = Math.floor(canvas.height * 0.05);
                        ctx.font = `bold ${fontSize}px Arial`;

                        let x = canvas.width / 2;
                        let y = canvas.height / 2;

                        if (text.x !== undefined && text.y !== undefined) {
                            x = (text.x / 100) * canvas.width;
                            y = (text.y / 100) * canvas.height;
                        } else {
                            if (text.position === 'top') y = canvas.height * 0.15;
                            if (text.position === 'bottom') y = canvas.height * 0.85;
                        }

                        ctx.strokeText(text.text, x, y);
                        ctx.fillText(text.text, x, y);
                        ctx.restore();
                    }
                });
            };

            // Ensure video is ready to play
            video.currentTime = 0;

            // Re-create recorder with correct stream if needed (though we did it above)
            // Actually, we can reuse the one above.

            let safetyTimeout: any;

            // Define the start logic
            internalStartCallback = async () => {
                console.log("Step 2: Starting recorder via user interaction");

                // BURNING THUMBNAIL LOGIC:
                // If replacing first frame, draw it explicitly BEFORE starting the video playback loop.
                if (options.replaceFirstFrame && thumbnailImg) {
                    // Draw thumbnail
                    const scale = Math.min(canvas.width / thumbnailImg.width, canvas.height / thumbnailImg.height);
                    const w = thumbnailImg.width * scale;
                    const h = thumbnailImg.height * scale;
                    const x = (canvas.width - w) / 2;
                    const y = (canvas.height - h) / 2;

                    ctx.fillStyle = 'black';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(thumbnailImg, x, y, w, h);

                    // Note: We don't start recorder here anymore to avoid recording loading time.
                    // We will draw thumbnail again or rely on the first frame logic later.
                }

                // Safety timeout
                const safeDuration = (video.duration && isFinite(video.duration)) ? video.duration : 60;
                safetyTimeout = setTimeout(() => {
                    console.warn("Export: Force stopping recorder due to timeout.");
                    if (recorder.state === 'recording') recorder.stop();
                }, (safeDuration * 1000) + 5000);

                // Try to play video - with fallback to muted if needed
                const startRecording = () => {
                    console.log("🎬 Video playing/ready, starting recorder...");

                    // Re-draw thumbnail if needed to ensure it's the first frame
                    if (options.replaceFirstFrame && thumbnailImg) {
                        const scale = Math.min(canvas.width / thumbnailImg.width, canvas.height / thumbnailImg.height);
                        const w = thumbnailImg.width * scale;
                        const h = thumbnailImg.height * scale;
                        const x = (canvas.width - w) / 2;
                        const y = (canvas.height - h) / 2;
                        ctx.drawImage(thumbnailImg, x, y, w, h);
                    }

                    if (recorder.state === 'inactive') {
                        recorder.start();
                        recordingStartTime = Date.now();
                        console.log(`🎬 Recording started with maxDuration: ${options.maxDuration}s`);
                    }
                    processLoop();
                };

                // Use 'playing' event to avoid recording buffering
                video.onplaying = () => {
                    // Remove listener to avoid multiple calls
                    video.onplaying = null;
                    startRecording();
                };

                try {
                    // 🔥 CRITICAL FIX: Always reset to 0 before starting export
                    // This prevents "1s duration" bug where video starts at 3s and stops at 4s
                    video.currentTime = 0;

                    await video.play();
                    // If video is already playing (e.g. from cache), onplaying might not fire or already fired
                    if (!video.paused && recorder.state === 'inactive') {
                        startRecording();
                    }
                } catch (e) {
                    console.warn("Video play with audio failed, trying muted:", e);
                    video.muted = true;
                    try {
                        video.currentTime = 0; // Reset again for retry
                        await video.play();
                        if (!video.paused && recorder.state === 'inactive') {
                            startRecording();
                        }
                    } catch (e2) {
                        console.error("Export playback failed even when muted:", e2);
                        if (recorder.state !== 'inactive') recorder.stop();
                        reject(new Error("无法播放视频进行录制。请尝试使用较小的视频文件。"));
                    }
                }
            };

            // Auto-start processing now that metadata is loaded
            // Trigger immediately
            autoStartProcessing();

            let lastProgressUpdate = 0;
            let loopCounter = 0; // Safety counter to prevent infinite loops

            const processLoop = async () => {
                loopCounter++;

                // Safety check: prevent true infinite loops
                if (loopCounter > 100000) {
                    console.error("Process loop ran too many times, stopping");
                    recorder.stop();
                    reject(new Error("视频处理循环异常，已停止"));
                    return;
                }

                // Safely update progress display if element exists
                if (progressText) {
                    const percent = video.duration > 0 ? (video.currentTime / video.duration) * 100 : 0;
                    progressText.textContent = `${Math.floor(percent)}%`;
                }

                // Check if video ended
                if (video.ended) {
                    console.log("Video ended, stopping recorder");
                    recorder.stop();
                    return;
                }

                // 🔥 ULTRA-CRITICAL: FORCE STOP at maxDuration
                // Multiple checks to ensure we NEVER exceed the limit
                if (options.maxDuration && options.maxDuration > 0) {
                    const currentVideoTime = video.currentTime;

                    // HARD STOP - stop slightly early to be absolutely safe
                    if (currentVideoTime >= options.maxDuration - 0.05) {
                        console.log(`🛑 FORCE STOP at ${currentVideoTime.toFixed(3)}s (max: ${options.maxDuration}s)`);

                        // Force pause
                        video.pause();

                        // Snap to exact time
                        video.currentTime = options.maxDuration;

                        // Force stop recorder - check all states
                        if (recorder.state !== 'inactive') {
                            console.log(`🛑 Stopping recorder (state: ${recorder.state})...`);
                            recorder.stop();
                        }

                        clearTimeout(safetyTimeout);
                        console.log('✅ Recording stopped at maxDuration');
                        return; // STOP IMMEDIATELY
                    }
                }

                // Check if paused
                if (video.paused) {
                    if (video.readyState >= 2) video.play().catch(e => console.warn("Auto-play failed in export", e));
                    requestAnimationFrame(processLoop);
                    return;
                }

                const currentTime = video.currentTime;

                // Handle Cuts - but only if we haven't reached maxDuration
                const activeCut = cuts.find(cut => currentTime >= cut.startTime && currentTime < cut.endTime);

                if (activeCut) {
                    try {
                        video.pause();
                        if (recorder.state === 'recording') recorder.pause();

                        video.currentTime = activeCut.endTime;

                        await new Promise<void>((resolve, reject) => {
                            const timeout = setTimeout(() => {
                                video.removeEventListener('seeked', onSeeked);
                                reject(new Error("Seek timeout during export"));
                            }, 5000);

                            const onSeeked = () => {
                                clearTimeout(timeout);
                                video.removeEventListener('seeked', onSeeked);
                                resolve();
                            };
                            video.addEventListener('seeked', onSeeked);
                        });

                        if (recorder.state === 'paused') recorder.resume();
                        await video.play();
                    } catch (e) {
                        console.error("Error handling cut during export:", e);
                        recorder.stop();
                        reject(e);
                        return;
                    }

                    requestAnimationFrame(processLoop);
                    return;
                }

                // Draw current frame
                drawFrame();

                // Progress update (using progressText for UI, onProgress for parent callback)
                if (Date.now() - lastProgressUpdate > 100) {
                    lastProgressUpdate = Date.now();
                    const progressPercent = (video.currentTime / video.duration) * 100;
                    onProgress?.(Math.min(99, Math.floor(progressPercent)));
                }

                if (video.paused || video.ended) {
                    // Stop if ended
                    if (video.ended) {
                        console.log("Video ended, stopping recorder");
                        recorder.stop();
                    }
                    // Don't continue loop if paused/ended
                    return;
                }

                // Continue the loop
                requestAnimationFrame(processLoop);
            };
        };
    });
}

export async function generateTranscriptFromVideo(
    videoBlob: Blob,
    t: Translator,
    apiKey?: string,
    model: string = 'gemini-2.0-flash-exp'
): Promise<TranscriptItem[]> {
    const ai = getAiClient(t, apiKey);
    const modelToUse = model || 'gemini-2.0-flash-exp';
    try {
        // Convert Blob to Base64
        const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(videoBlob);
        });

        // Check file size (approximate)
        if (base64Data.length > 20 * 1024 * 1024 * 1.37) { // > 20MB
            console.warn("Video too large for direct API call, using mock transcript.");
            return [
                { start: 0, end: 5, text: "Video is too large for real-time transcription." },
                { start: 5, end: 10, text: "Please use a shorter video for this demo." }
            ];
        }

        const response = await ai.models.generateContent({
            model: modelToUse,
            contents: [
                { text: "Generate a timestamped transcript for this video. Return JSON array with start, end, text. If there is no speech, return an empty array. Do NOT use placeholders like 'string' or 'text'. Transcribe actual speech only." },
                {
                    inlineData: {
                        mimeType: videoBlob.type, // Use the actual blob type
                        data: base64Data
                    }
                }
            ],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            start: { type: Type.NUMBER },
                            end: { type: Type.NUMBER },
                            text: { type: Type.STRING }
                        },
                        required: ['start', 'end', 'text']
                    }
                }
            }
        });

        const json = safeJsonParse(response.text || "[]", []);
        return json;

    } catch (e) {
        handleGeminiError(e, t);
        // Fallback to mock if it fails (e.g. file too large)
        console.warn("Transcription failed, falling back to mock.", e);
        return [
            { start: 0, end: 5, text: "[Error: Transcription failed. Using fallback.]" },
            { start: 5, end: 10, text: "Please check if the video is too large or API key is valid." }
        ];
    }
}

export async function generateStepByStepEditingPlanFromTranscript(
    userPrompt: string,
    transcript: TranscriptItem[],
    t: Translator,
    apiKey?: string,
    model: string = 'gemini-2.0-flash-exp'
): Promise<AiEditPlanData> {
    const ai = getAiClient(t, apiKey);
    try {
        // Simplify transcript for prompt to save tokens
        const simplifiedTranscript = transcript.map(item => `[${item.start.toFixed(1)}-${item.end.toFixed(1)}] ${item.text}`).join('\n');

        const prompt = `
        You are an expert video editor.
        User Request: "${userPrompt}"
        
        Video Transcript (Truncated):
        ${simplifiedTranscript.slice(0, 2000)}
        
        Create a concise editing plan.
        Format your response exactly like this:
        
        PLAN: [A brief 1-sentence summary of the plan]
        CUT: [startTime] [endTime]
        TEXT: [startTime] [endTime] [position: top/center/bottom] [text content]
        
        Rules:
        - Max 8 actions.
        - Times in seconds.
        - Position must be 'top', 'center', or 'bottom'.
        - If the user asks to "trim to X seconds" or "make it X seconds long", generate a CUT action from X to the end of the video (e.g., CUT: 4 1000).
        - Do not use JSON. Do not add other text.
        `;

        const response = await ai.models.generateContent({
            model: model,
            contents: [{ text: prompt }],
            config: {
                maxOutputTokens: 2048, // Reduced since text is concise
            }
        });

        const text = response.text || "";
        console.log("AI Plan Text:", text);

        const lines = text.split('\n');
        let displayPlan = "Editing plan generated.";
        const actions: any[] = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('PLAN:')) {
                displayPlan = trimmed.substring(5).trim();
            } else if (trimmed.startsWith('CUT:')) {
                const parts = trimmed.split(' ');
                if (parts.length >= 3) {
                    actions.push({
                        type: 'CUT',
                        startTime: parseFloat(parts[1]),
                        endTime: parseFloat(parts[2])
                    });
                }
            } else if (trimmed.startsWith('TEXT:')) {
                // TEXT: start end pos text...
                const parts = trimmed.split(' ');
                if (parts.length >= 5) {
                    const content = parts.slice(4).join(' ');
                    actions.push({
                        type: 'ADD_TEXT',
                        startTime: parseFloat(parts[1]),
                        endTime: parseFloat(parts[2]),
                        position: parts[3],
                        text: content
                    });
                }
            }
        }

        return {
            displayPlan,
            actions
        };

    } catch (e) {
        handleGeminiError(e, t);
        throw e;
    }
}
