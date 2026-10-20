'use strict';

/**
 * <diff-client-diff-view> — shows a diff result in one of three layouts.
 *
 * Attributes:
 *   mode            "unified"    one pane with removed and added lines stacked (default)
 *                   "horizontal" two panes next to each other (left | right)
 *                   "vertical"   two panes on top of each other
 *   left-heading    Title of the left / top pane (default "Original").
 *   right-heading   Title of the right / bottom pane (default "Modified").
 *
 * Properties:  diffResult   Output of DiffClientEngine.computeDiff (setting it re-renders).
 *              mode         Same as the attribute.
 *
 * Needs <diff-client-diff-pane> to be registered.
 */
class DiffClientDiffView extends HTMLElement {
    static observedAttributes = ['mode'];

    /** Renders the initial state when attached. */
    connectedCallback() {
        this._renderView();
    }

    /** Re-renders whenever the layout mode changes. */
    attributeChangedCallback() {
        if (this.isConnected) this._renderView();
    }

    /** @returns {string} The active layout mode. */
    get mode() {
        return this.getAttribute('mode') ?? 'unified';
    }
    /** @param {string} newMode "unified", "horizontal" or "vertical". */
    set mode(newMode) {
        this.setAttribute('mode', newMode);
    }

    /** @returns {object|null} The diff result being displayed. */
    get diffResult() {
        return this._diffResult ?? null;
    }
    /** @param {object|null} newDiffResult Result to display. */
    set diffResult(newDiffResult) {
        this._diffResult = newDiffResult;
        if (this.isConnected) this._renderView();
    }

    /** Rebuilds the panes for the current mode and result. */
    _renderView() {
        this.textContent = '';
        const currentResult = this.diffResult;

        // Nothing to compare yet: show a hint instead of empty panes.
        if (!currentResult || currentResult.statistics.isEmpty) {
            const placeholderElement = document.createElement('div');
            placeholderElement.className = 'diff-view-placeholder';
            placeholderElement.textContent = 'The differences will appear here.';
            this.append(placeholderElement);
            return;
        }

        if (this.mode === 'unified') {
            this.append(this._createPane({ heading: 'Unified diff', side: 'both', showSign: true, rows: currentResult.unifiedRows }));
            return;
        }

        // Split layouts: both panes use the aligned rows, so line N is at the same height on both sides.
        const splitContainerElement = document.createElement('div');
        splitContainerElement.className = `diff-view-split is-${this.mode}`;
        const leftPaneElement = this._createPane({
            heading: this.getAttribute('left-heading') ?? 'Original', side: 'left', showSign: false,
            rows: currentResult.alignedRows.map((alignedRow) => alignedRow.leftCell),
        });
        const rightPaneElement = this._createPane({
            heading: this.getAttribute('right-heading') ?? 'Modified', side: 'right', showSign: false,
            rows: currentResult.alignedRows.map((alignedRow) => alignedRow.rightCell),
        });
        splitContainerElement.append(leftPaneElement, rightPaneElement);
        this.append(splitContainerElement);

        this._synchroniseScrolling(leftPaneElement, rightPaneElement);
    }

    /**
     * Creates and fills a diff pane.
     * @param {{heading:string, side:string, showSign:boolean, rows:Array<object|null>}} paneDescription What to show.
     * @returns {HTMLElement} The <diff-client-diff-pane> element.
     */
    _createPane({ heading, side, showSign, rows }) {
        const paneElement = document.createElement('diff-client-diff-pane');
        paneElement.setAttribute('heading', heading);
        paneElement.setAttribute('side', side);
        if (showSign) paneElement.setAttribute('show-sign', '');
        paneElement.rows = rows;
        return paneElement;
    }

    /**
     * Makes two panes scroll together (both directions).
     * @param {HTMLElement} firstPaneElement One pane.
     * @param {HTMLElement} secondPaneElement The other pane.
     */
    _synchroniseScrolling(firstPaneElement, secondPaneElement) {
        // Copying a scroll position fires another scroll event on the target; this flag stops the echo loop.
        let isCopyingScrollPosition = false;
        const linkScrolling = (sourcePaneElement, targetPaneElement) => {
            sourcePaneElement.scrollContainerElement.addEventListener('scroll', () => {
                if (isCopyingScrollPosition) { isCopyingScrollPosition = false; return; }
                const sourceScroller = sourcePaneElement.scrollContainerElement;
                const targetScroller = targetPaneElement.scrollContainerElement;
                // Assigning an identical position fires no event, so only raise the flag when something will change.
                if (targetScroller.scrollTop === sourceScroller.scrollTop
                    && targetScroller.scrollLeft === sourceScroller.scrollLeft) return;
                isCopyingScrollPosition = true;
                targetScroller.scrollTop = sourceScroller.scrollTop;
                targetScroller.scrollLeft = sourceScroller.scrollLeft;
            });
        };
        linkScrolling(firstPaneElement, secondPaneElement);
        linkScrolling(secondPaneElement, firstPaneElement);
    }
}
DiffClientToolkit.registerCustomElementOnce('diff-client-diff-view', DiffClientDiffView);
