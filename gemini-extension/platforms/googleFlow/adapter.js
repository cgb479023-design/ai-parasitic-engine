/**
 * Google Flow Adapter
 * 
 * Platform adapter for Google Flow (labs.google) video generation.
 * 
 * @module platforms/googleFlow/adapter
 * @version 1.0.0
 * @date 2025-12-26
 */

/**
 * Google Flow Platform Adapter
 */
class GoogleFlowAdapter {
    constructor() {
        this.platformName = 'GoogleFlow';
        this.status = 'ready';
        this.url = 'https://labs.google/fx/tools/video-fx';
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
     * Checks if Google Flow page is available.
     */
    async isAvailable() {
        return window.location.href.includes('labs.google');
    }

    /**
     * Generates video using Google Flow.
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
        console.log(`🌊 [GoogleFlow] Starting generation with prompt: ${prompt.substring(0, 50)}...`);

        try {
            // Sanitize prompt
            const sanitizedPrompt = window.sanitizePromptForGoogleVids?.(prompt) || prompt;

            // Find prompt input
            const promptInput = await this.findPromptInput();
            if (!promptInput) {
                throw new Error('Prompt input not found');
            }

            // Type prompt
            await this.typePrompt(promptInput, sanitizedPrompt);

            // Set aspect ratio
            await this.setAspectRatio(aspectRatio);

            // Click generate
            const generateBtn = await this.findGenerateButton();
            if (generateBtn) {
                generateBtn.click();
                console.log('🌊 [GoogleFlow] Generate button clicked');
            } else {
                throw new Error('Generate button not found');
            }

            // Wait for generation
            const result = await this.waitForGeneration(timeout);

            this.status = result.success ? 'completed' : 'failed';
            return result;

        } catch (error) {
            this.status = 'failed';
            console.error('❌ [GoogleFlow] Generation failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Finds the prompt input element.
     */
    async findPromptInput() {
        const selectors = [
            'textarea[placeholder*="Describe"]',
            'textarea[placeholder*="Enter"]',
            'textarea[aria-label*="prompt"]',
            '.prompt-textarea textarea',
            'textarea'
        ];

        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.offsetParent !== null) {
                return el;
            }
        }

        // Deep search
        if (window.deepQuery) {
            return window.deepQuery(document.body, 'textarea');
        }

