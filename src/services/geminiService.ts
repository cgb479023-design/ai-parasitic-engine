// src/services/geminiService.ts (REAL IMPLEMENTATION)
import type { FormInput, EditAction, ViralityAnalysis, OutputData } from '../types';

// Helper for extension communication
const sendToExtension = (action: string, data: any = {}) => {
  window.postMessage({
    source: 'react_app',
    action,
    ...data
  }, '*');
};

const waitForExtensionMessage = (type: string, timeout = 600000): Promise<any> => {
  const startTime = Date.now();
  console.log(`🔄 [GeminiService] Waiting for extension message: ${type}, timeout: ${timeout}ms`);

  return new Promise((resolve, reject) => {
    const handler = (event: MessageEvent) => {
      // Check for specific message types from extension
      if (event.data?.source === 'extension' && event.data?.type === type) {
        const duration = Date.now() - startTime;
        console.log(`✅ [GeminiService] Received extension message: ${type} in ${duration}ms`);
        window.removeEventListener('message', handler);
        resolve(event.data);
      }
    };
    window.addEventListener('message', handler);
    setTimeout(() => {
      window.removeEventListener('message', handler);
      const duration = Date.now() - startTime;
      const errorMsg = `Timeout waiting for ${type} after ${duration}ms`;
      console.error(`❌ [GeminiService] ${errorMsg}`);
      reject(new Error(errorMsg));
    }, timeout);
  });
};

// Helper for logging workflow stages with timestamps
const logWorkflowStage = (workflow: string, stage: string, details?: any) => {
  console.log(`📋 [Workflow] ${workflow} - ${stage}`, details ? `| ${JSON.stringify(details)}` : '');
};

// Helper for logging performance metrics
const logPerformanceMetric = (metric: string, value: number, context?: any) => {
  console.log(`📊 [Metric] ${metric}: ${value}ms`, context ? `| ${JSON.stringify(context)}` : '');
};

// 0. Fetch Google Trends
export const fetchGoogleTrends = async (geo: string = 'US'): Promise<string[]> => {
  const startTime = Date.now();
  logWorkflowStage('fetchGoogleTrends', 'START', { geo });

  // We use the FETCH_URL capability we added to content.js
  const requestId = Date.now().toString();
  const url = `https://trends.google.com/trends/trendingsearches/daily/rss?geo=${geo}`;
  console.log(`🔍 [GeminiService] Fetching trends from URL: ${url}`);

  // Send request
  window.postMessage({
    source: 'react_app',
    type: 'FETCH_URL',
    url: url,
    requestId: requestId
  }, '*');

  // Wait for result
  return new Promise((resolve, reject) => {
    const handler = (event: MessageEvent) => {
      if (event.data?.source === 'extension' &&
        event.data?.type === 'FETCH_URL_RESULT' &&
        event.data?.requestId === requestId) {

        window.removeEventListener('message', handler);
        const duration = Date.now() - startTime;
        logPerformanceMetric('fetchGoogleTrends', duration, { geo, success: event.data.success });

        if (event.data.success && event.data.data) {
          // Parse RSS
          try {
            console.log(`📊 [GeminiService] Processing trends XML data, length: ${event.data.data.length}`);
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(event.data.data, "text/xml");
            const items = Array.from(xmlDoc.querySelectorAll('item title'));
            const trends = items.slice(0, 10).map(item => item.textContent || '').filter(t => t);
            console.log(`✅ [GeminiService] Found ${trends.length} trends: ${trends.slice(0, 3).join(', ')}...`);
            logWorkflowStage('fetchGoogleTrends', 'COMPLETE', { trendCount: trends.length });
            resolve(trends);
          } catch (e) {
            console.error("❌ [GeminiService] Error parsing Trends XML", e);
            logWorkflowStage('fetchGoogleTrends', 'FAILED', { error: 'XML parsing error' });
            resolve([]); // Return empty on parse error
          }
        } else {
          const errorMsg = event.data.error || 'Failed to fetch trends';
          console.error(`❌ [GeminiService] ${errorMsg}`);
          logWorkflowStage('fetchGoogleTrends', 'FAILED', { error: errorMsg });
          reject(new Error(errorMsg));
        }
      }
    };

    window.addEventListener('message', handler);
    setTimeout(() => {
      window.removeEventListener('message', handler);
      const duration = Date.now() - startTime;
      const errorMsg = `Timeout fetching trends after ${duration}ms`;
      console.error(`❌ [GeminiService] ${errorMsg}`);
      logPerformanceMetric('fetchGoogleTrends', duration, { geo, success: false });
      logWorkflowStage('fetchGoogleTrends', 'FAILED', { error: 'Timeout' });
      reject(new Error(errorMsg));
    }, 10000); // 10s timeout
  });
};

