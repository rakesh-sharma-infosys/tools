'use strict';

/**
 * <http-client-key-value-editor> — an editable table of key/value rows, each with
 * an enable/disable checkbox. A blank row is always kept at the bottom so the user
 * can simply keep typing to add more rows.
 *
 * Attributes:
 *   files     Adds a Text/File selector per row (used for multipart form-data).
 *   key-list  The id of a <datalist> used to suggest key names.
 *
 * Row object shape:
 *   { isEnabled:boolean, keyText:string, valueText:string, valueType:'text'|'file', selectedFile:File|null }
 *
 * Methods:
 *   getAllNonBlankRows()          Every row that has a key or a value.
 *   getEnabledRowsWithKey()       Rows that are checked AND have a key (the ones that get sent).
 *   serializeRowsForStorage()     Plain data without File objects, safe for localStorage.
 *   replaceAllRows(rowList)       Replaces the content (does NOT emit a change event).
 *
 * Events:
 *   http-client-value-changed     Emitted only for edits made by the user.
 */
class HttpClientKeyValueEditor extends HTMLElement {
    /** Builds the internal structure once the element is attached to the page. */
    connectedCallback() {
        this._buildStructureIfNeeded();
    }

    /** Creates the container and the first blank row, if not already done. */
    _buildStructureIfNeeded() {
        if (this._rowListContainerElement) return;
        /** @type {Array<object>} The row data objects, in display order. */
        this._rowDataList = [];
        this._rowListContainerElement = document.createElement('div');
        this._rowListContainerElement.className = 'key-value-list';
        this.append(this._rowListContainerElement);
        this._appendRow();
    }

    /** Tells listeners that the user changed something. */
    _notifyThatValueChanged() {
        HttpClientToolkit.dispatchCustomEvent(this, 'http-client-value-changed', { rows: this.serializeRowsForStorage() });
    }

    /**
     * Adds a row to the data list and to the DOM.
     * @param {object} [rowData] Initial row content; defaults to an enabled blank row.
     */
    _appendRow(rowData = { isEnabled: true, keyText: '', valueText: '', valueType: 'text', selectedFile: null }) {
        this._rowDataList.push(rowData);
        this._rowListContainerElement.append(this._createRowElement(rowData));
    }

    /**
     * Builds the DOM for one row and wires its event handlers.
     * @param {object} rowData The data object this row edits (mutated as the user types).
     * @returns {HTMLElement} The row element.
     */
    _createRowElement(rowData) {
        const supportsFileValues = this.hasAttribute('files');
        const rowElement = document.createElement('div');
        rowElement.className = 'key-value-row' + (rowData.isEnabled ? '' : ' row-disabled');

        const enabledCheckboxElement = Object.assign(document.createElement('input'), { type: 'checkbox', checked: rowData.isEnabled, title: 'Enable / disable' });
        const keyInputElement = Object.assign(document.createElement('input'), { type: 'text', value: rowData.keyText, placeholder: 'Key', spellcheck: false });
        const valueInputElement = Object.assign(document.createElement('input'), { type: 'text', value: rowData.valueText, placeholder: 'Value', spellcheck: false });
        const fileInputElement = Object.assign(document.createElement('input'), { type: 'file', hidden: true });
        const deleteButtonElement = Object.assign(document.createElement('button'), { type: 'button', className: 'key-value-delete-button', textContent: '×', title: 'Remove' });
        if (this.hasAttribute('key-list')) keyInputElement.setAttribute('list', this.getAttribute('key-list'));

        const rowChildElements = [enabledCheckboxElement, keyInputElement];

        // When the user types into the LAST row, append a fresh blank row below it.
        const handleUserEditedRow = () => {
            const lastRowData = this._rowDataList[this._rowDataList.length - 1];
            const rowIsNotBlank = rowData.keyText || rowData.valueText || rowData.selectedFile;
            if (rowData === lastRowData && rowIsNotBlank) this._appendRow();
            this._notifyThatValueChanged();
        };

        if (supportsFileValues) {
            // Per-row selector to choose between a text value and a file upload.
            const valueTypeSelectElement = document.createElement('select');
            valueTypeSelectElement.innerHTML = '<option value="text">Text</option><option value="file">File</option>';
            valueTypeSelectElement.value = rowData.valueType;
            // Show the text box or the file chooser depending on the selected type.
            const showInputMatchingValueType = () => {
                valueInputElement.hidden = rowData.valueType === 'file';
                fileInputElement.hidden = rowData.valueType !== 'file';
            };
            valueTypeSelectElement.onchange = () => { rowData.valueType = valueTypeSelectElement.value; showInputMatchingValueType(); this._notifyThatValueChanged(); };
            fileInputElement.onchange = () => { rowData.selectedFile = fileInputElement.files[0] || null; handleUserEditedRow(); };
            rowChildElements.push(valueTypeSelectElement);
            showInputMatchingValueType();
        }
        rowChildElements.push(valueInputElement, fileInputElement, deleteButtonElement);

        enabledCheckboxElement.onchange = () => {
            rowData.isEnabled = enabledCheckboxElement.checked;
            rowElement.classList.toggle('row-disabled', !rowData.isEnabled); // dims disabled rows
            this._notifyThatValueChanged();
        };
        keyInputElement.oninput = () => { rowData.keyText = keyInputElement.value; handleUserEditedRow(); };
        valueInputElement.oninput = () => { rowData.valueText = valueInputElement.value; handleUserEditedRow(); };
        deleteButtonElement.onclick = () => {
            this._rowDataList.splice(this._rowDataList.indexOf(rowData), 1);
            rowElement.remove();
            // Always keep exactly one blank row at the end.
            const lastRowData = this._rowDataList[this._rowDataList.length - 1];
            if (!lastRowData || lastRowData.keyText || lastRowData.valueText) this._appendRow();
            this._notifyThatValueChanged();
        };

        rowElement.append(...rowChildElements);
        return rowElement;
    }

    /** @returns {Array<object>} Every row that has a key or a value (blank rows are skipped). */
    getAllNonBlankRows() {
        this._buildStructureIfNeeded();
        return this._rowDataList.filter((rowData) => rowData.keyText.trim() || rowData.valueText);
    }

    /** @returns {Array<object>} Rows that are enabled and have a non-empty key: the rows that should be sent. */
    getEnabledRowsWithKey() {
        this._buildStructureIfNeeded();
        return this._rowDataList.filter((rowData) => rowData.isEnabled && rowData.keyText.trim());
    }

    /** @returns {Array<object>} Plain row data (without File objects) that can be stored as JSON. */
    serializeRowsForStorage() {
        return this.getAllNonBlankRows().map(({ isEnabled, keyText, valueText, valueType }) => ({ isEnabled, keyText, valueText, valueType }));
    }

    /**
     * Replaces all rows. Does not emit a change event, because this is a programmatic update.
     * @param {Array<object>} newRowList Partial row objects; missing fields get defaults.
     */
    replaceAllRows(newRowList) {
        this._buildStructureIfNeeded();
        this._rowDataList.length = 0;
        this._rowListContainerElement.textContent = '';
        newRowList.forEach((partialRowData) => this._appendRow({
            isEnabled: true, keyText: '', valueText: '', valueType: 'text', selectedFile: null, ...partialRowData,
        }));
        this._appendRow(); // trailing blank row
    }
}
HttpClientToolkit.registerCustomElementOnce('http-client-key-value-editor', HttpClientKeyValueEditor);
