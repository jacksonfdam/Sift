# @sift/extension

The MV3 browser extension. It registers a **DevTools panel** ("Sift") that
hosts the drag-and-drop capture viewer.

```sh
pnpm dev:extension     # CRXJS dev build with HMR (load dist/ unpacked)
pnpm build:extension   # production build to dist/
```

Load `dist/` as an unpacked extension (`chrome://extensions` → Developer mode →
Load unpacked), then open DevTools → **Sift** tab and drop a capture.

## Permissions audit

The manifest requests the absolute minimum:

| Field | Value | Why |
| --- | --- | --- |
| `devtools_page` | `src/devtools.html` | The only capability tied to DevTools; required to register the panel. |
| `permissions` | *(none)* | The viewer reads dropped files; it needs no Chrome permissions. |
| `host_permissions` | *(none)* | No network, no page access. |
| `content_security_policy` | `script-src 'self'; object-src 'self'; connect-src 'none'` | No remote code, no eval, no network egress. |

There is no background service worker holding state, no content script, and no
storage use. All capture state lives in the panel document and is discarded when
the panel closes or the page reloads.

## v2 note (not built)

Live capture will plug into the same `Flow` model via
`chrome.devtools.network.onRequestFinished` / `getHAR()` (DevTools entries are
already HAR-shaped). It would add no new host permissions. The current
architecture does not block it, but it is intentionally out of scope for v1.