// 1. Generate Full Prompt and Virality Analysis (Via LMArena)
export const generateFullPromptAndViralityAnalysis = async (
  formData: FormInput,
  t: (key: string) => string,
  apiKey?: string
) => {
  const startTime = Date.now();
  logWorkflowStage('generateFullPromptAndViralityAnalysis', 'START', {
    topic: formData.topic,
    niche: formData.niche,
    style: formData.style
  });

  console.log('🔍 [GeminiService] Generating analysis via LMArena (GPT-4o/Claude-3.5)...');

  const prompt = `
    You are a viral content strategist for YouTube.
    Analyze this topic: "${formData.topic}" (Niche: ${formData.niche}).
    Target Audience: ${formData.targetAudience}.
    Style: ${formData.style}.

    Return a JSON object with this EXACT structure (no markdown, just JSON):
    {
      "fullPrompt": "A detailed prompt for a video generation AI (like Sora/Veo) to create a ${formData.duration || 60}s video about ${formData.topic}. Visual style: ${formData.style}. Include scene descriptions.",
      "viralityAnalysis": {
        "score": 85,
        "status": "High",
        "insights": ["Insight 1", "Insight 2"],
        "recommendedTimes": ["18:00"],
        "publishingSchedule": "Daily"
      },
      "marketingCopy": {
        "title": "Clickbait Title",
        "description": "SEO optimized description...",
        "tags": ["tag1", "tag2"],
        "comment1": { "type": "question", "content": "Question to ask viewers?" },
        "comment2": { "type": "cta", "content": "Subscribe text" }
      }
    }
  `;

  console.log('📝 [GeminiService] Sending prompt to LMArena, length:', prompt.length, 'chars');

  // 1. Store prompt - content.js listens for LMARENA_GENERATE_PLAN
  window.postMessage({
    source: 'react_app',
    type: 'LMARENA_GENERATE_PLAN',
    prompt: prompt
  }, '*');

  // 2. Wait for result - content.js relays YPP_PLAN_RESULT
  try {
    logWorkflowStage('generateFullPromptAndViralityAnalysis', 'WAITING_FOR_RESULT');
    const result = await waitForExtensionMessage('YPP_PLAN_RESULT');

    // LMArena returns the parsed object in payload (or data)
    const data = result.payload || result.data;
    console.log('📊 [GeminiService] Received LMArena result:', {
      hasFullPrompt: !!data.fullPrompt,
      hasViralityAnalysis: !!data.viralityAnalysis,
      hasMarketingCopy: !!data.marketingCopy
    });

    // If it's wrapped in schedule (autoPilot.js sometimes wraps array), unwrap it
    if (data.schedule && !data.fullPrompt) {
      console.warn('⚠️ [GeminiService] Result wrapped in schedule, unwrapping...');
      const unwrappedData = {
        fullPrompt: data.schedule[0]?.fullPrompt || "Error parsing prompt",
        viralityAnalysis: { score: 0, status: 'Low', insights: [] },
        marketingCopy: { title: "Error", description: "", tags: [], comment1: {}, comment2: {} }
      };
      const duration = Date.now() - startTime;
      logPerformanceMetric('generateFullPromptAndViralityAnalysis', duration, { success: true });
      logWorkflowStage('generateFullPromptAndViralityAnalysis', 'COMPLETE', { resultType: 'unwrapped' });
      return unwrappedData;
    }

    const duration = Date.now() - startTime;
    logPerformanceMetric('generateFullPromptAndViralityAnalysis', duration, { success: true });
    logWorkflowStage('generateFullPromptAndViralityAnalysis', 'COMPLETE', {
      viralityScore: data.viralityAnalysis?.score,
      resultType: 'direct'
    });

    return data;
  } catch (e) {
    const duration = Date.now() - startTime;
    console.error("❌ [GeminiService] LMArena Analysis Failed:", e);
    logPerformanceMetric('generateFullPromptAndViralityAnalysis', duration, { success: false });
    logWorkflowStage('generateFullPromptAndViralityAnalysis', 'FAILED', { error: e.message });
    throw e;
  }
};

