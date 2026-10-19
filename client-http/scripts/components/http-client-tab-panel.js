'use strict';

/**
 * <http-client-tab-panel> — the content of one tab. Only valid as a direct child
 * of <http-client-tabs>, which shows exactly one panel at a time.
 *
 * Attributes:
 *   name    Identifier used to select the tab (defaults to the label).
 *   label   Text shown on the tab button.
 *   badge   Optional small counter shown next to the label (for example "3").
 *   active  Set by the parent <http-client-tabs>; do not set manually.
 */
class HttpClientTabPanel extends HTMLElement {
    static observedAttributes = ['label', 'badge'];

    /** @returns {string} The tab identifier (name attribute, or the label as a fallback). */
    get tabName() { return this.getAttribute('name') || this.getAttribute('label') || ''; }

    /** @returns {string} The badge text, or an empty string when there is none. */
    get badgeText() { return this.getAttribute('badge') || ''; }

    /** @param {string|number|null} newBadgeText Badge to show; empty, 0, null or undefined removes it. */
    set badgeText(newBadgeText) {
        const shouldRemoveBadge = newBadgeText === '' || newBadgeText === null || newBadgeText === undefined || newBadgeText === 0;
        if (shouldRemoveBadge) this.removeAttribute('badge');
        else this.setAttribute('badge', newBadgeText);
    }

    /** When the label or badge changes, ask the parent to redraw its tab buttons. */
    attributeChangedCallback() {
        this.closest('http-client-tabs')?.refreshTabButtons();
    }
}
HttpClientToolkit.registerCustomElementOnce('http-client-tab-panel', HttpClientTabPanel);
