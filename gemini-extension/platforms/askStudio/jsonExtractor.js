/**
 * JSON Extractor Module
 * 
 * Extracts JSON objects from Ask Studio AI responses.
 * Handles various JSON formats, incomplete responses, and edge cases.
 * 
 * @module platforms/askStudio/jsonExtractor
 * @version 1.0.0
 * @date 2025-12-26
 */

/**
 * Extraction result interface
 */
const ExtractionResult = {
    success: false,
    data: null,
    rawJson: '',
    method: '',
    error: ''
};

/**
 * Extracts JSON from a text response using multiple strategies.
 * 
 * @param {string} text - Raw text from Ask Studio response
 * @returns {{success: boolean, data: any, rawJson: string, method: string, error: string}}
 * 
 * @example
 * const result = extractJsonFromText('Here\'s your plan: {"schedule": [...]}');
 * if (result.success) {
 *     console.log(result.data.schedule);
 * }
 */
function extractJsonFromText(text) {
    if (!text || typeof text !== 'string') {
        return { success: false, data: null, rawJson: '', method: 'none', error: 'Empty or invalid input' };
    }

    console.log(`🔍 [JsonExtractor] Processing ${text.length} characters`);

    // Strategy 1: Try direct JSON parse (if response is pure JSON)
    try {
        const parsed = JSON.parse(text.trim());
        console.log('✅ [JsonExtractor] Strategy 1: Direct parse succeeded');
        return { success: true, data: parsed, rawJson: text.trim(), method: 'direct', error: '' };
    } catch (e) {
        // Continue to other strategies
    }

    // Strategy 2: Extract JSON from markdown code block
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
        try {
            const jsonStr = codeBlockMatch[1].trim();
            const parsed = JSON.parse(jsonStr);
            console.log('✅ [JsonExtractor] Strategy 2: Code block extraction succeeded');
            return { success: true, data: parsed, rawJson: jsonStr, method: 'codeblock', error: '' };
        } catch (e) {
            console.warn('⚠️ [JsonExtractor] Code block found but invalid JSON');
        }
    }

    // Strategy 3: Find outermost braces
    const result = extractOutermostJson(text);
    if (result.success) {
        console.log('✅ [JsonExtractor] Strategy 3: Outermost braces succeeded');
        return result;
    }

    // Strategy 4: Find array (for schedule-only responses)
    const arrayResult = extractOutermostArray(text);
    if (arrayResult.success) {
        console.log('✅ [JsonExtractor] Strategy 4: Array extraction succeeded');
        // Wrap in schedule object
        return {
            success: true,
            data: { schedule: arrayResult.data },
            rawJson: arrayResult.rawJson,
            method: 'array-wrapped',
            error: ''
        };
    }

    // Strategy 5: Aggressive cleanup and retry
    const cleanedResult = extractWithCleanup(text);
    if (cleanedResult.success) {
        console.log('✅ [JsonExtractor] Strategy 5: Cleaned extraction succeeded');
        return cleanedResult;
    }

    console.error('❌ [JsonExtractor] All strategies failed');
    return { success: false, data: null, rawJson: '', method: 'none', error: 'Could not extract valid JSON' };
}

/**
 * Extracts JSON using outermost brace matching.
 */
function extractOutermostJson(text) {
    let depth = 0;
    let start = -1;
    let end = -1;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (char === '{') {
            if (depth === 0) start = i;
            depth++;
        } else if (char === '}') {
            depth--;
            if (depth === 0 && start !== -1) {
                end = i;
                break;
            }
        }
    }

    if (start !== -1 && end !== -1) {
        const jsonStr = text.substring(start, end + 1);
        try {
            const parsed = JSON.parse(jsonStr);
            return { success: true, data: parsed, rawJson: jsonStr, method: 'outermost-braces', error: '' };
        } catch (e) {
            // Try fixing common issues
            const fixed = fixCommonJsonIssues(jsonStr);
            try {
                const parsed = JSON.parse(fixed);
                return { success: true, data: parsed, rawJson: fixed, method: 'outermost-fixed', error: '' };
            } catch (e2) {
                return { success: false, data: null, rawJson: jsonStr, method: 'outermost-failed', error: e2.message };
            }
        }
    }

    return { success: false, data: null, rawJson: '', method: 'outermost-notfound', error: 'No JSON object found' };
}

/**
 * Extracts outermost array.
 */
function extractOutermostArray(text) {
    // Check if this looks like a schedule array
    if (!text.includes('pillar') && !text.includes('schedule')) {
        return { success: false, data: null, rawJson: '', method: 'array-skip', error: 'No schedule indicators' };
    }

    let depth = 0;
    let start = -1;
    let end = -1;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (char === '[') {
            if (depth === 0) start = i;
            depth++;
        } else if (char === ']') {
            depth--;
            if (depth === 0 && start !== -1) {
                end = i;
                break;
            }
        }
    }

    if (start !== -1 && end !== -1) {
        const jsonStr = text.substring(start, end + 1);
        try {
            const parsed = JSON.parse(jsonStr);
            if (Array.isArray(parsed)) {
                return { success: true, data: parsed, rawJson: jsonStr, method: 'array', error: '' };
            }
        } catch (e) {
            // Continue
        }
    }

    return { success: false, data: null, rawJson: '', method: 'array-notfound', error: 'No valid array found' };
}

/**
 * Aggressive cleanup and retry parsing.
 */
