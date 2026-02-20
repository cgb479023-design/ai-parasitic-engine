/**
 * 统一类型定义文件
 * 集中管理所有类型定义，避免重复和不一致
 */

// 视频引擎枚举
export enum VideoEngine {
    VEO = 'veo',
    GMICLOUD = 'gmicloud',
    GEMINIGEN = 'geminigen',
    GOOGLEVIDS = 'googlevids',
}

// 生成模式枚举
export enum GenerationMode {
    AI_GENERATION = 'ai_generation',
    PROMPT_ONLY = 'prompt_only',
    SMART_EDITOR = 'smart_editor',
}

// 视觉风格枚举
export enum VisualStyle {
    CCTV = 'cctv',
    NIGHT_VISION = 'night_vision',
    DAYLIGHT = 'daylight',
    VHS_RETRO = 'vhs_retro',
    DOCUMENTARY_NATURE = 'documentary_nature',
    SCI_FI_HOLOGRAM = 'sci_fi_hologram',
    VIRAL = 'viral',
}

// 宽高比枚举
export enum AspectRatio {
    VERTICAL = '9:16',
    HORIZONTAL = '16:9',
    SQUARE = '1:1',
}

// Hook类型枚举
export enum HookType {
    TIME_BASED = 'time_based',
    VISUAL_CUE = 'visual_cue',
}

// 编辑动作类型
export enum EditActionType {
    ADD_TEXT = 'ADD_TEXT',
    CUT = 'CUT',
    TRIM = 'trim',
    CROP = 'crop',
    FILTER = 'filter',
    OVERLAY = 'overlay',
    IMAGE = 'image',
    TEXT = 'text',
}

// 表单输入接口
export interface FormInput {
    // 基础配置
    prompt: string;
    duration: number;
    aspectRatio: AspectRatio;
    style: VisualStyle[];
    generationMode: GenerationMode;
    engine: VideoEngine;

    // 内容配置
    thumbnailTitle: string;
    externalHookText: string;
    embeddedHookText: string;
    editingInstructions: string;
    hookType: HookType;

    // 引擎特定配置
    gmicloudModel: string;
    gmicloudApiKey: string;
    gmicloudBaseUrl?: string;
    geminigenApiKey: string;
    geminigenBaseUrl?: string;
    geminigenModel?: string;

    // 高级配置
    processAudio: boolean;
    videoTitle?: string;
    keywords?: string;
    niche?: string;
    videoDescription?: string;
    targetAudience?: string;
    videoType?: string;
    topic?: string;
    imitateUrl?: string;
}

// 营销文案接口
export interface MarketingCopy {
    title: string | null;
    description: string | null;
    tags: string[];
    comment1: { type: string; content: string | null };
    comment2: { type: string; content: string | null };
}

// 病毒式传播分析接口
export interface ViralityAnalysis {
    score: number;
    grade?: string;
    status?: 'Low' | 'Medium' | 'High' | 'Viral';
    metrics?: {
        playCount: number;
        ctr: number;
        retention: number;
    };
    advice?: {
        recommendedTimes: string[];
        publishingSchedule: string;
        thumbnailAdvice: string;
        ctaAdvice: string;
    };
    insights?: string[];
    thumbnailPrompts?: string[];
    recommendedTimes?: string[];
    publishingSchedule?: string;
}

// 输出数据接口
export interface OutputData {
    videoUrl: string;
    thumbnailUrl: string | null;
    marketingCopy: MarketingCopy;
    fullPrompt: string | null;
    aspectRatio: string;
    viralityAnalysis: ViralityAnalysis | null;
    thumbnailPrompts?: string[];
}

// 编辑动作接口
export interface EditAction {
    type: EditActionType;
    startTime: number;
    endTime: number;
    text?: string;
    position?: 'top' | 'center' | 'bottom';
    x?: number; // Percentage 0-100
    y?: number; // Percentage 0-100
    scale?: number; // Scale factor, default 1
    params?: any;
}

// AI编辑计划数据接口
export interface AiEditPlanData {
    displayPlan: string;
    actions: EditAction[];
    aspectRatio?: string;
    model?: string;
}

// AI编辑计划接口
export interface AiEditPlan {
    plan: AiEditPlanData | null;
    isProcessing: boolean;
}

// 转录项接口
export interface TranscriptItem {
    start: number;
    end: number;
    text: string;
}

export interface ShortsData {
    id: string;
    title: string;
    description?: string;
    thumbnail: string;
    visibility: string;
    date: string;
    views: string;
    comments: string;
    likes: string;
    restrictions: string;
}

export interface ICommentData {
    id: string;
    author: string;
    comment: string;
    date: string;
    isReplied: boolean;
    sentiment: 'positive' | 'negative' | 'neutral';
}

export interface INotification {
    id: string;
    type: 'alert' | 'info' | 'warning' | 'success';
    message: string;
    timestamp: Date;
    read: boolean;
}

// YouTube分析数据接口
export interface YouTubeAnalyticsData {
    [category: string]: any; // AnalyticsResult类型，后续统一
}

// 加载进度接口
export interface LoadingProgress {
    percentage: number;
    messageKey: string;
    messageParams?: any;
}

// 时间线属性接口
export interface TimelineProps {
    transcript: TranscriptItem[];
    isTranscribing: boolean;
    duration: number;
    currentTime: number;
    isPlaying: boolean;
    activeTranscriptIndex: number;
    appliedActions: EditAction[];
    selectedActionIndex: number;
    onSeek: (time: number) => void;
    onPlayPause: () => void;
    onActionSelect: (index: number) => void;
    onActionUpdate: (index: number, action: EditAction) => void;
    onActionDelete: (index: number) => void;
    onActionAdd: (action: EditAction) => void;
}

// 声音类型
export type SoundType = 'critical' | 'warning' | 'success' | 'viral' | 'milestone' | 'action' | 'error' | 'schedule' | 'info';

// YPP计划类型
export type YppPlanType = any; // 后续细化

export type PlanItemType = any; // 后续细化

export type PromptBlockType = any; // 后续细化

export type QualityCheckType = any; // 后续细化

export type VideoPlatformType = any; // 后续细化

// GMICloud模型信息接口
export interface GmicloudModelInfo {
    id: string;
    name: string;
    description?: string;
}
