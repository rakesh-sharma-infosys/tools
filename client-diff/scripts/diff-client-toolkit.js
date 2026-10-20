'use strict';

/**
 * Shared helper functions used by every <diff-client-*> custom element.
 *
 * Everything is exposed through one global namespace object, `DiffClientToolkit`,
 * because the application uses classic <script> tags (not ES modules) so that
 * index.html keeps working when opened directly from the file system (file://).
 */
const DiffClientToolkit = (() => {
    /**
     * Replaces the characters that have a special meaning in HTML with their
     * entity equivalents, so that untrusted text can be safely placed in innerHTML.
     * @param {*} textToEscape Any value; it is converted to a string first.
     * @returns {string} The escaped text.
     */
    const escapeHtmlSpecialCharacters = (textToEscape) => {
        // Lookup table: special character -> HTML entity.
        const entityByCharacter = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
        return String(textToEscape).replace(/[&<>"]/g, (matchedCharacter) => entityByCharacter[matchedCharacter]);
    };

    /**
     * Dispatches a CustomEvent that bubbles up through the DOM (and out of any
     * Shadow DOM), so parent components can listen for it.
     * @param {HTMLElement} targetElement The element that emits the event.
     * @param {string} eventName The event name, for example "diff-client-value-changed".
     * @param {object} [eventDetail] Extra data delivered as `event.detail`.
     */
    const dispatchCustomEvent = (targetElement, eventName, eventDetail = {}) => {
        targetElement.dispatchEvent(new CustomEvent(eventName, { detail: eventDetail, bubbles: true, composed: true }));
    };

    /**
     * Registers a custom element, but only if the tag name is not registered yet.
     * This makes loading a component script twice harmless.
     * @param {string} tagName Custom element tag name (must contain a hyphen).
     * @param {CustomElementConstructor} elementClass The class implementing the element.
     */
    const registerCustomElementOnce = (tagName, elementClass) => {
        if (!customElements.get(tagName)) customElements.define(tagName, elementClass);
    };

    /**
     * Converts the many accepted ways of describing select options into one shape.
     * Accepts an array of strings / {value,label} objects, or a comma separated
     * string such as "a,b" or "value:Label,otherValue:Other label".
     * @param {string|Array<string|{value:string,label:string}>} optionSource Raw option description.
     * @returns {Array<{value:string,label:string}>} Normalised option list.
     */
    const parseOptionList = (optionSource) => {
        const rawOptionList = Array.isArray(optionSource)
            ? optionSource
            : String(optionSource || '').split(',').filter(Boolean);

        return rawOptionList.map((rawOption) => {
            // Objects are assumed to already be in {value,label} shape.
            if (typeof rawOption !== 'string') return rawOption;
            // "value:Label" splits on the FIRST colon; a plain "value" uses itself as label.
            const separatorIndex = rawOption.indexOf(':');
            if (separatorIndex < 0) return { value: rawOption, label: rawOption };
            return { value: rawOption.slice(0, separatorIndex), label: rawOption.slice(separatorIndex + 1) };
        });
    };

    /**
     * Wraps a function so that it only runs once calls have stopped for a while.
     * Used to avoid recomputing the diff on every single keystroke.
     * @param {Function} functionToDelay The function to run after the quiet period.
     * @param {number} quietPeriodInMilliseconds How long to wait after the last call.
     * @returns {Function} The delayed version of the function.
     */
    const createDebouncedFunction = (functionToDelay, quietPeriodInMilliseconds) => {
        // Handle of the currently pending timer (if any), reset by every new call.
        let pendingTimerHandle = null;
        return (...functionArguments) => {
            clearTimeout(pendingTimerHandle);
            pendingTimerHandle = setTimeout(() => functionToDelay(...functionArguments), quietPeriodInMilliseconds);
        };
    };

    return {
        escapeHtmlSpecialCharacters,
        dispatchCustomEvent,
        registerCustomElementOnce,
        parseOptionList,
        createDebouncedFunction,
    };
})();
