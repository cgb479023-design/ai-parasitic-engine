/**
 * DOM Helper Utilities
 * 
 * Provides utilities for traversing Shadow DOM and waiting for elements.
 * Extracted from content.js for modularity.
 * 
 * @module core/domHelpers
 * @version 1.0.0
 * @date 2025-12-26
 */

/**
 * Recursively searches through Shadow DOM to find all matching elements.
 * YouTube Studio uses Shadow DOM extensively, so regular querySelectorAll won't work.
 * 
 * @param {Element|ShadowRoot|Document} root - The root element to start searching from
 * @param {string} selector - CSS selector to match
 * @returns {Element[]} Array of matching elements
 * 
 * @example
 * // Find all inputs including those in shadow roots
 * const inputs = deepQueryAll(document.body, 'input');
 * 
 * @example
 * // Find specific component
 * const datePickers = deepQueryAll(document.body, 'ytcp-date-picker');
 */
function deepQueryAll(root, selector) {
    const results = [];

    // 1. Check current root's light DOM children
    const nodes = Array.from(root.querySelectorAll('*'));

    // Also include the root itself if it matches
    if (root.matches && root.matches(selector)) {
        results.push(root);
    }

    // Add matching light DOM nodes
    nodes.forEach(node => {
        if (node.matches && node.matches(selector)) {
            results.push(node);
        }
    });

    // 2. Dive into Shadow Roots
    const allNodes = [root, ...nodes];
    allNodes.forEach(node => {
        if (node.shadowRoot) {
            results.push(...deepQueryAll(node.shadowRoot, selector));
        }
    });

    return results;
}

/**
 * Finds the first matching element in Shadow DOM.
 * 
 * @param {Element|ShadowRoot|Document} root - The root element to start searching from
 * @param {string} selector - CSS selector to match
 * @returns {Element|null} First matching element or null
 * 
 * @example
 * const dateInput = deepQuery(document.body, 'ytcp-date-picker input');
 */
function deepQuery(root, selector) {
    const results = deepQueryAll(root, selector);
    return results.length > 0 ? results[0] : null;
}

/**
 * Waits for an element to appear in the DOM.
 * Useful for waiting for dynamic content to load.
 * 
 * @param {string} selector - CSS selector to wait for
 * @param {number} [timeout=30000] - Maximum time to wait in milliseconds
 * @param {Element} [root=document] - Root element to search from
 * @returns {Promise<Element|null>} The found element or null if timeout
 * 
 * @example
 * // Wait up to 10 seconds for datetime picker
 * const picker = await waitForElement('ytcp-datetime-picker', 10000);
 * if (picker) {
 *     console.log('Picker found!');
 * }
 */
async function waitForElement(selector, timeout = 30000, root = document) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        // Try regular querySelector first (faster)
        let element = root.querySelector(selector);

        // If not found, try deep search (for shadow DOM)
        if (!element) {
            element = deepQuery(root, selector);
        }

        if (element) {
            return element;
        }

        // Wait 100ms before next check
        await new Promise(r => setTimeout(r, 100));
    }

    console.warn(`[domHelpers] Element "${selector}" not found after ${timeout}ms`);
    return null;
}

/**
 * Waits for multiple elements to appear.
 * 
 * @param {string} selector - CSS selector to wait for
 * @param {number} minCount - Minimum number of elements required
 * @param {number} [timeout=30000] - Maximum time to wait in milliseconds
 * @returns {Promise<Element[]>} Array of found elements (may be empty if timeout)
 * 
 * @example
 * // Wait for at least 5 calendar day cells
 * const cells = await waitForElements('.calendar-day', 5, 5000);
 */
async function waitForElements(selector, minCount = 1, timeout = 30000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        const elements = deepQueryAll(document.body, selector);

        if (elements.length >= minCount) {
            return elements;
        }

        await new Promise(r => setTimeout(r, 100));
    }

    console.warn(`[domHelpers] Only found ${document.querySelectorAll(selector).length} of ${minCount} required "${selector}" elements`);
    return deepQueryAll(document.body, selector);
}

/**
 * Checks if an element is visible in the viewport.
 * 
 * @param {Element} element - Element to check
 * @returns {boolean} True if element is visible
 */
function isElementVisible(element) {
    if (!element) return false;

    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);

    return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        style.opacity !== '0'
    );
}

/**
 * Finds the first visible element matching the selector.
 * 
 * @param {string} selector - CSS selector
 * @returns {Element|null} First visible matching element or null
 */
function findVisibleElement(selector) {
    const elements = deepQueryAll(document.body, selector);
    return elements.find(el => isElementVisible(el)) || null;
}

// Export for use in other modules
// Note: Chrome extensions don't support ES modules in content scripts by default
// These functions are available globally when this file is loaded
window.DomHelpers = {
    deepQueryAll,
    deepQuery,
    waitForElement,
    waitForElements,
    isElementVisible,
    findVisibleElement
};

// Also expose as global functions for backward compatibility
window.deepQueryAll = deepQueryAll;
window.deepQuery = deepQuery;
window.waitForElement = waitForElement;

console.log('📦 [Module] domHelpers.js loaded');
