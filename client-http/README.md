# HTTP Client

A Postman-style REST client that runs entirely in your browser. Requests are sent
directly from the page with the browser's `fetch()` API — there is no backend, no
build step and nothing to install.

- [Getting started](#getting-started)
- [Using the client](#using-the-client)
  - [Sending a request](#sending-a-request)
  - [Query parameters](#query-parameters)
  - [Headers](#headers)
  - [Request body](#request-body)
  - [Authentication](#authentication)
  - [Fetch settings](#fetch-settings)
  - [Reading the response](#reading-the-response)
  - [Layout: horizontal / vertical and resizing](#layout-horizontal--vertical-and-resizing)
  - [History](#history)
  - [Copy as cURL](#copy-as-curl)
  - [Theme](#theme)
- [Browser limitations (CORS and friends)](#browser-limitations-cors-and-friends)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Project structure](#project-structure)
- [Component reference](#component-reference)
- [Coding conventions](#coding-conventions)
- [Extending the client](#extending-the-client)
- [Troubleshooting](#troubleshooting)

---

## Getting started

1. Open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari). Double-clicking the file is enough — it works from `file://`.
2. Type a URL, pick a method, press **Send**.

To try it quickly, use a public CORS-enabled API such as `https://jsonplaceholder.typicode.com/todos/1`.

> Optional: if you prefer to serve it over HTTP, run `npx serve .` (or `python -m http.server`) inside this folder.

---

## Using the client

### Sending a request

1. Choose an **HTTP method** (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS) in the drop-down on the left of the URL box.
2. Enter the **URL**. If you omit the scheme (for example `localhost:3000/api`) `http://` is assumed.
3. Configure the request in the tabs below the bar (all optional).
4. Press **Send** (or press **Enter** while the cursor is in the URL box).

While a request is running the **Send** button turns into a red **Cancel** button; click it to abort. A request is also aborted automatically when the **timeout** (Settings tab, default 30 s) elapses.

### Query parameters

The **Params** tab edits the query string and is **kept in sync with the URL**:

- Typing `?page=2&limit=10` in the URL fills the table.
- Adding or editing a row in the table rewrites the URL (values are percent-encoded for you).
- Untick a row's checkbox to disable it without deleting it; disabled rows are left out of the URL but remembered.
- The number on the tab shows how many parameters are active.

Each table always has an empty row at the bottom — just start typing to add another. Use the **×** button to delete a row.

### Headers

The **Headers** tab works like the Params table. Key names offer autocomplete for common headers (`Accept`, `Authorization`, `Content-Type`, …). A default `Accept: */*` header is pre-filled.

Notes:

- `Content-Type` is set automatically from the body type, but a `Content-Type` you add here always wins.
- Browsers refuse to let scripts set some headers (`Host`, `Cookie`, `User-Agent`, `Origin`, …); those are silently dropped by the browser.

### Request body

Open the **Body** tab and choose a type. Bodies are ignored for `GET` and `HEAD` (a `fetch()` restriction).

| Type | What you get | Content-Type sent |
| --- | --- | --- |
| **none** | No body | — |
| **JSON** | Text editor + **Beautify JSON** button (shows parse errors) | `application/json` |
| **Text** | Plain text editor | `text/plain` |
| **XML** | Text editor | `application/xml` |
| **x-www-form-urlencoded** | Key/value table | `application/x-www-form-urlencoded` |
| **form-data** | Key/value table; each row can be **Text** or **File** (multipart upload) | `multipart/form-data` (boundary added by the browser) |
| **binary** | Choose a single file to send as the raw body | the file's type, or `application/octet-stream` |

In the text editor the **Tab** key inserts two spaces instead of moving focus.

### Authentication

The **Auth** tab can add credentials for you:

| Type | Result |
| --- | --- |
| **No auth** | Nothing is added |
| **Basic** | `Authorization: Basic base64(username:password)` (UTF-8 safe) |
| **Bearer token** | `Authorization: Bearer <token>` |
| **API key** | Adds your key name and value either as a **header** or as a **query parameter** |

### Fetch settings

The **Settings** tab exposes the `fetch()` options:

| Setting | Meaning |
| --- | --- |
| **Mode** | `cors` (default for cross-origin), `same-origin`, or `no-cors` (opaque response — status 0, empty body) |
| **Credentials** | Whether cookies/HTTP auth are sent: `same-origin`, `include`, `omit` |
| **Cache** | Browser cache behaviour (`default`, `no-store`, `reload`, `no-cache`, `force-cache`, `only-if-cached`) |
| **Redirect** | `follow`, `manual`, or `error` |
| **Referrer policy** | What `Referer` information is sent (default = browser decides) |
| **Timeout** | Milliseconds before the request is aborted; `0` disables the timeout |

### Reading the response

The response panel has three tabs. Above them (right side of the tab bar) you always see the **status code**, **total time** (hover to see time-to-first-byte) and **size**. Status colour: green = 2xx, amber = 3xx, red = 4xx/5xx or error.

**Body tab**

- **Pretty** – JSON is indented and syntax-highlighted. A **JSON filter** box appears; type a path to show only part of the document, for example `data.items[0].name`, `$.users[2]`, or `["odd key"]`. Invalid paths show a message instead of breaking the view.
- **Raw** – the response text exactly as received.
- **Preview** – renders images and PDFs, and HTML in a fully sandboxed frame (scripts disabled).
- **Wrap** – toggle long-line wrapping.
- **Copy** – copies what is currently shown (including a JSON filter). **Download** saves the raw bytes as `response.<ext>`.
- Binary content (zip, octet-stream, …) is not dumped as text; use Preview or Download.

**Headers tab** – every response header the browser lets the page read (the tab badge shows the count).

**Info tab** – final URL (after redirects), method, status, response type, whether it was redirected, content type, size and timings.

Errors (network failure, CORS block, timeout, cancellation, invalid URL) appear in the Body area in red with a list of likely causes.

### Layout: horizontal / vertical and resizing

- Click **Layout** in the header to switch between **Horizontal** (request and response side by side) and **Vertical** (request on top, response below).
- **Drag the splitter** (the thin bar between the two panels) to resize. Works with mouse, touch and pen.
- **Double-click** the splitter to reset to 50 / 50.
- Focus the splitter (Tab key) and use the **arrow keys** to nudge it by 2 %.
- Your chosen direction and size are remembered between visits.

### History

Click **History** to open the drawer. Every request that completed is stored (most recent first, max 50, duplicates of the same method + URL are merged). Click an entry to load its method, URL, params, headers, body, auth and settings back into the editor. **Clear** empties the list.

> For safety, **passwords, bearer tokens and API-key values are not saved** to history. Files chosen for upload are not saved either. Restoring an entry means re-entering these.

### Copy as cURL

The **cURL** button copies the current request as a `curl` command (headers, body and multipart fields included) so you can run it in a terminal or share it. The button shows "Copied!" for a moment.

### Theme

The 🌓 button toggles light and dark mode. The first visit follows your operating-system setting; afterwards your choice is remembered.

---

## Browser limitations (CORS and friends)

Because requests come from a web page, the browser enforces its security rules. These are *not* bugs in the client:

- **CORS** – a cross-origin API must send `Access-Control-Allow-Origin` (and answer pre-flight `OPTIONS` requests). Otherwise you only get a generic "Failed to fetch" error. `no-cors` mode avoids the error but returns an opaque, unreadable response.
- **Mixed content** – a page served over `https://` cannot call `http://` APIs. (A page opened from `file://` can.)
- **Forbidden headers** – `Cookie`, `Host`, `User-Agent`, `Origin`, … cannot be set. `Set-Cookie` cannot be read.
- **Visible response headers** – for cross-origin responses only CORS-safelisted headers are readable unless the server sends `Access-Control-Expose-Headers`.
- **Certificates** – invalid/self-signed HTTPS certificates are rejected without detail.
- **Timing** – "time to first byte" is measured when response headers arrive; it is an approximation of network latency.

---

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| **Enter** in URL box | Send the request |
| **Tab** in body editor | Insert two spaces |
| **← →** / **↑ ↓** on the focused splitter | Resize the panes (horizontal / vertical layout) |
| **Double-click** the splitter | Reset to 50 / 50 |

---

## Project structure

```
client-http/
├── index.html                          Page markup; uses the custom elements and loads the scripts
├── README.md
├── styles/
│   └── application-styles.css          Theme variables and styles for every component
└── scripts/
    ├── shared-utilities.js             Global `HttpClientToolkit`: escaping, formatting, storage, URL helpers
    ├── http-request-service.js         Sends requests with fetch(), exports cURL (no DOM code)
    ├── application-entry-point.js      Wires the components together (send, sync, history, theme, layout)
    └── components/                     One custom element per file
        ├── http-client-button.js
        ├── http-client-copy-button.js
        ├── http-client-form-field.js
        ├── http-client-segmented-toggle.js
        ├── http-client-key-value-editor.js
        ├── http-client-tab-panel.js
        ├── http-client-tabs.js
        ├── http-client-split-pane.js
        ├── http-client-request-bar.js
        ├── http-client-request-editor.js
        ├── http-client-response-viewer.js
        └── http-client-request-history.js
```

Scripts are **classic scripts, not ES modules**, so the page works from `file://` (browsers block module imports there). The order of the `<script>` tags in `index.html` matters: shared code → primitive components → layout components → composite components → application entry point.

---

## Component reference

All components are custom elements. They render into the normal ("light") DOM so the global stylesheet and theme apply — except `http-client-split-pane`, which uses Shadow DOM with slots. Every component communicates through **properties/methods** (parent → child) and **bubbling `http-client-*` events** (child → parent), and can be reused on its own.

### Primitives

#### `<http-client-button>`
A styled button wrapping a native `<button>`.

| Attribute | Description |
| --- | --- |
| `label` | Button text (or use inner text) |
| `variant` | `primary`, `danger`, `ghost`, or omit |
| `size` | `small` or omit |
| `type` | `button` (default) or `submit` |
| `disabled` | Boolean |

Property: `label`, `disabled`.

```html
<http-client-button variant="primary" label="Save"></http-client-button>
```

#### `<http-client-copy-button>`
Extends the button. Copies text and shows "Copied!".

Properties: `textToCopy` (fixed string) or `textToCopyProvider` (function evaluated on click; empty result = nothing copied).

```js
copyButton.textToCopyProvider = () => document.title;
```

#### `<http-client-form-field>`
A labelled control.

| Attribute | Description |
| --- | --- |
| `type` | `text` (default), `password`, `number`, `textarea`, `select`, `radio`, `checkbox` |
| `label` | Visible label; omit for a bare control |
| `name` | Identifier parents use to find the field |
| `value` / `checked` | Initial value / checkbox state |
| `options` | For select/radio: `"a,b"` or `"value:Label,other:Other label"` |
| `placeholder`, `min`, `max`, `step`, `list`, `autocomplete`, `rows` | Passed to the native control |

Properties: `value`, `checked`, `selectableOptions`, `nativeControlElement`.
Event: `http-client-value-changed` → `detail: { value, checked }`.

```html
<http-client-form-field type="select" label="Mode" options="cors,no-cors"></http-client-form-field>
```

#### `<http-client-segmented-toggle>`
Single-choice button group. Attributes `options`, `value`; property `selectedValue`; event `http-client-value-changed` → `detail: { value }`.

#### `<http-client-key-value-editor>`
Editable key/value table with enable checkboxes and an always-present blank row.

| Attribute | Description |
| --- | --- |
| `files` | Add a Text / File selector per row |
| `key-list` | id of a `<datalist>` for key suggestions |

Methods: `getAllNonBlankRows()`, `getEnabledRowsWithKey()`, `serializeRowsForStorage()`, `replaceAllRows(rowList)` (silent).
Row shape: `{ isEnabled, keyText, valueText, valueType, selectedFile }`.
Event: `http-client-value-changed` (user edits only).

### Layout

#### `<http-client-tabs>` + `<http-client-tab-panel>`
```html
<http-client-tabs active="one">
  <div tab-bar-extra>Shown at the right end of the tab bar</div>
  <http-client-tab-panel name="one" label="One">…</http-client-tab-panel>
  <http-client-tab-panel name="two" label="Two" badge="3">…</http-client-tab-panel>
</http-client-tabs>
```
Methods: `selectTabByName(name)`, `findTabPanelByName(name)`, `refreshTabButtons()`. Panel property `badgeText` (set to 0/empty to remove). Event: `http-client-tab-selected` → `detail: { tabName }`.

#### `<http-client-split-pane>`
Two panes with a draggable splitter (Shadow DOM).

| Attribute | Description |
| --- | --- |
| `direction` | `horizontal` (side by side, default) or `vertical` (stacked) |
| `ratio` | Start-pane share, 0.1 – 0.9 (default 0.5) |
| `storage-key` | If set, direction and ratio are saved in `localStorage` under this prefix |

Properties: `splitDirection`, `startPaneRatio`. Event: `http-client-panes-resized` → `detail: { ratio }`.

```html
<http-client-split-pane direction="vertical" storage-key="my-layout">
  <section slot="start">Top</section>
  <section slot="end">Bottom</section>
</http-client-split-pane>
```

### Composites

#### `<http-client-request-bar>`
Method selector, URL box, Send / Cancel / cURL.
Properties: `selectedMethod`, `urlText`, `isRequestInFlight`, `curlCommandProvider`.
Events: `http-client-send-requested`, `http-client-cancel-requested`, `http-client-url-edited` → `detail: { urlText }`.

#### `<http-client-request-editor>`
Params / Headers / Body / Auth / Settings tabs.
Methods:

| Method | Purpose |
| --- | --- |
| `buildRequestSpecification({ httpMethod, urlText })` | Returns `{ targetUrl, fetchInitOptions, timeoutMilliseconds }`; throws a friendly `Error` on invalid input |
| `createSnapshot({ includeSecrets })` | Plain, JSON-safe state (secrets omitted by default) |
| `restoreFromSnapshot(snapshot)` | Loads a snapshot |
| `updateQueryParametersFromUrl(urlText)` | URL → Params table |
| `buildUrlWithQueryParameters(urlText)` | Params table → URL |

Event: `http-client-query-params-changed`.

#### `<http-client-response-viewer>`
Methods: `displayResponse(responseDescription)`, `displayLoadingState()`, `displayErrorMessage(messageText)`, `resetToEmptyState()`.
Static helpers: `HttpClientResponseViewer.highlightJsonAsHtml(jsonText)`, `HttpClientResponseViewer.evaluateJsonPath(rootValue, pathText)`.

#### `<http-client-request-history>`
Methods: `addEntry(requestSnapshot, responseStatusCode)`, `toggleVisibility()`, `openDrawer()`, `closeDrawer()`, `clearAllEntries()`.
Attributes: `storage-key`, `max`. Event: `http-client-history-entry-selected` → `detail: { requestSnapshot }`.

### Non-visual modules

- **`HttpClientToolkit.httpRequestService.sendRequest(requestSpecification, { abortSignal })`** → resolves to a response description:
  `{ requestMethod, finalUrl, statusCode, statusText, isSuccessful, responseType, wasRedirected, headerEntries, contentTypeHeader, bodyBuffer, bodySizeInBytes, timeToFirstByteMilliseconds, totalDurationMilliseconds }`.
  Rejects with an `Error` named `AbortError` (cancelled) or `TimeoutError`.
- **`HttpClientToolkit.httpRequestService.convertRequestToCurlCommand(requestSpecification)`**.
- **`HttpClientToolkit`** also provides `escapeHtmlSpecialCharacters`, `formatByteCountForDisplay`, `formatDurationForDisplay`, `dispatchCustomEvent`, `registerCustomElementOnce`, `parseOptionList`, `copyTextToClipboard`, `localStorageJson`, `splitUrlIntoParts`, `parseQueryStringIntoRows`.

---

## Coding conventions

- **Descriptive names everywhere.** Variables, methods, files, CSS classes and element names are spelled out in full (`requestSpecification`, `getEnabledRowsWithKey`, `http-client-key-value-editor.js`) — no abbreviations such as `e`, `el`, `btn`, `kv`.
- **Everything is commented.** Every class and method has a doc comment (purpose, parameters, return value, events), and non-obvious logic has an explanatory comment next to it.
- **One custom element per file**, with the file named after its tag, e.g. `http-client-tabs.js` defines `<http-client-tabs>`.
- **Events** are named `http-client-<what-happened>` (past tense) and bubble.
- **Private members** are prefixed with an underscore (`_renderBody`, `_currentResponse`).
- **Programmatic updates are silent**: setting a value from code (for example `replaceAllRows`) does not emit change events; only user actions do.

---

## Extending the client

### Add a new component

1. Create `scripts/components/http-client-my-widget.js`:

   ```js
   'use strict';

   /** <http-client-my-widget> — describe what it does, its attributes, methods and events here. */
   class HttpClientMyWidget extends HTMLElement {
       /** Renders once when attached to the page. */
       connectedCallback() {
           if (this._isRendered) return; // connectedCallback also fires when the element is moved
           this._isRendered = true;
           this.textContent = 'Hello';
       }
   }
   HttpClientToolkit.registerCustomElementOnce('http-client-my-widget', HttpClientMyWidget);
   ```
2. Add its `<script>` tag to `index.html` **before** any component that uses it.
3. Add its styles to `styles/application-styles.css`.

### Add a new body or auth type

Add the option to the relevant `options` attribute in `http-client-request-editor.js`, add a matching `data-body-group` / `data-authentication-group` block, then handle it in `buildRequestSpecification()`.

---

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| "Failed to fetch" with no details | CORS blocked, server down, mixed content or bad certificate — check the browser DevTools **Network** and **Console** tabs for the real reason |
| Status shows `opaque` and no body | Mode is `no-cors`; switch to `cors` |
| A header I added is not sent | It is a forbidden header (e.g. `Cookie`) — the browser drops it |
| Cookies are not sent | Set **Credentials** to `include`, and the server must allow credentials via CORS |
| Response headers list is short | Cross-origin: server must send `Access-Control-Expose-Headers` |
| Nothing happens when opening `index.html` | Open DevTools **Console**; a script-load error usually means a file was moved or renamed |
| History entry has no password | By design — secrets are never stored |
