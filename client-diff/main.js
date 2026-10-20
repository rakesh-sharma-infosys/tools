'use strict';

/**
 * Application entry point: connects the independent <diff-client-*> components to each other.
 * The components know nothing about one another; all wiring happens here through events.
 */

// ---- look up the components declared in index.html ----
const originalTextPanelElement = document.querySelector('#original-text-panel');
const modifiedTextPanelElement = document.querySelector('#modified-text-panel');
const viewModeToggleElement = document.querySelector('#view-mode-toggle');
const ignoreCaseCheckboxElement = document.querySelector('#ignore-case-checkbox');
const ignoreWhitespaceCheckboxElement = document.querySelector('#ignore-whitespace-checkbox');
const swapButtonElement = document.querySelector('#swap-button');
const clearAllButtonElement = document.querySelector('#clear-all-button');
const diffStatisticsElement = document.querySelector('#diff-statistics');
const diffResultViewElement = document.querySelector('#diff-result-view');

/** Compares the two panels with the current options and pushes the result into the stats and the view. */
const recomputeAndShowDifferences = () => {
    const diffResult = DiffClientEngine.computeDiff(originalTextPanelElement.value, modifiedTextPanelElement.value, {
        ignoreCase: ignoreCaseCheckboxElement.isChecked,
        ignoreWhitespace: ignoreWhitespaceCheckboxElement.isChecked,
    });
    diffStatisticsElement.statistics = diffResult.statistics;
    diffResultViewElement.diffResult = diffResult;
};

// Typing in a big text should not recompute on every keystroke, so wait for a short pause.
const recomputeAfterShortPause = DiffClientToolkit.createDebouncedFunction(recomputeAndShowDifferences, 250);

// Every component announces changes with the same event; tell them apart by their element id.
document.addEventListener('diff-client-value-changed', (valueChangedEvent) => {
    if (valueChangedEvent.target === viewModeToggleElement) {
        // Only the layout changes, so no new comparison is needed.
        diffResultViewElement.mode = valueChangedEvent.detail.value;
    } else if (valueChangedEvent.target === originalTextPanelElement || valueChangedEvent.target === modifiedTextPanelElement) {
        recomputeAfterShortPause();
    } else {
        // A comparison option (ignore case / whitespace) changed: compare again straight away.
        recomputeAndShowDifferences();
    }
});

swapButtonElement.addEventListener('click', () => {
    const originalText = originalTextPanelElement.value;
    originalTextPanelElement.value = modifiedTextPanelElement.value;
    modifiedTextPanelElement.value = originalText;
    recomputeAndShowDifferences();
});

clearAllButtonElement.addEventListener('click', () => {
    originalTextPanelElement.value = '';
    modifiedTextPanelElement.value = '';
    recomputeAndShowDifferences();
});

// Show the initial "add content" state.
recomputeAndShowDifferences();
