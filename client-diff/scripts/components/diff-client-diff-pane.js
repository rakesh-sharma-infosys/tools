'use strict';

/**
 * <diff-client-diff-pane> — one scrollable list of diff lines with line numbers and colouring.
 * It is the building block of every diff view (unified = one pane, split = two panes).
 *
 * Attributes:
 *   heading   Optional title above the lines.
 *   side      Which line numbers to show: "left", "right" or "both" (default "both").
 *   show-sign Present to show a "+" / "−" marker column (used by the unified view).
 *
 * Properties:  rows                  Array of cells (see DiffClientEngine) or null for an empty filler line.
 *              scrollContainerElement  The scrolling element, so a parent can synchronise two panes.
 */
class DiffClientDiffPane extends HTMLElement {
    /** Builds the heading + scroll area structure once. */
    connectedCallback() {
        if (this.scrollContainerElement) return;

        this._headingElement = document.createElement('div');
        this._headingElement.className = 'diff-pane-heading';
        this._headingElement.textContent = this.getAttribute('heading') ?? '';
        this._headingElement.hidden = !this.hasAttribute('heading');

        this.scrollContainerElement = document.createElement('div');
        this.scrollContainerElement.className = 'diff-pane-scroll';

        // The lines live in an inner block that is at least as wide as the longest line,
        // so line backgrounds also cover the part that is scrolled into view horizontally.
        this._linesElement = document.createElement('div');
        this._linesElement.className = 'diff-pane-lines';
        this.scrollContainerElement.append(this._linesElement);

        this.append(this._headingElement, this.scrollContainerElement);
        this._renderRows();
    }

    /** @returns {Array<object|null>} The rows currently displayed. */
    get rows() {
        return this._rowList ?? [];
    }
    /** @param {Array<object|null>} newRows Replaces the displayed lines. */
    set rows(newRows) {
        this._rowList = newRows;
        if (this.scrollContainerElement) this._renderRows();
    }

    /** Re-creates all line elements from the current rows (one innerHTML assignment for speed). */
    _renderRows() {
        const lineNumberSide = this.getAttribute('side') ?? 'both';
        const shouldShowSign = this.hasAttribute('show-sign');
        this._linesElement.innerHTML = this.rows
            .map((cell) => this._createLineHtml(cell, lineNumberSide, shouldShowSign))
            .join('');
    }

    /**
     * Creates the HTML of one line.
     * @param {object|null} cell The line to show, or null for a blank filler line.
     * @param {string} lineNumberSide "left", "right" or "both".
     * @param {boolean} shouldShowSign Whether to include the +/− column.
     * @returns {string} HTML for the line.
     */
    _createLineHtml(cell, lineNumberSide, shouldShowSign) {
        const showLeftNumber = lineNumberSide !== 'right';
        const showRightNumber = lineNumberSide !== 'left';
        // Missing numbers (filler lines, or the other side of an added/removed line) render as empty cells.
        const numberHtml = (lineNumber) => `<span class="diff-pane-number">${lineNumber ?? ''}</span>`;

        if (!cell) {
            return `<div class="diff-pane-line is-filler">${showLeftNumber ? numberHtml(null) : ''}${showRightNumber ? numberHtml(null) : ''}`
                + `${shouldShowSign ? '<span class="diff-pane-sign"></span>' : ''}<span class="diff-pane-text"></span></div>`;
        }

        const signCharacterByType = { added: '+', removed: '−', equal: '' };
        return `<div class="diff-pane-line is-${cell.type}">`
            + `${showLeftNumber ? numberHtml(cell.leftLineNumber) : ''}`
            + `${showRightNumber ? numberHtml(cell.rightLineNumber) : ''}`
            + `${shouldShowSign ? `<span class="diff-pane-sign">${signCharacterByType[cell.type]}</span>` : ''}`
            + `<span class="diff-pane-text">${this._createTextHtml(cell)}</span></div>`;
    }

    /**
     * Creates the escaped text of a line, wrapping changed words in <mark> when word segments exist.
     * @param {object} cell The line.
     * @returns {string} Escaped HTML.
     */
    _createTextHtml(cell) {
        if (!cell.wordSegments) return DiffClientToolkit.escapeHtmlSpecialCharacters(cell.text);
        return cell.wordSegments
            .map((segment) => {
                const escapedSegmentText = DiffClientToolkit.escapeHtmlSpecialCharacters(segment.text);
                return segment.isChanged ? `<mark>${escapedSegmentText}</mark>` : escapedSegmentText;
            })
            .join('');
    }
}
DiffClientToolkit.registerCustomElementOnce('diff-client-diff-pane', DiffClientDiffPane);
