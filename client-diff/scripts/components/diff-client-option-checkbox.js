'use strict';

/**
 * <diff-client-option-checkbox> — a labelled on/off checkbox.
 *
 * Attributes:
 *   label     Text shown next to the checkbox.
 *   checked   Present when initially on.
 *
 * Properties:  isChecked
 * Events:      diff-client-value-changed   detail: { value: boolean }
 */
class DiffClientOptionCheckbox extends HTMLElement {
    /** Builds the label + checkbox the first time the element is attached to the page. */
    connectedCallback() {
        if (this._checkboxInputElement) return;
        const labelElement = document.createElement('label');
        labelElement.className = 'option-checkbox-label';

        this._checkboxInputElement = Object.assign(document.createElement('input'), {
            type: 'checkbox',
            checked: this.hasAttribute('checked'),
        });
        this._checkboxInputElement.addEventListener('change', () => {
            // The native change event does not cross the custom element boundary in a useful way, so re-emit our own.
            DiffClientToolkit.dispatchCustomEvent(this, 'diff-client-value-changed', { value: this._checkboxInputElement.checked });
        });

        const labelTextElement = document.createElement('span');
        labelTextElement.textContent = this.getAttribute('label') ?? '';

        labelElement.append(this._checkboxInputElement, labelTextElement);
        this.append(labelElement);
    }

    /** @returns {boolean} Whether the checkbox is currently ticked. */
    get isChecked() {
        return this._checkboxInputElement ? this._checkboxInputElement.checked : this.hasAttribute('checked');
    }
    /** @param {boolean} newCheckedState Ticks or unticks the checkbox (no event is emitted). */
    set isChecked(newCheckedState) {
        if (this._checkboxInputElement) this._checkboxInputElement.checked = Boolean(newCheckedState);
        else this.toggleAttribute('checked', Boolean(newCheckedState));
    }
}
DiffClientToolkit.registerCustomElementOnce('diff-client-option-checkbox', DiffClientOptionCheckbox);
