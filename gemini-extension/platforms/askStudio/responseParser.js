/**
 * Response Parser Module
 * 
 * Parses and normalizes Ask Studio responses into standard plan format.
 * 
 * @module platforms/askStudio/responseParser
 * @version 1.0.0
 * @date 2025-12-26
 */

/**
 * Normalizes algorithm scores from various Ask Studio formats.
 * 
 * @param {Object} scores - Raw algorithm scores object
 * @returns {Object} Normalized scores
 */
function normalizeAlgorithmScores(scores) {
    if (!scores) return null;

    // PIS normalization
    let pis = scores.PIS ?? scores.pis ?? scores.patternInterruptScore ?? null;
    if (pis !== null && typeof pis === 'number' && pis < 15) {
        pis = pis * 10; // Convert 9.5 → 95
    }

    // Parse percentage strings
    const parsePercent = (val) => {
        if (val === null || val === undefined) return null;
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
            const num = parseFloat(val.replace('%', ''));
            return isNaN(num) ? null : num;
        }
        return null;
    };

    // CQ normalization (0-10 → 0-1)
    let cq = scores.controversyQuotient ?? scores.CQ ?? null;
    if (cq !== null && typeof cq === 'number' && cq > 1) {
        cq = cq / 10;
    }

    return {
        patternInterruptScore: pis,
        predictedRetention3s: parsePercent(scores.predictedRetention3s),
        predictedCompletionRate: parsePercent(scores.predictedCompletionRate),
        predictedLoopRate: parsePercent(scores.predictedLoopRate),
        controversyQuotient: cq
    };
}

/**
 * Normalizes tags from various formats.
 * 
 * @param {string|string[]} tags - Tags in string or array format
 * @returns {string[]} Array of tag strings
 */
function normalizeTags(tags) {
    if (!tags) return [];

    if (Array.isArray(tags)) {
        return tags.map(t => String(t).trim()).filter(Boolean);
    }

    if (typeof tags === 'string') {
        return tags.split(',').map(t => t.trim()).filter(Boolean);
    }

    return [];
}

/**
 * Extracts prompt from promptBlock.
 * 
 * @param {string|Object} promptBlock - Prompt block in string or object format
 * @returns {string} Formatted prompt string
 */
function extractPrompt(promptBlock) {
    if (!promptBlock) return '';

    if (typeof promptBlock === 'string') {
        return promptBlock;
    }

    // Object format - extract in narrative order
    const parts = [];
    const fieldPrefixes = ['format', 'HOOK', 'CONTEXT', 'TENSION', 'CHAOS', 'CLIMAX', 'PAYOFF', 'LOOP'];

    for (const prefix of fieldPrefixes) {
        const key = Object.keys(promptBlock).find(k =>
            k.toUpperCase().startsWith(prefix.toUpperCase())
        );

        if (key && promptBlock[key]) {
            const value = promptBlock[key];
            if (typeof value === 'string' && value.trim()) {
                parts.push(value.trim());
            }
        }
    }

    // Fallback: join all values if no known fields
    if (parts.length === 0) {
        Object.values(promptBlock).forEach(val => {
            if (typeof val === 'string' && val.trim()) {
                parts.push(val);
            }
        });
    }

    return parts.join(' ');
}

/**
 * Normalizes a single plan item.
 * 
 * @param {Object} item - Raw plan item from Ask Studio
 * @param {number} index - Item index for ID generation
 * @returns {Object} Normalized plan item
 */
