/**
 * Logger Utility
 * 
 * Provides consistent logging with prefixes, timestamps, and log levels.
 * 
 * @module utils/logger
 * @version 1.0.0
 * @date 2025-12-26
 */

/**
 * Log levels
 */
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 99
};

/**
 * Current log level (can be changed at runtime)
 */
let currentLogLevel = LOG_LEVELS.DEBUG;

/**
 * Creates a prefixed logger for a specific module.
 * 
 * @param {string} moduleName - Name of the module for prefix
 * @param {string} [emoji='📌'] - Emoji to display before module name
 * @returns {Object} Logger object with log methods
 * 
 * @example
 * const logger = createLogger('YouTubeScheduler', '📅');
 * logger.info('Setting date...');
 * // Output: 📅 [YouTubeScheduler] Setting date...
 * 
 * logger.error('Failed to set date', error);
 * // Output: ❌ [YouTubeScheduler] Failed to set date Error: ...
 */
function createLogger(moduleName, emoji = '📌') {
    const prefix = `${emoji} [${moduleName}]`;

    return {
        debug: (...args) => {
            if (currentLogLevel <= LOG_LEVELS.DEBUG) {
                console.log(`${prefix}`, ...args);
            }
        },

        info: (...args) => {
            if (currentLogLevel <= LOG_LEVELS.INFO) {
                console.log(`${prefix}`, ...args);
            }
        },

        warn: (...args) => {
            if (currentLogLevel <= LOG_LEVELS.WARN) {
                console.warn(`⚠️ ${prefix}`, ...args);
            }
        },

        error: (...args) => {
            if (currentLogLevel <= LOG_LEVELS.ERROR) {
                console.error(`❌ ${prefix}`, ...args);
            }
        },

        success: (...args) => {
            if (currentLogLevel <= LOG_LEVELS.INFO) {
                console.log(`✅ ${prefix}`, ...args);
            }
        },

        group: (label) => {
            if (currentLogLevel <= LOG_LEVELS.DEBUG) {
                console.group(`${prefix} ${label}`);
            }
        },

        groupEnd: () => {
            if (currentLogLevel <= LOG_LEVELS.DEBUG) {
                console.groupEnd();
            }
        },

        time: (label) => {
            console.time(`${prefix} ${label}`);
        },

        timeEnd: (label) => {
            console.timeEnd(`${prefix} ${label}`);
        },

        table: (data) => {
            if (currentLogLevel <= LOG_LEVELS.DEBUG) {
                console.log(`${prefix} Table:`);
                console.table(data);
            }
        }
    };
}

/**
 * Sets the global log level.
 * 
 * @param {string|number} level - Log level ('DEBUG', 'INFO', 'WARN', 'ERROR', 'NONE')
 */
function setLogLevel(level) {
    if (typeof level === 'string') {
        currentLogLevel = LOG_LEVELS[level.toUpperCase()] ?? LOG_LEVELS.DEBUG;
    } else {
        currentLogLevel = level;
    }
    console.log(`[Logger] Log level set to: ${Object.keys(LOG_LEVELS).find(k => LOG_LEVELS[k] === currentLogLevel)}`);
}

/**
 * Gets the current log level.
 * 
 * @returns {number} Current log level
 */
function getLogLevel() {
    return currentLogLevel;
}

// Export for use in other modules
window.Logger = {
    createLogger,
    setLogLevel,
    getLogLevel,
    LOG_LEVELS
};

// Create default loggers for common modules
window.Loggers = {
    YouTube: createLogger('YouTube', '🎥'),
    GoogleVids: createLogger('GoogleVids', '🎬'),
    GoogleFlow: createLogger('GoogleFlow', '🌊'),
    AskStudio: createLogger('AskStudio', '🤖'),
    Extension: createLogger('Extension', '🧩'),
    Scheduler: createLogger('Scheduler', '📅'),
    Uploader: createLogger('Uploader', '📤')
};

console.log('📦 [Module] logger.js loaded');
