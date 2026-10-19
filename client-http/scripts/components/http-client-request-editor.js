'use strict';

/**
 * <http-client-request-editor> — tabbed editor for everything about a request
 * except the method and URL: query parameters, headers, body, authentication and
 * fetch() settings.
 *
 * Methods:
 *   buildRequestSpecification({httpMethod, urlText})
 *       Converts the form content into { targetUrl, fetchInitOptions, timeoutMilliseconds }.
 *       Throws an Error with a user-friendly message when the input is invalid.
 *   createSnapshot({includeSecrets})   Returns the editor state as plain JSON-safe data.
 *   restoreFromSnapshot(snapshot)      Loads a state previously produced by createSnapshot().
 *   updateQueryParametersFromUrl(urlText)  Refreshes the Params table from a URL's query string.
 *   buildUrlWithQueryParameters(urlText)   Returns the URL with its query string rebuilt from the Params table.
 *
 * Events:
 *   http-client-query-params-changed   The user edited the Params table.
 *
 * Requires: http-client-tabs, http-client-tab-panel, http-client-form-field,
 *           http-client-key-value-editor, http-client-button.
 */
class HttpClientRequestEditor extends HTMLElement {
    /** Builds the tabs and wires their behaviour once the element is attached to the page. */
    connectedCallback() {
        if (this._isBuilt) return;
        this._isBuilt = true;

        this.innerHTML = `
            <http-client-tabs active="params">
                <http-client-tab-panel name="params" label="Params">
                    <div class="hint-text">Query parameters (kept in sync with the URL)</div>
                    <http-client-key-value-editor name="queryParameters"></http-client-key-value-editor>
                </http-client-tab-panel>

                <http-client-tab-panel name="headers" label="Headers">
                    <div class="hint-text">Browsers silently drop forbidden headers (Host, Cookie, User-Agent, …).</div>
                    <http-client-key-value-editor name="requestHeaders" key-list="http-client-common-header-names"></http-client-key-value-editor>
                    <datalist id="http-client-common-header-names">
                        <option>Accept</option><option>Accept-Language</option><option>Authorization</option>
                        <option>Cache-Control</option><option>Content-Type</option><option>If-Match</option>
                        <option>If-None-Match</option><option>X-Requested-With</option><option>X-API-Key</option>
                    </datalist>
                </http-client-tab-panel>

                <http-client-tab-panel name="body" label="Body">
                    <http-client-form-field name="bodyContentType" type="radio" value="none"
                        options="none:none,json:JSON,text:Text,xml:XML,urlencoded:x-www-form-urlencoded,form:form-data,binary:binary"></http-client-form-field>
                    <div data-body-group="none" class="hint-text">This request has no body.</div>
                    <div data-body-group="raw" class="raw-body-section" hidden>
                        <div class="inline-row">
                            <http-client-button name="beautifyJsonButton" size="small" label="Beautify JSON"></http-client-button>
                            <span class="error-text" data-element="rawBodyErrorMessage"></span>
                        </div>
                        <http-client-form-field name="rawBodyText" type="textarea" placeholder='{"hello": "world"}'></http-client-form-field>
                    </div>
                    <http-client-key-value-editor name="urlEncodedFormFields" data-body-group="urlencoded" hidden></http-client-key-value-editor>
                    <http-client-key-value-editor name="multipartFormFields" files data-body-group="form" hidden></http-client-key-value-editor>
                    <div data-body-group="binary" hidden><input type="file" name="binaryFileInput"></div>
                </http-client-tab-panel>

                <http-client-tab-panel name="auth" label="Auth">
                    <http-client-form-field name="authenticationType" type="select" label="Type" value="none"
                        options="none:No auth,basic:Basic,bearer:Bearer token,apikey:API key"></http-client-form-field>
                    <div data-authentication-group="basic" class="authentication-fields" hidden>
                        <http-client-form-field name="basicAuthenticationUsername" label="Username"></http-client-form-field>
                        <http-client-form-field name="basicAuthenticationPassword" type="password" label="Password"></http-client-form-field>
                    </div>
                    <div data-authentication-group="bearer" class="authentication-fields" hidden>
                        <http-client-form-field name="bearerAuthenticationToken" label="Token"></http-client-form-field>
                    </div>
                    <div data-authentication-group="apikey" class="authentication-fields" hidden>
                        <http-client-form-field name="apiKeyName" label="Key" value="X-API-Key"></http-client-form-field>
                        <http-client-form-field name="apiKeyValue" label="Value"></http-client-form-field>
                        <http-client-form-field name="apiKeyLocation" type="select" label="Add to" options="header:Header,query:Query params"></http-client-form-field>
                    </div>
                </http-client-tab-panel>

                <http-client-tab-panel name="settings" label="Settings">
                    <div class="two-column-grid">
                        <http-client-form-field name="fetchMode" type="select" label="Mode" options="cors,same-origin,no-cors"></http-client-form-field>
                        <http-client-form-field name="fetchCredentials" type="select" label="Credentials" options="same-origin,include,omit"></http-client-form-field>
                        <http-client-form-field name="fetchCacheMode" type="select" label="Cache" options="default,no-store,reload,no-cache,force-cache,only-if-cached"></http-client-form-field>
                        <http-client-form-field name="fetchRedirectMode" type="select" label="Redirect" options="follow,manual,error"></http-client-form-field>
                        <http-client-form-field name="fetchReferrerPolicy" type="select" label="Referrer policy"
                            options=":(default),no-referrer,no-referrer-when-downgrade,origin,origin-when-cross-origin,same-origin,strict-origin,strict-origin-when-cross-origin,unsafe-url"></http-client-form-field>
                        <http-client-form-field name="requestTimeoutMilliseconds" type="number" min="0" value="30000" label="Timeout (ms, 0 = none)"></http-client-form-field>
                    </div>
                    <div class="hint-text">Note: <code>no-cors</code> returns an opaque response (status 0, empty body). Cross-origin calls need CORS headers on the server.</div>
                </http-client-tab-panel>
            </http-client-tabs>`;

        this._tabsElement = this.querySelector('http-client-tabs');
        // Start with a sensible default header so a fresh request asks for any content type.
        this._findControlByName('requestHeaders').replaceAllRows([{ isEnabled: true, keyText: 'Accept', valueText: '*/*' }]);

        // All child controls emit http-client-value-changed; the control's `name` tells us which one changed.
        this.addEventListener('http-client-value-changed', (valueChangedEvent) => {
            const changedControlName = valueChangedEvent.target.getAttribute?.('name');
            if (changedControlName === 'queryParameters') {
                this._updateTabBadges();
                HttpClientToolkit.dispatchCustomEvent(this, 'http-client-query-params-changed');
            } else if (changedControlName === 'requestHeaders') {
                this._updateTabBadges();
            } else if (changedControlName === 'bodyContentType') {
                this._showBodyEditorForSelectedContentType();
            } else if (changedControlName === 'authenticationType') {
                this._showAuthenticationFieldsForSelectedType();
            }
        });
        this._findControlByName('beautifyJsonButton').addEventListener('click', () => this._beautifyRawJsonBody());
        // Make the Tab key insert two spaces in the body editor instead of moving focus away.
        this._findControlByName('rawBodyText').addEventListener('keydown', (keyboardEvent) => {
            if (keyboardEvent.key !== 'Tab') return;
            keyboardEvent.preventDefault();
            keyboardEvent.target.setRangeText('  ', keyboardEvent.target.selectionStart, keyboardEvent.target.selectionEnd, 'end');
        });

        this._updateTabBadges();
        this._showBodyEditorForSelectedContentType();
        this._showAuthenticationFieldsForSelectedType();
    }

