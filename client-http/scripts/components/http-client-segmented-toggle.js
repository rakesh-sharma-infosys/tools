'use strict';

/**
 * <http-client-segmented-toggle> — a row of buttons where exactly one is selected.
 *
 * Attributes:
 *   options   Choices as "value:Label,otherValue:Other label".
 *   value     Initially selected value (defaults to the first option).
 *
 * Properties:  selectedValue, selectableOptions
 * Events:      http-client-value-changed   detail: { value }
 */
class HttpClientSegmentedToggle extends HTMLElement {
    static observedAttributes = ['value'];

    /** Builds the button group the first time the element is attached to the page. */
    connectedCallback() {
        if (this._buttonGroupElement) return;
        this._buttonGroupElement = document.createElement('div');
        this._buttonGroupElement.className = 'segmented-toggle-group';

        // One delegated click listener handles every segment button.
        this._buttonGroupElement.addEventListener('click', (clickEvent) => {
            const clickedSegmentButton = clickEvent.target.closest('button');
            if (!clickedSegmentButton) return;
            this._currentSelectedValue = clickedSegmentButton.dataset.optionValue;
            this._highlightSelectedSegment();
            HttpClientToolkit.dispatchCustomEvent(this, 'http-client-value-changed', { value: this._currentSelectedValue });
        });
        this.append(this._buttonGroupElement);
        this._renderSegments();
    }

    /**
     * Reacts to the `value` attribute being changed from outside.
     * @param {string} attributeName Which attribute changed.
     * @param {string|null} previousValue Previous value (unused).
     * @param {string|null} newValue New value.
     */
    attributeChangedCallback(attributeName, previousValue, newValue) {
        if (attributeName !== 'value') return;
        this._currentSelectedValue = newValue;
        if (this._buttonGroupElement) this._highlightSelectedSegment();
    }

    /** @returns {Array<{value:string,label:string}>} The available choices. */
    get selectableOptions() {
        return this._selectableOptionList ?? HttpClientToolkit.parseOptionList(this.getAttribute('options'));
    }
    /** @param {Array|string} newOptions Replaces the choices and re-renders. */
    set selectableOptions(newOptions) {
        this._selectableOptionList = HttpClientToolkit.parseOptionList(newOptions);
        if (this._buttonGroupElement) this._renderSegments();
    }

    /** @returns {string} The currently selected value. */
    get selectedValue() {
        return this._currentSelectedValue ?? this.getAttribute('value') ?? this.selectableOptions[0]?.value ?? '';
    }
    /** @param {string} newValue Selects the segment with this value (no event is emitted). */
    set selectedValue(newValue) {
        this._currentSelectedValue = newValue;
        if (this._buttonGroupElement) this._highlightSelectedSegment();
    }

    /** Creates one button per option. */
    _renderSegments() {
        this._buttonGroupElement.textContent = '';
        this.selectableOptions.forEach((option) => {
            const segmentButton = Object.assign(document.createElement('button'), { type: 'button', textContent: option.label });
            segmentButton.dataset.optionValue = option.value;
            this._buttonGroupElement.append(segmentButton);
        });
        this._highlightSelectedSegment();
    }

    /** Marks only the selected segment button as active. */
    _highlightSelectedSegment() {
        const currentValue = this.selectedValue;
        [...this._buttonGroupElement.children].forEach((segmentButton) => {
            segmentButton.classList.toggle('is-active', segmentButton.dataset.optionValue === currentValue);
        });
    }
}
HttpClientToolkit.registerCustomElementOnce('http-client-segmented-toggle', HttpClientSegmentedToggle);
