/**
 * Google Veo 3 API Service
 * 
 * Direct API integration for video generation using Google Veo 3/3.1.
 * Uses the Gemini API for server-side video generation.
 * 
 * @module services/veoService
 * @version 2.0.0
 * @date 2025-12-26
 * 
 * API Endpoint: predictLongRunning (NOT generateContent)
 * Format: { instances: [{ prompt }], parameters: { aspectRatio, ... } }
 */

// Available Veo models
export const VEO_MODELS = {
    VEO_3_1: 'veo-3.1-generate-preview',
    VEO_3_1_FAST: 'veo-3.1-fast-generate-preview',
    VEO_3: 'veo-3.0-generate-001',
    VEO_3_FAST: 'veo-3.0-fast-generate-001',
    VEO_2: 'veo-2.0-generate-001'
} as const;

export type VeoModelType = typeof VEO_MODELS[keyof typeof VEO_MODELS];

// API Configuration
export interface VeoApiConfig {
    apiKey: string;
    baseUrl?: string;
    timeout?: number;
}

// Video generation parameters
export interface VeoGenerateParams {
    prompt: string;
    model?: VeoModelType;
    aspectRatio?: '16:9' | '9:16';
    resolution?: '720p' | '1080p';
    durationSeconds?: 4 | 6 | 8;
    negativePrompt?: string;
    personGeneration?: 'allow_all' | 'allow_adult' | 'dont_allow';
    seed?: number;
}

// Generation result
export interface VeoGenerationResult {
    success: boolean;
    videoUrl?: string;
    videoData?: string; // Base64 encoded
    duration?: number;
    error?: string;
    operationId?: string;
}

// Operation status
export interface VeoOperationStatus {
    done: boolean;
    progress?: number;
    error?: string;
    result?: {
        generateVideoResponse?: {
            generatedSamples: Array<{
                video: {
                    uri: string;
                    mimeType?: string;
                }
            }>
        }
    };
}

/**
 * VeoService Class
 * 
 * Handles video generation via Google Veo 3 API.
 */
export class VeoService {
    private apiKey: string;
    private baseUrl: string;
    private timeout: number;
    private currentOperation: string | null = null;

    constructor(config: VeoApiConfig) {
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
        this.timeout = config.timeout || 600000; // 10 minutes default
    }

    /**
     * 🛡️ Sanitizes prompt to prevent content policy rejections.
     * Mirrors the rules in yppService.ts sanitizePromptForVideoGen
     */
    private sanitizePrompt(text: string): string {
        if (!text) return text;

        const sensitivePatterns = [
            // Prominent People / Celebrities
            { pattern: /\b(celebrity|celebrities|famous|star|superstar|celeb)\b/gi, replacement: 'person' },
            { pattern: /\b(actor|actress|singer|musician|rapper|dj)\b/gi, replacement: 'performer' },
            { pattern: /\b(president|politician|senator|governor|mayor|minister)\b/gi, replacement: 'official' },
            { pattern: /\b(athlete|player|champion|olympian)\b/gi, replacement: 'competitor' },
            { pattern: /\b(influencer|youtuber|tiktoker|streamer)\b/gi, replacement: 'content creator' },
            { pattern: /\b(karen|chad|kyle|becky|kevin)\b/gi, replacement: 'customer' },

            // Channel persona names (trigger "real person" filters)
            { pattern: /\bmark\s+bobl\b/gi, replacement: 'the analyst' },
            { pattern: /\b(himself|herself|themselves)\s+from\s+\d+\s+years?\s+ago\b/gi, replacement: 'in an old photo' },
            { pattern: /\bfrom\s+\d+\s+years?\s+ago\b/gi, replacement: 'in the past' },
            { pattern: /\b\d+\s+years?\s+(ago|younger|older)\b/gi, replacement: 'previously' },
            { pattern: /\b[A-Z][a-z]+\s+[A-Z][a-z]+\s+(himself|herself|themselves)\b/gi, replacement: 'the person themselves' },
            { pattern: /\b(pixelated|blurred|goofy)\s+(picture|photo|image)\s+of\s+[A-Z][a-z]+/gi, replacement: 'stylized image' },

            // Children / Minors
            { pattern: /\b(child|children|kid|kids|baby|babies|infant|toddler|minor|minors)\b/gi, replacement: 'adult' },
            { pattern: /\b(boy|girl|teen|teenager|adolescent|youth|juvenile)\b/gi, replacement: 'adult' },
            { pattern: /\b(school|playground|daycare|nursery|kindergarten)\b/gi, replacement: 'workplace' },
            { pattern: /\b(\d+)[\s-]?(year|yr)[\s-]?old\b/gi, replacement: 'adult' },

            // Violence & Death
            { pattern: /\b(dead|death|die|died|dying|kill|killed|killing|murder|murdered)s?\b/gi, replacement: 'incident' },
            { pattern: /\b(crash(?:es|ed|ing)?)\b/gi, replacement: 'bump' },
            { pattern: /\b(accident(?:s)?)\b/gi, replacement: 'mishap' },
            { pattern: /\b(injur(?:e|ed|y|ies))\b/gi, replacement: 'inconvenience' },

            // Weapons
            { pattern: /\b(gun|weapon|shoot|shot|shooting|rifle|pistol|knife|sword|firearm)s?\b/gi, replacement: 'equipment' },

            // Blood & Gore
            { pattern: /\b(blood|bleeding|bleed|gore|gory|bloody)\b/gi, replacement: 'spill' },

            // Explosions
            { pattern: /\b(explod(?:e|es|ed|ing)|explosion|bomb|blast|detonate)s?\b/gi, replacement: 'burst' },

            // Violence Words
            { pattern: /\b(fight(?:s|ing)?|assault(?:s|ed)?|beat(?:s|ing)?|punch(?:es|ed)?|kick(?:s|ed)?|slap(?:s|ped)?)\b/gi, replacement: 'interaction' },

            // Fear/Danger
            { pattern: /\b(terrif(?:y|ied|ying)|fear(?:ful)?|scared|horror)\b/gi, replacement: 'surprised' },
            { pattern: /\b(dangerous|risky|deadly|fatal|lethal)\b/gi, replacement: 'unexpected' },
        ];

        let sanitized = text;

        for (const { pattern, replacement } of sensitivePatterns) {
            sanitized = sanitized.replace(pattern, replacement);
        }

        // Additional safety
        sanitized = sanitized.replace(/dead/gi, 'incident');
        sanitized = sanitized.replace(/karen/gi, 'customer');
        sanitized = sanitized.replace(/\bkid\b/gi, 'adult');
        sanitized = sanitized.replace(/\bchild\b/gi, 'adult');

        return sanitized;
    }

