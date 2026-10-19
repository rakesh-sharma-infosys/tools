'use strict';

/**
 * <http-client-split-pane> — two resizable panes separated by a draggable splitter.
 * Uses Shadow DOM so its layout and splitter styling are fully self-contained.
 *
 * Usage:
 *   <http-client-split-pane direction="horizontal" ratio="0.5" storage-key="my-app">
 *     <section slot="start">…first pane…</section>
 *     <section slot="end">…second pane…</section>
 *   </http-client-split-pane>
 *
 * Attributes:
 *   direction    "horizontal" = panes side by side (default); "vertical" = panes stacked.
 *   ratio        Share of the space given to the start pane, clamped to 0.1 – 0.9 (default 0.5).
 *   storage-key  When set, direction and ratio are saved in localStorage under this prefix.
 *
 * Splitter interaction: drag with mouse/touch/pen, nudge with the arrow keys,
 * double-click to reset to 50/50.
 *
 * Properties:  splitDirection, startPaneRatio
 * Events:      http-client-panes-resized   detail: { ratio }
 */
class HttpClientSplitPane extends HTMLElement {
    static observedAttributes = ['direction', 'ratio'];

    /** Builds the shadow DOM (slots + splitter) and wires the splitter interactions. */
    constructor() {
        super();
        const shadowRoot = this.attachShadow({ mode: 'open' });
        shadowRoot.innerHTML = `
            <style>
                /* --start-pane-ratio is updated from JavaScript while dragging. */
                :host { display: flex; flex: 1; min-width: 0; min-height: 0; --start-pane-ratio: .5; }
                :host([direction="vertical"]) { flex-direction: column; }
                /* The start pane takes its share minus half the splitter thickness (5px). */
                ::slotted([slot="start"]) { flex: 0 0 calc(var(--start-pane-ratio) * 100% - 5px); min-width: 0; min-height: 0; }
                ::slotted([slot="end"])   { flex: 1 1 0; min-width: 0; min-height: 0; }
                /* While dragging, stop panes (iframes especially) from swallowing pointer events. */
                :host([is-dragging]) ::slotted(*) { pointer-events: none; user-select: none; }
                .splitter-handle { flex: 0 0 10px; position: relative; cursor: col-resize; touch-action: none; border-radius: 4px; outline: none; }
                :host([direction="vertical"]) .splitter-handle { cursor: row-resize; }
                /* The visible grip line in the middle of the handle. */
                .splitter-handle::after {
                    content: ""; position: absolute; inset: 0; margin: auto; width: 3px; height: 40px;
                    background: var(--border, #ccc); border-radius: 2px; transition: background .15s;
                }
                :host([direction="vertical"]) .splitter-handle::after { width: 40px; height: 3px; }
                .splitter-handle:hover::after, .splitter-handle:focus-visible::after, :host([is-dragging]) .splitter-handle::after { background: var(--accent, #0b6bcb); }
            </style>
            <slot name="start"></slot>
            <div class="splitter-handle" part="splitter" role="separator" tabindex="0" title="Drag to resize · double-click to reset"></div>
            <slot name="end"></slot>`;
        this._splitterHandleElement = shadowRoot.querySelector('.splitter-handle');
        this._currentStartPaneRatio = 0.5;
        this._attachSplitterInteractions();
    }

    /** Restores the saved layout (if a storage key is configured) when attached to the page. */
    connectedCallback() {
        const storageKeyPrefix = this.getAttribute('storage-key');
        if (storageKeyPrefix && !this._hasLoadedSavedLayout) {
            // Set BEFORE applying values so attributeChangedCallback is allowed to save from now on.
            this._hasLoadedSavedLayout = true;
            const savedDirection = HttpClientToolkit.localStorageJson.readValue(`${storageKeyPrefix}:direction`);
            const savedRatio = HttpClientToolkit.localStorageJson.readValue(`${storageKeyPrefix}:ratio`);
            if (savedDirection) this.splitDirection = savedDirection;
            if (savedRatio) this.startPaneRatio = savedRatio;
        }
        this._updateAccessibilityOrientation();
    }

    /**
     * @param {string} attributeName "direction" or "ratio".
     * @param {string|null} previousValue Previous value (unused).
     * @param {string|null} newValue New value.
     */
    attributeChangedCallback(attributeName, previousValue, newValue) {
        if (attributeName === 'ratio') this.startPaneRatio = parseFloat(newValue);
        if (attributeName === 'direction') {
            this._updateAccessibilityOrientation();
            // Do not persist during initial parsing, otherwise defaults would overwrite the saved layout.
            if (this._hasLoadedSavedLayout) this._saveLayout();
        }
    }

