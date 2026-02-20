/**
 * Enhanced Parser Service
 * 
 * Provides robust JSON parsing with automatic retry and fallback strategies.
 * Handles Ask Studio AI responses with comprehensive error recovery.
 * 
 * @module services/enhancedParserService
 * @version 1.0.0
 * @date 2026-01-13
 */

interface ParseResult {
  success: boolean;
  data: any;
  rawJson: string;
  method: string;
  error?: string;
  attempt?: number; // Optional: only set in final result
}

interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  delayMs: 1000,
  backoffMultiplier: 2
};

/**
 * JSON Parser with automatic retry and multiple fallback strategies.
 * 
 * @param {string} text - Text containing JSON to extract
 * @param {RetryOptions} options - Retry configuration
 * @returns {Promise<ParseResult>} Parse result with retry information
 * 
 * @example
 * const result = await parseWithRetry(responseText);
 * if (result.success) {
 *   console.log('Parsed after', result.attempt, 'attempts');
 * }
 */
export async function parseWithRetry(text: string, options: RetryOptions = {}): Promise<ParseResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;

  console.log(`🔄 [EnhancedParser] Starting parse with ${opts.maxAttempts} max attempts`);

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      const result = parseWithStrategies(text);
      
      if (result.success) {
        console.log(`✅ [EnhancedParser] Parse succeeded on attempt ${attempt}/${opts.maxAttempts} using strategy: ${result.method}`);
        return { ...result, attempt };
      }
      
      lastError = new Error(result.error || 'Unknown parse error');
      
      // If this wasn't the last attempt, wait before retrying
      if (attempt < opts.maxAttempts) {
        const delay = opts.delayMs! * Math.pow(opts.backoffMultiplier!, attempt - 1);
        console.log(`⏳ [EnhancedParser] Attempt ${attempt} failed (${result.error}), retrying in ${delay}ms...`);
        await sleep(delay);
      }
    } catch (e) {
      lastError = e as Error;
      console.warn(`⚠️ [EnhancedParser] Attempt ${attempt} threw exception:`, e);
      
      if (attempt < opts.maxAttempts) {
        const delay = opts.delayMs! * Math.pow(opts.backoffMultiplier!, attempt - 1);
        await sleep(delay);
      }
    }
  }

  // All attempts failed - return comprehensive error
  return {
    success: false,
    data: null,
    rawJson: '',
    method: 'all-failed',
    error: lastError?.message || 'All parse attempts failed',
    attempt: opts.maxAttempts!
  };
}

/**
 * Try multiple JSON extraction strategies in sequence.
 * 
 * @param {string} text - Text to parse
 * @returns {ParseResult} Parse result
 */
function parseWithStrategies(text: string): ParseResult {
  if (!text || typeof text !== 'string') {
    return { success: false, data: null, rawJson: '', method: 'none', error: 'Empty or invalid input', attempt: 0 };
  }

  console.log(`🔍 [EnhancedParser] Processing ${text.length} characters`);

  // Strategy 1: Direct JSON parse
  const directResult = tryDirectParse(text);
  if (directResult.success) return { ...directResult, attempt: 0 };

  // Strategy 2: Code block extraction
  const codeBlockResult = tryCodeBlockExtraction(text);
  if (codeBlockResult.success) return { ...codeBlockResult, attempt: 0 };

  // Strategy 3: Outermost braces
  const bracesResult = tryOutermostBraces(text);
  if (bracesResult.success) return { ...bracesResult, attempt: 0 };

  // Strategy 4: Array extraction
  const arrayResult = tryArrayExtraction(text);
  if (arrayResult.success) return { ...arrayResult, attempt: 0 };

  // Strategy 5: Aggressive cleanup
  const cleanupResult = tryCleanupExtraction(text);
  if (cleanupResult.success) return { ...cleanupResult, attempt: 0 };

  // Strategy 6: Partial extraction (try to extract what we can)
  const partialResult = tryPartialExtraction(text);
  if (partialResult.success) return { ...partialResult, attempt: 0 };

  return {
    success: false,
    data: null,
    rawJson: '',
    method: 'all-failed',
    error: 'Could not extract valid JSON using any strategy',
    attempt: 0
  };
}

/**
 * Strategy 1: Direct JSON parse
 */
function tryDirectParse(text: string): ParseResult {
  try {
    const parsed = JSON.parse(text.trim());
    return { success: true, data: parsed, rawJson: text.trim(), method: 'direct' };
  } catch (e) {
    return { success: false, data: null, rawJson: '', method: 'direct-failed', error: (e as Error).message };
  }
}

/**
 * Strategy 2: Extract from markdown code block
 */
function tryCodeBlockExtraction(text: string): ParseResult {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    try {
      const jsonStr = codeBlockMatch[1].trim();
      const parsed = JSON.parse(jsonStr);
      return { success: true, data: parsed, rawJson: jsonStr, method: 'codeblock' };
    } catch (e) {
      return { success: false, data: null, rawJson: '', method: 'codeblock-failed', error: (e as Error).message };
    }
  }
  return { success: false, data: null, rawJson: '', method: 'codeblock-notfound', error: 'No code block found' };
}

/**
 * Strategy 3: Extract outermost braces
 */
