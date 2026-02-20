/**
 * Human Behavior Simulator
 * 
 * Simulates human-like interactions to avoid bot detection.
 * Includes random delays, human-like mouse movements, and typing simulation.
 * 
 * @module core/humanSimulator
 * @version 1.0.0
 * @date 2026-01-07
 */

(function () {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════════════
    // CONFIGURATION
    // ═══════════════════════════════════════════════════════════════════════════

    const CONFIG = {
        // Delay ranges (ms)
        CLICK_DELAY_MIN: 50,
        CLICK_DELAY_MAX: 200,
        TYPE_DELAY_MIN: 30,
        TYPE_DELAY_MAX: 120,
        ACTION_DELAY_MIN: 500,
        ACTION_DELAY_MAX: 2000,

        // Mouse movement
        MOUSE_STEPS: 10,
        MOUSE_JITTER: 3,

        // Typing
        TYPO_CHANCE: 0.02,  // 2% chance of typo (then backspace)
        PAUSE_CHANCE: 0.05  // 5% chance of pause while typing
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // UTILITY FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Random delay between min and max milliseconds
     * @param {number} minMs 
     * @param {number} maxMs 
     * @returns {Promise<void>}
     */
    function randomDelay(minMs = CONFIG.ACTION_DELAY_MIN, maxMs = CONFIG.ACTION_DELAY_MAX) {
        const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
        return new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Generate a random number between min and max
     */
    function randomBetween(min, max) {
        return Math.random() * (max - min) + min;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MOUSE SIMULATION
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Calculate a point on a quadratic bezier curve
     * @param {number} t - Progress (0-1)
     * @param {object} p0 - Start point {x, y}
     * @param {object} p1 - Control point {x, y}
     * @param {object} p2 - End point {x, y}
     */
    function bezierPoint(t, p0, p1, p2) {
        const x = Math.pow(1 - t, 2) * p0.x + 2 * (1 - t) * t * p1.x + Math.pow(t, 2) * p2.x;
        const y = Math.pow(1 - t, 2) * p0.y + 2 * (1 - t) * t * p1.y + Math.pow(t, 2) * p2.y;
        return { x, y };
    }

    /**
     * Simulate mouse movement towards an element using a bezier curve
     * @param {Element} element - Target element
     * @returns {Promise<void>}
     */
    async function humanMouseMove(element) {
        if (!element) {
            console.warn('🖱️ [HumanSim] No element provided for mouse move');
            return;
        }

        const rect = element.getBoundingClientRect();
        const targetX = rect.left + rect.width / 2 + randomBetween(-5, 5);
        const targetY = rect.top + rect.height / 2 + randomBetween(-5, 5);

        // Current "mouse" position (center of viewport as estimate)
        const startX = window.innerWidth / 2;
        const startY = window.innerHeight / 2;

        // Random control point for natural curve
        const controlX = (startX + targetX) / 2 + randomBetween(-100, 100);
        const controlY = (startY + targetY) / 2 + randomBetween(-50, 50);

        const p0 = { x: startX, y: startY };
        const p1 = { x: controlX, y: controlY };
        const p2 = { x: targetX, y: targetY };

        console.log(`🖱️ [HumanSim] Moving mouse to (${Math.round(targetX)}, ${Math.round(targetY)})`);

        // Dispatch mousemove events along the bezier path
        for (let i = 0; i <= CONFIG.MOUSE_STEPS; i++) {
            const t = i / CONFIG.MOUSE_STEPS;
            const point = bezierPoint(t, p0, p1, p2);

            // Add jitter
            const jitterX = randomBetween(-CONFIG.MOUSE_JITTER, CONFIG.MOUSE_JITTER);
            const jitterY = randomBetween(-CONFIG.MOUSE_JITTER, CONFIG.MOUSE_JITTER);

            const event = new MouseEvent('mousemove', {
                bubbles: true,
                cancelable: true,
                clientX: point.x + jitterX,
                clientY: point.y + jitterY,
                view: window
            });

            document.elementFromPoint(point.x, point.y)?.dispatchEvent(event);

            await randomDelay(10, 30);
        }

        // Dispatch mouseenter and mouseover on target
        element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, view: window }));
        element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, view: window }));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // CLICK SIMULATION
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Simulate a human-like click on an element
     * @param {Element} element - Target element
     * @returns {Promise<void>}
     */
    async function humanClick(element) {
        if (!element) {
            console.warn('🖱️ [HumanSim] No element provided for click');
            return;
        }

        console.log(`🖱️ [HumanSim] Human click on:`, element.tagName, element.className?.substring(0, 30));

        // Move mouse first
        await humanMouseMove(element);

        // Pre-click delay
        await randomDelay(CONFIG.CLICK_DELAY_MIN, CONFIG.CLICK_DELAY_MAX);

        // Focus the element
        if (typeof element.focus === 'function') {
            element.focus();
        }

        // Dispatch mousedown
        element.dispatchEvent(new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            view: window
        }));

        // Short delay between mousedown and mouseup (human reaction time)
        await randomDelay(50, 150);

        // Dispatch mouseup
        element.dispatchEvent(new MouseEvent('mouseup', {
            bubbles: true,
            cancelable: true,
            view: window
        }));

        // Dispatch click
        element.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
        }));

        // Also try native click as fallback
        if (typeof element.click === 'function') {
            element.click();
        }

        console.log('✅ [HumanSim] Click completed');
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // TYPING SIMULATION
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Simulate human-like typing into an element
     * @param {Element} element - Target input/contenteditable element
     * @param {string} text - Text to type
     * @returns {Promise<void>}
     */
    async function humanType(element, text) {
        if (!element || !text) {
            console.warn('⌨️ [HumanSim] Missing element or text for typing');
            return;
        }

        console.log(`⌨️ [HumanSim] Typing ${text.length} characters...`);

        // Focus element
        element.focus();
        await randomDelay(100, 300);

        // Clear existing content
        const isContentEditable = element.getAttribute('contenteditable') === 'true' || element.tagName === 'DIV';
        if (isContentEditable) {
            element.innerHTML = '';
            element.textContent = '';
        } else {
            element.value = '';
        }

        element.dispatchEvent(new Event('input', { bubbles: true }));
        await randomDelay(50, 150);

        // Type character by character
        let typed = '';
        for (let i = 0; i < text.length; i++) {
            const char = text[i];

            // Random pause (thinking)
            if (Math.random() < CONFIG.PAUSE_CHANCE) {
                await randomDelay(300, 800);
            }

            // Simulate typo (type wrong char, then backspace)
            if (Math.random() < CONFIG.TYPO_CHANCE && i > 5) {
                const typoChar = String.fromCharCode(char.charCodeAt(0) + 1);
                typed += typoChar;
                updateElementText(element, typed, isContentEditable);
                await randomDelay(100, 200);

                // Backspace
                typed = typed.slice(0, -1);
                updateElementText(element, typed, isContentEditable);
                await randomDelay(50, 100);
            }

            // Type the correct character
            typed += char;
            updateElementText(element, typed, isContentEditable);

            // Dispatch input event
            element.dispatchEvent(new Event('input', { bubbles: true }));

            // Inter-key delay
            await randomDelay(CONFIG.TYPE_DELAY_MIN, CONFIG.TYPE_DELAY_MAX);
        }

        // Final events
        element.dispatchEvent(new Event('change', { bubbles: true }));
        console.log('✅ [HumanSim] Typing completed');
    }

    /**
     * Helper to update element text content
     */
    function updateElementText(element, text, isContentEditable) {
        if (isContentEditable) {
            element.textContent = text;
        } else {
            element.value = text;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // EXPORTS
    // ═══════════════════════════════════════════════════════════════════════════

    // Export to window for use by other modules
    window.HumanSimulator = {
        randomDelay,
        humanMouseMove,
        humanClick,
        humanType,
        CONFIG
    };

    console.log('🤖 [HumanSimulator] Module loaded');

})();
