import { AnalyticsResult } from '../../services/analyticsService';

export interface YouTubeAnalyticsData {
    [category: string]: AnalyticsResult;
}

export interface YouTubeAnalyticsProps {
    apiKey?: string;
}

export interface ShortsData {
    id: string;
    title: string;
    thumbnail: string;
    thumbnailUrl?: string; // Sometimes used interchangeably
    visibility: string;
    date: string;
    publishDate?: string; // Sometimes used interchangeably
    views: string;
    comments: string;
    likes: string;
    restrictions: string;
    videoId?: string;
    watchUrl?: string;
    analyticsUrl?: string;
}

export interface DFLState {
    isActive: boolean;
    learningPhase: 'idle' | 'collecting' | 'analyzing' | 'optimizing';
    lastLearningCycle: Date | null;
    topPerformers: { title: string; views: number; pattern: string; videoId?: string }[];
    bestTitlePatterns: string[];
    viralTriggers: string[];
    algorithmScore: number; // 0-100
    feedActivation: boolean; // Shorts Feed activated?
    interventionsEnabled: boolean;
    autoCommentEnabled: boolean;
    dynamicScheduleEnabled: boolean;
    handledViralEvents: string[]; // Persisted list of handled signal sources to prevent loops
    // 🆕 Channel Identity (IP-Based Content)
    channelIdentity?: ChannelIdentity;
    // 🆕 Learned Patterns (Auto-Learned from Top Performers)
    learnedPatterns?: LearnedPatterns;
}

export interface ICommentData {
    id: string;
    author: string;
    text: string;
    likes: string;
    replies: string;
    date: string;
    videoTitle?: string;
    sentiment?: 'positive' | 'negative' | 'neutral';
}

export interface INotification {
    id: string;
    text: string;
    date: string;
    type: 'comment' | 'system' | 'alert';
    read: boolean;
}

// 🆕 Channel Identity - Your Channel's Unique Brand/IP
export interface ChannelIdentity {
    niche: string;           // e.g., "AI/Tech Comedy", "Pet Fails", "Street Food"
    protagonist: string;     // e.g., "AI Robot", "Grumpy Cat", "Street Vendor"
    style: string;           // e.g., "Satirical Tech Fails", "Wholesome Animals"
    audience: string;        // e.g., "Tech-savvy Gen Z", "Pet Lovers 25-45"
    signature: string;       // e.g., "EMOJI_HOOK", "CAPS_DRAMA", "QUESTION_HOOK"
    bannedTopics: string[];  // Topics to avoid
    preferredTags: string[]; // Always include these tags
}

// 🆕 Learned Patterns - Auto-extracted from Top Performers
export interface LearnedPatterns {
    topKeywords: string[];        // Most common words in top titles
    avgTitleLength: number;       // Optimal title length
    bestPublishHours: number[];   // Hours with best performance
    topEmojis: string[];          // Most effective emojis
    winningFormulas: string[];    // Extracted title formulas
    lastUpdated: Date;
    // 🆕 A/B Test Performance Tracking
    scenarioPerformance?: {
        [scenarioType: string]: {
            totalVideos: number;
            totalViews: number;
            avgViews: number;
            successRate: number;  // % of videos > 500 views in 1 hour
        }
    };
}

export interface DFLMetrics {
    firstHourVelocity: number;
    swipeAwayRate: number;
    rewatchRatio: number;
    subsConversion: number;
    sessionContribution: number;
    retentionAt3s: number;
    viralPotential: number; // 0-100 calculated score
}

export interface DFLIntervention {
    type: 'auto_comment' | 'schedule_adjust' | 'repost' | 'boost';
    targetVideoId?: string;
    reason: string;
    action: string;
    timestamp: Date;
    status: 'pending' | 'executed' | 'failed';
}

export interface DFLSignal {
    type: 'velocity_spike' | 'rewatch_surge' | 'trend_detected' | 'pattern_match' | 'auto_comment';
    intensity: 'low' | 'medium' | 'high' | 'extreme';
    source: string;
    timestamp: Date;
    actionTaken?: string;
}

export interface TrendSurfing {
    detectedTrend: string | null;
    topPerformerScene: string | null;
    trendScore: number;
    suggestedVariations: string[];
}

export interface TimeSlotVelocity {
    hour: number;
    avgVelocity: number;
    sampleSize: number;
    successRate: number;
    lastUpdated: Date;
}

export interface AdaptiveSchedule {
    enabled: boolean;
    confidenceScore: number;
    lastAnalysis: Date | null;
    optimalSlots: number[];
    peakWindow: { start: number; end: number };
    timeSlotData: TimeSlotVelocity[];
    burstQueueEnabled: boolean;
}

export type SoundType = 'success' | 'error' | 'warning' | 'viral' | 'milestone' | 'critical' | 'action' | 'schedule' | 'info';

export interface YPPPlan {
    schedule: any[];
    [key: string]: any;
}

export interface YPPIntervention {
    type: string;
    targetVideoId: string;
    action: string;
    status: 'pending' | 'executed' | 'failed';
    timestamp: Date;
}

export interface YPPValidation {
    isValid: boolean;
    issues: string[];
}

export interface YPPVideoData {
    videoId: string;
    title: string;
    views: number;
    metrics: any;
}

