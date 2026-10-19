'use strict';

/**
 * <http-client-response-viewer> — shows an HTTP response: a status/time/size
 * summary, the body (pretty / raw / preview, with a JSON path filter), the
 * response headers and general information.
 *
 * Methods:
 *   displayResponse(responseDescription)  Shows a result returned by httpRequestService.sendRequest().
 *   displayLoadingState()                 Shows a "sending…" placeholder.
 *   displayErrorMessage(messageText)      Shows an error instead of a response.
 *   resetToEmptyState()                   Clears everything back to the initial placeholder.
 *
 * Requires: http-client-tabs, http-client-tab-panel, http-client-segmented-toggle,
 *           http-client-form-field, http-client-copy-button, http-client-button.
 */
class HttpClientResponseViewer extends HTMLElement {
    /** Builds the tabs and toolbar once the element is attached to the page. */
    connectedCallback() {
        if (this._isBuilt) return;
        this._isBuilt = true;

        this.innerHTML = `
            <http-client-tabs active="body">
                <div tab-bar-extra class="response-summary" data-element="responseSummary"></div>
                <http-client-tab-panel name="body" label="Body">
                    <div class="response-toolbar">
                        <http-client-segmented-toggle name="bodyViewMode" options="pretty:Pretty,raw:Raw,preview:Preview" value="pretty"></http-client-segmented-toggle>
                        <http-client-form-field name="jsonPathFilter" placeholder="Filter JSON: data.items[0].name" hidden></http-client-form-field>
                        <http-client-form-field name="wrapLongLines" type="checkbox" label="Wrap" checked></http-client-form-field>
                        <http-client-copy-button name="copyBodyButton" size="small" label="Copy"></http-client-copy-button>
                        <http-client-button name="downloadBodyButton" size="small" label="Download"></http-client-button>
                    </div>
                    <div class="response-content-area" data-element="responseBody"></div>
                </http-client-tab-panel>
                <http-client-tab-panel name="headers" label="Headers"><div class="response-content-area" data-element="responseHeaders"></div></http-client-tab-panel>
                <http-client-tab-panel name="info" label="Info"><div class="response-content-area" data-element="responseInformation"></div></http-client-tab-panel>
            </http-client-tabs>`;

        this._tabsElement = this.querySelector('http-client-tabs');
        // Helpers to find internal parts by their data-element / name attributes.
        this._findPartByDataElement = (partName) => this.querySelector(`[data-element="${partName}"]`);
        this._findControlByName = (controlName) => this.querySelector(`[name="${controlName}"]`);

        // Any toolbar change simply re-renders the body.
        ['bodyViewMode', 'wrapLongLines', 'jsonPathFilter'].forEach((controlName) => {
            this._findControlByName(controlName).addEventListener('http-client-value-changed', () => this._renderBody());
        });
        this._findControlByName('copyBodyButton').textToCopyProvider = () => this._getTextToCopy();
        this._findControlByName('downloadBodyButton').addEventListener('click', () => this._downloadBody());

        this.resetToEmptyState();
    }

    /* ------------------------------ public API ------------------------------ */

    /** Clears the viewer back to the initial "press Send" placeholder. */
    resetToEmptyState() {
        /** @type {object|null} The response currently displayed (null when none). */
        this._currentResponse = null;
        this._findPartByDataElement('responseSummary').textContent = '';
        this._tabsElement.findTabPanelByName('headers').badgeText = '';
        this._showPlaceholderInBody('<div class="placeholder-message">Enter a URL and press <b>Send</b> to get a response.</div>');
        this._findPartByDataElement('responseHeaders').textContent = '';
        this._findPartByDataElement('responseInformation').textContent = '';
    }

    /** Shows a "Sending request…" message while waiting for the server. */
    displayLoadingState() {
        this._findPartByDataElement('responseSummary').textContent = '';
        this._showPlaceholderInBody('<div class="loading-message">Sending request…</div>');
    }

    /**
     * Shows an error (network failure, timeout, invalid input) in place of a response.
     * @param {string} messageText The text to show; line breaks are preserved.
     */
    displayErrorMessage(messageText) {
        this._currentResponse = null;
        this._findPartByDataElement('responseSummary').innerHTML = '<span class="status-pill status-error">Error</span>';
        const bodyElement = this._findPartByDataElement('responseBody');
        bodyElement.className = 'response-content-area';
        bodyElement.textContent = '';
        const errorTextElement = Object.assign(document.createElement('pre'), { textContent: messageText });
        errorTextElement.style.color = 'var(--danger)';
        bodyElement.append(errorTextElement);
        this._findPartByDataElement('responseHeaders').textContent = '';
        this._findPartByDataElement('responseInformation').textContent = '';
        this._tabsElement.findTabPanelByName('headers').badgeText = '';
    }