    /**
     * Finds a child control by its `name` attribute.
     * @param {string} controlName The name attribute value.
     * @returns {HTMLElement} The control.
     */
    _findControlByName(controlName) { return this.querySelector(`[name="${controlName}"]`); }

    /**
     * Reads the current value of a named control.
     * @param {string} controlName The name attribute value.
     * @returns {string} Its value.
     */
    _readControlValue(controlName) { return this._findControlByName(controlName).value; }

    /* ------------------------------ UI state ------------------------------ */

    /** Shows counters on the Params and Headers tabs (number of enabled rows). */
    _updateTabBadges() {
        this._tabsElement.findTabPanelByName('params').badgeText = this._findControlByName('queryParameters').getEnabledRowsWithKey().length;
        this._tabsElement.findTabPanelByName('headers').badgeText = this._findControlByName('requestHeaders').getEnabledRowsWithKey().length;
    }

    /** Displays only the body editor that matches the selected body type. */
    _showBodyEditorForSelectedContentType() {
        const selectedBodyContentType = this._readControlValue('bodyContentType');
        // json, text and xml all share the same raw text editor.
        const bodyGroupToShow = ['json', 'text', 'xml'].includes(selectedBodyContentType) ? 'raw' : selectedBodyContentType;
        this.querySelectorAll('[data-body-group]').forEach((bodyGroupElement) => {
            bodyGroupElement.hidden = bodyGroupElement.dataset.bodyGroup !== bodyGroupToShow;
        });
        this._findControlByName('beautifyJsonButton').hidden = selectedBodyContentType !== 'json';
        this.querySelector('[data-element="rawBodyErrorMessage"]').textContent = '';
    }

