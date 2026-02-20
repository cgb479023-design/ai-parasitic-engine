import { DFLState, DFLMetrics } from '../types';

// Load saved DFL state from localStorage
export const loadSavedDFLState = (): DFLState => {
    try {
        const saved = localStorage.getItem('dflState');
        if (saved) {
            const parsed = JSON.parse(saved);
            // Convert date strings back to Date objects
            if (parsed.lastLearningCycle) {
                parsed.lastLearningCycle = new Date(parsed.lastLearningCycle);
            }
            console.log('📊 [DFL] Loaded saved state from localStorage');
            return parsed;
        }
    } catch (e) {
        console.warn('⚠️ [DFL] Failed to load saved state:', e);
    }
    return {
        isActive: true, // 🚀 YPP SPRINT: Default to ACTIVE for 24/7 unattended operation
        learningPhase: 'idle',
        lastLearningCycle: null,
        topPerformers: [],
        bestTitlePatterns: [],
        viralTriggers: [],
        algorithmScore: 0,
        feedActivation: false,
        interventionsEnabled: true, // 🚀 YPP SPRINT: Enable by default
        autoCommentEnabled: true,   // 🚀 YPP SPRINT: Enable by default
        dynamicScheduleEnabled: true, // 🚀 YPP SPRINT: Enable by default
        handledViralEvents: [],
        // 🆕 Default Channel Identity - Mark Bobl | Digital Forensics Trailer
        channelIdentity: {
            niche: 'Digital Forensics & Viral Case Analysis',
            protagonist: 'Forensic Analyst / Digital Detective',
            style: 'Bizarre Internet Cases with Dramatic Reveals',
            audience: 'Mystery-lovers, True Crime fans, Gen Z & Millennials',
            signature: 'FORENSIC_REVEAL',
            bannedTopics: ['politics', 'religion', 'graphic violence'],
            preferredTags: ['#Shorts', '#Viral', '#Mystery', '#Internet', '#Forensics', '#Bizarre']
        },
        learnedPatterns: undefined
    };
};

export const loadSavedDFLMetrics = (): DFLMetrics => {
    try {
        const saved = localStorage.getItem('dflMetrics');
        if (saved) {
            console.log('📊 [DFL] Loaded saved metrics from localStorage');
            return JSON.parse(saved);
        }
    } catch (e) {
        console.warn('⚠️ [DFL] Failed to load saved metrics:', e);
    }
    return {
        firstHourVelocity: 0,
        swipeAwayRate: 0,
        rewatchRatio: 0,
        subsConversion: 0,
        sessionContribution: 0,
        retentionAt3s: 0,
        viralPotential: 0
    };
};
