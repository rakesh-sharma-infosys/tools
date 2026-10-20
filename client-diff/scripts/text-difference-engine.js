'use strict';

/**
 * Pure (DOM free) text comparison logic.
 *
 * Exposed as the global `DiffClientEngine`. The main entry point is `computeDiff`,
 * which turns two texts into the rows needed by every diff view:
 *   - `unifiedRows`  one list with removed lines followed by added lines per change.
 *   - `alignedRows`  a list of { leftCell, rightCell } pairs for side-by-side views.
 *   - `statistics`   counts of added / removed / unchanged lines.
 *
 * A "cell" describes one displayed line:
 *   { type: 'equal'|'removed'|'added', leftLineNumber, rightLineNumber, text, wordSegments }
 * `wordSegments` (only on modified line pairs) is [{ text, isChanged }] for in-line highlighting.
 */
const DiffClientEngine = (() => {
    /**
     * The largest comparison table (rows x columns) we are willing to allocate.
     * Above this, the changed middle part is simply reported as "all removed, all added".
     */
    const MAXIMUM_COMPARISON_TABLE_CELLS = 16_000_000;

    /** Lines longer than this are not compared word by word (keeps the page fast). */
    const MAXIMUM_LINE_LENGTH_FOR_WORD_DIFF = 1000;

    /** Fraction (0..1) of a line that must be unchanged before changed words are highlighted inside it. */
    const MINIMUM_SIMILARITY_FOR_WORD_DIFF = 0.4;

    /**
     * Splits text into lines, accepting Windows, Unix and old Mac line endings.
     * Empty text gives zero lines, and one trailing line break does not create an extra empty line.
     * @param {string} text The text to split.
     * @returns {string[]} The lines without their line endings.
     */
    const splitTextIntoLines = (text) => {
        if (text === '') return [];
        const lineList = text.split(/\r\n|\r|\n/);
        // "a\nb\n" splits into ["a","b",""]; drop the artificial last empty entry.
        if (lineList[lineList.length - 1] === '') lineList.pop();
        return lineList;
    };

    /**
     * Compares two lists of comparison keys and returns the edit script.
     * Strategy: trim the identical beginning and end, then run a classic
     * longest-common-subsequence table on whatever is left in the middle.
     * @param {string[]} leftKeys Comparison keys of the original items.
     * @param {string[]} rightKeys Comparison keys of the modified items.
     * @returns {Array<{type:'equal'|'removed'|'added', leftIndex:(number|null), rightIndex:(number|null)}>}
     *          Operations in display order; indexes point into the two input lists.
     */
    const diffSequences = (leftKeys, rightKeys) => {
        const operationList = [];
        const leftTotalCount = leftKeys.length;
        const rightTotalCount = rightKeys.length;

        // Count identical items at the very beginning.
        let commonPrefixLength = 0;
        while (commonPrefixLength < leftTotalCount && commonPrefixLength < rightTotalCount
            && leftKeys[commonPrefixLength] === rightKeys[commonPrefixLength]) {
            commonPrefixLength++;
        }

        // Count identical items at the very end (never overlapping the prefix).
        let commonSuffixLength = 0;
        while (commonSuffixLength < leftTotalCount - commonPrefixLength
            && commonSuffixLength < rightTotalCount - commonPrefixLength
            && leftKeys[leftTotalCount - 1 - commonSuffixLength] === rightKeys[rightTotalCount - 1 - commonSuffixLength]) {
            commonSuffixLength++;
        }

        // Exclusive end positions of the part that really needs comparing.
        const middleLeftEndIndex = leftTotalCount - commonSuffixLength;
        const middleRightEndIndex = rightTotalCount - commonSuffixLength;

        for (let index = 0; index < commonPrefixLength; index++) {
            operationList.push({ type: 'equal', leftIndex: index, rightIndex: index });
        }

        const middleLeftCount = middleLeftEndIndex - commonPrefixLength;
        const middleRightCount = middleRightEndIndex - commonPrefixLength;

        if (middleLeftCount * middleRightCount > MAXIMUM_COMPARISON_TABLE_CELLS) {
            // Too big to compare precisely: report the whole middle as replaced.
            for (let leftIndex = commonPrefixLength; leftIndex < middleLeftEndIndex; leftIndex++) {
                operationList.push({ type: 'removed', leftIndex, rightIndex: null });
            }
            for (let rightIndex = commonPrefixLength; rightIndex < middleRightEndIndex; rightIndex++) {
                operationList.push({ type: 'added', leftIndex: null, rightIndex });
            }
        } else {
            // commonSubsequenceLengthTable[i][j] = LCS length of the middle items from i (left) and j (right) onwards.
            const tableWidth = middleRightCount + 1;
            const commonSubsequenceLengthTable = new Uint32Array((middleLeftCount + 1) * tableWidth);
            for (let rowIndex = middleLeftCount - 1; rowIndex >= 0; rowIndex--) {
                for (let columnIndex = middleRightCount - 1; columnIndex >= 0; columnIndex--) {
                    const keysAreEqual = leftKeys[commonPrefixLength + rowIndex] === rightKeys[commonPrefixLength + columnIndex];
                    commonSubsequenceLengthTable[rowIndex * tableWidth + columnIndex] = keysAreEqual
                        ? commonSubsequenceLengthTable[(rowIndex + 1) * tableWidth + columnIndex + 1] + 1
                        : Math.max(
                            commonSubsequenceLengthTable[(rowIndex + 1) * tableWidth + columnIndex],
                            commonSubsequenceLengthTable[rowIndex * tableWidth + columnIndex + 1]);
                }
            }

            // Walk the table from the top-left corner to produce the operations in order.
            let rowIndex = 0;
            let columnIndex = 0;
            while (rowIndex < middleLeftCount && columnIndex < middleRightCount) {
                const leftIndex = commonPrefixLength + rowIndex;
                const rightIndex = commonPrefixLength + columnIndex;
                if (leftKeys[leftIndex] === rightKeys[rightIndex]) {
                    operationList.push({ type: 'equal', leftIndex, rightIndex });
                    rowIndex++;
                    columnIndex++;
                } else if (commonSubsequenceLengthTable[(rowIndex + 1) * tableWidth + columnIndex]
                    >= commonSubsequenceLengthTable[rowIndex * tableWidth + columnIndex + 1]) {
                    // Dropping the left item keeps the longest common subsequence: it was removed.
                    operationList.push({ type: 'removed', leftIndex, rightIndex: null });
                    rowIndex++;
                } else {
                    operationList.push({ type: 'added', leftIndex: null, rightIndex });
                    columnIndex++;
                }
            }
            // Whatever is left on one side has no partner.
            for (; rowIndex < middleLeftCount; rowIndex++) {
                operationList.push({ type: 'removed', leftIndex: commonPrefixLength + rowIndex, rightIndex: null });
            }
            for (; columnIndex < middleRightCount; columnIndex++) {
                operationList.push({ type: 'added', leftIndex: null, rightIndex: commonPrefixLength + columnIndex });
            }
        }

        for (let suffixOffset = 0; suffixOffset < commonSuffixLength; suffixOffset++) {
            operationList.push({ type: 'equal', leftIndex: middleLeftEndIndex + suffixOffset, rightIndex: middleRightEndIndex + suffixOffset });
        }
        return operationList;
    };

    /**
     * Builds the string used to decide whether two lines are "the same",
     * honouring the comparison options.
     * @param {string} lineText The raw line.
     * @param {{ignoreCase:boolean, ignoreWhitespace:boolean}} comparisonOptions Active options.
     * @returns {string} The normalised comparison key.
     */
    const createComparisonKey = (lineText, comparisonOptions) => {
        let comparisonKey = lineText;
        // Removing ALL whitespace also makes "a  b" equal to "ab", which is the usual meaning of "ignore whitespace".
        if (comparisonOptions.ignoreWhitespace) comparisonKey = comparisonKey.replace(/\s+/g, '');
        if (comparisonOptions.ignoreCase) comparisonKey = comparisonKey.toLowerCase();
        return comparisonKey;
    };

    /**
     * Splits a line into words, whitespace runs and single punctuation characters.
     * @param {string} lineText The line to tokenise.
     * @returns {string[]} The tokens; joining them gives back the original line.
     */
    const splitLineIntoTokens = (lineText) => lineText.match(/\s+|\w+|[^\w\s]/g) ?? [];

    /**
     * Merges neighbouring segments that share the same changed flag.
     * @param {Array<{text:string,isChanged:boolean}>} segmentList Segments to merge (modified in place).
     * @returns {Array<{text:string,isChanged:boolean}>} The merged list.
     */
    const mergeNeighbouringSegments = (segmentList) => segmentList.reduce((mergedList, segment) => {
        const previousSegment = mergedList[mergedList.length - 1];
        if (previousSegment && previousSegment.isChanged === segment.isChanged) previousSegment.text += segment.text;
        else mergedList.push({ ...segment });
        return mergedList;
    }, []);

    /**
     * Adds `wordSegments` to a removed/added pair of lines so the exact changed words can be highlighted.
     * @param {object} removedCell The line from the original text.
     * @param {object} addedCell The line from the modified text.
     */
    const attachWordSegmentsToPair = (removedCell, addedCell) => {
        if (removedCell.text.length > MAXIMUM_LINE_LENGTH_FOR_WORD_DIFF
            || addedCell.text.length > MAXIMUM_LINE_LENGTH_FOR_WORD_DIFF) return;

        const removedTokens = splitLineIntoTokens(removedCell.text);
        const addedTokens = splitLineIntoTokens(addedCell.text);
        const removedSegments = [];
        const addedSegments = [];
        const tokenOperations = diffSequences(removedTokens, addedTokens);

        // Lines paired only by position may be unrelated; highlighting scattered words then just adds noise.
        const unchangedCharacterCount = tokenOperations
            .filter((operation) => operation.type === 'equal')
            .reduce((characterCount, operation) => characterCount + removedTokens[operation.leftIndex].length, 0);
        const longerLineLength = Math.max(removedCell.text.length, addedCell.text.length);
        if (unchangedCharacterCount < longerLineLength * MINIMUM_SIMILARITY_FOR_WORD_DIFF) return;

        tokenOperations.forEach((operation) => {
            if (operation.type === 'equal') {
                const unchangedText = removedTokens[operation.leftIndex];
                removedSegments.push({ text: unchangedText, isChanged: false });
                addedSegments.push({ text: unchangedText, isChanged: false });
            } else if (operation.type === 'removed') {
                removedSegments.push({ text: removedTokens[operation.leftIndex], isChanged: true });
            } else {
                addedSegments.push({ text: addedTokens[operation.rightIndex], isChanged: true });
            }
        });

        removedCell.wordSegments = mergeNeighbouringSegments(removedSegments);
        addedCell.wordSegments = mergeNeighbouringSegments(addedSegments);
    };

    /**
     * Compares two texts line by line.
     * @param {string} originalText The left / original text.
     * @param {string} modifiedText The right / modified text.
     * @param {{ignoreCase?:boolean, ignoreWhitespace?:boolean}} [comparisonOptions] Optional comparison switches.
     * @returns {{unifiedRows:object[], alignedRows:Array<{leftCell:(object|null), rightCell:(object|null)}>,
     *            statistics:{addedLineCount:number, removedLineCount:number, unchangedLineCount:number, areIdentical:boolean, isEmpty:boolean}}}
     */
    const computeDiff = (originalText, modifiedText, comparisonOptions = {}) => {
        const activeOptions = { ignoreCase: false, ignoreWhitespace: false, ...comparisonOptions };
        const originalLines = splitTextIntoLines(originalText);
        const modifiedLines = splitTextIntoLines(modifiedText);
        const operationList = diffSequences(
            originalLines.map((lineText) => createComparisonKey(lineText, activeOptions)),
            modifiedLines.map((lineText) => createComparisonKey(lineText, activeOptions)));

        const unifiedRows = [];
        const alignedRows = [];
        const statistics = { addedLineCount: 0, removedLineCount: 0, unchangedLineCount: 0, areIdentical: false, isEmpty: false };

        // A change block is a run of removed and added lines between two unchanged lines.
        let pendingRemovedCells = [];
        let pendingAddedCells = [];

        /** Emits the collected change block: pairs lines up for side-by-side, stacks them for unified. */
        const flushPendingChangeBlock = () => {
            const pairedRowCount = Math.max(pendingRemovedCells.length, pendingAddedCells.length);
            for (let pairIndex = 0; pairIndex < pairedRowCount; pairIndex++) {
                const leftCell = pendingRemovedCells[pairIndex] ?? null;
                const rightCell = pendingAddedCells[pairIndex] ?? null;
                if (leftCell && rightCell) attachWordSegmentsToPair(leftCell, rightCell);
                alignedRows.push({ leftCell, rightCell });
            }
            unifiedRows.push(...pendingRemovedCells, ...pendingAddedCells);
            pendingRemovedCells = [];
            pendingAddedCells = [];
        };

        operationList.forEach((operation) => {
            if (operation.type === 'removed') {
                statistics.removedLineCount++;
                pendingRemovedCells.push({
                    type: 'removed', leftLineNumber: operation.leftIndex + 1, rightLineNumber: null,
                    text: originalLines[operation.leftIndex],
                });
            } else if (operation.type === 'added') {
                statistics.addedLineCount++;
                pendingAddedCells.push({
                    type: 'added', leftLineNumber: null, rightLineNumber: operation.rightIndex + 1,
                    text: modifiedLines[operation.rightIndex],
                });
            } else {
                flushPendingChangeBlock();
                statistics.unchangedLineCount++;
                // The same cell object is shown on both sides of a side-by-side view.
                const unchangedCell = {
                    type: 'equal', leftLineNumber: operation.leftIndex + 1, rightLineNumber: operation.rightIndex + 1,
                    text: modifiedLines[operation.rightIndex],
                };
                unifiedRows.push(unchangedCell);
                alignedRows.push({ leftCell: unchangedCell, rightCell: unchangedCell });
            }
        });
        flushPendingChangeBlock();

        statistics.isEmpty = originalLines.length === 0 && modifiedLines.length === 0;
        statistics.areIdentical = statistics.addedLineCount === 0 && statistics.removedLineCount === 0;
        return { unifiedRows, alignedRows, statistics };
    };

    return { splitTextIntoLines, diffSequences, computeDiff };
})();
