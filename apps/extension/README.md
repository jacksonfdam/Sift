# @sift/extension

The Manifest V3 build. It registers one DevTools panel called "Sift" that hosts
the drag-and-drop viewer. That is the entire extension. It does not follow you
around the browser, because it cannot.

```sh
pnpm dev:extension     # CRXJS dev build with HMR
pnpm build:extension   # production build to dist/
```

Load `dist/` unpacked (`chrome://extensions`, Developer mode, Load unpacked),
open DevTools, find the Sift tab, and drop a capture. Built with
`@crxjs/vite-plugin` `2.6.1`. Targets Chrome 110 and up.

## The permissions audit, which is short

The interesting column is the empty one.

| Field | Value | Why |
| --- | --- | --- |
| `devtools_page` | `src/devtools.html` | Required to register the panel. The only thing tying Sift to DevTools. |
| `permissions` | none | The viewer reads files you drop. It needs nothing from Chrome. |
| `host_permissions` | none | No network, no page access, no opinions about your tabs. |
| `content_security_policy` | `script-src 'self'; object-src 'self'; connect-src 'none'` | No remote code, no eval, no egress. |

There is no background service worker holding state, no content script, and no
storage. Capture state lives in the panel document and dies when you close it.
An extension with nothing to hide, mostly because it has nothing to keep.

## The v2 you will ask about

Live capture is not here. When it arrives it will plug into the same `Flow`
model through `chrome.devtools.network.onRequestFinished` and `getHAR()`, since
DevTools entries are already HAR shaped. It would add no new permissions. The
current architecture leaves the door open and the lights off.
