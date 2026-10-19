'use strict';

/**
 * UI-independent HTTP layer: sends requests with fetch() and exports cURL commands.
 * Contains no DOM code so it could be reused or unit tested on its own.
 *
 * A "request specification" is a plain object:
 *   {
 *     targetUrl: string,                 // absolute URL including query string
 *     fetchInitOptions: RequestInit,     // method, headers, body, mode, credentials, ...
 *     timeoutMilliseconds: number        // 0 means "no timeout"
 *   }
 */
HttpClientToolkit.httpRequestService = {
    /**
     * Sends a request specification using fetch().
     * Resolves with a plain "response description" object (including the raw body bytes)
     * and rejects with an Error whose message is suitable for showing to the user.
     *
     * @param {{targetUrl:string, fetchInitOptions:RequestInit, timeoutMilliseconds:number}} requestSpecification What to send.
     * @param {{abortSignal?:AbortSignal}} [sendOptions] Pass an AbortSignal to let the caller cancel the request.
     * @returns {Promise<object>} Response description (statusCode, headerEntries, bodyBuffer, timings, ...).
     */
    async sendRequest(requestSpecification, { abortSignal } = {}) {
        // We use our own controller so that BOTH the caller's cancel signal and our timeout can abort fetch.
        const internalAbortController = new AbortController();
        const abortInternalController = () => internalAbortController.abort();
        abortSignal?.addEventListener('abort', abortInternalController);

        // Tracks whether the abort was caused by the timeout, to choose the right error message.
        let didTimeoutElapse = false;
        const timeoutTimerIdentifier = requestSpecification.timeoutMilliseconds
            ? setTimeout(() => { didTimeoutElapse = true; internalAbortController.abort(); }, requestSpecification.timeoutMilliseconds)
            : 0;

        const requestStartTimestamp = performance.now();

        try {
            const fetchResponse = await fetch(requestSpecification.targetUrl, {
                ...requestSpecification.fetchInitOptions,
                signal: internalAbortController.signal,
            });
            // fetch() resolves as soon as headers arrive, so this timestamp is the time to first byte.
            const headersReceivedTimestamp = performance.now();
            const bodyBuffer = await fetchResponse.arrayBuffer();
            const bodyReceivedTimestamp = performance.now();

            return {
                requestMethod: requestSpecification.fetchInitOptions.method,
                finalUrl: fetchResponse.url || requestSpecification.targetUrl, // differs from targetUrl after redirects
                statusCode: fetchResponse.status,
                statusText: fetchResponse.statusText,
                isSuccessful: fetchResponse.ok,
                responseType: fetchResponse.type, // basic | cors | opaque | ...
                wasRedirected: fetchResponse.redirected,
                headerEntries: [...fetchResponse.headers.entries()], // [[name, value], ...]
                contentTypeHeader: fetchResponse.headers.get('content-type') || '',
                bodyBuffer,
                bodySizeInBytes: bodyBuffer.byteLength,
                timeToFirstByteMilliseconds: headersReceivedTimestamp - requestStartTimestamp,
                totalDurationMilliseconds: bodyReceivedTimestamp - requestStartTimestamp,
            };
        } catch (caughtError) {
            if (caughtError.name === 'AbortError') {
                // Distinguish "user pressed Cancel" from "timeout elapsed".
                throw Object.assign(
                    new Error(didTimeoutElapse
                        ? `Request timed out after ${requestSpecification.timeoutMilliseconds} ms.`
                        : 'Request cancelled.'),
                    { name: didTimeoutElapse ? 'TimeoutError' : 'AbortError' },
                );
            }
            // Browsers deliberately give network errors no detail, so list the usual causes.
            throw new Error(`${caughtError.message}\n\nCommon causes: server unreachable, blocked by CORS (the server must send Access-Control-Allow-Origin), mixed content (https page → http API), or an invalid certificate.`);
        } finally {
            // Always clean up so timers and listeners do not leak.
            clearTimeout(timeoutTimerIdentifier);
            abortSignal?.removeEventListener('abort', abortInternalController);
        }
    },

    /**
     * Renders a request specification as a cURL command line.
     * @param {{targetUrl:string, fetchInitOptions:RequestInit}} requestSpecification The request to export.
     * @returns {string} A shell command, with every value single-quoted.
     */
    convertRequestToCurlCommand(requestSpecification) {
        // Wraps text in single quotes and escapes embedded single quotes for POSIX shells.
        const quoteForShell = (text) => `'${String(text).replace(/'/g, `'\\''`)}'`;

        const commandParts = ['curl', '-X', requestSpecification.fetchInitOptions.method, quoteForShell(requestSpecification.targetUrl)];
        requestSpecification.fetchInitOptions.headers.forEach((headerValue, headerName) => {
            commandParts.push('-H', quoteForShell(`${headerName}: ${headerValue}`));
        });

        const requestBody = requestSpecification.fetchInitOptions.body;
        if (typeof requestBody === 'string') {
            commandParts.push('--data-raw', quoteForShell(requestBody));
        } else if (requestBody instanceof FormData) {
            requestBody.forEach((fieldValue, fieldName) => {
                // File parts use curl's "@filename" syntax; text parts are sent inline.
                commandParts.push('-F', quoteForShell(fieldValue instanceof File ? `${fieldName}=@${fieldValue.name}` : `${fieldName}=${fieldValue}`));
            });
        } else if (requestBody instanceof File) {
            commandParts.push('--data-binary', quoteForShell('@' + requestBody.name));
        }
        return commandParts.join(' ');
    },
};