    /**
     * Displays a response: summary, body, headers and info.
     * @param {object} responseDescription Result of httpRequestService.sendRequest().
     */
    displayResponse(responseDescription) {
        this._currentResponse = responseDescription;
        const response = responseDescription;

        // Colour class by status family: 2xx success, 3xx redirect, 4xx/5xx error, 0 = opaque/unknown.
        let statusColourClass = 'status-error';
        if (response.statusCode >= 200 && response.statusCode < 300) statusColourClass = 'status-success';
        else if (response.statusCode >= 300 && response.statusCode < 400) statusColourClass = 'status-redirect';

        this._findPartByDataElement('responseSummary').innerHTML =
            `<span class="status-pill ${statusColourClass}">${response.statusCode || 'opaque'} ${HttpClientToolkit.escapeHtmlSpecialCharacters(response.statusText)}</span>` +
            `<span title="Time to first byte: ${HttpClientToolkit.formatDurationForDisplay(response.timeToFirstByteMilliseconds)}">${HttpClientToolkit.formatDurationForDisplay(response.totalDurationMilliseconds)}</span>` +
            `<span>${HttpClientToolkit.formatByteCountForDisplay(response.bodySizeInBytes)}</span>`;
        this._tabsElement.findTabPanelByName('headers').badgeText = response.headerEntries.length;

        this._renderBody();

        this._findPartByDataElement('responseHeaders').innerHTML = response.headerEntries.length
            ? this._buildKeyValueTableHtml(response.headerEntries)
            : '<div class="placeholder-message">No readable headers. Cross-origin responses only expose CORS-safelisted headers unless the server sends Access-Control-Expose-Headers.</div>';

        this._findPartByDataElement('responseInformation').innerHTML = this._buildKeyValueTableHtml([
            ['URL', response.finalUrl],
            ['Method', response.requestMethod],
            ['Status', `${response.statusCode} ${response.statusText}`],
            ['Response type', response.responseType],
            ['Redirected', String(response.wasRedirected)],
            ['Content-Type', response.contentTypeHeader || '(none)'],
            ['Size', `${HttpClientToolkit.formatByteCountForDisplay(response.bodySizeInBytes)} (${response.bodySizeInBytes} bytes)`],
            ['Time to first byte', HttpClientToolkit.formatDurationForDisplay(response.timeToFirstByteMilliseconds)],
            ['Total time', HttpClientToolkit.formatDurationForDisplay(response.totalDurationMilliseconds)],
        ]);
    }

    /* ------------------------------ rendering ------------------------------ */

    /**
     * Replaces the body area with a simple HTML message.
     * @param {string} messageHtml Trusted HTML to display.
     */
    _showPlaceholderInBody(messageHtml) {
        const bodyElement = this._findPartByDataElement('responseBody');
        bodyElement.className = 'response-content-area';
        bodyElement.innerHTML = messageHtml;
    }

    /**
     * Builds a two-column table.
     * @param {Array<[string,string]>} nameValuePairs Rows of [name, value]; both are HTML-escaped.
     * @returns {string} Table HTML.
     */
    _buildKeyValueTableHtml(nameValuePairs) {
        const escape = HttpClientToolkit.escapeHtmlSpecialCharacters;
        return '<table class="key-value-table">'
            + nameValuePairs.map(([name, value]) => `<tr><td>${escape(name)}</td><td>${escape(value)}</td></tr>`).join('')
            + '</table>';
    }

    /**
     * Classifies the response body from its Content-Type header.
     * @returns {'json'|'html'|'xml'|'image'|'pdf'|'text'|'binary'|'unknown'} The body kind.
     */
    _detectBodyKind() {
        const contentType = this._currentResponse.contentTypeHeader.toLowerCase();
        if (/json/.test(contentType)) return 'json';
        if (contentType.includes('html')) return 'html';
        if (contentType.includes('xml')) return 'xml';
        if (contentType.startsWith('image/')) return 'image';
        if (contentType.includes('pdf')) return 'pdf';
        if (/^(text\/|application\/(javascript|x-www-form-urlencoded))/.test(contentType)) return 'text';
        return contentType ? 'binary' : 'unknown';
    }

    /**
     * Decodes the body bytes to text using the charset from Content-Type (default UTF-8).
     * The result is cached on the response object because decoding large bodies is costly.
     * @returns {string} The decoded body text.
     */
    _getBodyAsText() {
        const response = this._currentResponse;
        if (response.cachedBodyText === undefined) {
            const charsetMatch = /charset=([^;]+)/i.exec(response.contentTypeHeader);
            try {
                response.cachedBodyText = new TextDecoder(charsetMatch ? charsetMatch[1].trim() : 'utf-8').decode(response.bodyBuffer);
            } catch {
                // Unknown charset label: fall back to UTF-8.
                response.cachedBodyText = new TextDecoder('utf-8').decode(response.bodyBuffer);
            }
        }
        return response.cachedBodyText;
    }

