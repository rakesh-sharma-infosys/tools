'use strict';

/**
 * <diff-client-theme-toggle> — a button that switches between the light and dark theme.
 * Same behaviour as the theme button of the client-http project: the first visit follows the
 * operating system preference, afterwards the saved choice is used.
 *
 * The theme is applied as `data-theme="light|dark"` on <html>; main.css reacts to it.
 *
 * Attributes:
 *   storage-key   localStorage key used to remember the choice (default "diffClient.theme").
 *
 * Properties:  theme   (get / set "light" or "dark"; setting applies and saves it)
 * Events:      diff-client-value-changed   detail: { value }   (only when the user clicks)
 */
class DiffClientThemeToggle extends HTMLElement {
    /** Builds the button the first time the element is attached and applies the starting theme. */
    connectedCallback() {
        if (this._buttonElement) return;

        this._buttonElement = Object.assign(document.createElement('button'), { type: 'button' });
        this._buttonElement.addEventListener('click', () => {
            this.theme = this.theme === 'dark' ? 'light' : 'dark';
            DiffClientToolkit.dispatchCustomEvent(this, 'diff-client-value-changed', { value: this.theme });
        });
        this.append(this._buttonElement);

        // First visit: follow the operating system. Later visits: use the saved choice.
        const operatingSystemPrefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
        this.theme = this._readSavedTheme() || (operatingSystemPrefersDark ? 'dark' : 'light');
    }

    /** @returns {'light'|'dark'} The theme currently applied to the page. */
    get theme() {
        return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    }
    /** @param {'light'|'dark'} themeName The theme to apply and remember. */
    set theme(themeName) {
        document.documentElement.dataset.theme = themeName;
        this._buttonElement.textContent = '🌓';
        this._buttonElement.title = 'Toggle light / dark theme';
        try {
            localStorage.setItem(this._storageKey, themeName);
        } catch {
            // Storage can be blocked (private mode, file:// restrictions); the theme still works for this visit.
        }
    }

    /** @returns {string} The localStorage key for the saved choice. */
    get _storageKey() {
        return this.getAttribute('storage-key') ?? 'diffClient.theme';
    }

    /** @returns {string|null} The saved theme name, or null when nothing valid was saved. */
    _readSavedTheme() {
        try {
            const savedTheme = localStorage.getItem(this._storageKey);
            return savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : null;
        } catch {
            return null;
        }
    }
}
DiffClientToolkit.registerCustomElementOnce('diff-client-theme-toggle', DiffClientThemeToggle);
