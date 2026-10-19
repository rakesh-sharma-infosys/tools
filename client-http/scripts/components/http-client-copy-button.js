'use strict';

/**
 * <http-client-copy-button> — a button that copies text to the clipboard and
 * briefly shows "Copied!" as confirmation.
 *
 * Supply the text with either:
 *   - the `textToCopy` property (a fixed string), or
 *   - the `textToCopyProvider` property (a function called at click time, so the
 *     text is always up to date). If it returns an empty value nothing is copied.
 *
 * Supports the same attributes as <http-client-button>.
 * Requires http-client-button.js to be loaded first.
 */
class HttpClientCopyButton extends HttpClientButton {
    // Label used when the page does not specify one.
    static defaultLabelText = 'Copy';

    /** @type {string|undefined} Fixed text to copy when no provider function is set. */
    textToCopy;

    /** @type {(() => string)|undefined} Function returning the text to copy at click time. */
    textToCopyProvider;

    /** Builds the button (via the parent class) and attaches the click behaviour once. */
    connectedCallback() {
        super.connectedCallback();
        if (this._isClickListenerAttached) return;
        this._isClickListenerAttached = true;

        this.addEventListener('click', async () => {
            // Prefer the provider so callers can compute the text lazily.
            const textToPlaceOnClipboard = this.textToCopyProvider ? this.textToCopyProvider() : this.textToCopy;
            if (textToPlaceOnClipboard === undefined || textToPlaceOnClipboard === null || textToPlaceOnClipboard === '') return;

            await HttpClientToolkit.copyTextToClipboard(textToPlaceOnClipboard);

            // Flash the confirmation text, then restore the original label.
            this._nativeButtonElement.textContent = 'Copied!';
            clearTimeout(this._confirmationResetTimerIdentifier);
            this._confirmationResetTimerIdentifier = setTimeout(() => {
                this._nativeButtonElement.textContent = this._buttonLabelText;
            }, 1200);
        });
    }
}
HttpClientToolkit.registerCustomElementOnce('http-client-copy-button', HttpClientCopyButton);