    /** Displays only the authentication fields that match the selected authentication type. */
    _showAuthenticationFieldsForSelectedType() {
        const selectedAuthenticationType = this._readControlValue('authenticationType');
        this.querySelectorAll('[data-authentication-group]').forEach((authenticationGroupElement) => {
            authenticationGroupElement.hidden = authenticationGroupElement.dataset.authenticationGroup !== selectedAuthenticationType;
        });
    }

    /** Re-formats the raw body as indented JSON, or shows the parse error. */
    _beautifyRawJsonBody() {
        const errorMessageElement = this.querySelector('[data-element="rawBodyErrorMessage"]');
        try {
            this._findControlByName('rawBodyText').value = JSON.stringify(JSON.parse(this._readControlValue('rawBodyText')), null, 2);
            errorMessageElement.textContent = '';
        } catch (parseError) {
            errorMessageElement.textContent = 'Invalid JSON: ' + parseError.message;
        }
    }

    /* ------------------------------ URL <-> params ------------------------------ */

    /**
     * Replaces the enabled rows of the Params table with the parameters found in the URL.
     * Disabled rows are kept, because they are not part of the URL but the user may re-enable them.
     * @param {string} urlText The URL as typed by the user.
     */
    updateQueryParametersFromUrl(urlText) {
        const queryParametersEditor = this._findControlByName('queryParameters');
        const { queryString } = HttpClientToolkit.splitUrlIntoParts(urlText);
        const disabledRowsToKeep = queryParametersEditor.getAllNonBlankRows().filter((rowData) => !rowData.isEnabled).map((rowData) => ({ ...rowData }));
        const rowsParsedFromUrl = queryString ? HttpClientToolkit.parseQueryStringIntoRows(queryString) : [];
        queryParametersEditor.replaceAllRows([...rowsParsedFromUrl, ...disabledRowsToKeep]);
        this._updateTabBadges();
    }

    /**
     * Rebuilds the URL's query string from the enabled Params rows.
     * @param {string} urlText The current URL text.
     * @returns {string} The URL with an updated query string; base and #fragment are untouched.
     */
    buildUrlWithQueryParameters(urlText) {
        const { baseUrl, fragment } = HttpClientToolkit.splitUrlIntoParts(urlText);
        const rebuiltQueryString = this._findControlByName('queryParameters').getEnabledRowsWithKey()
            .map((rowData) => `${encodeURIComponent(rowData.keyText)}=${encodeURIComponent(rowData.valueText)}`)
            .join('&');
        return baseUrl + (rebuiltQueryString ? '?' + rebuiltQueryString : '') + fragment;
    }

    /* ------------------------------ build request ------------------------------ */

    /**
     * Turns the editor content into something fetch() can send.
     * @param {{httpMethod:string, urlText:string}} requestBasics The method and URL typed in the request bar.
     * @returns {{targetUrl:string, fetchInitOptions:RequestInit, timeoutMilliseconds:number}} The request specification.
     * @throws {Error} When the URL is empty or invalid.
     */
    buildRequestSpecification({ httpMethod, urlText }) {
        let normalisedUrlText = (urlText || '').trim();
        if (!normalisedUrlText) throw new Error('Please enter a URL.');
        // Assume http:// when the user typed a bare host such as "localhost:3000/api".
        if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(normalisedUrlText)) normalisedUrlText = 'http://' + normalisedUrlText;
        const targetUrlObject = new URL(normalisedUrlText);

