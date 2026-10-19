'use strict';

/**
 * Shared helper functions used by every <http-client-*> custom element.
 *
 * Everything is exposed through one global namespace object, `HttpClientToolkit`,
 * because the application uses classic <script> tags (not ES modules) so that
 * index.html keeps working when opened directly from the file system (file://).
 */
const HttpClientToolkit = (() => {
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
     * Formats a number of bytes as a human readable string (B, KB or MB).
     * @param {number} byteCount Size in bytes.
     * @returns {string} For example "512 B", "1.5 KB" or "2.00 MB".
     */
    const formatByteCountForDisplay = (byteCount) => {
        const bytesPerKilobyte = 1024;
        const bytesPerMegabyte = 1024 * 1024;
        if (byteCount < bytesPerKilobyte) return `${byteCount} B`;
        if (byteCount < bytesPerMegabyte) return `${(byteCount / bytesPerKilobyte).toFixed(1)} KB`;
        return `${(byteCount / bytesPerMegabyte).toFixed(2)} MB`;
    };

    /**
     * Formats a duration as milliseconds (below one second) or seconds.
     * @param {number} durationInMilliseconds Duration in milliseconds.
     * @returns {string} For example "250 ms" or "1.35 s".
     */
    const formatDurationForDisplay = (durationInMilliseconds) => {
        if (durationInMilliseconds < 1000) return `${Math.round(durationInMilliseconds)} ms`;
        return `${(durationInMilliseconds / 1000).toFixed(2)} s`;
    };

    /**
     * Dispatches a CustomEvent that bubbles up through the DOM (and out of any
     * Shadow DOM), so parent components can listen for it.
     * @param {HTMLElement} targetElement The element that emits the event.
     * @param {string} eventName The event name, for example "http-client-value-changed".
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
     * Copies text to the clipboard. Uses the modern async Clipboard API and falls
     * back to a hidden textarea + execCommand for insecure contexts (such as file://).
     * @param {string} textToCopy The text to place on the clipboard.
     * @returns {Promise<void>}
     */
    const copyTextToClipboard = async (textToCopy) => {
        try {
            await navigator.clipboard.writeText(textToCopy);
        } catch {
            const temporaryTextArea = Object.assign(document.createElement('textarea'), { value: textToCopy });
            document.body.append(temporaryTextArea);
            temporaryTextArea.select();
            document.execCommand('copy');
            temporaryTextArea.remove();
        }
    };

    /**
     * Small wrapper around localStorage that stores JSON and never throws
     * (storage can be disabled, full, or contain corrupt data).
     */
    const localStorageJson = {
        /**
         * @param {string} storageKey Key to read.
         * @param {*} [fallbackValue] Returned when the key is missing or unreadable.
         * @returns {*} The parsed value or the fallback.
         */
        readValue(storageKey, fallbackValue = null) {
            try {
                const storedText = localStorage.getItem(storageKey);
                return storedText === null ? fallbackValue : JSON.parse(storedText);
            } catch {
                return fallbackValue;
            }
        },
        /**
         * @param {string} storageKey Key to write.
         * @param {*} valueToStore Any JSON-serialisable value.
         */
        writeValue(storageKey, valueToStore) {
            try { localStorage.setItem(storageKey, JSON.stringify(valueToStore)); } catch { /* quota exceeded or storage disabled: ignore */ }
        },
        /** @param {string} storageKey Key to delete. */
        removeValue(storageKey) {
            try { localStorage.removeItem(storageKey); } catch { /* storage disabled: ignore */ }
        },
    };

    /**
     * Splits a URL string into base, query string and fragment WITHOUT normalising it
     * (unlike `new URL()`), so the text the user typed is preserved exactly.
     * @param {string} fullUrl For example "https://x.dev/a?b=1#top".
     * @returns {{baseUrl:string, queryString:string, fragment:string}} "https://x.dev/a", "b=1", "#top".
     */
    const splitUrlIntoParts = (fullUrl) => {
        const fragmentStartIndex = fullUrl.indexOf('#');
        const fragment = fragmentStartIndex >= 0 ? fullUrl.slice(fragmentStartIndex) : '';
        const urlWithoutFragment = fragmentStartIndex >= 0 ? fullUrl.slice(0, fragmentStartIndex) : fullUrl;
        const queryStartIndex = urlWithoutFragment.indexOf('?');
        return {
            baseUrl: queryStartIndex >= 0 ? urlWithoutFragment.slice(0, queryStartIndex) : urlWithoutFragment,
            queryString: queryStartIndex >= 0 ? urlWithoutFragment.slice(queryStartIndex + 1) : '',
            fragment,
        };
    };

    /**
     * Percent-decodes one query string component ("+" means space); malformed
     * escape sequences are returned unchanged instead of throwing.
     * @param {string} encodedComponent Encoded text.
     * @returns {string} Decoded text.
     */
    const decodeQueryComponent = (encodedComponent) => {
        try { return decodeURIComponent(encodedComponent.replace(/\+/g, ' ')); } catch { return encodedComponent; }
    };

    /**
     * Parses "a=1&b=2&c" into a list of name/value pairs.
     * @param {string} queryString Query string without the leading "?".
     * @returns {Array<{keyText:string, valueText:string}>} One entry per parameter.
     */
    const parseQueryStringIntoRows = (queryString) => queryString
        .split('&')
        .filter(Boolean)
        .map((parameterText) => {
            const equalsSignIndex = parameterText.indexOf('=');
            // A parameter without "=" (like "c") has an empty value.
            if (equalsSignIndex < 0) return { keyText: decodeQueryComponent(parameterText), valueText: '' };
            return {
                keyText: decodeQueryComponent(parameterText.slice(0, equalsSignIndex)),
                valueText: decodeQueryComponent(parameterText.slice(equalsSignIndex + 1)),
            };
        });

    return {
        escapeHtmlSpecialCharacters,
        formatByteCountForDisplay,
        formatDurationForDisplay,
        dispatchCustomEvent,
        registerCustomElementOnce,
        parseOptionList,
        copyTextToClipboard,
        localStorageJson,
        splitUrlIntoParts,
        parseQueryStringIntoRows,
    };
})();
