/**
 * Platform Adapter Base
 * 
 * Defines the common interface for all video generation platform adapters.
 * 
 * @module platforms/platformAdapter
 * @version 1.0.0
 * @date 2025-12-26
 */

/**
 * Platform types enum
 */
const PlatformType = {
    GEMINIGEN: 'geminigen',
    GOOGLE_FLOW: 'googleflow',
    GOOGLE_VIDS: 'googlevids'
};

/**
 * Platform status enum
 */
const PlatformStatus = {
    READY: 'ready',
    GENERATING: 'generating',
    COMPLETED: 'completed',
    FAILED: 'failed',
    NOT_AVAILABLE: 'not_available'
};

/**
 * Generation options interface
 */
const DefaultGenerateOptions = {
    aspectRatio: '9:16',
    duration: 7,
    quality: '1080p',
    timeout: 300000 // 5 minutes
};

/**
 * Base Platform Adapter Class
 * 
 * All platform-specific adapters should extend this class.
 */
class BasePlatformAdapter {
    constructor(platformName) {
        this.platformName = platformName;
        this.status = PlatformStatus.READY;
        this.logger = window.Loggers?.[platformName] || console;
        this.currentOperation = null;
    }

    /**
     * Gets the platform name.
     * @returns {string}
     */
    getName() {
        return this.platformName;
    }

    /**
     * Gets the current status.
     * @returns {string}
     */
    getStatus() {
        return this.status;
    }

    /**
     * Checks if the platform is available.
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        throw new Error('isAvailable() must be implemented by subclass');
    }

    /**
     * Generates a video with the given prompt.
     * 
     * @param {string} prompt - Video generation prompt
     * @param {Object} options - Generation options
     * @returns {Promise<{success: boolean, videoData?: string, videoUrl?: string, error?: string}>}
     */
    async generate(prompt, options = {}) {
        throw new Error('generate() must be implemented by subclass');
    }

    /**
     * Cancels the current operation.
     * @returns {Promise<boolean>}
     */
    async cancel() {
        this.status = PlatformStatus.READY;
        this.currentOperation = null;
        this.log('Operation cancelled');
        return true;
    }

    /**
     * Gets the platform URL.
     * @returns {string}
     */
    getUrl() {
        throw new Error('getUrl() must be implemented by subclass');
    }

    /**
     * Logs a message with platform prefix.
     */
    log(...args) {
        const prefix = `🎬 [${this.platformName}]`;
        console.log(prefix, ...args);
    }

    /**
     * Logs an error with platform prefix.
     */
    logError(...args) {
        const prefix = `❌ [${this.platformName}]`;
        console.error(prefix, ...args);
    }
}

/**
 * Platform Registry
 * 
 * Manages all registered platform adapters.
 */
class PlatformRegistry {
    constructor() {
        this.adapters = new Map();
        this.defaultPlatform = PlatformType.GOOGLE_VIDS;
    }

    /**
     * Registers a platform adapter.
     */
    register(platformType, adapter) {
        this.adapters.set(platformType, adapter);
        console.log(`📦 [PlatformRegistry] Registered: ${platformType}`);
    }

    /**
     * Gets an adapter by platform type.
     */
    get(platformType) {
        return this.adapters.get(platformType);
    }

    /**
     * Gets the default adapter.
     */
    getDefault() {
        return this.adapters.get(this.defaultPlatform);
    }

    /**
     * Sets the default platform.
     */
    setDefault(platformType) {
        if (this.adapters.has(platformType)) {
            this.defaultPlatform = platformType;
            console.log(`📦 [PlatformRegistry] Default set to: ${platformType}`);
        }
    }

    /**
     * Lists all registered platforms.
     */
    list() {
        return Array.from(this.adapters.keys());
    }

    /**
     * Checks which platforms are available.
     */
    async checkAvailability() {
        const results = {};
        for (const [type, adapter] of this.adapters) {
            try {
                results[type] = await adapter.isAvailable();
            } catch (e) {
                results[type] = false;
            }
        }
        return results;
    }
}

// Create global registry
window.PlatformRegistry = new PlatformRegistry();

// Export classes and enums
window.PlatformAdapter = {
    Base: BasePlatformAdapter,
    Registry: window.PlatformRegistry,
    Types: PlatformType,
    Status: PlatformStatus,
    DefaultOptions: DefaultGenerateOptions
};

console.log('📦 [Module] platforms/platformAdapter.js loaded');