function extractWithCleanup(text) {
    // Remove markdown artifacts
    let cleaned = text
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .replace(/^\s*Here['']s your.*?:\s*/i, '')
        .replace(/^\s*Based on.*?:\s*/i, '')
        .trim();

    // Try to find JSON after cleanup
    return extractOutermostJson(cleaned);
}

/**
 * Fixes common JSON formatting issues.
 */
function fixCommonJsonIssues(jsonStr) {
    let fixed = jsonStr;

    // Fix trailing commas before closing brackets
    fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

    // Fix single quotes (if used instead of double)
    // Only if no double quotes present
    if (!fixed.includes('"') && fixed.includes("'")) {
        fixed = fixed.replace(/'/g, '"');
    }

    // Fix unquoted keys (basic support)
    fixed = fixed.replace(/(\{|\,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

    // Fix escaped newlines in strings
    fixed = fixed.replace(/\\n/g, '\\n');

    // 🆕 V7.1: Fix missing commas between properties
    fixed = fixed.replace(/(")\s*\n\s*(")/g, '$1,\n$2');
    fixed = fixed.replace(/(\})\s*\n\s*(\{)/g, '$1,\n$2');

    // 🆕 V7.5: Fix missing commas after string values before next key
    // Pattern: "value"\n"nextKey": -> "value",\n"nextKey":
    fixed = fixed.replace(/("[^"]*")\s*\n\s*("[^"]+"\s*:)/g, '$1,\n$2');

    // 🆕 V7.5: Fix missing commas after number values before next key
    // Pattern: 123\n"nextKey": -> 123,\n"nextKey":
    fixed = fixed.replace(/(\d+)\s*\n\s*("[^"]+"\s*:)/g, '$1,\n$2');

    // 🆕 V7.5: Fix missing commas after boolean/null values before next key
    fixed = fixed.replace(/(true|false|null)\s*\n\s*("[^"]+"\s*:)/gi, '$1,\n$2');

    // 🆕 V7.5: Fix missing commas after closing brace/bracket before next key
    // Pattern: }\n"nextKey": -> },\n"nextKey":
    fixed = fixed.replace(/([}\]])\s*\n\s*("[^"]+"\s*:)/g, '$1,\n$2');

    // 🆕 V7.5: Fix inline missing commas (no newline)
    // Pattern: "value"  "nextKey": -> "value", "nextKey":
    fixed = fixed.replace(/("[^"]*")\s{2,}("[^"]+"\s*:)/g, '$1, $2');

    // 🆕 V7.5: Fix missing comma after array item before next item
    // Pattern: }  { -> }, {
    fixed = fixed.replace(/(\})\s+(\{)/g, '$1, $2');
    fixed = fixed.replace(/(\])\s+(\[)/g, '$1, $2');

    // Remove zero-width characters
    fixed = fixed.replace(/[\u200B-\u200D\uFEFF]/g, '');

    // Fix double colons
    fixed = fixed.replace(/::/g, ':');

    // 🆕 V7.5: Fix unterminated strings (try to close them)
    // This is risky, only do if we can detect the pattern clearly
    const openQuotes = (fixed.match(/"/g) || []).length;
    if (openQuotes % 2 !== 0) {
        console.warn('⚠️ [JsonExtractor] Odd number of quotes detected, attempting fix');
        // Try to find and close unterminated string before common delimiters
        fixed = fixed.replace(/("[^"]*)\n\s*}/g, '$1"\n}');
        fixed = fixed.replace(/("[^"]*)\n\s*]/g, '$1"\n]');
    }

    return fixed;
}

/**
 * Validates the extracted plan structure.
 */
function validatePlanStructure(data) {
    if (!data) {
        return { valid: false, error: 'Data is null or undefined' };
    }

    // Check for schedule array
    let schedule = null;
    if (Array.isArray(data)) {
        schedule = data;
    } else if (data.schedule && Array.isArray(data.schedule)) {
        schedule = data.schedule;
    } else if (data.videos && Array.isArray(data.videos)) {
        schedule = data.videos;
    }

    if (!schedule) {
        return { valid: false, error: 'No schedule array found' };
    }

    if (schedule.length === 0) {
        return { valid: false, error: 'Schedule is empty' };
    }

    // Validate first item has required fields
    const firstItem = schedule[0];
    const requiredFields = ['title'];
    const missingFields = requiredFields.filter(f => !firstItem[f]);

    if (missingFields.length > 0) {
        return { valid: false, error: `Missing required fields: ${missingFields.join(', ')}` };
    }

    return { valid: true, error: '', itemCount: schedule.length };
}

/**
 * Complete extraction and validation pipeline.
 */
function extractAndValidatePlan(text) {
    const extraction = extractJsonFromText(text);

    if (!extraction.success) {
        return {
            success: false,
            data: null,
            error: extraction.error,
            method: extraction.method
        };
    }

    const validation = validatePlanStructure(extraction.data);

    if (!validation.valid) {
        return {
            success: false,
            data: extraction.data,
            error: validation.error,
            method: extraction.method + '-invalid-structure'
        };
    }

    return {
        success: true,
        data: extraction.data,
        error: '',
        method: extraction.method,
        itemCount: validation.itemCount
    };
}

// Export for use in other modules
window.JsonExtractor = {
    extractJsonFromText,
    extractOutermostJson,
    extractOutermostArray,
    fixCommonJsonIssues,
    validatePlanStructure,
    extractAndValidatePlan
};

// Also expose main function globally
window.extractJsonFromText = extractJsonFromText;
window.extractAndValidatePlan = extractAndValidatePlan;

console.log('📦 [Module] platforms/askStudio/jsonExtractor.js loaded');