// 2. Generate Video and Thumbnail (Via Google Vids)
export const generateVideoAndThumbnail = async (
  prompt: string,
  formData: FormInput,
  onProgress: (progress: { percentage: number; messageKey: string; messageParams?: any }) => void,
  t: (key: string) => string,
  apiKey?: string
) => {
  const startTime = Date.now();
  logWorkflowStage('generateVideoAndThumbnail', 'START', {
    promptLength: prompt.length,
    aspectRatio: formData.aspectRatio || '9:16',
    topic: formData.topic
  });

  console.log('🎬 [GeminiService] Initiating Google Vids generation...');
  console.log('📝 [GeminiService] Prompt preview:', prompt.substring(0, 100) + '...');

  // 1. Trigger Google Vids generation - content.js listens for GOOGLE_VIDS_GENERATE
  const uploadData = {
    title: formData.videoTitle || formData.topic,
    description: formData.videoDescription,
    tags: [],
    scheduleDate: '',
    scheduleTime: ''
  };

  console.log('📤 [GeminiService] Sending generate request to Google Vids:', {
    aspectRatio: formData.aspectRatio || '9:16',
    videoTitle: uploadData.title
  });

  window.postMessage({
    source: 'react_app',
    type: 'GOOGLE_VIDS_GENERATE',
    prompt: prompt,
    aspectRatio: formData.aspectRatio || '9:16',
    uploadData: uploadData
  }, '*');

  // 2. Simulate progress while waiting
  let progress = 0;
  const interval = setInterval(() => {
    progress += 2;
    if (progress > 95) progress = 95;
    onProgress({ percentage: progress, messageKey: 'loading.progress.initiateVeo', messageParams: { model: 'Veo/Sora' } });
  }, 2000);

  // 3. Wait for download/completion
  try {
    logWorkflowStage('generateVideoAndThumbnail', 'WAITING_FOR_GENERATION', { timeout: '600000ms' });
    // Wait for GOOGLE_VIDS_DOWNLOAD_COMPLETE from background (via content script relay)
    const result = await waitForExtensionMessage('GOOGLE_VIDS_DOWNLOAD_COMPLETE', 600000); // 10 min timeout

    clearInterval(interval);
    onProgress({ percentage: 100, messageKey: 'loading.progress.completed' });

    const duration = Date.now() - startTime;
    console.log('✅ [GeminiService] Google Vids generation completed in', duration, 'ms');
    console.log('📊 [GeminiService] Generation result:', result);

    logPerformanceMetric('generateVideoAndThumbnail', duration, { success: true });
    logWorkflowStage('generateVideoAndThumbnail', 'COMPLETE', {
      duration: duration,
      resultType: typeof result
    });

    // Return a placeholder blob - the real file is handled by extension
    return new Blob(['Placeholder'], { type: 'video/mp4' });
  } catch (e) {
    clearInterval(interval);
    const duration = Date.now() - startTime;
    console.error("❌ [GeminiService] Video generation timed out or failed after", duration, "ms", e);
    logPerformanceMetric('generateVideoAndThumbnail', duration, { success: false });
    logWorkflowStage('generateVideoAndThumbnail', 'FAILED', { error: e.message });
    throw e;
  }
};

