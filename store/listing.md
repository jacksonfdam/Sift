# Chrome Web Store listing — Sift

## Title

**Sift — HTTP capture viewer**

The store pulls the title from `name` in `manifest.json`. It is not edited in the
dashboard. Current value: `Sift — HTTP capture viewer`.

## Summary

**Privacy-first, in-memory viewer for HAR / Fiddler SAZ / Charles captures. Read-only; nothing is saved or sent.**

The store pulls the summary from `description` in `manifest.json`. Current value
is 110 characters, within the 132-character limit.

## Category and language

- **Category:** Developer Tools
- **Language:** English (United States)

## Description

Sift is a read-only viewer for HTTP session captures. You drag a capture file
onto the panel and Sift renders a navigable request and response inspector. It
parses the file entirely in memory and never writes anything to disk.

It opens three formats:

- HAR (`.har`), the HTTP Archive JSON format exported by browser developer tools
  and many HTTP clients.
- Fiddler SAZ (`.saz`) session archives.
- Charles session exports, both `.xml` and `.trace`.

All three are normalized into the same internal model, so the inspector behaves
identically regardless of where the capture came from.

What it does:

- Shows a request list with method, status (colored by class), host, path,
  response type, size, and duration. The list is virtualized, so captures with
  thousands of requests stay responsive.
- Shows a detail pane with tabs for request and response headers, query
  parameters, cookies, request body, response body, and timing.
- Pretty-prints and syntax-highlights JSON, XML, HTML, CSS, and JavaScript
  bodies. Large bodies are held behind an explicit "render anyway" control so a
  single request cannot lock up the panel.
- Masks sensitive values by default. Authorization headers, cookies, Set-Cookie
  headers, common API-key headers, and token-shaped query parameters are hidden
  until you click to reveal an individual value, or use the global reveal
  toggle.
- Decompresses gzip and deflate response bodies and reassembles chunked
  transfer encoding. Brotli-encoded bodies cannot be decoded with the bundled
  library and are shown as raw bytes with a clear "not decoded" badge rather
  than failing.
- Exports a sanitized HAR. This rebuilds a valid HAR file with every sensitive
  value replaced by a placeholder, so a capture can be shared without leaking
  credentials. The export is the only file Sift produces, and only as a download
  you start.
- Searches across URL, headers, and body text, with quick filters by method,
  status class, host, and response MIME type.

Who it is for: developers and QA engineers who need to read a capture someone
sent them, or one they exported, without uploading it to an online tool or
installing a heavier proxy. Because nothing is persisted, the panel is empty
again after a reload, by design.

How to use it: open Chrome DevTools, select the "Sift" panel, and drop a
capture file onto it. There is no toolbar popup; the extension exists only as a
DevTools panel.

Limitations, stated plainly:

- Brotli (`br`) response bodies are not decoded.
- Encrypted or password-protected SAZ archives are detected and refused with a
  clear message rather than guessed at.
- The Charles `.chls` and `.tcpsf` formats and packet captures (pcap/pcapng) are
  not supported. Export HAR from those tools instead.
- There is no live capture in this version. Sift views files you already have.

## Privacy

### Single purpose

Sift opens HTTP capture files (HAR, Fiddler SAZ, and Charles) and displays them
in a read-only, in-memory inspector inside Chrome DevTools. That is its only
function.

### Permissions

The manifest declares no entries in `permissions` and no `host_permissions`.

- `permissions`: none. Sift reads files you drop into the panel. It needs no
  browser permissions to do that.
- `host_permissions`: none. Sift does not read, modify, or access any web page,
  tab, or network request. It does not see your browsing.
- `devtools_page`: this is the only manifest field that integrates with the
  browser. It is required to register the "Sift" panel in DevTools. It does not
  grant access to page content or network data; it only adds a panel.
- `content_security_policy` (`extension_pages`):
  `script-src 'self'; object-src 'self'; connect-src 'none'`. This forbids
  remote code and eval, and blocks outbound network connections from the
  extension's pages.

### Remote code

No. All code is bundled inside the extension package. The content security
policy permits only `'self'` scripts and disallows eval, so no remote or
dynamically fetched code can run.

### Data usage

None; local only. Sift does not collect, store, transmit, or sell any user data.

- Capture files are parsed in memory and discarded when the panel is hidden,
  closed, or reloaded.
- No storage APIs are used: no `localStorage`, no `sessionStorage`, no
  `chrome.storage`, no `IndexedDB`, no Cache API.
- No network requests are made. There is no telemetry, no analytics, and no
  external service.
- The only output is the sanitized HAR export, which is a local file download
  that you initiate.

## Affiliation disclaimer

Sift is an independent tool. It is not affiliated with, endorsed by, or
sponsored by the makers of Fiddler or Charles, or by Google. "Fiddler" and
"Charles" are trademarks of their respective owners and are referenced only to
describe the capture file formats that Sift can open. HAR is an open format.

## Chrome Web Store — Privacy tab (copy-paste blocks)

Each block below maps to a field in the dashboard's Privacy tab and stays under
that field's 1,000-character limit.

### Single purpose

```
Sift is a read-only viewer for HTTP capture files. It opens HAR, Fiddler SAZ, and Charles (.xml/.trace) session exports, parses them entirely in memory, and displays them as a navigable request/response inspector inside Chrome DevTools. It does not capture, proxy, intercept, decrypt, or modify network traffic. Every feature — the request list, the header/query/cookie/body/timing detail tabs, default masking of secrets, search and filtering, and sanitized HAR export — exists only to help you view a capture file you already have.
```

### Permission justifications

```
None to provide. The manifest declares no "permissions" and no optional permissions, so the Privacy tab shows no permission-justification fields. The only manifest key that integrates with the browser is "devtools_page", which registers the Sift DevTools panel. It grants no access to page content, tabs, cookies, storage, or network data; it only adds a panel. If a reviewer asks, that is the sole reason it is present.
```

### Host permission justification

```
None to provide. The manifest declares no "host_permissions" and contains no content scripts, so there are no match patterns to justify. Sift never reads, modifies, or accesses any website, tab, or network request, and has no access to the pages you browse. No host is used for tracking, analytics, or any other purpose, because no host permission is requested at all.
```

### Are you using remote code?

```
No. Sift executes no remote code. All scripts are bundled inside the extension package. There are no remote <script> tags, no eval, and no code fetched from any URL. The content security policy for extension pages is "script-src 'self'; object-src 'self'; connect-src 'none'", which forbids remote scripts and eval and blocks outbound network connections. This was verified against the source and the built bundle.
```

### Data usage

```
Data collected or transmitted: none. Sift does not collect or transmit any of Chrome's data categories: not personally identifiable information, health, financial, authentication, personal communications, location, web history, user activity, or website content. Capture files you open are parsed in memory and discarded on reload; no storage APIs (localStorage, sessionStorage, chrome.storage, IndexedDB, Cache API) and no network are used. The only output is a sanitized HAR export, which is a local download you start. The capture's contents stay on your device.
```

Then check the three certifications in the form:

```
[x] I do not sell or transfer user data to third parties, apart from the approved use cases.
[x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
[x] I do not use or transfer user data to determine creditworthiness or for lending purposes.
```

(All three are accurate because no user data is collected or transferred at all.)

### Privacy policy URL

```
https://<your-vercel-domain>/privacy
```

The privacy policy is hosted from this repository's `site/` folder, deployed to
Vercel with clean URLs enabled, so `site/privacy.html` is served at `/privacy`.
Paste the live public URL (your custom domain, or the
`https://<project>.vercel.app/privacy` URL Vercel assigns) into this field.
