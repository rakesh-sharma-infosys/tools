'use strict';

/**
 * <http-client-request-history> — a slide-in drawer listing recent requests,
 * persisted in localStorage. Hidden until opened.
 *
 * Attributes:
 *   storage-key   localStorage key (default "httpClient.requestHistory").
 *   max           Maximum number of entries kept (default 50).
 *
 * Methods:
 *   addEntry(requestSnapshot, responseStatusCode)  Records a request (most recent first).
 *   toggleVisibility(), openDrawer(), closeDrawer(), clearAllEntries()
 *
 * Events:
 *   http-client-history-entry-selected   detail: { requestSnapshot }
 *
 * A request snapshot must contain `httpMethod` and `urlText`. Entries with the
 * same method + URL replace the older one, so the list has no duplicates.
 *
 * Requires: http-client-button.
 */
class HttpClientRequestHistory extends HTMLElement {
    /** Builds the drawer contents once the element is attached to the page. */
    connectedCallback() {
        if (this._entryListElement) return;
        this.hidden = true; // closed by default

        this.innerHTML = `
            <div class="history-header">
                <b>History</b>
                <span>
                    <http-client-button name="clearHistoryButton" size="small" label="Clear"></http-client-button>
                    <http-client-button name="closeHistoryButton" size="small" label="✕"></http-client-button>
                </span>
            </div>
            <ul></ul>`;
        this._entryListElement = this.querySelector('ul');
        this.querySelector('[name="clearHistoryButton"]').addEventListener('click', () => this.clearAllEntries());
        this.querySelector('[name="closeHistoryButton"]').addEventListener('click', () => this.closeDrawer());

        // One delegated listener handles clicks on every history entry.
        this._entryListElement.addEventListener('click', (clickEvent) => {
            const clickedEntryElement = clickEvent.target.closest('li[data-entry-index]');
            if (!clickedEntryElement) return;
            const selectedEntry = this._readStoredEntries()[Number(clickedEntryElement.dataset.entryIndex)];
            HttpClientToolkit.dispatchCustomEvent(this, 'http-client-history-entry-selected', { requestSnapshot: selectedEntry.requestSnapshot });
            this.closeDrawer();
        });
    }

    /** @returns {string} The localStorage key used for persistence. */
    get _storageKey() { return this.getAttribute('storage-key') || 'httpClient.requestHistory'; }

    /** @returns {Array<{requestSnapshot:object, savedAtTimestamp:number, responseStatusCode:number}>} Stored entries, newest first. */
    _readStoredEntries() { return HttpClientToolkit.localStorageJson.readValue(this._storageKey, []); }

    /** Shows the drawer (refreshing the list first). */
    openDrawer() { this._renderEntries(); this.hidden = false; }
    /** Hides the drawer. */
    closeDrawer() { this.hidden = true; }
    /** Opens the drawer if closed, closes it if open. */
    toggleVisibility() { if (this.hidden) this.openDrawer(); else this.closeDrawer(); }
    /** Deletes every stored entry. */
    clearAllEntries() { HttpClientToolkit.localStorageJson.removeValue(this._storageKey); this._renderEntries(); }

    /**
     * Records a request at the top of the history.
     * @param {object} requestSnapshot The request state; must include httpMethod and urlText.
     * @param {number} responseStatusCode The HTTP status that came back (kept for future display).
     */
    addEntry(requestSnapshot, responseStatusCode) {
        const maximumEntryCount = Number(this.getAttribute('max')) || 50;
        const isSameRequest = (firstSnapshot, secondSnapshot) => firstSnapshot.httpMethod === secondSnapshot.httpMethod && firstSnapshot.urlText === secondSnapshot.urlText;

        // Remove any older entry for the same method + URL, then put the new one first.
        const entriesWithoutDuplicate = this._readStoredEntries().filter((entry) => !isSameRequest(entry.requestSnapshot, requestSnapshot));
        entriesWithoutDuplicate.unshift({ requestSnapshot, savedAtTimestamp: Date.now(), responseStatusCode });
        HttpClientToolkit.localStorageJson.writeValue(this._storageKey, entriesWithoutDuplicate.slice(0, maximumEntryCount));

        if (!this.hidden) this._renderEntries(); // keep an open drawer up to date
    }

    /** Redraws the entry list from storage. */
    _renderEntries() {
        const storedEntries = this._readStoredEntries();
        this._entryListElement.textContent = '';

        if (!storedEntries.length) {
            this._entryListElement.append(Object.assign(document.createElement('li'), { className: 'hint-text', textContent: 'No requests yet.' }));
            return;
        }
        storedEntries.forEach((entry, entryIndex) => {
            const entryElement = document.createElement('li');
            entryElement.dataset.entryIndex = entryIndex; // used by the delegated click handler
            // Method and time are trusted/formatted text; the URL is set via textContent below to avoid HTML injection.
            entryElement.innerHTML = `<span class="history-method">${HttpClientToolkit.escapeHtmlSpecialCharacters(entry.requestSnapshot.httpMethod)}</span><span class="history-url monospace-text"></span><span class="history-time">${new Date(entry.savedAtTimestamp).toLocaleTimeString()}</span>`;
            entryElement.querySelector('.history-url').textContent = entry.requestSnapshot.urlText;
            this._entryListElement.append(entryElement);
        });
    }
}
HttpClientToolkit.registerCustomElementOnce('http-client-request-history', HttpClientRequestHistory);