        return null;
    }

    /**
     * Types prompt into input.
     */
    async typePrompt(input, prompt) {
        input.focus();
        await (window.delay?.(200) || new Promise(r => setTimeout(r, 200)));

        // Clear existing content
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));

        // Type character by character for better framework detection
        if (window.typeText) {
            await window.typeText(input, prompt, 5);
        } else {
            input.value = prompt;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }

        input.dispatchEvent(new Event('change', { bubbles: true }));
        console.log('✅ [GoogleFlow] Prompt typed');
    }

    /**
     * Sets the aspect ratio.
     */
    async setAspectRatio(aspectRatio) {
        // Look for aspect ratio dropdown or buttons
        const ratioSelectors = [
            '[data-value="9:16"]',
            '[data-value="16:9"]',
            'button[aria-label*="9:16"]',
            'button[aria-label*="vertical"]',
            '.aspect-ratio-selector button'
        ];

        // Map aspect ratio to expected value
        const targetRatio = aspectRatio === '9:16' ? 'vertical' : 'horizontal';

        // Try to find dropdown trigger first
        const dropdown = document.querySelector('[aria-label*="aspect"], [aria-label*="ratio"], .ratio-dropdown');
        if (dropdown) {
            dropdown.click();
            await (window.delay?.(500) || new Promise(r => setTimeout(r, 500)));
        }

        // Look for ratio option
        const allButtons = document.querySelectorAll('button, [role="option"], [role="menuitem"]');
        for (const btn of allButtons) {
            const text = (btn.textContent || btn.getAttribute('aria-label') || '').toLowerCase();
            if (text.includes(aspectRatio) || text.includes(targetRatio)) {
                btn.click();
                console.log(`📐 [GoogleFlow] Aspect ratio set: ${aspectRatio}`);
                await (window.delay?.(300) || new Promise(r => setTimeout(r, 300)));
                return true;
            }
        }

        console.warn('⚠️ [GoogleFlow] Aspect ratio selector not found');
        return false;
    }

    /**
     * Handles the "Pick or create a project" dialog if present.
     * Google Flow now requires selecting a project before generation.
     */
    async handleProjectDialog() {
        console.log('🌊 [GoogleFlow] Checking for project dialog...');

        // Look for the project dialog
        const dialogText = document.body.innerText || '';
        if (!dialogText.includes('Pick or create a project') &&
            !dialogText.includes('create a project')) {
            console.log('✅ [GoogleFlow] No project dialog detected');
            return true;
        }

        console.log('📋 [GoogleFlow] Project dialog detected, looking for Create button...');

        // Find the "Create" button
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
            const text = (btn.textContent || '').toLowerCase().trim();
            if (text === 'create' || text.includes('create project') || text.includes('new project')) {
                if (btn.offsetParent !== null) {
                    console.log('✅ [GoogleFlow] Clicking Create button...');
                    btn.click();
                    await (window.delay?.(2000) || new Promise(r => setTimeout(r, 2000)));
                    return true;
                }
            }
        }

        // Also try clicking any visible "Dismiss" to close the dialog
        for (const btn of buttons) {
            const text = (btn.textContent || '').toLowerCase().trim();
            if (text === 'dismiss' || text === 'cancel' || text === 'close') {
                if (btn.offsetParent !== null) {
                    console.log('⚠️ [GoogleFlow] Clicking Dismiss to close dialog...');
                    btn.click();
                    await (window.delay?.(1000) || new Promise(r => setTimeout(r, 1000)));
                    break;
                }
            }
        }

        return true;
    }

    /**
     * Finds the generate button.
     * Updated for Google Flow's new UI structure.
     */
    async findGenerateButton() {
        // First, handle any project dialog
        await this.handleProjectDialog();
        await (window.delay?.(500) || new Promise(r => setTimeout(r, 500)));

        // Strategy 1: Look for buttons with generate/create text
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
            const text = (btn.textContent || '').toLowerCase();
            const label = (btn.getAttribute('aria-label') || '').toLowerCase();

            if (text.includes('generate') || text.includes('create video') ||
                label.includes('generate') || label.includes('create')) {
                if (btn.offsetParent !== null && !btn.disabled) {
                    console.log(`✅ [GoogleFlow] Found generate button: "${text.trim()}"`);
                    return btn;
                }
            }
        }

        // Strategy 2: Look for the right arrow / submit icon button (common in chat-like UIs)
        const iconButtons = document.querySelectorAll('button, [role="button"]');
        for (const btn of iconButtons) {
            // Check for arrow icon or send icon
            const hasSendIcon = btn.querySelector('svg path[d*="M2.01"], svg path[d*="M22"], svg[class*="send"]') ||
                btn.innerHTML?.includes('arrow') ||
                btn.innerHTML?.includes('send');
            const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();

            if ((hasSendIcon || ariaLabel.includes('send') || ariaLabel.includes('submit')) &&
                btn.offsetParent !== null) {
                console.log(`✅ [GoogleFlow] Found icon-based submit button`);
                return btn;
            }
        }

        // Strategy 3: Look for primary/submit buttons by style
        const primarySelectors = [
            'button[type="submit"]',
            'button.primary',
            'button[data-primary]',
            '.primary-button',
            'button.bg-blue-600',
            'button.bg-primary',
            '[class*="primary"] button',
            '[class*="submit"] button'
        ];

        for (const sel of primarySelectors) {
            try {
                const btn = document.querySelector(sel);
                if (btn && btn.offsetParent !== null && !btn.disabled) {
                    console.log(`✅ [GoogleFlow] Found primary button via selector: ${sel}`);
                    return btn;
                }
            } catch (e) { /* ignore invalid selectors */ }
        }

        // Strategy 4: Find by position - last button in the input area
        const inputArea = document.querySelector('textarea, input[type="text"]');
        if (inputArea) {
            const parent = inputArea.closest('form, div');
            if (parent) {
                const btns = parent.querySelectorAll('button');
                const lastBtn = btns[btns.length - 1];
                if (lastBtn && lastBtn.offsetParent !== null) {
                    console.log(`✅ [GoogleFlow] Found button near input area`);
                    return lastBtn;
                }
            }
        }

        console.warn('⚠️ [GoogleFlow] Generate button not found after all strategies');
        return null;
    }

    /**
     * Waits for video generation to complete.
     */
    async waitForGeneration(timeout = 300000) {
        const startTime = Date.now();
        const checkInterval = 5000;

        console.log('🌊 [GoogleFlow] Waiting for generation...');

        while (Date.now() - startTime < timeout) {
            // Check for video element
            const video = document.querySelector('video[src], video source[src]');
            if (video) {
                const videoUrl = video.src || video.querySelector('source')?.src;
                if (videoUrl) {
                    console.log('✅ [GoogleFlow] Video ready');
                    return { success: true, videoUrl };
                }
            }

            // Check for download button
            const downloadBtn = document.querySelector('a[download], button[aria-label*="download"]');
            if (downloadBtn) {
                console.log('✅ [GoogleFlow] Download available');
                return { success: true, downloadAvailable: true };
            }

            // Check for progress indicator
            const progress = document.querySelector('[role="progressbar"], .generating, .loading');
            if (progress) {
                const progressValue = progress.getAttribute('aria-valuenow') ||
                    progress.textContent?.match(/(\d+)%/)?.[1];
                if (progressValue) {
                    console.log(`🌊 [GoogleFlow] Progress: ${progressValue}%`);
                }
            }

            // Check for error
            const errorEl = document.querySelector('[class*="error"], [role="alert"]');
            if (errorEl) {
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
     * Cancels current operation.
     */
    async cancel() {
        this.status = 'ready';
        this.currentOperation = null;

        const cancelBtn = document.querySelector('button[aria-label*="Cancel"], button[aria-label*="Stop"]');
        if (cancelBtn) {
            cancelBtn.click();
        }

        console.log('🛑 [GoogleFlow] Operation cancelled');
        return true;
    }
}

// Create and register adapter
const googleFlowAdapter = new GoogleFlowAdapter();

// Register with platform registry
if (window.PlatformRegistry) {
    window.PlatformRegistry.register('googleflow', googleFlowAdapter);
}

// Export
window.GoogleFlowAdapter = googleFlowAdapter;

console.log('📦 [Module] platforms/googleFlow/adapter.js loaded');