function tryOutermostBraces(text: string): ParseResult {
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
    
    // Try parsing as-is
    try {
      const parsed = JSON.parse(jsonStr);
      return { success: true, data: parsed, rawJson: jsonStr, method: 'outermost-braces' };
    } catch (e) {
      // Try fixing common issues
      const fixed = fixCommonJsonIssues(jsonStr);
      try {
        const parsed = JSON.parse(fixed);
        return { success: true, data: parsed, rawJson: fixed, method: 'outermost-fixed' };
      } catch (e2) {
        return { success: false, data: null, rawJson: '', method: 'outermost-failed', error: (e2 as Error).message };
      }
    }
  }

  return { success: false, data: null, rawJson: '', method: 'outermost-notfound', error: 'No braces found' };
}

/**
 * Strategy 4: Extract array
 */
function tryArrayExtraction(text: string): ParseResult {
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
        return { success: true, data: parsed, rawJson: jsonStr, method: 'array' };
      }
    } catch (e) {
      return { success: false, data: null, rawJson: '', method: 'array-failed', error: (e as Error).message };
    }
  }

  return { success: false, data: null, rawJson: '', method: 'array-notfound', error: 'No valid array found' };
}

/**
 * Strategy 5: Aggressive cleanup
 */
function tryCleanupExtraction(text: string): ParseResult {
  const cleaned = text
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .replace(/^\s*Here['']s your.*?:\s*/i, '')
    .replace(/^\s*Based on.*?:\s*/i, '')
    .trim();

  return tryOutermostBraces(cleaned);
}

/**
 * Strategy 6: Partial extraction (try to extract key-value pairs)
 */
function tryPartialExtraction(text: string): ParseResult {
  // Try to extract structured data even if JSON is malformed
  const partial: any = {};

  // Extract title
  const titleMatch = text.match(/["']title["']\s*:\s*["']([^"']+)["']/i);
  if (titleMatch) partial.title = titleMatch[1];

  // Extract schedule array (if exists)
  const scheduleMatch = text.match(/["']schedule["']\s*:\s*\[([\s\S]*?)\]/i);
  if (scheduleMatch) {
    try {
      partial.schedule = JSON.parse(`[${scheduleMatch[1]}]`);
    } catch (e) {
      partial.schedule = [];
    }
  }

  // Extract pillar values from text
  const pillarMatches = text.match(/pillar["']?\s*[:=]\s*["']?([^"'\n,]+)["']?/gi);
  if (pillarMatches) {
    partial.pillars = pillarMatches.map(m => m.replace(/pillar["']?\s*[:=]\s*["']?/, '').trim());
  }

  if (Object.keys(partial).length > 0) {
    console.log('⚠️ [EnhancedParser] Partial extraction succeeded:', Object.keys(partial));
    return { success: true, data: partial, rawJson: JSON.stringify(partial), method: 'partial' };
  }

  return { success: false, data: null, rawJson: '', method: 'partial-failed', error: 'No partial data found' };
}

/**
 * Fixes common JSON formatting issues.
 */
function fixCommonJsonIssues(jsonStr: string): string {
  let fixed = jsonStr;

  // Fix trailing commas
  fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

  // Fix single quotes (if no double quotes)
  if (!fixed.includes('"') && fixed.includes("'")) {
    fixed = fixed.replace(/'/g, '"');
  }

  // Fix unquoted keys
  fixed = fixed.replace(/(\{|\,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

  // Fix missing commas between properties
  fixed = fixed.replace(/(")\s*\n\s*(")/g, '$1,\n$2');
  fixed = fixed.replace(/(\})\s*\n\s*(\{)/g, '$1,\n$2');

  // Fix missing commas after values
  fixed = fixed.replace(/("[^"]*")\s*\n\s*("[^"]+"\s*:)/g, '$1,\n$2');
  fixed = fixed.replace(/(\d+)\s*\n\s*("[^"]+"\s*:)/g, '$1,\n$2');
  fixed = fixed.replace(/(true|false|null)\s*\n\s*("[^"]+"\s*:)/gi, '$1,\n$2');

  // Fix missing commas after closing braces
  fixed = fixed.replace(/([}\]])\s*\n\s*("[^"]+"\s*:)/g, '$1,\n$2');

  // Fix inline missing commas
  fixed = fixed.replace(/("[^"]*")\s{2,}("[^"]+"\s*:)/g, '$1, $2');

  // Fix missing comma between items
  fixed = fixed.replace(/(\})\s+(\{)/g, '$1, $2');
  fixed = fixed.replace(/(\])\s+(\[)/g, '$1, $2');

  // Remove zero-width characters
  fixed = fixed.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // Fix double colons
  fixed = fixed.replace(/::/g, ':');

  // Fix unterminated strings
  const openQuotes = (fixed.match(/"/g) || []).length;
  if (openQuotes % 2 !== 0) {
    fixed = fixed.replace(/("[^"]*)\n\s*}/g, '$1"\n}');
    fixed = fixed.replace(/("[^"]*)\n\s*]/g, '$1"\n]');
  }

  return fixed;
}

/**
 * Sleep utility for retry delays.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validate extracted plan structure.
 */
export function validatePlanStructure(data: any): { valid: boolean; error: string; itemCount?: number } {
  if (!data) {
    return { valid: false, error: 'Data is null or undefined' };
  }

  // Find schedule array
  let schedule: any[] | null = null;
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
 * Parse with automatic retry and validation.
 */
export async function parsePlanWithRetry(text: string, options: RetryOptions = {}): Promise<any> {
  const parseResult = await parseWithRetry(text, options);

  if (!parseResult.success) {
    throw new Error(`Failed to parse plan: ${parseResult.error}`);
  }

  const validation = validatePlanStructure(parseResult.data);

  if (!validation.valid) {
    throw new Error(`Invalid plan structure: ${validation.error}`);
  }

  return parseResult.data;
}