    /**
     * Generates a video from a text prompt.
     * 
     * @param params - Generation parameters
     * @returns Promise<VeoGenerationResult>
     */
    async generateVideo(params: VeoGenerateParams): Promise<VeoGenerationResult> {
        const {
            prompt: rawPrompt,
            model = VEO_MODELS.VEO_3_1_FAST,
            aspectRatio = '9:16',
            resolution = '720p',
            durationSeconds = 8,
            negativePrompt,
            personGeneration,
            seed
        } = params;

        // 🛡️ SAFETY FILTER: Sanitize prompt before sending to Veo API
        const prompt = this.sanitizePrompt(rawPrompt);

        console.log(`🎬 [VeoService] Starting video generation...`);
        console.log(`   Model: ${model}`);
        console.log(`   Prompt: ${prompt.substring(0, 100)}...`);
        if (prompt !== rawPrompt) {
            console.log(`   🛡️ Prompt was sanitized (sensitive content removed)`);
        }
        console.log(`   Aspect Ratio: ${aspectRatio}`);
        console.log(`   Resolution: ${resolution}`);

        try {
            // Step 1: Initiate video generation using predictLongRunning
            const operationId = await this.initiateGeneration({
                prompt,
                model,
                aspectRatio,
                resolution,
                durationSeconds,
                negativePrompt,
                personGeneration,
                seed
            });

            this.currentOperation = operationId;
            console.log(`🎬 [VeoService] Generation initiated. Operation ID: ${operationId}`);

            // Step 2: Poll for completion
            const result = await this.pollOperation(operationId);

            if (result.error) {
                throw new Error(result.error);
            }

            if (!result.done || !result.result?.generateVideoResponse?.generatedSamples?.length) {
                throw new Error('Video generation timed out or failed');
            }

            // Step 3: Get video URL
            const video = result.result.generateVideoResponse.generatedSamples[0];
            const videoUrl = video.video.uri;

            console.log(`✅ [VeoService] Video generated successfully!`);
            console.log(`   URL: ${videoUrl}`);

            // Step 4: Download video as base64
            let videoData: string | undefined;
            try {
                videoData = await this.downloadVideoAsBase64(videoUrl);
                console.log(`✅ [VeoService] Video downloaded as base64 (${Math.round((videoData.length * 0.75) / 1024 / 1024)}MB)`);
            } catch (e) {
                console.warn(`⚠️ [VeoService] Could not download video as base64:`, e);
            }

            return {
                success: true,
                videoUrl,
                videoData,
                operationId
            };

        } catch (error: any) {
            console.error(`❌ [VeoService] Generation failed:`, error.message);
            return {
                success: false,
                error: error.message
            };
        } finally {
            this.currentOperation = null;
        }
    }