function normalizePlanItem(item, index) {
    return {
        id: item.id || `plan-item-${index}-${Date.now()}`,
        pillar: item.pillar || 'Viral',
        type: item.type || 'Short',
        tool: item.tool || '⚡ Veo',
        duration: item.duration || '7s',
        publishTimeLocal: item.publishTimeLocal || null,
        publishTimeUS: item.publishTimeUS || null,
        title: item.title || `Video ${index + 1}`,
        description: item.description || '',
        tags: normalizeTags(item.tags),
        promptBlock: item.promptBlock || null,
        pinnedComment: item.pinnedComment || '',
        algorithmScores: normalizeAlgorithmScores(item.algorithmScores),

        // Status fields (initialized)
        status: 'pending',
        videoData: null,
        videoUrl: null,
        publishedUrl: null,
        error: null
    };
}

/**
 * Parses and normalizes a complete Ask Studio response.
 * 
 * @param {Object} rawData - Raw extracted JSON data
 * @returns {Object} Normalized plan structure
 */
function parseAskStudioResponse(rawData) {
    if (!rawData) {
        return { success: false, error: 'No data provided', plan: null };
    }

    // Find the schedule array
    let schedule = null;
    if (Array.isArray(rawData)) {
        schedule = rawData;
    } else if (rawData.schedule && Array.isArray(rawData.schedule)) {
        schedule = rawData.schedule;
    } else if (rawData.videos && Array.isArray(rawData.videos)) {
        schedule = rawData.videos;
    } else if (rawData.plan && Array.isArray(rawData.plan)) {
        schedule = rawData.plan;
    }

    if (!schedule || schedule.length === 0) {
        return { success: false, error: 'No schedule array found', plan: null };
    }

    // Normalize each item
    const normalizedSchedule = schedule.map((item, index) => normalizePlanItem(item, index));

    // Build full plan object
    const plan = {
        algorithmStage: rawData.algorithmStage || rawData.stage || 'Unknown',
        stageAnalysis: rawData.stageAnalysis || rawData.analysis || '',
        channelInsights: rawData.channelInsights || null,
        schedule: normalizedSchedule,

        // Metadata
        generatedAt: new Date().toISOString(),
        itemCount: normalizedSchedule.length,
        source: 'Ask Studio'
    };

    return { success: true, error: '', plan };
}

/**
 * Quick validation of plan item for execution.
 * 
 * @param {Object} item - Plan item to validate
 * @returns {{valid: boolean, issues: string[]}}
 */
function validatePlanItemForExecution(item) {
    const issues = [];

    if (!item.title) {
        issues.push('Missing title');
    }

    if (!item.promptBlock && !item.description) {
        issues.push('Missing prompt (no promptBlock or description)');
    }

    if (!item.publishTimeLocal && !item.publishTimeUS) {
        issues.push('Missing publish time');
    }

    return {
        valid: issues.length === 0,
        issues
    };
}

/**
 * Gets execution-ready prompt from plan item.
 * 
 * @param {Object} item - Plan item
 * @returns {string} Complete prompt for video generation
 */
function getExecutionPrompt(item) {
    // Priority: promptBlock > description > title
    let prompt = extractPrompt(item.promptBlock);

    // Check if prompt is too short or only format info
    const MIN_LENGTH = 50;
    if (prompt.length < MIN_LENGTH) {
        const parts = [];

        if (item.description) parts.push(item.description);
        if (item.title) parts.push(`Title: ${item.title}`);
        if (prompt) parts.push(prompt);

        prompt = parts.join('. ');
    }

    // Add cinematic markers if not present
    if (!prompt.toLowerCase().includes('cinematic') && !prompt.toLowerCase().includes('4k')) {
        prompt += ' Cinematic quality, 4K, high contrast.';
    }

    return prompt.trim();
}

// Export for use in other modules
window.ResponseParser = {
    normalizeAlgorithmScores,
    normalizeTags,
    extractPrompt,
    normalizePlanItem,
    parseAskStudioResponse,
    validatePlanItemForExecution,
    getExecutionPrompt
};

// Also expose main functions globally
window.parseAskStudioResponse = parseAskStudioResponse;
window.getExecutionPrompt = getExecutionPrompt;

console.log('📦 [Module] platforms/askStudio/responseParser.js loaded');
