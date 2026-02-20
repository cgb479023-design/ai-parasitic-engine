/**
 * GeminiGen Adapter
 * 
 * Platform adapter for GeminiGen.ai video generation.
 * 
 * @module platforms/geminiGen/adapter
 * @version 1.0.0
 * @date 2025-12-26
 */

/**
 * GeminiGen Platform Adapter
 */
class GeminiGenAdapter {
    constructor() {
        this.platformName = 'GeminiGen';
        this.status = 'ready';
        this.url = 'https://geminigen.ai/';
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
     * Checks if GeminiGen page is available.
     */
    async isAvailable() {
        return window.location.href.includes('geminigen.ai');
    }

    /**
     * Generates video using GeminiGen.
     * 
     * @param {string} prompt - Video generation prompt
     * @param {Object} options - Generation options
     */
    async generate(prompt, options = {}) {
        const {
            aspectRatio = '9:16',
            timeout = 300000
        } = options;

        this.status = 'generating';
        console.log(`⚡ [GeminiGen] Starting generation with prompt: ${prompt.substring(0, 50)}...`);

        try {
            // Sanitize prompt (GeminiGen may have its own restrictions)
            const sanitizedPrompt = window.sanitizePromptForGoogleVids?.(prompt) || prompt;

            // Find prompt input
            const promptInput = await this.findPromptInput();
            if (!promptInput) {
                throw new Error('Prompt input not found');
            }

            // Type prompt
            await this.typePrompt(promptInput, sanitizedPrompt);

            // Wait a moment for UI to settle
            await (window.delay?.(500) || new Promise(r => setTimeout(r, 500)));

            // Click generate button
            const generateBtn = await this.findGenerateButton();
            if (generateBtn) {
                generateBtn.click();
                console.log('⚡ [GeminiGen] Generate button clicked');
            } else {
                // Try pressing Enter as alternative
                promptInput.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    bubbles: true
                }));
                console.log('⚡ [GeminiGen] Enter key pressed as fallback');
            }

            // Wait for generation
            const result = await this.waitForGeneration(timeout);