    /** Renders the body area according to the selected view mode, wrap setting and JSON filter. */
    _renderBody() {
        const response = this._currentResponse;
        if (!response) return;

        const bodyElement = this._findPartByDataElement('responseBody');
        const selectedViewMode = this._findControlByName('bodyViewMode').selectedValue;
        const jsonPathFilterField = this._findControlByName('jsonPathFilter');
        bodyElement.className = 'response-content-area' + (this._findControlByName('wrapLongLines').checked ? '' : ' no-wrap');
        bodyElement.textContent = '';

        // Release the previous preview blob so memory is not leaked.
        if (this._previewObjectUrl) { URL.revokeObjectURL(this._previewObjectUrl); this._previewObjectUrl = null; }

        const bodyKind = this._detectBodyKind();
        // Treat a body as JSON when declared so, or when the type is unknown but it starts with { or [.
        const isJsonBody = bodyKind === 'json' || (bodyKind === 'unknown' && /^\s*[{[]/.test(this._getBodyAsText().slice(0, 50)));
        // The JSON filter box is only useful in Pretty mode for JSON bodies.
        jsonPathFilterField.hidden = !(isJsonBody && selectedViewMode === 'pretty');

        if (response.statusCode === 0 && response.responseType === 'opaque') {
            bodyElement.innerHTML = '<div class="placeholder-message">Opaque response (<code>no-cors</code> mode) — status and body are hidden by the browser.</div>';
            return;
        }
        if (!response.bodySizeInBytes) {
            bodyElement.innerHTML = '<div class="placeholder-message">Response body is empty.</div>';
            return;
        }
        if (selectedViewMode === 'preview') {
            this._renderPreview(bodyElement, bodyKind);
            return;
        }
        if (['image', 'pdf', 'binary'].includes(bodyKind)) {
            bodyElement.innerHTML = `<div class="placeholder-message">Binary content (${HttpClientToolkit.escapeHtmlSpecialCharacters(response.contentTypeHeader)}, ${HttpClientToolkit.formatByteCountForDisplay(response.bodySizeInBytes)}).<br>Use <b>Preview</b> or <b>Download</b>.</div>`;
            return;
        }

        const preformattedTextElement = Object.assign(document.createElement('pre'), { className: 'monospace-text' });
        const bodyText = this._getBodyAsText();
        if (selectedViewMode === 'pretty' && isJsonBody) {
            try {
                let parsedJsonValue = JSON.parse(bodyText);
                // Narrow down to the part of the document the user asked for, if any.
                if (jsonPathFilterField.value.trim()) parsedJsonValue = HttpClientResponseViewer.evaluateJsonPath(parsedJsonValue, jsonPathFilterField.value);
                const prettyJsonText = JSON.stringify(parsedJsonValue, null, 2) ?? 'undefined';
                // Syntax highlighting is skipped for very large payloads to keep the page responsive.
                if (prettyJsonText.length > 2_000_000) preformattedTextElement.textContent = prettyJsonText;
                else preformattedTextElement.innerHTML = HttpClientResponseViewer.highlightJsonAsHtml(prettyJsonText);
            } catch (jsonError) {
                // Invalid JSON: show the raw text. A path error: show the error message.
                preformattedTextElement.textContent = jsonError instanceof SyntaxError ? bodyText : '⚠ ' + jsonError.message;
            }
        } else {
            preformattedTextElement.textContent = bodyText;
        }
        bodyElement.append(preformattedTextElement);
    }

    /**
     * Renders the Preview view: images, PDFs and (sandboxed) HTML.
     * @param {HTMLElement} bodyElement The container to render into.
     * @param {string} bodyKind The result of _detectBodyKind().
     */
    _renderPreview(bodyElement, bodyKind) {
        const response = this._currentResponse;
        const bodyBlob = new Blob([response.bodyBuffer], { type: response.contentTypeHeader || 'application/octet-stream' });
        this._previewObjectUrl = URL.createObjectURL(bodyBlob);

        if (bodyKind === 'image') {
            bodyElement.append(Object.assign(new Image(), { src: this._previewObjectUrl }));
        } else if (bodyKind === 'pdf') {
            bodyElement.append(Object.assign(document.createElement('iframe'), { src: this._previewObjectUrl }));
        } else if (bodyKind === 'html') {
            const sandboxedFrameElement = document.createElement('iframe');
            // An empty sandbox attribute applies ALL restrictions: no scripts, forms, popups or same-origin access.
            sandboxedFrameElement.setAttribute('sandbox', '');
            sandboxedFrameElement.srcdoc = this._getBodyAsText();
            bodyElement.append(sandboxedFrameElement);
        } else {
            bodyElement.innerHTML = '<div class="placeholder-message">No preview available for this content type.</div>';
        }
    }

    /* ------------------------------ actions ------------------------------ */

    /**
     * Supplies the text for the Copy button: exactly what is shown in Pretty mode
     * (including a JSON filter), otherwise the full decoded body.
     * @returns {string} Text to copy, or '' when nothing is displayed.
     */
    _getTextToCopy() {
        if (!this._currentResponse) return '';
        const displayedPreElement = this._findPartByDataElement('responseBody').querySelector('pre');
        const isPrettyMode = this._findControlByName('bodyViewMode').selectedValue === 'pretty';
        return displayedPreElement && isPrettyMode ? displayedPreElement.textContent : this._getBodyAsText();
    }

    /** Saves the raw response bytes to a file named response.<extension>. */
    _downloadBody() {
        const response = this._currentResponse;
        if (!response) return;
        // Guess a file extension from the body kind; images use their MIME subtype.
        const fileExtension = {
            json: 'json', html: 'html', xml: 'xml', text: 'txt', pdf: 'pdf',
            image: (response.contentTypeHeader.split('/')[1] || 'img').split(/[;+]/)[0],
        }[this._detectBodyKind()] || 'bin';

        const temporaryDownloadLink = Object.assign(document.createElement('a'), {
            href: URL.createObjectURL(new Blob([response.bodyBuffer], { type: response.contentTypeHeader })),
            download: 'response.' + fileExtension,
        });
        temporaryDownloadLink.click();
        // Revoke later so the download has time to start.
        setTimeout(() => URL.revokeObjectURL(temporaryDownloadLink.href), 1000);
    }

    /* ------------------------------ static helpers ------------------------------ */

    /**
     * Wraps JSON tokens in <span> elements so CSS can colour keys, strings,
     * numbers, booleans and null. The text is HTML-escaped first, so quotes
     * appear as &quot; and the regular expression matches that form.
     * @param {string} jsonText Pretty-printed JSON text.
     * @returns {string} HTML with syntax highlighting.
     */
    static highlightJsonAsHtml(jsonText) {
        const jsonTokenPattern = /(&quot;(?:\\.|[^\\&]|&(?!quot;))*&quot;)(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
        return HttpClientToolkit.escapeHtmlSpecialCharacters(jsonText).replace(
            jsonTokenPattern,
            (matchedToken, quotedString, colonAfterString, booleanLiteral) => {
                // A string followed by ":" is an object key; otherwise it is a string value.
                if (quotedString) return colonAfterString ? `<span class="json-key">${quotedString}</span>${colonAfterString}` : `<span class="json-string">${quotedString}</span>`;
                if (booleanLiteral) return `<span class="json-boolean">${matchedToken}</span>`;
                if (matchedToken === 'null') return '<span class="json-null">null</span>';
                return `<span class="json-number">${matchedToken}</span>`;
            },
        );
    }

    /**
     * Evaluates a simple path against a parsed JSON value.
     * Supported syntax: dots, [index], ["quoted key"], and an optional leading "$".
     * Examples: data.items[0].name   $.a["b c"][2]
     * @param {*} rootValue The parsed JSON document.
     * @param {string} pathText The path to follow.
     * @returns {*} The value found at the path.
     * @throws {Error} When a path segment does not exist.
     */
    static evaluateJsonPath(rootValue, pathText) {
        const pathWithoutRootMarker = pathText.trim().replace(/^\$\.?/, '');
        if (!pathWithoutRootMarker) return rootValue;

        let currentValue = rootValue;
        // Each match is one segment: a bare name, [index], ["key"] or ['key'].
        const pathSegmentPattern = /([^.[\]]+)|\[(\d+)\]|\["([^"]*)"\]|\['([^']*)'\]/g;
        for (const segmentMatch of pathWithoutRootMarker.matchAll(pathSegmentPattern)) {
            const segmentKey = segmentMatch[1] ?? segmentMatch[2] ?? segmentMatch[3] ?? segmentMatch[4];
            if (currentValue === null || typeof currentValue !== 'object' || !(segmentKey in currentValue)) {
                throw new Error(`Path not found at "${segmentKey}"`);
            }
            currentValue = currentValue[segmentKey];
        }
        return currentValue;
    }
}
HttpClientToolkit.registerCustomElementOnce('http-client-response-viewer', HttpClientResponseViewer);