        // ---- Headers ----
        const requestHeaders = new Headers();
        // Setting an invalid header name/value throws; we skip those silently so one bad row does not block sending.
        const setHeaderIgnoringInvalid = (headerName, headerValue) => { try { requestHeaders.set(headerName, headerValue); } catch { /* invalid header: skip */ } };
        this._findControlByName('requestHeaders').getEnabledRowsWithKey().forEach((rowData) => setHeaderIgnoringInvalid(rowData.keyText.trim(), rowData.valueText));

        // ---- Authentication ----
        const authenticationType = this._readControlValue('authenticationType');
        if (authenticationType === 'basic') {
            // btoa only handles Latin-1, so UTF-8 encode the credentials first.
            const credentialsText = this._readControlValue('basicAuthenticationUsername') + ':' + this._readControlValue('basicAuthenticationPassword');
            setHeaderIgnoringInvalid('Authorization', 'Basic ' + btoa(unescape(encodeURIComponent(credentialsText))));
        } else if (authenticationType === 'bearer') {
            setHeaderIgnoringInvalid('Authorization', 'Bearer ' + this._readControlValue('bearerAuthenticationToken').trim());
        } else if (authenticationType === 'apikey' && this._readControlValue('apiKeyName').trim()) {
            const apiKeyName = this._readControlValue('apiKeyName').trim();
            if (this._readControlValue('apiKeyLocation') === 'header') setHeaderIgnoringInvalid(apiKeyName, this._readControlValue('apiKeyValue'));
            else targetUrlObject.searchParams.set(apiKeyName, this._readControlValue('apiKeyValue'));
        }

        // ---- Body ----
        let requestBody;
        const selectedBodyContentType = this._readControlValue('bodyContentType');
        // Only sets Content-Type when the user has not already provided one in the Headers tab.
        const setDefaultContentType = (contentTypeValue) => { if (!requestHeaders.has('Content-Type')) requestHeaders.set('Content-Type', contentTypeValue); };
        // GET and HEAD requests cannot carry a body in fetch().
        if (!['GET', 'HEAD'].includes(httpMethod)) {
            if (['json', 'text', 'xml'].includes(selectedBodyContentType)) {
                requestBody = this._readControlValue('rawBodyText');
                setDefaultContentType({ json: 'application/json', text: 'text/plain', xml: 'application/xml' }[selectedBodyContentType]);
            } else if (selectedBodyContentType === 'urlencoded') {
                requestBody = new URLSearchParams(this._findControlByName('urlEncodedFormFields').getEnabledRowsWithKey().map((rowData) => [rowData.keyText, rowData.valueText])).toString();
                setDefaultContentType('application/x-www-form-urlencoded');
            } else if (selectedBodyContentType === 'form') {
                requestBody = new FormData();
                this._findControlByName('multipartFormFields').getEnabledRowsWithKey().forEach((rowData) => {
                    if (rowData.valueType === 'file' && rowData.selectedFile) requestBody.append(rowData.keyText, rowData.selectedFile, rowData.selectedFile.name);
                    else requestBody.append(rowData.keyText, rowData.valueText);
                });
                requestHeaders.delete('Content-Type'); // the browser must generate the multipart boundary itself
            } else if (selectedBodyContentType === 'binary') {
                requestBody = this._findControlByName('binaryFileInput').files[0];
                if (requestBody) setDefaultContentType(requestBody.type || 'application/octet-stream');
            }
        }

        // ---- fetch() options ----
        const fetchInitOptions = {
            method: httpMethod,
            headers: requestHeaders,
            body: requestBody,
            mode: this._readControlValue('fetchMode'),
            credentials: this._readControlValue('fetchCredentials'),
            cache: this._readControlValue('fetchCacheMode'),
            redirect: this._readControlValue('fetchRedirectMode'),
        };
        // An empty referrer policy means "browser default", so it must be omitted.
        if (this._readControlValue('fetchReferrerPolicy')) fetchInitOptions.referrerPolicy = this._readControlValue('fetchReferrerPolicy');