            this.status = result.success ? 'completed' : 'failed';
            return result;

        } catch (error) {
            this.status = 'failed';
            console.error('❌ [GeminiGen] Generation failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Finds the prompt input element.
     */
    async findPromptInput() {
        const selectors = [
            'textarea[placeholder*="prompt"]',
            'textarea[placeholder*="Describe"]',
            'input[type="text"][placeholder*="prompt"]',
            '#prompt-input',
            '.prompt-input',
            'textarea'
        ];

        for (const sel of selectors) {
            try {
                const el = document.querySelector(sel);
                if (el && el.offsetParent !== null) {
                    return el;
                }
            } catch (e) {
                // Continue
            }
        }

        // Deep search
        if (window.deepQuery) {
            const ta = window.deepQuery(document.body, 'textarea');
            if (ta) return ta;
        }

        return null;
    }

    /**
     * Types prompt into input.
     */
    async typePrompt(input, prompt) {
        input.focus();
        await (window.delay?.(200) || new Promise(r => setTimeout(r, 200)));

        // Clear existing
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));

        // Type prompt
        if (window.typeText) {
            await window.typeText(input, prompt, 5);
        } else {
            input.value = prompt;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }

        input.dispatchEvent(new Event('change', { bubbles: true }));
        console.log('✅ [GeminiGen] Prompt typed');
    }

    /**
     * Finds the generate button.
     */
    async findGenerateButton() {
        // Search by text content
        const buttons = document.querySelectorAll('button, [role="button"]');
        for (const btn of buttons) {
            const text = (btn.textContent || '').toLowerCase();
            const label = (btn.getAttribute('aria-label') || '').toLowerCase();

            if (text.includes('generate') || text.includes('create') ||
                text.includes('submit') || label.includes('generate')) {
                if (btn.offsetParent !== null && !btn.disabled) {
                    return btn;
                }
            }
        }

        // Look for submit button near input
        const form = document.querySelector('form');
        if (form) {
            const submitBtn = form.querySelector('button[type="submit"], button:not([type])');
            if (submitBtn) return submitBtn;
        }

        return null;
    }

    /**
     * Waits for video generation to complete.
     */
    async waitForGeneration(timeout = 300000) {
        const startTime = Date.now();
        const checkInterval = 3000;

        console.log('⚡ [GeminiGen] Waiting for generation...');

        while (Date.now() - startTime < timeout) {
            // 🆕 CHECK FOR CLOUDFLARE TURNSTILE VERIFICATION
            const verifyPopup = document.querySelector('[class*="turnstile"], [class*="cloudflare"], [class*="verify"], [data-action="verify"]');
            const verifyText = document.body.innerText;

            if (verifyText.includes('Verify you are human') || verifyPopup) {
                console.log('🔐 [GeminiGen] Cloudflare verification detected! Attempting auto-click...');

                // Strategy 1: Direct checkbox click
                const checkbox = document.querySelector('input[type="checkbox"]') ||
                    document.querySelector('[role="checkbox"]') ||
                    document.querySelector('.cf-turnstile input') ||
                    document.querySelector('[name="cf-turnstile-response"]');

                if (checkbox && !checkbox.checked) {
                    checkbox.click();
                    console.log('✅ [GeminiGen] Clicked verification checkbox (direct)');
                    await (window.delay?.(2000) || new Promise(r => setTimeout(r, 2000)));
                    continue; // Re-check after clicking
                }

                // Strategy 2: Click the Turnstile container
                const turnstileContainer = document.querySelector('.cf-turnstile') ||
                    document.querySelector('[class*="turnstile"]') ||
                    document.querySelector('div[style*="border"]');

                if (turnstileContainer) {
                    turnstileContainer.click();
                    console.log('✅ [GeminiGen] Clicked Turnstile container');
                    await (window.delay?.(2000) || new Promise(r => setTimeout(r, 2000)));
                    continue;
                }

                // Strategy 3: Find and click inside iframe
                const iframes = document.querySelectorAll('iframe[src*="turnstile"], iframe[src*="cloudflare"], iframe[title*="Cloudflare"]');
                for (const iframe of iframes) {
                    try {
                        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                        if (iframeDoc) {
                            const iframeCheckbox = iframeDoc.querySelector('input[type="checkbox"]');
                            if (iframeCheckbox && !iframeCheckbox.checked) {
                                iframeCheckbox.click();
                                console.log('✅ [GeminiGen] Clicked checkbox inside iframe');
                                await (window.delay?.(2000) || new Promise(r => setTimeout(r, 2000)));
                            }
                        }
                    } catch (e) {
                        // Cross-origin iframe, try clicking the iframe itself
                        iframe.click();
                        console.log('✅ [GeminiGen] Clicked iframe (cross-origin fallback)');
                    }
                }

                // Strategy 4: Click any visible "Verify" button
                const verifyBtn = Array.from(document.querySelectorAll('button, [role="button"], span, div'))
                    .find(el => (el.innerText || '').toLowerCase().includes('verify') && el.offsetParent !== null);

                if (verifyBtn) {
                    verifyBtn.click();
                    console.log('✅ [GeminiGen] Clicked Verify button');
                    await (window.delay?.(2000) || new Promise(r => setTimeout(r, 2000)));
                }
            }

            // Check for video element
            const video = document.querySelector('video[src]:not([src=""]), video source[src]');
            if (video) {
                const videoUrl = video.src || video.querySelector('source')?.src;
                if (videoUrl && !videoUrl.includes('placeholder')) {
                    console.log('✅ [GeminiGen] Video ready');

                    // Try to get video data
                    const videoData = await this.captureVideoData(videoUrl);
                    return { success: true, videoUrl, videoData };
                }
            }

            // Check for result container
            const resultContainer = document.querySelector('.result, .output, [data-result]');
            if (resultContainer) {
                const videoInResult = resultContainer.querySelector('video');
                if (videoInResult?.src) {
                    return { success: true, videoUrl: videoInResult.src };
                }
            }

            // Check for loading indicator
            const loading = document.querySelector('.loading, .generating, [class*="spinner"]');
            if (loading && loading.offsetParent !== null) {
                console.log('⚡ [GeminiGen] Still generating...');
            }

            // Check for error
            const errorEl = document.querySelector('.error, [role="alert"]');
            if (errorEl && errorEl.offsetParent !== null) {
                const errorText = errorEl.textContent;
                if (errorText.toLowerCase().includes('error') ||
                    errorText.toLowerCase().includes('failed')) {
                    return { success: false, error: errorText };
                }
            }

            await (window.delay?.(checkInterval) || new Promise(r => setTimeout(r, checkInterval)));
        }

        return { success: false, error: 'Generation timed out' };
    }

    /**
     * Attempts to capture video data as base64.
     */
    async captureVideoData(videoUrl) {
        try {
            // If URL is blob, try to convert
            if (videoUrl.startsWith('blob:')) {
                const response = await fetch(videoUrl);
                const blob = await response.blob();

                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = () => resolve(null);
                    reader.readAsDataURL(blob);
                });
            }

            return null;
        } catch (error) {
            console.warn('⚠️ [GeminiGen] Could not capture video data:', error);
            return null;
        }
    }

    /**
     * Cancels current operation.
     */
    async cancel() {
        this.status = 'ready';
        this.currentOperation = null;

        const cancelBtn = document.querySelector('button[aria-label*="Cancel"], .cancel-button');
        if (cancelBtn) {
            cancelBtn.click();
        }

        console.log('🛑 [GeminiGen] Operation cancelled');
        return true;
    }
}

// Create and register adapter
const geminiGenAdapter = new GeminiGenAdapter();

// Register with platform registry
if (window.PlatformRegistry) {
    window.PlatformRegistry.register('geminigen', geminiGenAdapter);
}

// Export
window.GeminiGenAdapter = geminiGenAdapter;

console.log('📦 [Module] platforms/geminiGen/adapter.js loaded');