// 2a. Generate A/B Thumbnail Prompts (Via LMArena)
export const generateABThumbnailPrompts = async (
  topic: string,
  style: string,
  t: (key: string) => string,
  apiKey?: string
): Promise<string[]> => {
  const startTime = Date.now();
  logWorkflowStage('generateABThumbnailPrompts', 'START', { topic, style });

  console.log(`🖼️  [GeminiService] Generating A/B Thumbnail Prompts for: ${topic}`);

  const prompt = `
        You are a YouTube Thumbnail expert (MrBeast style).
        Topic: "${topic}"
        Style: "${style}"

        Generate 4 DISTINCT thumbnail concepts for A/B testing:
        1. High Emotion (Close-up face, strong reaction)
        2. Curiosity Gap (Hidden element, question mark, "Don't do this")
        3. Direct Benefit (Before/After, 100x result)
        4. Contrarian/Negative (Warning, "Stop doing X")

        Return a JSON object with this EXACT structure:
        {
            "thumbnails": [
                "Prompt for concept 1...",
                "Prompt for concept 2...",
                "Prompt for concept 3...",
                "Prompt for concept 4..."
            ]
        }
    `;

  console.log('📝 [GeminiService] Sending thumbnail prompt to LMArena, length:', prompt.length, 'chars');

  // 1. Send to Extension
  window.postMessage({
    source: 'react_app',
    type: 'LMARENA_GENERATE_PLAN',
    prompt: prompt
  }, '*');

  // 2. Wait for result
  try {
    logWorkflowStage('generateABThumbnailPrompts', 'WAITING_FOR_RESULT');
    const result = await waitForExtensionMessage('YPP_PLAN_RESULT');
    const data = result.payload || result.data;

    console.log('📊 [GeminiService] Received thumbnail prompts result:', {
      hasThumbnails: !!data?.thumbnails,
      type: typeof data.thumbnails
    });

    let thumbnails: string[] = [];

    if (data && Array.isArray(data.thumbnails)) {
      thumbnails = data.thumbnails;
      console.log('✅ [GeminiService] Generated', thumbnails.length, 'thumbnail prompts');
      thumbnails.forEach((thumb, index) => {
        console.log(`   🖼️  Prompt ${index + 1}:`, thumb.substring(0, 80) + '...');
      });
    } else {
      console.warn('⚠️ [GeminiService] No valid thumbnails array found, using default prompts');
      thumbnails = [
        `Thumbnail for ${topic} - Style 1`,
        `Thumbnail for ${topic} - Style 2`,
        `Thumbnail for ${topic} - Style 3`,
        `Thumbnail for ${topic} - Style 4`
      ];
    }

    const duration = Date.now() - startTime;
    logPerformanceMetric('generateABThumbnailPrompts', duration, { success: true, promptCount: thumbnails.length });
    logWorkflowStage('generateABThumbnailPrompts', 'COMPLETE', { promptCount: thumbnails.length });

    return thumbnails;
  } catch (e) {
    const duration = Date.now() - startTime;
    console.error("❌ [GeminiService] Failed to generate A/B thumbnails after", duration, "ms", e);
    logPerformanceMetric('generateABThumbnailPrompts', duration, { success: false });
    logWorkflowStage('generateABThumbnailPrompts', 'FAILED', { error: e.message });
    return [`Thumbnail for ${topic}`];
  }
};

// 3. Generate Editing Plan (Via LMArena)
export const generateEditingPlan = async (
  instructions: string,
  t: (key: string) => string,
  apiKey?: string
) => {
  const startTime = Date.now();
  logWorkflowStage('generateEditingPlan', 'START', { instructionsLength: instructions.length });

  console.log('🎬 [GeminiService] Generating editing plan...');
  console.log('📝 [GeminiService] Instructions:', instructions.substring(0, 100) + '...');

  const prompt = `Create a video editing plan for: ${instructions}. Return JSON: { "duration": 60, "aspectRatio": "9:16", "steps": [] }`;

  console.log('📤 [GeminiService] Sending editing plan prompt to LMArena');

  window.postMessage({
    source: 'react_app',
    type: 'LMARENA_GENERATE_PLAN',
    prompt: prompt
  }, '*');

  try {
    logWorkflowStage('generateEditingPlan', 'WAITING_FOR_RESULT');
    const result = await waitForExtensionMessage('YPP_PLAN_RESULT');
    const data = result.payload || result.data;

    console.log('✅ [GeminiService] Received editing plan:', {
      hasDuration: !!data.duration,
      hasAspectRatio: !!data.aspectRatio,
      stepCount: data.steps?.length || 0
    });

    const duration = Date.now() - startTime;
    logPerformanceMetric('generateEditingPlan', duration, { success: true, stepCount: data.steps?.length || 0 });
    logWorkflowStage('generateEditingPlan', 'COMPLETE');

    return data;
  } catch (e) {
    const duration = Date.now() - startTime;
    console.error("❌ [GeminiService] Failed to generate editing plan after", duration, "ms", e);
    logPerformanceMetric('generateEditingPlan', duration, { success: false });
    logWorkflowStage('generateEditingPlan', 'FAILED', { error: e.message });
    throw e;
  }
};

