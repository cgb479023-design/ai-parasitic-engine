/**
 * Delay/Timing Utilities
 * 
 * Provides utilities for delays and timing operations.
 * Extracted from content.js for modularity.
 * 
 * @module utils/delay
 * @version 1.0.0
 * @date 2025-12-26
 */

/**
 * Creates a promise that resolves after the specified delay.
 * Replaces the common pattern: await new Promise(r => setTimeout(r, ms))
 * 
 * @param {number} ms - Delay in milliseconds
 * @returns {Promise<void>}
 * 
 * @example
 * // Wait 500ms
 * await delay(500);
 * 
 * @example
 * // Wait 2 seconds before continuing
 * console.log('Starting...');
 * await delay(2000);
 * console.log('Done!');
 */
async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Executes a function with retry logic.
 * Useful for operations that may fail temporarily.
 * 
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Retry options
 * @param {number} [options.maxRetries=3] - Maximum number of retry attempts
 * @param {number} [options.delayMs=1000] - Delay between retries in milliseconds
 * @param {number} [options.backoffMultiplier=1.5] - Multiplier for exponential backoff
 * @param {Function} [options.onRetry] - Callback called on each retry
 * @returns {Promise<any>} Result of the function
 * @throws {Error} If all retries fail
 * 
 * @example
 * // Retry clicking a button up to 3 times
 * await withRetry(
 *     async () => {
 *         const btn = document.querySelector('button');
 *         if (!btn) throw new Error('Button not found');
 *         btn.click();
 *     },
 *     { maxRetries: 3, delayMs: 500 }
 * );
 */
async function withRetry(fn, options = {}) {
    const {
        maxRetries = 3,
        delayMs = 1000,
        backoffMultiplier = 1.5,
        onRetry = null
    } = options;

    let lastError;
    let currentDelay = delayMs;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt < maxRetries) {
                if (onRetry) {
                    onRetry(attempt, error, currentDelay);
                }
                console.log(`[Retry] Attempt ${attempt}/${maxRetries} failed: ${error.message}. Retrying in ${currentDelay}ms...`);
                await delay(currentDelay);
                currentDelay = Math.round(currentDelay * backoffMultiplier);
            }
        }
    }

    throw lastError;
}

/**
 * Waits until a condition is met or timeout occurs.
 * 
 * @param {Function} condition - Function that returns true when condition is met
 * @param {Object} options - Options
 * @param {number} [options.timeout=30000] - Maximum wait time in milliseconds
 * @param {number} [options.interval=100] - Check interval in milliseconds
 * @param {string} [options.description='condition'] - Description for logging
 * @returns {Promise<boolean>} True if condition met, false if timeout
 * 
 * @example
 * // Wait for loading to complete
 * const success = await waitUntil(
 *     () => document.querySelector('.loading') === null,
 *     { timeout: 10000, description: 'loading complete' }
 * );
 */
async function waitUntil(condition, options = {}) {
    const {
        timeout = 30000,
        interval = 100,
        description = 'condition'
    } = options;

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        try {
            if (await condition()) {
                return true;
            }
        } catch (e) {
            // Condition threw an error, treat as false
        }

        await delay(interval);
    }

    console.warn(`[waitUntil] Timeout waiting for ${description} after ${timeout}ms`);
    return false;
}

/**
 * Creates a debounced version of a function.
 * 
 * @param {Function} fn - Function to debounce
 * @param {number} wait - Debounce wait time in milliseconds
 * @returns {Function} Debounced function
 * 
 * @example
 * const debouncedSave = debounce(() => saveData(), 500);
 * // Calling multiple times quickly will only execute once
 * debouncedSave();
 * debouncedSave();
 * debouncedSave();
 */
function debounce(fn, wait) {
    let timeoutId = null;

    return function (...args) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            fn.apply(this, args);
            timeoutId = null;
        }, wait);
    };
}

/**
 * Creates a throttled version of a function.
 * 
 * @param {Function} fn - Function to throttle
 * @param {number} limit - Minimum time between calls in milliseconds
 * @returns {Function} Throttled function
 */
function throttle(fn, limit) {
    let lastCall = 0;

    return function (...args) {
        const now = Date.now();

        if (now - lastCall >= limit) {
            lastCall = now;
            return fn.apply(this, args);
        }
    };
}

/**
 * Executes a function with a timeout.
 * 
 * @param {Function} fn - Async function to execute
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} [errorMessage='Operation timed out'] - Error message on timeout
 * @returns {Promise<any>} Result of the function
 * @throws {Error} If timeout occurs
 * 
 * @example
 * try {
 *     const result = await withTimeout(
 *         () => fetchData(),
 *         5000,
 *         'Data fetch timed out'
 *     );
 * } catch (error) {
 *     console.error(error.message);
 * }
 */
async function withTimeout(fn, timeoutMs, errorMessage = 'Operation timed out') {
    return Promise.race([
        fn(),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
        )
    ]);
}

// Export for use in other modules
window.DelayUtils = {
    delay,
    withRetry,
    waitUntil,
    debounce,
    throttle,
    withTimeout
};

// Also expose delay as global function (most commonly used)
window.delay = delay;
window.withRetry = withRetry;

console.log('📦 [Module] delay.js loaded');
