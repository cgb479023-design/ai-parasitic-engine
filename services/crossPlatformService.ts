/**
 * Cross-Platform Content Adapter Service
 * 
 * Adapts YPP plan items for X (Twitter) and TikTok distribution.
 * Implements the "Vanguard" strategy: external platforms ignite YouTube's algorithm.
 * 
 * @module services/crossPlatformService
 * @version 1.0.0
 * @date 2026-01-08
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

import { contractManager } from '@/src/core/ContractManager';
import { effectLogger } from '@/src/core/EffectLogger';
import { intentStream } from '@/src/core/IntentStream';

export interface XPostContent {
    text: string;           // 280 char max tweet
    youtubeLink: string;    // Short link to YouTube video
    hashtags: string[];     // Trending hashtags
    mediaUrl?: string;      // Optional thumbnail or GIF
}

export interface TikTokContent {
    caption: string;        // 150 char caption
    hashtags: string[];     // TikTok hashtags (max 5)
    bioLinkCta: string;     // Call-to-action for bio link
    hookDescription: string; // First 3 second hook
}

export interface CrossPlatformOutput {
    x: XPostContent;
    tiktok: TikTokContent;
    youtubeVideoId?: string;
    timestamp: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
    X: {
        MAX_CHARS: 280,
        LINK_LENGTH: 23, // t.co shortens to 23 chars
        HASHTAG_LIMIT: 3,
    },
    TIKTOK: {
        MAX_CAPTION: 150,
        HASHTAG_LIMIT: 5,
    },
    // 🔥 Viral hooks for each platform
    HOOKS: {
        X: [
            "🚨 You NEED to see this...",
            "Wait for it... 👀",
            "This is why I love the internet",
            "POV: You're the main character",
            "Nobody expected this 😳",
        ],
        TIKTOK: [
            "Wait till the end 💀",
            "POV: ",
            "Live footage of ",
            "When you realize ",
            "No way this actually happened 😭",
        ],
    },
    // Algorithm-inducing timestamp mentions
    TIMESTAMP_TRIGGERS: [
        "0:04 is where it gets real 👀",
        "Watch at 0:03 carefully 🔍",
        "The ending at 0:07 tho 💀",
        "0:05 - I can't unsee this",
    ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// X (TWITTER) ADAPTER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Adapts a YPP plan item for X (Twitter) posting.
 * 
 * @param planItem - The YPP schedule item
 * @param youtubeUrl - The YouTube video URL to link
 * @returns Optimized X post content
 */