// Keep interface compatible mocks for less critical functions
export const trimVideo = async (blob: Blob, duration?: number, aspectRatio?: string) => blob;
export const generateThumbnailPrompt = async (topic?: string) => "Thumbnail Prompt";
export const generateImageForThumbnail = async (prompt?: string) => "https://via.placeholder.com/1280x720";
export const prependImageToVideo = async (blob: Blob, imageBlob?: Blob) => blob;
export const captureFrameFromVideo = async (blob: Blob, time?: number) => new Blob([], { type: 'image/jpeg' });
export const generateSmartViralThumbnail = async (blob: Blob) => new Blob([], { type: 'image/jpeg' });

// Stubs for compatibility
export const generateGmicloudVideo = generateVideoAndThumbnail;
export const processUploadedVideoWithAI = async (formData: any, file: File, onProgress?: any, onMuxing?: any, t?: any, apiKey?: any) => ({ videoUrl: URL.createObjectURL(file), thumbnailUrl: '', finalAspectRatio: '9:16' });
export const processEditedVideoWithAI = async (file: File, actions?: any, formData?: any, onProgress?: any, onMuxing?: any, t?: any, apiKey?: any, analysis?: any) => ({ videoUrl: URL.createObjectURL(file), thumbnailUrl: '' });
export const generateAnalysisForEditor = async (formData?: any, actions?: any, t?: any, apiKey?: any, model?: any, transcript?: any, thumbnail?: any) => ({ viralityAnalysis: { score: 0, status: 'Low' as any, insights: [] }, marketingCopy: { title: '', description: '', tags: [], comment1: { type: '', content: '' }, comment2: { type: '', content: '' } } });

export const constructGeminiGenUrl = (formData: any, prompt?: string) => `https://gemini.google.com/app?prompt=${encodeURIComponent(prompt || '')}`;
export const constructGoogleVidsUrl = (formData: any, prompt?: string) => ({ url: `https://vids.google.com/create`, prompt: prompt || '', aspectRatio: '9:16' });

