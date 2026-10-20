'use strict';

/**
 * <diff-client-file-picker-button> — a button that opens the file chooser and reads the chosen file as text.
 *
 * Attributes:
 *   label     Button text (default "Upload file").
 *   accept    Optional file type filter, for example ".txt,.json" (default: any file).
 *
 * Methods:     readFileAndAnnounce(file)  Reads a File (also used for drag and drop) and emits the event below.
 * Events:      diff-client-file-picked   detail: { fileName, textContent }
 */
class DiffClientFilePickerButton extends HTMLElement {
    /** Builds the visible button and the hidden file input the first time the element is attached. */
    connectedCallback() {
        if (this._hiddenFileInputElement) return;

        this._hiddenFileInputElement = Object.assign(document.createElement('input'), { type: 'file', hidden: true });
        if (this.hasAttribute('accept')) this._hiddenFileInputElement.accept = this.getAttribute('accept');

        const visibleButtonElement = Object.assign(document.createElement('button'), {
            type: 'button',
            textContent: this.getAttribute('label') ?? 'Upload file',
        });
        // Clicking the visible button forwards to the hidden input, which opens the chooser.
        visibleButtonElement.addEventListener('click', () => this._hiddenFileInputElement.click());

        this._hiddenFileInputElement.addEventListener('change', async () => {
            const chosenFile = this._hiddenFileInputElement.files[0];
            // Clear the input so choosing the same file again still triggers a change event.
            this._hiddenFileInputElement.value = '';
            if (chosenFile) await this.readFileAndAnnounce(chosenFile);
        });

        this.append(visibleButtonElement, this._hiddenFileInputElement);
    }

    /**
     * Reads a file as text and emits `diff-client-file-picked`.
     * @param {File} fileToRead The file chosen by the user or dropped onto a panel.
     * @returns {Promise<void>}
     */
    async readFileAndAnnounce(fileToRead) {
        const textContent = await fileToRead.text();
        DiffClientToolkit.dispatchCustomEvent(this, 'diff-client-file-picked', { fileName: fileToRead.name, textContent });
    }
}
DiffClientToolkit.registerCustomElementOnce('diff-client-file-picker-button', DiffClientFilePickerButton);
