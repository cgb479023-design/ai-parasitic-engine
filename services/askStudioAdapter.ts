/**
 * Ask Studio 数据适配器
 * 
 * 用于将 Ask Studio 返回的 JSON 数据适配到 React 应用期望的数据结构
 * 
 * @module services/askStudioAdapter
 * @version 2.0.0
 * @date 2026-01-31
 */

export interface YPPPlan {
    algorithmStage: {
        current_stage: string;
        priority_metrics: string[];
        strategy: string;
    };
    schedule: VideoScheduleItem[];
    insights: {
        viral_signals: string[];
        optimization_tips: string[];
    };
    stageAnalysis?: string;
}

export interface VideoScheduleItem {
    id: string;
    title: string;
    promptBlock: string | {
        mainPrompt: string;
        styleGuide?: string;
        technicalSpecs?: string;
    };
    publishTimeLocal: string;
    publishTimeUS?: string;
    status: 'pending' | 'in-progress' | 'completed' | 'failed';
    tags?: string[];
    description?: string;
    pinnedComment?: string;
    comments?: string[];
    // Ask Studio V7.0 新增字段
    pillar?: string;
    type?: string;
    tool?: string;
    duration?: string;
}

/**
 * 适配 Ask Studio 响应到 React 期望的数据结构
 */
export const adaptAskStudioResponse = (rawResponse: any): YPPPlan => {
    console.log('🔄 [Adapter] Starting adaptation...');
    console.log('🔄 [Adapter] Raw response keys:', Object.keys(rawResponse));
    
    // 1️⃣ 适配 algorithmStage
    let algorithmStage: any;
    if (typeof rawResponse.algorithmStage === 'string') {
        console.log('🔄 [Adapter] Converting algorithmStage from string to object');
        algorithmStage = {
            current_stage: rawResponse.algorithmStage,
            priority_metrics: extractMetricsFromString(rawResponse.algorithmStage),
            strategy: rawResponse.stageAnalysis || ''
        };
    } else if (typeof rawResponse.algorithmStage === 'object' && rawResponse.algorithmStage !== null) {
        console.log('🔄 [Adapter] algorithmStage is already an object');
        algorithmStage = {
            current_stage: rawResponse.algorithmStage.current_stage || 'Unknown',
            priority_metrics: rawResponse.algorithmStage.priority_metrics || [],
            strategy: rawResponse.algorithmStage.strategy || ''
        };
    } else {
        console.warn('⚠️ [Adapter] algorithmStage is missing or invalid, using default');
        algorithmStage = {
            current_stage: 'Unknown',
            priority_metrics: [],
            strategy: ''
        };
    }
    
    // 2️⃣ 适配 schedule 数组
    const schedule = (rawResponse.schedule || []).map((item: any, index: number) => {
        console.log(`🔄 [Adapter] Processing video ${index + 1}:`, item.title);
        
        // 生成唯一 ID
        const id = item.id || `video_${Date.now()}_${index}`;
        
        // 适配 promptBlock
        let promptBlock: any;
        if (typeof item.promptBlock === 'string') {
            // 保持字符串格式（Ask Studio V7.0 使用字符串）
            promptBlock = item.promptBlock;
            console.log(`  ✅ promptBlock is string (${item.promptBlock.length} chars)`);
        } else if (typeof item.promptBlock === 'object' && item.promptBlock !== null) {
            // 已经是对象格式
            promptBlock = item.promptBlock;
            console.log(`  ✅ promptBlock is object`);
        } else {
            // 缺失或无效
            console.warn(`  ⚠️ promptBlock is missing for video ${index + 1}`);
            promptBlock = 'No prompt available';
        }
        
        // 适配发布时间
        const publishTimeLocal = item.publishTimeLocal || item.publishTimeUS || new Date().toISOString();
        
        // 解析标签
        const tags = parseTagsField(item.tags);
        
        // 保留所有原始字段 + 添加必需字段
        return {
            ...item,                        // 保留原始字段（pillar, type, tool, duration 等）
            id,                             // 添加 ID
            title: item.title || `Untitled Video ${index + 1}`,
            promptBlock,                    // 适配后的 promptBlock
            publishTimeLocal,               // 标准化时间
            status: item.status || 'pending',
            tags,
            description: item.description || '',
            pinnedComment: item.pinnedComment || '',
            comments: item.comments || []
        };
    });
    
    console.log(`🔄 [Adapter] Processed ${schedule.length} videos`);
    
    // 3️⃣ 适配 insights
    const insights = rawResponse.insights || {
        viral_signals: [],
        optimization_tips: []
    };
    
    // 4️⃣ 构建最终对象
    const adaptedPlan: YPPPlan = {
        algorithmStage,
        schedule,
        insights,
        stageAnalysis: rawResponse.stageAnalysis
    };
    
    console.log('✅ [Adapter] Adaptation complete:', {
        scheduleLength: schedule.length,
        algorithmStage: algorithmStage.current_stage,
        hasInsights: !!insights.viral_signals?.length
    });
    
    return adaptedPlan;
};