// Main Orchestrator
export const generateViralContent = async (
  input: FormInput,
  t: (key: string) => string = (k) => k,
  apiKey?: string
): Promise<OutputData> => {
  const workflowStartTime = Date.now();
  logWorkflowStage('generateViralContent', 'START', {
    topic: input.topic,
    hasImitateUrl: !!input.imitateUrl,
    duration: input.duration
  });

  console.log("🚀 [GeminiService] Starting Viral Content Generation Workflow...");
  console.log("📋 [GeminiService] Input parameters:", {
    topic: input.topic,
    niche: input.niche,
    style: input.style,
    duration: input.duration,
    targetAudience: input.targetAudience,
    hasImitateUrl: !!input.imitateUrl
  });

  let analysis;

  // 1. Determine Generation Strategy
  logWorkflowStage('generateViralContent', 'DETERMINE_STRATEGY');

  if (input.imitateUrl && input.imitateUrl.trim() !== '') {
    console.log(`🚀 [GeminiService] ACTIVATING VIRAL IMITATION MODE for: ${input.imitateUrl}`);
    try {
      // A. Scrape original video
      logWorkflowStage('generateViralContent', 'ANALYZE_VIRAL_VIDEO', { url: input.imitateUrl });
      const transcript = await analyzeViralVideo(input.imitateUrl);
      console.log('📝 [GeminiService] Obtained transcript, length:', transcript.length, 'chars');

      // B. Generate imitation script
      logWorkflowStage('generateViralContent', 'GENERATE_IMITATION_SCRIPT');
      analysis = await generateImitationScript(transcript, input.topic || input.videoTitle, input);

      console.log("✅ [GeminiService] Imitation Analysis Complete:", {
        hasFullPrompt: !!analysis.fullPrompt,
        hasViralityScore: !!analysis.viralityAnalysis?.score
      });
    } catch (e) {
      console.error("❌ [GeminiService] Imitation Failed, falling back to standard generation:", e);
      logWorkflowStage('generateViralContent', 'FALLBACK_TO_STANDARD_GENERATION');
      analysis = await generateFullPromptAndViralityAnalysis(input, t, apiKey);
    }
  } else {
    // Standard Generation
    logWorkflowStage('generateViralContent', 'STANDARD_GENERATION');
    analysis = await generateFullPromptAndViralityAnalysis(input, t, apiKey);
  }

  // 2. Generate Video via Google Vids (using prompt from LMArena)
  const promptToUse = analysis.fullPrompt || input.topic || "Viral video";
  logWorkflowStage('generateViralContent', 'GENERATE_VIDEO_ASSETS', { promptLength: promptToUse.length });

  // Enhanced progress handler with logging
  const progressHandler = (p: any) => {
    console.log('📊 [Progress]', p.percentage, '% -', p.messageKey);
  };

  // Run Video Generation and Thumbnail Prompt Generation in Parallel
  console.log('🎬 [GeminiService] Running parallel operations: Video Generation + Thumbnail Prompts');

  const parallelStartTime = Date.now();
  const [videoBlob, thumbnailPrompts] = await Promise.all([
    generateVideoAndThumbnail(promptToUse, input, progressHandler, t, apiKey),
    generateABThumbnailPrompts(input.topic || "Viral Topic", (input.style || "High Energy") as string, t, apiKey)
  ]);

  const parallelDuration = Date.now() - parallelStartTime;
  console.log('✅ [GeminiService] Parallel operations completed in', parallelDuration, 'ms');

  // 3. Return Result
  logWorkflowStage('generateViralContent', 'FINALIZING_RESULT');

  const finalResult: OutputData = {
    videoUrl: URL.createObjectURL(videoBlob),
    thumbnailUrl: 'https://via.placeholder.com/1280x720', // Extension handles real thumbnail
    marketingCopy: analysis.marketingCopy || {
      title: input.videoTitle || input.topic,
      description: input.videoDescription,
      tags: [],
      comment1: { type: 'none', content: '' },
      comment2: { type: 'none', content: '' }
    },
    fullPrompt: analysis.fullPrompt,
    aspectRatio: input.aspectRatio || '9:16',
    viralityAnalysis: analysis.viralityAnalysis || { score: 0, status: 'Pending', insights: [] },
    thumbnailPrompts: thumbnailPrompts
  };

  const workflowDuration = Date.now() - workflowStartTime;
  logPerformanceMetric('generateViralContent', workflowDuration, {
    success: true,
    hasVideo: !!finalResult.videoUrl,
    hasThumbnails: finalResult.thumbnailPrompts.length > 0
  });
  logWorkflowStage('generateViralContent', 'COMPLETE', { totalDuration: workflowDuration });

  console.log("🎉 [GeminiService] Viral Content Generation Workflow Completed!");
  console.log("📊 [GeminiService] Final Result:", {
    videoGenerated: !!finalResult.videoUrl,
    thumbnailPromptsCount: finalResult.thumbnailPrompts.length,
    hasViralityAnalysis: !!finalResult.viralityAnalysis,
    hasMarketingCopy: !!finalResult.marketingCopy
  });

  return finalResult;
};

