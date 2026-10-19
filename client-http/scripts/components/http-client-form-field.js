'use strict';

// Counter used to give every radio group on the page a unique `name`, so separate groups never interfere.
let formFieldInstanceCounter = 0;

/**
 * <http-client-form-field> — a labelled form control.
 *
 * Attributes:
 *   type         text | password | number | textarea | select | radio | checkbox  (default: text)
 *   label        Visible label (omit for a bare control with no label).
 *   name         Identifier that parent components use to look the field up.
 *   value        Initial value.
 *   checked      Initial state (checkbox only).
 *   options      Select/radio choices: "a,b" or "value:Label,otherValue:Other label".
 *   placeholder, min, max, step, list, autocomplete, rows   Forwarded to the native control.
 *
 * Properties:
 *   value, checked, selectableOptions, nativeControlElement
 *
 * Events:
 *   http-client-value-changed   detail: { value, checked }
 */
class HttpClientFormField extends HTMLElement {
    static observedAttributes = ['value'];

    /** Renders the control the first time the element is attached to the page. */
    connectedCallback() {
        if (!this._nativeControlElement) this._renderControl();
    }

    /**
     * Keeps the control in sync when the `value` attribute is changed from outside.
     * @param {string} attributeName Which attribute changed (only "value" is observed).
     * @param {string|null} previousValue Previous attribute value (unused).
     * @param {string|null} newValue New attribute value.
     */
    attributeChangedCallback(attributeName, previousValue, newValue) {
        if (attributeName === 'value' && this._nativeControlElement && newValue !== this.value) {
            this._writeValueToControl(newValue ?? '');
        }
    }

    /** @returns {Array<{value:string,label:string}>} The select/radio choices. */
    get selectableOptions() {
        return this._selectableOptionList ?? HttpClientToolkit.parseOptionList(this.getAttribute('options'));
    }
    /** @param {Array|string} newOptions New choices; the control is re-rendered. */
    set selectableOptions(newOptions) {
        this._selectableOptionList = HttpClientToolkit.parseOptionList(newOptions);
        if (this._nativeControlElement) this._renderControl();
    }

    /** @returns {HTMLElement} The underlying native control (input, select, textarea or radio group wrapper). */
    get nativeControlElement() {
        this._renderControlIfNeeded();
        return this._nativeControlElement;
    }

    /** @returns {string} The current value (for checkboxes: "true" or "false"). */
    get value() {
        // Before rendering we can only report the initial attribute.
        if (!this._nativeControlElement) return this.getAttribute('value') ?? '';
        if (this._controlType === 'radio') {
            const checkedRadioInput = this._radioInputElements.find((radioInput) => radioInput.checked);
            return checkedRadioInput ? checkedRadioInput.value : '';
        }
        if (this._controlType === 'checkbox') return String(this._nativeControlElement.checked);
        return this._nativeControlElement.value;
    }
    /** @param {string} newValue Value to display in the control. */
    set value(newValue) {
        if (!this._nativeControlElement) this.setAttribute('value', newValue);
        else this._writeValueToControl(newValue);
    }

    /** @returns {boolean} Checked state (meaningful for checkboxes). */
    get checked() {
        return this._nativeControlElement ? Boolean(this._nativeControlElement.checked) : this.hasAttribute('checked');
    }
    /** @param {boolean} isChecked New checked state. */
    set checked(isChecked) {
        if (this._nativeControlElement) this._nativeControlElement.checked = Boolean(isChecked);
        else this.toggleAttribute('checked', Boolean(isChecked));
    }

    /** Moves keyboard focus to the underlying control. */
    focus() {
        this.nativeControlElement.focus?.();
    }

    /** Renders the control if it has not been rendered yet (lazy initialisation). */
    _renderControlIfNeeded() {
        if (!this._nativeControlElement) this._renderControl();
    }

    /**
     * Writes a value into whichever kind of native control is in use.
     * @param {string|boolean} valueToWrite The value (or boolean for checkboxes).
     */
    _writeValueToControl(valueToWrite) {
        if (this._controlType === 'radio') {
            // Check the radio whose value matches; uncheck the others.
            this._radioInputElements.forEach((radioInput) => { radioInput.checked = radioInput.value === valueToWrite; });
        } else if (this._controlType === 'checkbox') {
            this._nativeControlElement.checked = valueToWrite === true || valueToWrite === 'true';
        } else {
            this._nativeControlElement.value = valueToWrite;
        }
    }

