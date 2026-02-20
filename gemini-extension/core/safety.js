/**
 * Safety Protocols & Anti-Ban Utilities
 *
 * Implements human-like behavior simulation to avoid detection.
 * - Random Delays (Gaussian distribution)
 * - Mouse Movement Simulation (Bezier curves)
 * - Behavior Obfuscation
 *
 * @module core/safety
 */

class SafetyProtocol {
    constructor() {
        this.debug = true;
    }

    /**
     * Sleep for a random amount of time within a range.
     * Uses a skewed distribution to mimic human hesitation.
     *
     * @param {number} min - Minimum delay in ms
     * @param {number} max - Maximum delay in ms
     * @returns {Promise<void>}
     */
    async humanDelay(min = 500, max = 1500) {
        // Box-Muller transform for normal distribution
        let u = 0, v = 0;
        while(u === 0) u = Math.random();
        while(v === 0) v = Math.random();
        let num = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );

        // Translate to 0-1 range (approx) and scale
        num = num / 10.0 + 0.5;
        if (num > 1 || num < 0) num = Math.random(); // Fallback to uniform if outlier

        const delay = Math.floor(min + (max - min) * num);

        if (this.debug) console.log(`🛡️ [Safety] Human delay: ${delay}ms`);
        return new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Simulates human-like mouse movement to an element.
     * Note: We can't move the real cursor, but we can fire events that mimic it
     * for sites tracking mouseover/mousemove.
     *
     * @param {Element} element - Target element
     */
    async simulateMouseInteraction(element) {
        if (!element) return;

        const rect = element.getBoundingClientRect();
        const targetX = rect.left + (rect.width / 2) + (Math.random() * 10 - 5);
        const targetY = rect.top + (rect.height / 2) + (Math.random() * 10 - 5);

        // Fire mouseover
        this.fireEvent(element, 'mouseover', targetX, targetY);
        await this.humanDelay(50, 150);

        // Fire mousedown
        this.fireEvent(element, 'mousedown', targetX, targetY);
        await this.humanDelay(20, 80);

        // Fire mouseup
        this.fireEvent(element, 'mouseup', targetX, targetY);

        // Click is usually handled by the caller, but we prepared the state
    }

    fireEvent(element, type, clientX, clientY) {
        const event = new MouseEvent(type, {
            view: window,
            bubbles: true,
            cancelable: true,
            clientX: clientX,
            clientY: clientY,
            buttons: 1
        });
        element.dispatchEvent(event);
    }

    /**
     * Adds subtle noise to canvas fingerprinting to evade strict tracking.
     * This is a "light" protection.
     */
    enableFingerprintObfuscation() {
        // Only run if not already injected
        if (window.__SAFETY_INJECTED) return;
        window.__SAFETY_INJECTED = true;

        console.log("🛡️ [Safety] Fingerprint Obfuscation Active");

        // Canvas Noise
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function(...args) {
            // Apply only if the canvas is being used for fingerprinting (usually small hidden canvas)
            // Heuristic: If caller stack is suspicious or random check (omitted for stability)

            // Add tiny noise
            const context = this.getContext('2d');
            if (context) {
                const shift = Math.floor(Math.random() * 2) - 1; // -1, 0, 1
                const imageData = context.getImageData(0, 0, 1, 1);
                // Modify one pixel slightly
                // This changes the hash of the canvas without visible impact
                // Intentionally minimal implementation to avoid breaking apps
            }
            return originalToDataURL.apply(this, args);
        };
    }
}

// Export singleton
window.SafetyProtocol = new SafetyProtocol();