    /**
     * Initiates video generation and returns operation ID.
     * Uses predictLongRunning endpoint with correct format.
     */
    private async initiateGeneration(params: VeoGenerateParams): Promise<string> {
        // Use predictLongRunning endpoint (NOT generateContent)
        const url = `${this.baseUrl}/models/${params.model}:predictLongRunning`;

        // Build request body in correct format
        const requestBody: any = {
            instances: [{
                prompt: params.prompt
            }],
            parameters: {
                aspectRatio: params.aspectRatio || '9:16'
            }
        };

        // Add optional parameters
        if (params.resolution) {
            requestBody.parameters.resolution = params.resolution;
        }

        if (params.durationSeconds) {
            requestBody.parameters.durationSeconds = params.durationSeconds;
        }

        if (params.negativePrompt) {
            requestBody.parameters.negativePrompt = params.negativePrompt;
        }

        if (params.personGeneration) {
            requestBody.parameters.personGeneration = params.personGeneration;
        }

        if (params.seed !== undefined) {
            requestBody.parameters.seed = params.seed;
        }

        console.log(`🎬 [VeoService] Request URL: ${url}`);
        console.log(`🎬 [VeoService] Request body:`, JSON.stringify(requestBody, null, 2));

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': this.apiKey
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error(`❌ [VeoService] API Error:`, errorData);
            throw new Error(errorData.error?.message || `API error: ${response.status}`);
        }

        const data = await response.json();
        console.log(`🎬 [VeoService] API Response:`, JSON.stringify(data, null, 2));

        // The API returns an operation name
        if (data.name) {
            return data.name;
        }

        throw new Error('Invalid API response: no operation name returned');
    }

    /**
     * Polls operation status until complete or timeout.
     */
    private async pollOperation(operationName: string): Promise<VeoOperationStatus> {
        const startTime = Date.now();
        const pollInterval = 10000; // 10 seconds

        while (Date.now() - startTime < this.timeout) {
            // Poll operation status
            const url = `${this.baseUrl}/${operationName}`;

            try {
                const response = await fetch(url, {
                    headers: {
                        'x-goog-api-key': this.apiKey
                    }
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error?.message || `Poll error: ${response.status}`);
                }

                const data = await response.json();

                if (data.done) {
                    if (data.error) {
                        return { done: true, error: data.error.message };
                    }
                    return {
                        done: true,
                        result: data.response
                    };
                }

                // Report progress
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                console.log(`🎬 [VeoService] Waiting for generation... (${elapsed}s)`);

            } catch (error: any) {
                console.warn(`⚠️ [VeoService] Poll error:`, error.message);
            }

            // Wait before next poll
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        return { done: false, error: 'Operation timed out' };
    }

    /**
     * Downloads video from URL and returns as base64.
     */
    private async downloadVideoAsBase64(videoUrl: string): Promise<string> {
        // Download video using API key in header
        const response = await fetch(videoUrl, {
            headers: {
                'x-goog-api-key': this.apiKey
            }
        });

        if (!response.ok) {
            throw new Error(`Download failed: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const base64 = btoa(
            new Uint8Array(arrayBuffer)
                .reduce((data, byte) => data + String.fromCharCode(byte), '')
        );

        return `data:video/mp4;base64,${base64}`;
    }

    /**
     * Cancels current operation if any.
     */
    async cancel(): Promise<boolean> {
        if (!this.currentOperation) {
            return false;
        }

        try {
            const url = `${this.baseUrl}/${this.currentOperation}:cancel`;
            await fetch(url, {
                method: 'POST',
                headers: {
                    'x-goog-api-key': this.apiKey
                }
            });
            this.currentOperation = null;
            console.log(`🛑 [VeoService] Operation cancelled`);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Gets current operation status.
     */
    getStatus(): { isGenerating: boolean; operationId: string | null } {
        return {
            isGenerating: this.currentOperation !== null,
            operationId: this.currentOperation
        };
    }
}

// Singleton instance (created when API key is provided)
let veoServiceInstance: VeoService | null = null;

/**
 * Gets or creates VeoService instance.
 */
export function getVeoService(apiKey?: string): VeoService | null {
    if (apiKey) {
        veoServiceInstance = new VeoService({ apiKey });
    }
    return veoServiceInstance;
}

/**
 * Quick generate helper function.
 */
export async function generateVeoVideo(
    apiKey: string,
    prompt: string,
    options?: Partial<VeoGenerateParams>
): Promise<VeoGenerationResult> {
    const service = new VeoService({ apiKey });
    return service.generateVideo({
        prompt,
        ...options
    });
}

export default VeoService;