    /** (Re)builds the DOM for this field from its attributes, keeping the current value. */
    _renderControl() {
        const controlType = this.getAttribute('type') || 'text';
        const labelText = this.getAttribute('label');

        // Remember the value so re-rendering (for example after options change) does not lose it.
        const valueToKeep = this._nativeControlElement ? this.value : this.getAttribute('value');
        const checkedStateToKeep = this._nativeControlElement && controlType === 'checkbox' ? this.checked : this.hasAttribute('checked');

        this.textContent = '';
        this._controlType = controlType;
        this._radioInputElements = [];
        let nativeControlElement;

        if (controlType === 'select') {
            nativeControlElement = document.createElement('select');
            this.selectableOptions.forEach((option) => nativeControlElement.add(new Option(option.label, option.value)));
        } else if (controlType === 'radio') {
            // A radio "control" is a wrapper containing one labelled radio input per option.
            nativeControlElement = document.createElement('div');
            nativeControlElement.className = 'inline-row allow-wrap radio-option-group';
            const radioGroupName = `http-client-form-field-${++formFieldInstanceCounter}`;
            this.selectableOptions.forEach((option) => {
                const optionLabelElement = document.createElement('label');
                const radioInputElement = Object.assign(document.createElement('input'), { type: 'radio', name: radioGroupName, value: option.value });
                optionLabelElement.append(radioInputElement, ' ' + option.label);
                nativeControlElement.append(optionLabelElement);
                this._radioInputElements.push(radioInputElement);
            });
        } else if (controlType === 'textarea') {
            nativeControlElement = document.createElement('textarea');
        } else {
            nativeControlElement = document.createElement('input');
            nativeControlElement.type = controlType;
        }
        this._nativeControlElement = nativeControlElement;

        if (controlType !== 'radio') {
            // Copy through the attributes the native control understands.
            ['placeholder', 'min', 'max', 'step', 'list', 'autocomplete', 'rows'].forEach((attributeName) => {
                if (this.hasAttribute(attributeName)) nativeControlElement.setAttribute(attributeName, this.getAttribute(attributeName));
            });
            nativeControlElement.spellcheck = false; // spell-check underlines are noise for URLs, headers and JSON
        }

        // Layout: bare control, inline checkbox label, or label stacked above the control.
        if (!labelText || controlType === 'radio') {
            this.append(nativeControlElement);
        } else if (controlType === 'checkbox') {
            const checkboxLabelElement = Object.assign(document.createElement('label'), { className: 'checkbox-label' });
            checkboxLabelElement.append(nativeControlElement, Object.assign(document.createElement('span'), { textContent: labelText }));
            this.append(checkboxLabelElement);
        } else {
            const labelledFieldElement = Object.assign(document.createElement('label'), { className: 'labelled-field' });
            labelledFieldElement.append(Object.assign(document.createElement('span'), { textContent: labelText }), nativeControlElement);
            this.append(labelledFieldElement);
        }

        // Restore the initial/kept value.
        if (controlType === 'checkbox') nativeControlElement.checked = checkedStateToKeep;
        else if (valueToKeep !== null) this._writeValueToControl(valueToKeep);
        // A radio group with nothing selected defaults to its first option.
        if (controlType === 'radio' && !this._radioInputElements.some((radioInput) => radioInput.checked) && this._radioInputElements[0]) {
            this._radioInputElements[0].checked = true;
        }

        // Text-like controls report every keystroke ("input"); choice controls report on "change".
        const changeEventName = ['select', 'radio', 'checkbox'].includes(controlType) ? 'change' : 'input';
        nativeControlElement.addEventListener(changeEventName, () => {
            HttpClientToolkit.dispatchCustomEvent(this, 'http-client-value-changed', { value: this.value, checked: this.checked });
        });
    }
}
HttpClientToolkit.registerCustomElementOnce('http-client-form-field', HttpClientFormField);
