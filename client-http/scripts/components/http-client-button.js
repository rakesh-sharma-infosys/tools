'use strict';

/**
 * <http-client-button> — a styled action button.
 *
 * Attributes:
 *   label     Button text (falls back to the element's own text content).
 *   variant   "primary" | "danger" | "ghost" | (omitted = neutral).
 *   size      "small" | (omitted = normal).
 *   type      "button" (default) | "submit" — "submit" submits the surrounding <form>.
 *   disabled  Boolean attribute that disables the button.
 *
 * The element wraps a native <button>, so click events, keyboard focus and
 * form submission all behave natively.
 */
class HttpClientButton extends HTMLElement {
    // Attributes that must re-render the native button when they change.
    static observedAttributes = ['label', 'variant', 'size', 'type', 'disabled'];

    // Text used when neither a label attribute nor text content is provided. Subclasses override this.
    static defaultLabelText = '';

    /** Builds the inner native <button> once, the first time the element is attached to the page. */
    connectedCallback() {
        // Guard: connectedCallback also fires when the element is moved in the DOM.
        if (this._nativeButtonElement) return;

        // The label may come from the attribute, from inner text, or from the class default.
        this._buttonLabelText = this.getAttribute('label') ?? (this.textContent.trim() || this.constructor.defaultLabelText);
        this.textContent = ''; // remove the original text node; the native button will show the label

        this._nativeButtonElement = document.createElement('button');
        this.append(this._nativeButtonElement);
        this._synchronizeNativeButtonWithAttributes();
    }

    /**
     * Called by the browser whenever one of the observed attributes changes.
     * @param {string} attributeName Which attribute changed.
     * @param {string|null} previousValue Value before the change (unused).
     * @param {string|null} newValue Value after the change.
     */
    attributeChangedCallback(attributeName, previousValue, newValue) {
        if (attributeName === 'label') this._buttonLabelText = newValue ?? '';
        // Before connectedCallback has run there is nothing to update yet.
        if (this._nativeButtonElement) this._synchronizeNativeButtonWithAttributes();
    }

    /** @returns {string} The text currently shown on the button. */
    get label() { return this._buttonLabelText ?? this.getAttribute('label') ?? ''; }
    /** @param {string} newLabelText Replaces the button text. */
    set label(newLabelText) { this.setAttribute('label', newLabelText); }

    /** @returns {boolean} Whether the button is disabled. */
    get disabled() { return this.hasAttribute('disabled'); }
    /** @param {boolean} shouldBeDisabled Enables or disables the button. */
    set disabled(shouldBeDisabled) { this.toggleAttribute('disabled', Boolean(shouldBeDisabled)); }

    /** Copies the current attributes and label onto the inner native <button>. */
    _synchronizeNativeButtonWithAttributes() {
        const variantName = this.getAttribute('variant');
        const sizeName = this.getAttribute('size');
        // CSS classes are derived from the attributes, e.g. "button-control variant-primary size-small".
        this._nativeButtonElement.className = [
            'button-control',
            variantName ? `variant-${variantName}` : '',
            sizeName ? `size-${sizeName}` : '',
        ].filter(Boolean).join(' ');
        this._nativeButtonElement.type = this.getAttribute('type') || 'button';
        this._nativeButtonElement.disabled = this.hasAttribute('disabled');
        this._nativeButtonElement.textContent = this._buttonLabelText;
    }
}
HttpClientToolkit.registerCustomElementOnce('http-client-button', HttpClientButton);
