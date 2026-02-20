/**
 * Google Vids Adapter
 * 
 * Platform adapter for Google Vids (Veo 2) video generation.
 * 
 * @module platforms/googleVids/adapter
 * @version 1.0.0
 * @date 2025-12-26
 */

/**
 * Google Vids Platform Adapter
 */
class GoogleVidsAdapter {
    constructor() {
        this.platformName = 'GoogleVids';
        this.status = 'ready';
        this.url = 'https://docs.google.com/videos/';
        this.currentOperation = null;
    }

    getName() {
        return this.platformName;
    }

    getStatus() {
        return this.status;
    }

    getUrl() {
        return this.url;
    }

    /**
     * Checks if Google Vids page is available.
     */
    async isAvailable() {
        return window.location.href.includes('docs.google.com/videos');
    }

    /**
     * Generates video using Google Vids.
     * 
     * @param {string} prompt - Video generation prompt
     * @param {Object} options - Generation options
     */
    async generate(prompt, options = {}) {
        const {
            aspectRatio = '9:16',
            duration = 7,
            timeout = 300000
        } = options;

        this.status = 'generating';
        console.log(`🎬 [GoogleVids] Starting generation with prompt: ${prompt.substring(0, 50)}...`);

        try {
            // Sanitize prompt
            const sanitizedPrompt = window.sanitizePromptForGoogleVids?.(prompt) || prompt;
            console.log(`🛡️ [GoogleVids] Sanitized prompt length: ${sanitizedPrompt.length}`);

            // Find and fill the prompt input
            const promptInput = await this.findPromptInput();
            if (!promptInput) {
                throw new Error('Prompt input not found');
            }

            // Clear and type prompt
            await this.typePrompt(promptInput, sanitizedPrompt);

            // Set aspect ratio if available
            await this.setAspectRatio(aspectRatio);

            // Click generate button
            const generateBtn = await this.findGenerateButton();
            if (generateBtn) {
                generateBtn.click();
                console.log('🎬 [GoogleVids] Generate button clicked');
            } else {
                throw new Error('Generate button not found');
            }

            // Wait for generation to complete
            const result = await this.waitForGeneration(timeout);

            this.status = result.success ? 'completed' : 'failed';
            return result;

        } catch (error) {
            this.status = 'failed';
            console.error('❌ [GoogleVids] Generation failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Finds the prompt input element.
     */
    async findPromptInput() {
        const selectors = [
            'textarea[placeholder*="Describe"]',
            'textarea[placeholder*="prompt"]',
            '.prompt-input textarea',
            '[data-testid="prompt-input"]',
            'textarea'
        ];

        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.offsetParent !== null) {
                return el;
            }
        }

        // Deep search with Shadow DOM
        if (window.deepQuery) {
            return window.deepQuery(document.body, 'textarea');
        }

        return null;
    }

    /**
     * Types prompt into input with proper events.
     */
    async typePrompt(input, prompt) {
        input.focus();
        input.value = '';

        // Use typeText if available, otherwise direct assignment
        if (window.typeText) {
            await window.typeText(input, prompt, 10);
        } else {
            input.value = prompt;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }

        console.log('✅ [GoogleVids] Prompt typed');
    }

    /**
     * Sets the aspect ratio.
     */
    async setAspectRatio(aspectRatio) {
        // Look for aspect ratio selector
        const ratioButtons = document.querySelectorAll('[data-ratio], [aria-label*="ratio"], button');

        for (const btn of ratioButtons) {
            const text = btn.textContent || btn.getAttribute('aria-label') || '';
            if (text.includes(aspectRatio) || text.includes(aspectRatio.replace(':', '×'))) {
                btn.click();
                console.log(`📐 [GoogleVids] Aspect ratio set: ${aspectRatio}`);
                await (window.delay?.(300) || new Promise(r => setTimeout(r, 300)));
                return true;
            }
        }

        console.warn('⚠️ [GoogleVids] Aspect ratio selector not found');
        return false;
    }

    /**
     * Finds the generate button.
     */
    async findGenerateButton() {
        const selectors = [
            'button[aria-label*="Generate"]',
            'button[aria-label*="Create"]',
            'button:contains("Generate")',
            '.generate-button',
            '[data-testid="generate-button"]'
        ];

        // Standard search
        for (const sel of selectors) {
            try {
                const el = document.querySelector(sel);
                if (el && el.offsetParent !== null) {
                    return el;
                }
            } catch (e) {
                // Selector may not be valid
            }
        }

        // Text-based search
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
            const text = btn.textContent?.toLowerCase() || '';
            if (text.includes('generate') || text.includes('create video')) {
                return btn;
            }
        }

        return null;
    }

    /**
     * Waits for video generation to complete.
     */
    async waitForGeneration(timeout = 300000) {
        const startTime = Date.now();
        const checkInterval = 5000;

        while (Date.now() - startTime < timeout) {
            // Check for video element or download link
            const video = document.querySelector('video[src], video source[src]');
            const downloadLink = document.querySelector('a[download], a[href*="download"]');

            if (video || downloadLink) {
                const videoUrl = video?.src || video?.querySelector('source')?.src || downloadLink?.href;
                console.log('✅ [GoogleVids] Video ready:', videoUrl);
                return { success: true, videoUrl };
            }

            // Check for error messages
            const errorEl = document.querySelector('[class*="error"], [role="alert"]');
            if (errorEl && errorEl.textContent.includes('error')) {
                return { success: false, error: errorEl.textContent };
            }

            await (window.delay?.(checkInterval) || new Promise(r => setTimeout(r, checkInterval)));
        }

        return { success: false, error: 'Generation timed out' };
    }

    /**
     * Cancels current operation.
     */
    async cancel() {
        this.status = 'ready';
        this.currentOperation = null;

        // Try to find and click cancel button
        const cancelBtn = document.querySelector('button[aria-label*="Cancel"], button:contains("Cancel")');
        if (cancelBtn) {
            cancelBtn.click();
        }

        console.log('🛑 [GoogleVids] Operation cancelled');
        return true;
    }
}

// Create and register adapter
const googleVidsAdapter = new GoogleVidsAdapter();

// Register with platform registry if available
if (window.PlatformRegistry) {
    window.PlatformRegistry.register('googlevids', googleVidsAdapter);
}

// Export
window.GoogleVidsAdapter = googleVidsAdapter;

console.log('📦 [Module] platforms/googleVids/adapter.js loaded');
