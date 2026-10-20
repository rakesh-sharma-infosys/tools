'use strict';

/**
 * <diff-client-text-panel> — a titled text area that can be filled by typing,
 * pasting (button or Ctrl+V), uploading a file, or dragging a file onto it.
 *
 * Attributes:
 *   heading       Title shown above the text area, for example "Original".
 *   placeholder   Hint text shown while the text area is empty.
 *
 * Properties:  value   (get / set the text; setting does not emit an event)
 * Methods:     clearText()
 * Events:      diff-client-value-changed   detail: { value }
 *
 * Needs <diff-client-file-picker-button> to be registered.
 */
class DiffClientTextPanel extends HTMLElement {
    /** Builds the panel the first time the element is attached to the page. */
    connectedCallback() {
        if (this._textAreaElement) return;

        // ---- header: title + status + action buttons ----
        const headerElement = document.createElement('div');
        headerElement.className = 'text-panel-header';

        const headingElement = document.createElement('strong');
        headingElement.className = 'text-panel-heading';
        headingElement.textContent = this.getAttribute('heading') ?? '';

        // Shows the loaded file name (if any) plus line and character counts.
        this._statusElement = document.createElement('span');
        this._statusElement.className = 'text-panel-status';

        const actionButtonGroupElement = document.createElement('div');
        actionButtonGroupElement.className = 'text-panel-actions';

        const pasteButtonElement = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Paste' });
        pasteButtonElement.addEventListener('click', () => this._pasteFromClipboard());

        this._filePickerButtonElement = document.createElement('diff-client-file-picker-button');
        this._filePickerButtonElement.setAttribute('label', 'Upload');
        this._filePickerButtonElement.addEventListener('diff-client-file-picked', (filePickedEvent) => {
            // The picker's event is internal to this panel; replace it with the panel's own value event.
            filePickedEvent.stopPropagation();
            this._applyTextFromFile(filePickedEvent.detail.fileName, filePickedEvent.detail.textContent);
        });

        const clearButtonElement = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Clear' });
        clearButtonElement.addEventListener('click', () => this.clearText());

        actionButtonGroupElement.append(pasteButtonElement, this._filePickerButtonElement, clearButtonElement);
        headerElement.append(headingElement, this._statusElement, actionButtonGroupElement);

        // Small line above the text area showing the MD5 checksum of the current text.
        this._checksumElement = document.createElement('div');
        this._checksumElement.className = 'text-panel-checksum';

        // ---- the editable text area ----
        this._textAreaElement = Object.assign(document.createElement('textarea'), {
            placeholder: this.getAttribute('placeholder') ?? 'Paste text here, or upload / drop a file…',
            spellcheck: false,
        });
        this._textAreaElement.addEventListener('input', () => {
            // Typing means the content no longer matches the uploaded file.
            this._loadedFileName = '';
            this._refreshStatusText();
            this._announceValueChanged();
        });

        // ---- drag and drop of files onto the whole panel ----
        this.addEventListener('dragover', (dragEvent) => {
            // Cancelling dragover is what allows the drop event to fire.
            dragEvent.preventDefault();
            this.classList.add('is-drag-target');
        });
        this.addEventListener('dragleave', () => this.classList.remove('is-drag-target'));
        this.addEventListener('drop', async (dropEvent) => {
            dropEvent.preventDefault();
            this.classList.remove('is-drag-target');
            const droppedFile = dropEvent.dataTransfer.files[0];
            if (droppedFile) await this._filePickerButtonElement.readFileAndAnnounce(droppedFile);
        });

        this._loadedFileName = '';
        this.append(headerElement, this._checksumElement, this._textAreaElement);
        this._refreshStatusText();
    }

    /** @returns {string} The text currently in the panel. */
    get value() {
        return this._textAreaElement ? this._textAreaElement.value : '';
    }
    /** @param {string} newText Replaces the text (no event is emitted, the caller already knows). */
    set value(newText) {
        this._textAreaElement.value = newText;
        this._loadedFileName = '';
        this._refreshStatusText();
    }

    /** Empties the panel and tells listeners. */
    clearText() {
        this.value = '';
        this._announceValueChanged();
    }

    /**
     * Puts the text of an uploaded file into the panel.
     * @param {string} fileName Name shown in the status line.
     * @param {string} fileText The file contents.
     */
    _applyTextFromFile(fileName, fileText) {
        this._textAreaElement.value = fileText;
        this._loadedFileName = fileName;
        this._refreshStatusText();
        this._announceValueChanged();
    }

    /** Reads the clipboard (needs permission) and replaces the text with it. */
    async _pasteFromClipboard() {
        try {
            this._applyTextFromFile('', await navigator.clipboard.readText());
        } catch {
            // Browsers may block programmatic clipboard reading; the user can still press Ctrl+V.
            this._statusElement.textContent = 'Clipboard blocked — click the box and press Ctrl+V';
            this._textAreaElement.focus();
        }
    }

    /** Updates the "file name · lines · characters" status text and the MD5 checksum line. */
    _refreshStatusText() {
        this._checksumElement.textContent = `MD5: ${Md5ChecksumCalculator.calculateChecksumOfText(this._textAreaElement.value)}`;
        const currentText = this._textAreaElement.value;
        const lineCount = DiffClientEngine.splitTextIntoLines(currentText).length;
        const countsText = `${lineCount} lines · ${currentText.length} chars`;
        this._statusElement.textContent = this._loadedFileName ? `${this._loadedFileName} · ${countsText}` : countsText;
    }

    /** Emits `diff-client-value-changed` with the current text. */
    _announceValueChanged() {
        DiffClientToolkit.dispatchCustomEvent(this, 'diff-client-value-changed', { value: this._textAreaElement.value });
    }
}
DiffClientToolkit.registerCustomElementOnce('diff-client-text-panel', DiffClientTextPanel);