// 4. Analyze Viral Video (Transcript)
export const analyzeViralVideo = async (videoUrl: string) => {
  const startTime = Date.now();
  logWorkflowStage('analyzeViralVideo', 'START', { url: videoUrl });

  console.log(`🎬 [GeminiService] Analyzing viral video: ${videoUrl}`);

  // 1. Open video
  logWorkflowStage('analyzeViralVideo', 'OPENING_VIDEO_TAB');
  sendToExtension('openTab', { url: videoUrl });

  // Wait for load
  console.log('⏳ [GeminiService] Waiting 8 seconds for video page to load...');
  await new Promise(r => setTimeout(r, 8000));

  // 2. Scrape Transcript
  logWorkflowStage('analyzeViralVideo', 'SCRAPING_TRANSCRIPT');
  window.postMessage({
    source: 'react_app',
    type: 'SCRAPE_TRANSCRIPT'
  }, '*');

  const result = await waitForExtensionMessage('TRANSCRIPT_RESULT');

  if (result.error || !result.text) {
    const duration = Date.now() - startTime;
    logPerformanceMetric('analyzeViralVideo', duration, { success: false });
    logWorkflowStage('analyzeViralVideo', 'FAILED', { error: result.error || 'No transcript found' });
    throw new Error(result.error || 'No transcript found');
  }

  const duration = Date.now() - startTime;
  logPerformanceMetric('analyzeViralVideo', duration, { success: true, transcriptLength: result.text.length });
  logWorkflowStage('analyzeViralVideo', 'COMPLETE', { transcriptLength: result.text.length });

  console.log('✅ [GeminiService] Transcript scraped successfully, length:', result.text.length, 'chars');
  return result.text;
};

// 5. Generate Imitation Script
export const generateImitationScript = async (transcript: string, myTopic: string, formData: FormInput) => {
  const startTime = Date.now();
  logWorkflowStage('generateImitationScript', 'START', {
    transcriptLength: transcript.length,
    topic: myTopic
  });

  console.log('📝 [GeminiService] Generating imitation script for:', myTopic);
  console.log('🎬 [GeminiService] Original transcript length:', transcript.length, 'chars');

  const prompt = `
        You are a viral content strategist.
        I want to IMITATE the structure of a viral video but apply it to a NEW TOPIC.

        ORIGINAL VIRAL VIDEO TRANSCRIPT:
        "${transcript.substring(0, 15000)}..."

        NEW TOPIC: "${myTopic}"
        NICHE: "${formData.niche}"
        STYLE: "${formData.style}"

        TASK:
        1. Analyze the Hook, Retention Points, and Pacing of the original.
        2. Write a NEW SCRIPT for the new topic that strictly follows the same viral structure.
        3. Generate marketing copy.

        Return JSON (EXACTLY this structure, no markdown):
        {
          "fullPrompt": "A detailed video generation prompt for Sora/Veo based on the new script. Include scene descriptions matched to the script lines.",
          "viralityAnalysis": {
            "score": 95,
            "status": "Viral",
            "insights": ["Copied viral hook structure", "Matched pacing of original hit", "Optimized for retention"],
            "recommendedTimes": ["18:00"],
            "publishingSchedule": "Daily"
          },
          "marketingCopy": {
            "title": "Viral Title (Imitated Style)",
            "description": "Description...",
            "tags": ["tag1", "tag2"],
            "comment1": { "type": "question", "content": "..." },
            "comment2": { "type": "cta", "content": "..." }
          }
        }
    `;

  console.log('📤 [GeminiService] Sending imitation script prompt to LMArena, length:', prompt.length, 'chars');

  // 1. Send to Extension
  window.postMessage({
    source: 'react_app',
    type: 'LMARENA_GENERATE_PLAN',
    prompt: prompt
  }, '*');

  // 2. Wait for result
  logWorkflowStage('generateImitationScript', 'WAITING_FOR_RESULT');
  const result = await waitForExtensionMessage('YPP_PLAN_RESULT');
  const data = result.payload || result.data;

  const duration = Date.now() - startTime;
  logPerformanceMetric('generateImitationScript', duration, { success: true });
  logWorkflowStage('generateImitationScript', 'COMPLETE');

  console.log('✅ [GeminiService] Imitation script generated successfully:', {
    hasFullPrompt: !!data.fullPrompt,
    hasViralityAnalysis: !!data.viralityAnalysis
  });

  return data;
};

