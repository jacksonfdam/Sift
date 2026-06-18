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

## Packaging it into a zip

The Chrome Web Store wants a zip with `manifest.json` at the root, not your
`dist` folder wrapped in a bow. So:

```sh
pnpm zip:extension                      # bump patch, build, zip
SIFT_VERSION=1.4.0 pnpm zip:extension   # pin an exact version instead
```

The version lives in one place, `apps/extension/package.json`, and the manifest
reads it from there. `zip:extension` bumps the patch number by default, so each
package you cut gets a fresh version, which the Web Store requires (it rejects a
re-upload of an existing version). Pass `SIFT_VERSION=MAJOR.MINOR.PATCH` to set
an exact one, or run `pnpm --filter @sift/extension version:set 1.4.0` on its
own. The bump only happens on `zip`; plain `pnpm build:extension` leaves the
version alone.

The zip lands in `apps/extension/` and is git-ignored, because committing build
output is how repositories gain weight. The packer uses `fflate` `0.8.2` (a dev
dependency, the same zero-dependency library the SAZ parser already relies on)
and a fixed timestamp, so packing the same version twice gives byte-identical
archives. Upload that file by hand at the Web Store developer dashboard, or let
CI do it. Remember to commit the bumped `package.json`.

## Publishing automatically

[`.github/workflows/release-extension.yml`](../../.github/workflows/release-extension.yml)
builds, runs `pnpm verify` (tests plus the zero-egress check), packs the zip,
and uploads it as a workflow artifact. Push a tag like `v0.1.0` and it also
publishes to the Chrome Web Store, using
[`chrome-webstore-upload-cli`](https://github.com/fregante/chrome-webstore-upload-cli)
via `npx`. No credentials, no publish: the job just hands you the zip and the
upload step is skipped.

Publishing needs four repository secrets, which the workflow reads and never
prints:

| Secret | What it is |
| --- | --- |
| `CWS_EXTENSION_ID` | The extension's ID from the developer dashboard. |
| `CWS_CLIENT_ID` | OAuth client ID for a Google Cloud project with the Chrome Web Store API enabled. |
| `CWS_CLIENT_SECRET` | OAuth client secret for that client. |
| `CWS_REFRESH_TOKEN` | A refresh token minted once for that client. |

Getting the OAuth credentials is a one-time slog through a Google Cloud project,
the Chrome Web Store API, and a consent screen. The official walkthrough is
Chrome's "Using the Web Store Publish API" guide
(<https://developer.chrome.com/docs/webstore/using-api>), and the CLI's README
covers minting the refresh token. The first upload of a brand-new extension must
be done manually in the dashboard; the API can only update an item that already
exists.

## The v2 you will ask about

Live capture is not here. When it arrives it will plug into the same `Flow`
model through `chrome.devtools.network.onRequestFinished` and `getHAR()`, since
DevTools entries are already HAR shaped. It would add no new permissions. The
current architecture leaves the door open and the lights off.
