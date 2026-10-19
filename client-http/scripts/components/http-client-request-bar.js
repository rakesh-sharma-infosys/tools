'use strict';

/**
 * <http-client-request-bar> — the top bar of the app: HTTP method selector, URL
 * input, and the Send / Cancel / "copy as cURL" actions.
 *
 * Attributes:
 *   methods   Comma separated list of selectable HTTP methods
 *             (default "GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS").
 *
 * Properties:
 *   selectedMethod        The chosen HTTP method (read/write).
 *   urlText               The URL text box content (read/write).
 *   isRequestInFlight     When true the Send button is replaced by a Cancel button (read/write).
 *   curlCommandProvider   Function returning the cURL command text when "cURL" is clicked.
 *
 * Events:
 *   http-client-send-requested     The user pressed Send or Enter in the URL box.
 *   http-client-cancel-requested   The user pressed Cancel.
 *   http-client-url-edited         The user typed in the URL box; detail: { urlText }.
 *
 * Requires: http-client-form-field, http-client-button, http-client-copy-button.
 */
class HttpClientRequestBar extends HTMLElement {
    /** @type {(() => string)|undefined} Supplies the cURL command text for the copy button. */
    curlCommandProvider;

    /** Builds the form once the element is attached to the page. */
    connectedCallback() {
        if (this._formElement) return;

        const availableMethodsText = this.getAttribute('methods') || 'GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS';
        this.innerHTML = `
            <form class="request-bar-form" autocomplete="off">
                <http-client-form-field name="httpMethod" type="select" options="${HttpClientToolkit.escapeHtmlSpecialCharacters(availableMethodsText)}"></http-client-form-field>
                <http-client-form-field name="requestUrl" placeholder="https://api.example.com/users?page=1"></http-client-form-field>
                <http-client-button name="sendButton" type="submit" variant="primary" label="Send"></http-client-button>
                <http-client-button name="cancelButton" variant="danger" label="Cancel" hidden></http-client-button>
                <http-client-copy-button name="copyCurlButton" label="cURL" title="Copy request as cURL"></http-client-copy-button>
            </form>`;
        this._formElement = this.querySelector('form');

        // Looks up one of the named child controls.
        this._findControlByName = (controlName) => this.querySelector(`[name="${controlName}"]`);

        // Submitting the form (Send button or Enter key) must not reload the page.
        this._formElement.addEventListener('submit', (submitEvent) => {
            submitEvent.preventDefault();
            HttpClientToolkit.dispatchCustomEvent(this, 'http-client-send-requested');
        });
        this._findControlByName('cancelButton').addEventListener('click', () => {
            HttpClientToolkit.dispatchCustomEvent(this, 'http-client-cancel-requested');
        });
        // Re-emit URL typing under a more specific name and hide the generic child event from outside listeners.
        this._findControlByName('requestUrl').addEventListener('http-client-value-changed', (valueChangedEvent) => {
            valueChangedEvent.stopPropagation();
            HttpClientToolkit.dispatchCustomEvent(this, 'http-client-url-edited', { urlText: this.urlText });
        });
        this._findControlByName('httpMethod').addEventListener('http-client-value-changed', (valueChangedEvent) => valueChangedEvent.stopPropagation());
        // The copy button asks us for the cURL text at click time.
        this._findControlByName('copyCurlButton').textToCopyProvider = () => this.curlCommandProvider?.();
    }

    /** @returns {string} The selected HTTP method, for example "GET". */
    get selectedMethod() { return this._findControlByName('httpMethod').value; }
    /** @param {string} methodName Method to select. */
    set selectedMethod(methodName) { this._findControlByName('httpMethod').value = methodName; }

    /** @returns {string} The text currently in the URL box. */
    get urlText() { return this._findControlByName('requestUrl').value; }
    /** @param {string} newUrlText New URL box content (no event is emitted). */
    set urlText(newUrlText) { this._findControlByName('requestUrl').value = newUrlText; }

    /** @returns {boolean} Whether a request is currently being sent. */
    get isRequestInFlight() { return this._isRequestInFlight || false; }
    /** @param {boolean} isInFlight true shows Cancel instead of Send. */
    set isRequestInFlight(isInFlight) {
        this._isRequestInFlight = Boolean(isInFlight);
        this._findControlByName('sendButton').hidden = this._isRequestInFlight;
        this._findControlByName('cancelButton').hidden = !this._isRequestInFlight;
    }
}
HttpClientToolkit.registerCustomElementOnce('http-client-request-bar', HttpClientRequestBar);