/**
 * 从字符串中提取指标关键词
 */
const extractMetricsFromString = (text: string): string[] => {
    const metrics: string[] = [];
    const keywords = [
        'Viewer-Rate', 'Loop-Rate', 'APV', 'Retention', 
        'CTR', 'Engagement', 'Watch Time', 'Velocity',
        'Views', 'Subscribers', 'Comments', 'Likes'
    ];
    
    keywords.forEach(keyword => {
        if (text.toLowerCase().includes(keyword.toLowerCase())) {
            metrics.push(keyword);
        }
    });
    
    return metrics.length > 0 ? metrics : ['views', 'retention'];
};

/**
 * 解析标签字段（支持字符串和数组）
 */
const parseTagsField = (tags: any): string[] => {
    if (Array.isArray(tags)) {
        return tags;
    }
    if (typeof tags === 'string') {
        // 支持逗号分隔和空格分隔
        return tags.split(/[,\s]+/).map(tag => tag.trim()).filter(Boolean);
    }
    return [];
};

/**
 * 验证计划结构
 */
export const validatePlanStructure = (plan: any): boolean => {
    console.log('🔍 [Validator] Starting validation...');
    
    if (!plan) {
        console.error('❌ [Validator] Plan is null or undefined');
        return false;
    }
    
    if (!plan.algorithmStage) {
        console.error('❌ [Validator] Missing algorithmStage');
        return false;
    }
    
    if (!plan.algorithmStage.current_stage) {
        console.error('❌ [Validator] algorithmStage.current_stage is missing');
        return false;
    }
    
    if (!Array.isArray(plan.schedule)) {
        console.error('❌ [Validator] schedule is not an array');
        return false;
    }
    
    if (plan.schedule.length === 0) {
        console.warn('⚠️ [Validator] schedule is empty');
        return false;
    }
    
    // 验证每个视频项
    for (let i = 0; i < plan.schedule.length; i++) {
        const item = plan.schedule[i];
        
        if (!item.title) {
            console.error(`❌ [Validator] Video ${i + 1} missing title`);
            return false;
        }
        
        if (!item.promptBlock) {
            console.error(`❌ [Validator] Video ${i + 1} missing promptBlock`);
            return false;
        }
        
        if (!item.publishTimeLocal) {
            console.warn(`⚠️ [Validator] Video ${i + 1} missing publishTimeLocal`);
            // 不阻止验证，只是警告
        }
        
        if (!item.id) {
            console.warn(`⚠️ [Validator] Video ${i + 1} missing id`);
            // 不阻止验证，只是警告
        }
    }
    
    console.log('✅ [Validator] Plan structure is valid');
    return true;
};

/**
 * 数据清洗（移除无效字段、标准化格式）
 */
export const sanitizePlanData = (plan: YPPPlan): YPPPlan => {
    console.log('🧹 [Sanitizer] Starting sanitization...');
    
    return {
        ...plan,
        schedule: plan.schedule.map(item => ({
            ...item,
            // 清理标题（保留 emoji 和特殊字符，只移除控制字符）
            title: item.title.replace(/[\x00-\x1F\x7F]/g, '').trim(),
            // 确保状态有效
            status: ['pending', 'in-progress', 'completed', 'failed'].includes(item.status) 
                ? item.status 
                : 'pending',
            // 清理标签（移除空标签）
            tags: (item.tags || []).filter(tag => tag && tag.trim().length > 0),
            // 清理描述（移除多余空格）
            description: (item.description || '').replace(/\s+/g, ' ').trim()
        }))
    };
};

/**
 * 导出所有工具函数
 */
export default {
    adaptAskStudioResponse,
    validatePlanStructure,
    sanitizePlanData,
    extractMetricsFromString,
    parseTagsField
};
