/**
 * Global Constants for GeminiGen Extension
 * 
 * Centralized location for all message types and storage keys
 * to prevent regression and string mismatch errors.
 */

const CONSTANTS = {
    // Storage Keys
    STORAGE: {
        GOOGLE_VIDS_UPLOAD_DATA: 'googleVidsUploadData',
        YOUTUBE_STUDIO_OPENED_PREFIX: 'youtube_studio_opened_',
        PENDING_ASK_STUDIO_PROMPT: 'pendingAskStudioPrompt',
        PENDING_AUTO_COMMENT: 'pending_auto_comment',
        ASK_STUDIO_RETRY: 'askStudio_retryCount',
        PENDING_ANALYTICS_REQUEST: 'pendingAnalyticsRequest',
        SETTINGS: 'extension_settings'
    },

    // Message Actions & Types
    ACTIONS: {
        // Core Data Operations
        STORE_VIDEO_DATA: 'storeVideoData',
        GET_VIDEO_DATA: 'getVideoData',
        CLEAR_VIDEO_DATA: 'clearVideoData',

        // GeminiGen Flow
        RELAY_GEMINI_VIDEO_RESULT: 'relayGeminiVideoResult',
        GEMINI_VIDEO_RESULT: 'GEMINI_VIDEO_RESULT',
        GEMINI_MANUAL_SCRAPE_REQUEST: 'GEMINI_MANUAL_SCRAPE_REQUEST',
        OPEN_GEMINIGEN_TAB: 'OPEN_GEMINIGEN_TAB',
        OPEN_GEMINI_TAB_ACTION: 'openGeminiGenTab', // The action used in payload

        // LMArena
        LMARENA_GENERATE_PLAN: 'LMARENA_GENERATE_PLAN',
        STORE_LMARENA_PROMPT: 'storeLMArenaPrompt',

        // Google Vids Flow
        STORE_GOOGLE_VIDS_DATA: 'storeGoogleVidsUploadData',
        STORE_GOOGLE_VIDS_REQUEST: 'storeGoogleVidsRequest',
        CHECK_STUDIO_OPENED: 'checkYouTubeStudioOpened',
        FORCE_OPEN_STUDIO: 'forceOpenYouTubeStudio',
        RELAY_VIDS_STATUS: 'relayGoogleVidsStatus',
        GOOGLE_VIDS_STATUS: 'GOOGLE_VIDS_STATUS',
        GOOGLE_VIDS_GENERATE: 'GOOGLE_VIDS_GENERATE',
        OPEN_GOOGLE_VIDS_TAB: 'openGoogleVidsTab',

        // Google Flow Flow
        GOOGLE_FLOW_GENERATE: 'GOOGLE_FLOW_GENERATE',
        OPEN_GOOGLE_FLOW_TAB: 'openGoogleFlowTab',

        // YouTube Studio Automation
        PREPARE_YOUTUBE_UPLOAD: 'PREPARE_YOUTUBE_UPLOAD',
        YOUTUBE_UPLOAD_COMPLETE: 'YOUTUBE_UPLOAD_COMPLETE',
        YOUTUBE_UPLOAD_STATUS: 'YOUTUBE_UPLOAD_STATUS',
        REQUEST_YOUTUBE_ANALYTICS: 'REQUEST_YOUTUBE_ANALYTICS',
        RELAY_ANALYTICS_REQUEST: 'relayAnalyticsRequest',
        YOUTUBE_ANALYTICS_RESULT: 'YOUTUBE_ANALYTICS_RESULT',
        SET_ANALYTICS_TIME_RANGE: 'SET_ANALYTICS_TIME_RANGE',
        REQUEST_YOUTUBE_SHORTS_REFRESH: 'REQUEST_YOUTUBE_SHORTS_REFRESH',

        // Ask Studio & Planning
        GENERATE_PLAN: 'ASK_STUDIO_GENERATE_PLAN', // Type & Action
        TRIGGER_AUTO_REFRESH: 'TRIGGER_AUTO_REFRESH',
        PERFORM_ANALYTICS_ASK: 'performAnalyticsAsk',

        // Comments & Ignite Engine
        REGISTER_SCHEDULED_COMMENT: 'REGISTER_SCHEDULED_COMMENT',
        EXECUTE_COMMENT_ACTION: 'EXECUTE_COMMENT_ACTION',
        COMMENT_POSTED: 'COMMENT_POSTED',
        IGNITE_STATUS: 'IGNITE_STATUS',
        IGNITE_COMMENT: 'IGNITE_COMMENT',
        TRIGGER_AI_REPLY: 'TRIGGER_AI_REPLY',
        PERFORM_COMMENT_ACTION: 'PERFORM_COMMENT_ACTION',
        TOGGLE_AUTO_REPLY: 'TOGGLE_AUTO_REPLY',
        IGNITE_SCRIPT: 'IGNITE_SCRIPT',

        // DFL (Dynamic Feedback Loop)
        DFL_START_SCHEDULE_MONITOR: 'DFL_START_SCHEDULE_MONITOR',
        DFL_TRIGGER_IGNITION: 'DFL_TRIGGER_IGNITION',
        DFL_CHECK_VELOCITY: 'DFL_CHECK_VELOCITY',
        DFL_SCHEDULE_ADJUST_REQUEST: 'DFL_SCHEDULE_ADJUST_REQUEST',

        // Cross-Platform
        CROSS_PLATFORM_DISTRIBUTE: 'CROSS_PLATFORM_DISTRIBUTE',
        X_POST_REQUEST: 'X_POST_REQUEST',
        X_AUTO_POST: 'X_AUTO_POST',
        TIKTOK_UPLOAD_REQUEST: 'TIKTOK_UPLOAD_REQUEST',
        TIKTOK_COMMENT_REQUEST: 'TIKTOK_COMMENT_REQUEST',

        // Extension Lifecycle
        CHECK_EXTENSION_STATUS: 'CHECK_EXTENSION_STATUS',

        // Payload Actions (often used in 'action' field)
        PAYLOAD_SCRAPE_ANALYTICS: 'scrape_analytics_direct',
        PAYLOAD_BOOST_VIDEO: 'boost_video',
        PAYLOAD_ANALYTICS: 'analytics',
        PAYLOAD_LIKE: 'like',
        PAYLOAD_REPLY: 'reply',
        PAYLOAD_PIN: 'pin',
        PAYLOAD_X_POST: 'xPost',
        PAYLOAD_X_SCRAPE_TRENDS: 'scrapeXTrends',
        PAYLOAD_X_SCRAPE_ANALYTICS: 'scrapeXAnalytics',
        PAYLOAD_TIKTOK_UPLOAD: 'tiktokUpload',
        PAYLOAD_TIKTOK_COMMENT: 'tiktokComment',
        PAYLOAD_TIKTOK_SCRAPE: 'scrapeTikTokAnalytics'
    },

    // 🔥 Ignite 2.0: Sockpuppet Account Configuration
    IGNITE_CONFIG: {
        // 马甲账号列表 (顺序决定发布顺序)
        SOCKPUPPET_ACCOUNTS: [
            'Mark Bobl | Digital Forensics',  // 主账号 (置顶评论)
            'CCTV Debunker',                   // 马甲 1
            'c hao',                           // 马甲 2
            'chi rimmon'                       // 马甲 3
        ],
        // 评论间隔 (毫秒)
        COMMENT_DELAY_MIN: 60000,   // 最短 1 分钟
        COMMENT_DELAY_MAX: 120000,  // 最长 2 分钟
        // 首条评论延迟
        FIRST_COMMENT_DELAY: 5000   // 5 秒
    },

    // Status Types
    STATUS: {
        IDLE: 'idle',
        GENERATING: 'generating',
        DOWNLOAD_COMPLETE: 'download_complete',
        UPLOADING: 'uploading',
        COMPLETE: 'complete',
        ERROR: 'error'
    }
};

// Export to global scope for non-module scripts
// Works in both content scripts (window) and service workers (self/globalThis)
const globalScope = typeof globalThis !== 'undefined' ? globalThis :
    typeof self !== 'undefined' ? self :
        typeof window !== 'undefined' ? window : {};

globalScope.EXT_CONSTANTS = CONSTANTS;

// CommonJS export for Node.js compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONSTANTS;
}