export function adaptForX(
    planItem: {
        title: string;
        description: string;
        tags: string;
        promptBlock?: string;
    },
    youtubeUrl: string
): XPostContent {
    // Extract key hook from title
    const title = planItem.title || '';
    const description = planItem.description || '';

    // Select a random viral hook
    const hook = CONFIG.HOOKS.X[Math.floor(Math.random() * CONFIG.HOOKS.X.length)];

    // Select a timestamp trigger for algorithm induction
    const timestampTrigger = CONFIG.TIMESTAMP_TRIGGERS[
        Math.floor(Math.random() * CONFIG.TIMESTAMP_TRIGGERS.length)
    ];

    // Extract hashtags from tags
    const tagList = (planItem.tags || '').split(',').map(t => t.trim()).filter(Boolean);
    const hashtags = tagList.slice(0, CONFIG.X.HASHTAG_LIMIT).map(t =>
        t.startsWith('#') ? t : `#${t.replace(/\s+/g, '')}`
    );

    // Build tweet text
    // Format: [Hook] + [Short description or title] + [Timestamp trigger] + [Link]
    const availableChars = CONFIG.X.MAX_CHARS - CONFIG.X.LINK_LENGTH - 5; // 5 for spacing

    let tweetBody = `${hook}\n\n`;

    // Add title/description (truncated if needed)
    const titlePart = title.length > 60 ? title.substring(0, 57) + '...' : title;
    tweetBody += titlePart + '\n\n';

    // Add timestamp trigger
    tweetBody += timestampTrigger + '\n\n';

    // Add hashtags
    const hashtagStr = hashtags.join(' ');
    if (tweetBody.length + hashtagStr.length < availableChars - 10) {
        tweetBody += hashtagStr;
    }

    // Truncate if still too long
    if (tweetBody.length > availableChars) {
        tweetBody = tweetBody.substring(0, availableChars - 3) + '...';
    }

    return {
        text: tweetBody.trim(),
        youtubeLink: youtubeUrl,
        hashtags: hashtags,
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIKTOK ADAPTER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Adapts a YPP plan item for TikTok posting.
 * 
 * @param planItem - The YPP schedule item
 * @returns Optimized TikTok content
 */
export function adaptForTikTok(
    planItem: {
        title: string;
        description: string;
        tags: string;
        promptBlock?: string;
    }
): TikTokContent {
    const title = planItem.title || '';
    const description = planItem.description || '';

    // Select a POV-style hook
    const hookTemplate = CONFIG.HOOKS.TIKTOK[Math.floor(Math.random() * CONFIG.HOOKS.TIKTOK.length)];

    // Extract subject from title (first meaningful phrase)
    const subject = title.replace(/[😱🔥💀👀🤯]/g, '').trim().split('—')[0].trim();

    // Build hook description for first 3 seconds
    const hookDescription = hookTemplate.includes('POV:')
        ? `${hookTemplate} you witness ${subject.toLowerCase()}`
        : hookTemplate.includes('Live footage')
            ? `${hookTemplate} ${subject.toLowerCase()}`
            : hookTemplate + subject;

    // Extract and optimize hashtags for TikTok
    const tagList = (planItem.tags || '').split(',').map(t => t.trim()).filter(Boolean);
    const tiktokHashtags = [
        '#fyp',           // Must-have for TikTok
        '#viral',         // Boost signal
        ...tagList.slice(0, CONFIG.TIKTOK.HASHTAG_LIMIT - 2).map(t =>
            t.startsWith('#') ? t : `#${t.replace(/\s+/g, '')}`
        )
    ];

    // Build caption
    let caption = title.length > 100 ? title.substring(0, 97) + '...' : title;

    // Truncate if needed
    if (caption.length > CONFIG.TIKTOK.MAX_CAPTION) {
        caption = caption.substring(0, CONFIG.TIKTOK.MAX_CAPTION - 3) + '...';
    }

    return {
        caption: caption,
        hashtags: tiktokHashtags,
        bioLinkCta: '🔗 Full video on YouTube - Link in Bio!',
        hookDescription: hookDescription,
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// UNIFIED ADAPTER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generates cross-platform distribution content from a YPP plan item.
 * 
 * @param planItem - The YPP schedule item
 * @param youtubeUrl - The YouTube video URL (after upload)
 * @returns Complete cross-platform output
 */
export function generateCrossPlatformContent(
    planItem: {
        title: string;
        description: string;
        tags: string;
        promptBlock?: string;
    },
    youtubeUrl: string
): CrossPlatformOutput {
    // Extract video ID from URL
    const videoIdMatch = youtubeUrl.match(/(?:v=|shorts\/)([a-zA-Z0-9_-]{10,12})/);
    const youtubeVideoId = videoIdMatch ? videoIdMatch[1] : undefined;

    return {
        x: adaptForX(planItem, youtubeUrl),
        tiktok: adaptForTikTok(planItem),
        youtubeVideoId,
        timestamp: new Date().toISOString(),
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISTRIBUTION TRIGGER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Sends cross-platform distribution request to the Chrome extension.
 * 
 * @param content - The cross-platform content to distribute
 */
export function triggerCrossPlatformDistribution(content: CrossPlatformOutput, requestId?: string): string {
    const rid = requestId || `dist_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    // 🛡️ Constitution Pillar 1: Formal Verification
    contractManager.verify('cross_platform_distribution', content);

    console.log(`🌐 [CrossPlatform] Triggering distribution (${rid}):`, content);

    // 🔗 Constitution Pillar 3: Causal Tracing
    effectLogger.logEffect(rid, 'CROSS_PLATFORM_DISTRIBUTE', {
        platforms: [content.x && 'X', content.tiktok && 'TikTok'].filter(Boolean),
        timestamp: Date.now()
    });

    // 🔮 Constitution Pillar 4: Event Sourcing
    intentStream.propose('CROSS_PLATFORM_DISTRIBUTE', { rid, platforms: content.x && content.tiktok ? 'both' : (content.x ? 'x' : 'tiktok') }, 'agent');

    window.postMessage({
        type: 'CROSS_PLATFORM_DISTRIBUTE',
        payload: content,
        requestId: rid
    }, '*');

    return rid;
}

/**
 * Sends cross-platform distribution request to the backend API.
 */
export async function triggerCrossPlatformDistributionAsync(
    content: CrossPlatformOutput,
    timeoutMs: number = 60000
): Promise<any> {
    console.log(`🌐 [CrossPlatform] Dispatching to backend:`, content);

    try {
        const response = await fetch('/api/distribute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(content)
        });

        if (!response.ok) throw new Error(`Backend error: ${response.statusText}`);

        const result = await response.json();
        return result;
    } catch (e) {
        console.error("❌ [CrossPlatform] Distribution dispatch failed:", e);
        return { success: false, error: e.message };
    }
}

export async function checkExtensionStatus(): Promise<'OK' | 'INVALIDATED' | 'TIMEOUT'> {
    // 🛡️ V5.0: Since we've moved to backend autonomous mode, we no longer depend on the extension.
    return 'OK';
}

/**
 * Sends X-only distribution request.
 */
export function triggerXPost(content: XPostContent, requestId?: string): string {
    const rid = requestId || `x_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    // 🛡️ Formal Verification
    contractManager.verify('cross_platform_distribution', { x: content });

    console.log(`📱 [X] Triggering post (${rid}):`, content.text.substring(0, 50) + '...');

    // 🔗 Causal Tracing
    effectLogger.logEffect(rid, 'X_POST_REQUEST', { textLength: content.text.length });

    window.postMessage({
        type: 'X_POST_REQUEST',
        payload: content,
        requestId: rid
    }, '*');

    return rid;
}

/**
 * Sends TikTok-only distribution request.
 */
export function triggerTikTokUpload(
    videoBlob: Blob,
    content: TikTokContent,
    requestId?: string
): string {
    const rid = requestId || `tt_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    // 🛡️ Formal Verification
    contractManager.verify('cross_platform_distribution', { tiktok: content });

    console.log(`🎵 [TikTok] Triggering upload (${rid}):`, content.caption.substring(0, 50) + '...');

    // 🔗 Causal Tracing
    effectLogger.logEffect(rid, 'TIKTOK_UPLOAD_REQUEST', { captionLength: content.caption.length });

    // Convert blob to base64 for messaging
    const reader = new FileReader();
    reader.onloadend = () => {
        const base64 = reader.result as string;

        window.postMessage({
            type: 'TIKTOK_UPLOAD_REQUEST',
            payload: {
                ...content,
                videoData: base64,
            },
            requestId: rid
        }, '*');
    };
    reader.readAsDataURL(videoBlob);

    return rid;
}

// Export service object
export const crossPlatformService = {
    adaptForX,
    adaptForTikTok,
    generateCrossPlatformContent,
    triggerCrossPlatformDistribution,
    triggerCrossPlatformDistributionAsync,
    checkExtensionStatus,
    triggerXPost,
    triggerTikTokUpload,
};

console.log('📦 [Service] crossPlatformService loaded');
