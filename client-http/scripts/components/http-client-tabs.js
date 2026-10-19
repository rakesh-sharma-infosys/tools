'use strict';

/**
 * <http-client-tabs> — a tab bar plus tab panels.
 *
 * Usage:
 *   <http-client-tabs active="params">
 *     <div tab-bar-extra>…content shown at the right end of the tab bar…</div>
 *     <http-client-tab-panel name="params" label="Params">…</http-client-tab-panel>
 *     <http-client-tab-panel name="headers" label="Headers">…</http-client-tab-panel>
 *   </http-client-tabs>
 *
 * Attributes:  active   Name of the tab that is initially shown (defaults to the first tab).
 * Methods:     selectTabByName(tabName), findTabPanelByName(tabName), refreshTabButtons()
 * Events:      http-client-tab-selected   detail: { tabName }
 */
class HttpClientTabs extends HTMLElement {
    /** Builds the tab bar once the element is attached to the page. */
    connectedCallback() {
        if (this._tabButtonListElement) return;

        this._tabBarElement = document.createElement('div');
        this._tabBarElement.className = 'tab-bar';
        this._tabButtonListElement = document.createElement('div');
        this._tabButtonListElement.className = 'tab-button-list';
        // Children marked `tab-bar-extra` are moved into the right-hand side of the bar.
        this._tabBarElement.append(this._tabButtonListElement, ...this.querySelectorAll(':scope > [tab-bar-extra]'));
        this.prepend(this._tabBarElement);

        // One delegated click listener serves every tab button.
        this._tabButtonListElement.addEventListener('click', (clickEvent) => {
            const clickedTabButton = clickEvent.target.closest('.tab-button');
            if (clickedTabButton) this.selectTabByName(clickedTabButton.dataset.tabName);
        });

        this.selectTabByName(this.getAttribute('active') || this._readTabName(this.tabPanelElements[0]), true);
    }

    /** @returns {HTMLElement[]} The direct <http-client-tab-panel> children. */
    get tabPanelElements() {
        return [...this.children].filter((childElement) => childElement.localName === 'http-client-tab-panel');
    }

    /**
     * Reads a panel's name from its attributes. We read attributes (instead of using
     * the panel's `tabName` getter) because the panel may not be upgraded to its
     * custom element class yet when this element connects.
     * @param {HTMLElement} tabPanelElement The panel to read.
     * @returns {string} Its name.
     */
    _readTabName(tabPanelElement) {
        return tabPanelElement ? (tabPanelElement.getAttribute('name') || tabPanelElement.getAttribute('label') || '') : '';
    }

    /**
     * @param {string} tabName The tab's name.
     * @returns {HTMLElement|undefined} The matching panel element.
     */
    findTabPanelByName(tabName) {
        return this.tabPanelElements.find((tabPanelElement) => this._readTabName(tabPanelElement) === tabName);
    }

    /**
     * Shows one panel, hides the others and highlights its tab button.
     * @param {string} tabName The tab to select.
     * @param {boolean} [isSilent] When true no event is emitted (used for the initial selection).
     */
    selectTabByName(tabName, isSilent = false) {
        this.tabPanelElements.forEach((tabPanelElement) => {
            tabPanelElement.toggleAttribute('active', this._readTabName(tabPanelElement) === tabName);
        });
        this._selectedTabName = tabName;
        this.refreshTabButtons();
        if (!isSilent) HttpClientToolkit.dispatchCustomEvent(this, 'http-client-tab-selected', { tabName });
    }

    /** Redraws the tab buttons from the current panels (labels, badges, selected state). */
    refreshTabButtons() {
        // Panels can ask for a refresh before this element has built its bar.
        if (!this._tabButtonListElement) return;
        this._tabButtonListElement.textContent = '';

        this.tabPanelElements.forEach((tabPanelElement) => {
            const tabName = this._readTabName(tabPanelElement);
            const badgeText = tabPanelElement.getAttribute('badge');

            const tabButtonElement = document.createElement('button');
            tabButtonElement.type = 'button';
            tabButtonElement.className = 'tab-button' + (tabName === this._selectedTabName ? ' is-active' : '');
            tabButtonElement.dataset.tabName = tabName;
            tabButtonElement.textContent = tabPanelElement.getAttribute('label') || tabName;
            if (badgeText) {
                tabButtonElement.append(' ', Object.assign(document.createElement('span'), { className: 'tab-badge', textContent: badgeText }));
            }
            this._tabButtonListElement.append(tabButtonElement);
        });
    }
}
HttpClientToolkit.registerCustomElementOnce('http-client-tabs', HttpClientTabs);
