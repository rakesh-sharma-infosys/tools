'use strict';

/**
 * <diff-client-diff-stats> — a one-line summary such as "+3 added  −2 removed  10 unchanged".
 *
 * Properties:  statistics   { addedLineCount, removedLineCount, unchangedLineCount, areIdentical, isEmpty }
 *              (as produced by DiffClientEngine.computeDiff; setting it re-renders)
 */
class DiffClientDiffStats extends HTMLElement {
    /** Renders the initial (empty) summary when attached. */
    connectedCallback() {
        this._renderSummary();
    }

    /** @returns {object|null} The statistics currently displayed. */
    get statistics() {
        return this._statistics ?? null;
    }
    /** @param {object|null} newStatistics New numbers to display. */
    set statistics(newStatistics) {
        this._statistics = newStatistics;
        this._renderSummary();
    }

    /** Builds the summary markup from the current statistics. */
    _renderSummary() {
        const statistics = this._statistics;
        if (!statistics || statistics.isEmpty) {
            this.innerHTML = '<span class="diff-stats-message">Add content to both sides to compare.</span>';
        } else if (statistics.areIdentical) {
            this.innerHTML = '<span class="diff-stats-message is-identical">✔ The two texts are identical.</span>';
        } else {
            this.innerHTML = `
                <span class="diff-stats-added">+${statistics.addedLineCount} added</span>
                <span class="diff-stats-removed">−${statistics.removedLineCount} removed</span>
                <span class="diff-stats-unchanged">${statistics.unchangedLineCount} unchanged</span>`;
        }
    }
}
DiffClientToolkit.registerCustomElementOnce('diff-client-diff-stats', DiffClientDiffStats);