        return {
            targetUrl: targetUrlObject.toString(),
            fetchInitOptions,
            timeoutMilliseconds: Number(this._readControlValue('requestTimeoutMilliseconds')) || 0,
        };
    }

    /* ------------------------------ persistence ------------------------------ */

    /**
     * Captures the editor state as plain data (for history or saving).
     * Files cannot be stored, and secrets are left out unless explicitly requested.
     * @param {{includeSecrets?:boolean}} [snapshotOptions] Set includeSecrets to keep passwords/tokens/API key values.
     * @returns {object} The snapshot.
     */
    createSnapshot({ includeSecrets = false } = {}) {
        // Returns the real value for secrets only when allowed, otherwise an empty string.
        const readSecretControlValue = (controlName) => (includeSecrets ? this._readControlValue(controlName) : '');
        return {
            queryParameters: this._findControlByName('queryParameters').serializeRowsForStorage(),
            requestHeaders: this._findControlByName('requestHeaders').serializeRowsForStorage(),
            bodyContentType: this._readControlValue('bodyContentType'),
            rawBodyText: this._readControlValue('rawBodyText'),
            urlEncodedFormFields: this._findControlByName('urlEncodedFormFields').serializeRowsForStorage(),
            // File rows are dropped: a File object cannot be saved or restored.
            multipartFormFields: this._findControlByName('multipartFormFields').serializeRowsForStorage().filter((rowData) => rowData.valueType !== 'file'),
            authentication: {
                type: this._readControlValue('authenticationType'),
                username: this._readControlValue('basicAuthenticationUsername'),
                password: readSecretControlValue('basicAuthenticationPassword'),
                bearerToken: readSecretControlValue('bearerAuthenticationToken'),
                apiKeyName: this._readControlValue('apiKeyName'),
                apiKeyValue: readSecretControlValue('apiKeyValue'),
                apiKeyLocation: this._readControlValue('apiKeyLocation'),
            },
            fetchSettings: {
                mode: this._readControlValue('fetchMode'),
                credentials: this._readControlValue('fetchCredentials'),
                cacheMode: this._readControlValue('fetchCacheMode'),
                redirectMode: this._readControlValue('fetchRedirectMode'),
                referrerPolicy: this._readControlValue('fetchReferrerPolicy'),
                timeoutMilliseconds: this._readControlValue('requestTimeoutMilliseconds'),
            },
        };
    }

    /**
     * Loads a snapshot created by createSnapshot() back into the editor.
     * @param {object} snapshot The state to restore.
     */
    restoreFromSnapshot(snapshot) {
        const writeControlValue = (controlName, newValue) => { this._findControlByName(controlName).value = newValue; };
        this._findControlByName('queryParameters').replaceAllRows(snapshot.queryParameters);
        this._findControlByName('requestHeaders').replaceAllRows(snapshot.requestHeaders);
        writeControlValue('bodyContentType', snapshot.bodyContentType);
        writeControlValue('rawBodyText', snapshot.rawBodyText);
        this._findControlByName('urlEncodedFormFields').replaceAllRows(snapshot.urlEncodedFormFields);
        this._findControlByName('multipartFormFields').replaceAllRows(snapshot.multipartFormFields);

        const authentication = snapshot.authentication;
        writeControlValue('authenticationType', authentication.type);
        writeControlValue('basicAuthenticationUsername', authentication.username);
        writeControlValue('basicAuthenticationPassword', authentication.password);
        writeControlValue('bearerAuthenticationToken', authentication.bearerToken);
        writeControlValue('apiKeyName', authentication.apiKeyName);
        writeControlValue('apiKeyValue', authentication.apiKeyValue);
        writeControlValue('apiKeyLocation', authentication.apiKeyLocation);

        const fetchSettings = snapshot.fetchSettings;
        writeControlValue('fetchMode', fetchSettings.mode);
        writeControlValue('fetchCredentials', fetchSettings.credentials);
        writeControlValue('fetchCacheMode', fetchSettings.cacheMode);
        writeControlValue('fetchRedirectMode', fetchSettings.redirectMode);
        writeControlValue('fetchReferrerPolicy', fetchSettings.referrerPolicy);
        writeControlValue('requestTimeoutMilliseconds', fetchSettings.timeoutMilliseconds);

        // Programmatic writes emit no events, so refresh the dependent UI manually.
        this._updateTabBadges();
        this._showBodyEditorForSelectedContentType();
        this._showAuthenticationFieldsForSelectedType();
    }
}
HttpClientToolkit.registerCustomElementOnce('http-client-request-editor', HttpClientRequestEditor);
