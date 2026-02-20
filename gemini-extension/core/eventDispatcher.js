/**
 * Event Dispatcher Utilities
 * 
 * Provides utilities for dispatching DOM events that YouTube Studio's
 * Polymer/Lit framework can detect and respond to.
 * 
 * @module core/eventDispatcher
 * @version 1.0.0
 * @date 2025-12-26
 */

/**
 * Dispatches a sequence of events to simulate user interaction.
 * YouTube Studio uses Polymer/Lit which requires proper event sequences.
 * 
 * @param {Element} element - Target element
 * @param {string[]} eventTypes - Array of event types to dispatch
 * @param {Object} [options={}] - Additional event options
 * 
 * @example
 * // Simulate full input interaction
 * dispatchEvents(input, ['focus', 'click', 'input', 'change', 'blur']);
 */
function dispatchEvents(element, eventTypes, options = {}) {
    const defaultOptions = { bubbles: true, cancelable: true };
    const mergedOptions = { ...defaultOptions, ...options };

    eventTypes.forEach(type => {
        const event = new Event(type, mergedOptions);
        element.dispatchEvent(event);
    });
}

/**
 * Dispatches input event with proper InputEvent for text inputs.
 * This is required for frameworks that listen to InputEvent.
 * 
 * @param {Element} input - Input element
 * @param {string} data - Character or text that was input
 * @param {string} [inputType='insertText'] - Type of input
 */
function dispatchInputEvent(input, data, inputType = 'insertText') {
    const event = new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        data: data,
        inputType: inputType
    });
    input.dispatchEvent(event);
}

/**
 * Dispatches keyboard events for a key press.
 * 
 * @param {Element} element - Target element
 * @param {string} key - Key name (e.g., 'Enter', 'Tab', 'Escape')
 * @param {Object} [options={}] - Additional key options
 * 
 * @example
 * // Press Enter key
 * dispatchKeyPress(input, 'Enter');
 * 
 * @example
 * // Press key with modifier
 * dispatchKeyPress(input, 'a', { ctrlKey: true });
 */
function dispatchKeyPress(element, key, options = {}) {
    const keyCode = getKeyCode(key);

    const eventOptions = {
        key: key,
        code: key,
        keyCode: keyCode,
        which: keyCode,
        bubbles: true,
        cancelable: true,
        ...options
    };

    // Dispatch keydown, keypress (if applicable), and keyup
    element.dispatchEvent(new KeyboardEvent('keydown', eventOptions));

    // keypress is deprecated but some sites still use it
    if (key.length === 1) {
        element.dispatchEvent(new KeyboardEvent('keypress', eventOptions));
    }

    element.dispatchEvent(new KeyboardEvent('keyup', eventOptions));
}

/**
 * Gets the key code for common keys.
 * 
 * @param {string} key - Key name
 * @returns {number} Key code
 */
function getKeyCode(key) {
    const keyCodes = {
        'Enter': 13,
        'Tab': 9,
        'Escape': 27,
        'Backspace': 8,
        'Delete': 46,
        'ArrowUp': 38,
        'ArrowDown': 40,
        'ArrowLeft': 37,
        'ArrowRight': 39,
        'Space': 32,
        ' ': 32
    };

    return keyCodes[key] || key.charCodeAt(0);
}

/**
 * Types text into an input character by character.
 * This is required for some frameworks that don't detect direct value assignment.
 * 
 * @param {Element} input - Input element
 * @param {string} text - Text to type
 * @param {number} [charDelayMs=30] - Delay between characters in milliseconds
 * 
 * @example
 * // Type time value slowly for YouTube Studio to detect
 * await typeText(timeInput, '10:00 AM', 30);
 */
async function typeText(input, text, charDelayMs = 30) {
    // Focus and clear first
    input.focus();
    input.setSelectionRange(0, input.value.length);
    input.value = '';
    dispatchInputEvent(input, '', 'deleteContentBackward');

    await window.delay?.(100) || new Promise(r => setTimeout(r, 100));

    // Type each character
    for (const char of text) {
        input.value += char;
        dispatchInputEvent(input, char, 'insertText');
        await window.delay?.(charDelayMs) || new Promise(r => setTimeout(r, charDelayMs));
    }

    // Dispatch change event
    input.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Sets input value with full event sequence.
 * Use this for inputs that need proper framework binding.
 * 
 * @param {Element} input - Input element
 * @param {string} value - Value to set
 * @param {boolean} [pressEnter=true] - Whether to press Enter after setting
 * 
 * @example
 * // Set date value with confirmation
 * await setInputValue(dateInput, '12/27/2025', true);
 */
async function setInputValue(input, value, pressEnter = true) {
    input.focus();
    input.click();

    await window.delay?.(100) || new Promise(r => setTimeout(r, 100));

    // Clear existing value
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    // Set new value
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    if (pressEnter) {
        dispatchKeyPress(input, 'Enter');
    }

    input.blur();
}

/**
 * Simulates a click with full event sequence.
 * Some YouTube Studio buttons need this full sequence.
 * 
 * @param {Element} element - Element to click
 */
function simulateClick(element) {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const mouseDownEvent = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y
    });

    const mouseUpEvent = new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y
    });

    const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y
    });

    element.dispatchEvent(mouseDownEvent);
    element.dispatchEvent(mouseUpEvent);
    element.dispatchEvent(clickEvent);
}

// Export for use in other modules
window.EventDispatcher = {
    dispatchEvents,
    dispatchInputEvent,
    dispatchKeyPress,
    typeText,
    setInputValue,
    simulateClick,
    getKeyCode
};

// Also expose commonly used functions globally
window.typeText = typeText;
window.setInputValue = setInputValue;
window.simulateClick = simulateClick;
window.dispatchKeyPress = dispatchKeyPress;

console.log('📦 [Module] eventDispatcher.js loaded');