    /** @returns {'horizontal'|'vertical'} Current direction. */
    get splitDirection() { return this.getAttribute('direction') === 'vertical' ? 'vertical' : 'horizontal'; }
    /** @param {'horizontal'|'vertical'} newDirection Switches between side-by-side and stacked. */
    set splitDirection(newDirection) { this.setAttribute('direction', newDirection === 'vertical' ? 'vertical' : 'horizontal'); }

    /** @returns {number} The start pane's share of the space (0.1 – 0.9). */
    get startPaneRatio() { return this._currentStartPaneRatio; }
    /** @param {number} newRatio Requested share; clamped to 0.1 – 0.9, invalid numbers are ignored. */
    set startPaneRatio(newRatio) {
        if (!Number.isFinite(newRatio)) return;
        this._currentStartPaneRatio = Math.min(0.9, Math.max(0.1, newRatio));
        this.style.setProperty('--start-pane-ratio', this._currentStartPaneRatio);
    }

    /** Tells assistive technology which way the splitter moves. */
    _updateAccessibilityOrientation() {
        // A vertical stack has a horizontal separator line, and vice versa.
        this._splitterHandleElement.setAttribute('aria-orientation', this.splitDirection === 'vertical' ? 'horizontal' : 'vertical');
    }

    /** Saves direction and ratio to localStorage when a storage key is configured. */
    _saveLayout() {
        const storageKeyPrefix = this.getAttribute('storage-key');
        if (!storageKeyPrefix) return;
        HttpClientToolkit.localStorageJson.writeValue(`${storageKeyPrefix}:direction`, this.splitDirection);
        HttpClientToolkit.localStorageJson.writeValue(`${storageKeyPrefix}:ratio`, this._currentStartPaneRatio);
    }

    /** Persists the layout and notifies listeners that the user finished resizing. */
    _finishResize() {
        this._saveLayout();
        HttpClientToolkit.dispatchCustomEvent(this, 'http-client-panes-resized', { ratio: this._currentStartPaneRatio });
    }

    /** Wires pointer dragging, double-click reset and arrow-key resizing on the splitter handle. */
    _attachSplitterInteractions() {
        const splitterHandle = this._splitterHandleElement;

        // Start dragging: "capture" the pointer so we keep receiving moves even outside the handle.
        splitterHandle.addEventListener('pointerdown', (pointerEvent) => {
            pointerEvent.preventDefault();
            splitterHandle.setPointerCapture(pointerEvent.pointerId);
            this.toggleAttribute('is-dragging', true);
        });

        // While dragging: convert the pointer position into a ratio of the container size.
        splitterHandle.addEventListener('pointermove', (pointerEvent) => {
            if (!splitterHandle.hasPointerCapture(pointerEvent.pointerId)) return;
            const containerBounds = this.getBoundingClientRect();
            this.startPaneRatio = this.splitDirection === 'vertical'
                ? (pointerEvent.clientY - containerBounds.top) / containerBounds.height
                : (pointerEvent.clientX - containerBounds.left) / containerBounds.width;
        });

        // Stop dragging (pointer released or interaction cancelled by the browser).
        const endDragging = (pointerEvent) => {
            if (splitterHandle.hasPointerCapture(pointerEvent.pointerId)) splitterHandle.releasePointerCapture(pointerEvent.pointerId);
            if (this.hasAttribute('is-dragging')) {
                this.removeAttribute('is-dragging');
                this._finishResize();
            }
        };
        splitterHandle.addEventListener('pointerup', endDragging);
        splitterHandle.addEventListener('pointercancel', endDragging);

        // Double-click resets to an even split.
        splitterHandle.addEventListener('dblclick', () => { this.startPaneRatio = 0.5; this._finishResize(); });

        // Keyboard: arrow keys along the split axis move the splitter by 2% per press.
        splitterHandle.addEventListener('keydown', (keyboardEvent) => {
            const isVertical = this.splitDirection === 'vertical';
            const shrinkKeyName = isVertical ? 'ArrowUp' : 'ArrowLeft';
            const growKeyName = isVertical ? 'ArrowDown' : 'ArrowRight';
            if (keyboardEvent.key !== shrinkKeyName && keyboardEvent.key !== growKeyName) return;
            keyboardEvent.preventDefault();
            this.startPaneRatio += keyboardEvent.key === growKeyName ? 0.02 : -0.02;
            this._finishResize();
        });
    }
}
HttpClientToolkit.registerCustomElementOnce('http-client-split-pane', HttpClientSplitPane);
