'use strict';

/**
 * Application wiring: connects the <http-client-*> components to each other.
 * All UI behaviour lives inside the components; this file only coordinates them
 * (sending requests, syncing URL and params, history, layout and theme).
 */
(() => {
    const findElementByIdentifier = (elementIdentifier) => document.getElementById(elementIdentifier);

    const requestBarElement = findElementByIdentifier('requestBar');
    const requestEditorElement = findElementByIdentifier('requestEditor');
    const responseViewerElement = findElementByIdentifier('responseViewer');
    const requestHistoryElement = findElementByIdentifier('requestHistory');
    const splitPaneElement = findElementByIdentifier('splitPane');
    const layoutToggleButtonElement = findElementByIdentifier('layoutToggleButton');

    /* ---------------- keep the URL and the Params table in sync ---------------- */

    // Typing in the URL box updates the Params table...
    requestBarElement.addEventListener('http-client-url-edited', () => {
        requestEditorElement.updateQueryParametersFromUrl(requestBarElement.urlText);
    });
    // ...and editing the Params table rewrites the URL box.
    requestEditorElement.addEventListener('http-client-query-params-changed', () => {
        requestBarElement.urlText = requestEditorElement.buildUrlWithQueryParameters(requestBarElement.urlText);
    });

    // The "cURL" button asks for the command text at click time. Invalid input is shown as an error instead.
    requestBarElement.curlCommandProvider = () => {
        try {
            return HttpClientToolkit.httpRequestService.convertRequestToCurlCommand(
                requestEditorElement.buildRequestSpecification({ httpMethod: requestBarElement.selectedMethod, urlText: requestBarElement.urlText }),
            );
        } catch (specificationError) {
            responseViewerElement.displayErrorMessage(specificationError.message);
            return '';
        }
    };

    /* ---------------- send / cancel ---------------- */

    // Lets the Cancel button abort the request that is currently in flight (null when idle).
    let activeRequestAbortController = null;

    requestBarElement.addEventListener('http-client-cancel-requested', () => activeRequestAbortController?.abort());

    requestBarElement.addEventListener('http-client-send-requested', async () => {
        let requestSpecification;
        try {
            requestSpecification = requestEditorElement.buildRequestSpecification({
                httpMethod: requestBarElement.selectedMethod,
                urlText: requestBarElement.urlText,
            });
        } catch (specificationError) {
            responseViewerElement.displayErrorMessage(specificationError.message);
            return;
        }

        activeRequestAbortController = new AbortController();
        requestBarElement.isRequestInFlight = true;
        responseViewerElement.displayLoadingState();
        try {
            const responseDescription = await HttpClientToolkit.httpRequestService.sendRequest(requestSpecification, {
                abortSignal: activeRequestAbortController.signal,
            });
            // Only successful round-trips are stored in the history.
            requestHistoryElement.addEntry(
                { httpMethod: requestBarElement.selectedMethod, urlText: requestBarElement.urlText, ...requestEditorElement.createSnapshot() },
                responseDescription.statusCode,
            );
            responseViewerElement.displayResponse(responseDescription);
        } catch (sendError) {
            responseViewerElement.displayErrorMessage(sendError.message);
        } finally {
            activeRequestAbortController = null;
            requestBarElement.isRequestInFlight = false;
        }
    });

    /* ---------------- history ---------------- */

    findElementByIdentifier('historyToggleButton').addEventListener('click', () => requestHistoryElement.toggleVisibility());

    // Choosing a history entry loads its method, URL and editor state back into the UI.
    requestHistoryElement.addEventListener('http-client-history-entry-selected', (selectionEvent) => {
        const selectedSnapshot = selectionEvent.detail.requestSnapshot;
        requestBarElement.selectedMethod = selectedSnapshot.httpMethod;
        requestBarElement.urlText = selectedSnapshot.urlText;
        requestEditorElement.restoreFromSnapshot(selectedSnapshot);
    });

    /* ---------------- layout (the split pane persists its own direction and size) ---------------- */

    /** Updates the layout button text to describe the current direction. */
    const updateLayoutButtonLabel = () => {
        layoutToggleButtonElement.label = splitPaneElement.splitDirection === 'vertical' ? '⇅ Layout: Vertical' : '⇆ Layout: Horizontal';
    };
    layoutToggleButtonElement.addEventListener('click', () => {
        splitPaneElement.splitDirection = splitPaneElement.splitDirection === 'vertical' ? 'horizontal' : 'vertical';
        updateLayoutButtonLabel();
    });
    updateLayoutButtonLabel();

    /* ---------------- theme ---------------- */

    const themeStorageKey = 'httpClient.theme';

    /**
     * Applies and remembers a colour theme.
     * @param {'light'|'dark'} themeName The theme to activate.
     */
    const applyTheme = (themeName) => {
        document.documentElement.dataset.theme = themeName;
        HttpClientToolkit.localStorageJson.writeValue(themeStorageKey, themeName);
    };
    // First visit: follow the operating system preference. Later visits: use the saved choice.
    const operatingSystemPrefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(HttpClientToolkit.localStorageJson.readValue(themeStorageKey) || (operatingSystemPrefersDark ? 'dark' : 'light'));
    findElementByIdentifier('themeToggleButton').addEventListener('click', () => {
        applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    });
})();
