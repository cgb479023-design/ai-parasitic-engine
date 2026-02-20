/**
 * 健壮的JSON解析工具函数，用于处理各种复杂的JSON解析场景
 * 特别适用于Fast Collect功能中的JSON解析需求
 *
 * @param jsonStr 需要解析的JSON字符串
 * @param options 解析选项
 * @returns 解析后的JSON对象或默认值
 */
export const safeJsonParse = (jsonStr: string | any, options?: {
  fallback?: any,
  context?: string
}): any => {
  // If input is already an object, return it directly
  if (typeof jsonStr === 'object' && jsonStr !== null) {
    return jsonStr;
  }

  // If input is not a string, return fallback
  if (typeof jsonStr !== 'string') {
    return options?.fallback ?? null;
  }

  const { fallback = null, context = '' } = options || {};
  const originalJson = jsonStr.trim();

  // If input is an empty string, return fallback
  if (originalJson === '') {
    return fallback;
  }

  try {
    let cleanedJson = originalJson;

    // 1. Remove markdown code blocks
    const codeBlockMatch = cleanedJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      cleanedJson = codeBlockMatch[1].trim();
    }

    // 2. Remove BOM (Byte Order Mark)
    if (cleanedJson.startsWith('\uFEFF')) {
      cleanedJson = cleanedJson.slice(1);
    }

    // 3. Handle control characters
    cleanedJson = handleControlCharacters(cleanedJson);

    // 4. Attempt to fix common JSON syntax errors
    cleanedJson = fixJsonSyntax(cleanedJson);

    // 5. Try to parse directly
    try {
      return JSON.parse(cleanedJson);
    } catch (e) {
      // If direct parsing fails, attempt to extract the outermost JSON object
      const jsonMatch = cleanedJson.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const extractedJson = jsonMatch[0];
        try {
          return JSON.parse(extractedJson);
        } catch (extractedError) {
          if (context.includes('Fast Collect') ||
              originalJson.includes('yppSprint') ||
              originalJson.includes('channelOverview') ||
              originalJson.includes('retention')) {
            return {
              "yppSprint": { "progress": 0 },
              "channelOverview": { "views": 0 },
              "retention": { "rate": 0 },
              "velocity": { "viewsPerHour": 0 },
              "videoPerformance": { "topVideos": [] },
              "audience": { "demographics": {} },
              "traffic": { "sources": [] },
              "engagement": { "comments": 0 },
              "comments": { "topComments": [] },
              "rewatch": { "ratio": 0 },
              "swipeAway": { "rate": 0 },
              "subsConversion": { "rate": 0 },
              "sessionTime": { "average": 0 }
            };
          }
          // Re-throw if not a Fast Collect scenario and extraction failed
          throw extractedError;
        }
      }
      // Re-throw original parse error if no match or extraction failed
      throw e;
    }
  } catch (e) {
    // For Fast Collect scenarios, return a default result object on any failure
    const isFastCollect = context.includes('Fast Collect') ||
                          originalJson.includes('yppSprint') ||
                          originalJson.includes('channelOverview') ||
                          originalJson.includes('retention');

    if (isFastCollect) {
      return {
        "yppSprint": { "progress": 0 },
        "channelOverview": { "views": 0 },
        "retention": { "rate": 0 },
        "velocity": { "viewsPerHour": 0 },
        "videoPerformance": { "topVideos": [] },
        "audience": { "demographics": {} },
        "traffic": { "sources": [] },
        "engagement": { "comments": 0 },
        "comments": { "topComments": [] },
        "rewatch": { "ratio": 0 },
        "swipeAway": { "rate": 0 },
        "subsConversion": { "rate": 0 },
        "sessionTime": { "average": 0 }
      };
    }

    return fallback;
  }
};

/**
 * Attempts to fix common JSON syntax errors.
 * @param jsonStr The string to fix.
 * @returns The fixed string.
 */
const fixJsonSyntax = (jsonStr: string): string => {
  let fixedJson = jsonStr;

  // Replace single quotes with double quotes for property names and string values
  fixedJson = fixedJson.replace(/'([^']+)'/g, '"$1"');

  // Add double quotes to unquoted property names
  fixedJson = fixedJson.replace(/([{,]\s*)([a-zA-Z0-9_$]+?)\s*:/g, '$1"$2":');

  // Remove trailing commas in objects and arrays
  fixedJson = fixedJson.replace(/,\s*([}\]])/g, '$1');

  return fixedJson;
};


/**
 * Handles control characters in a string by escaping them.
 * @param str The string to process.
 * @returns The string with control characters escaped.
 */
const handleControlCharacters = (str: string): string => {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const code = char.charCodeAt(0);

    // Handle control characters
    if (code < 32 || code === 127) {
      switch (char) {
        case '\b': result += '\\b'; break;
        case '\t': result += '\\t'; break;
        case '\n': result += '\\n'; break;
        case '\v': result += '\\v'; break;
        case '\f': result += '\\f'; break;
        case '\r': result += '\\r'; break;
        default: result += ''; break; // Remove other non-printable control characters
      }
    } else {
      result += char;
    }
  }
  return result;
};

/**
 * 检查字符串是否为有效的JSON格式。
 * @param jsonStr 需要检查的字符串。
 * @returns 如果是有效的JSON，则返回true，否则返回false。
 */
export const isValidJson = (jsonStr: string): boolean => {
  if (typeof jsonStr !== 'string') {
    return false;
  }
  try {
    JSON.parse(jsonStr);
  } catch {
    return false;
  }
  return true;
};
