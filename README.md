# Sift

A privacy-first HTTP capture viewer. You drag in a capture, it shows you the
requests and responses, and then it forgets the whole thing. No proxy, no
interception, no saving. It reads files. That is the entire personality.

Sift opens HAR, Fiddler SAZ, and Charles captures, parses them in memory, and
renders a request/response inspector. Nothing is written to disk. Nothing is
sent anywhere. If that sounds unambitious, good. Ambition is how capture tools
end up with a cloud account.

## The guarantees, which are the point

These are not aspirations. They are checked.

- **In memory only.** A capture goes `File` to `ArrayBuffer` to `Flow[]` to the
  screen, and then nowhere. Sift never touches `chrome.storage`,
  `localStorage`, `sessionStorage`, `IndexedDB`, the Cache API, or the disk.
  Reload the page and your capture is gone. That is the design, not a bug
  report.
- **Zero network egress.** Sift makes no outbound requests of any kind.
  Everything is bundled locally: no CDNs, no remote fonts, no telemetry. There
  is a script, [`scripts/verify-egress.mjs`](scripts/verify-egress.mjs), that
  greps the built bundles for `fetch`, `XMLHttpRequest`, `WebSocket`,
  `localStorage` and the rest. If it finds one, the check fails and someone has
  some explaining to do.
- **Secrets masked by default.** Captures are full of bearer tokens, cookies,
  and API keys. Sift masks them on sight, on the working assumption that you
  have screen-shared before and will again. Click a value to reveal it. There
  is a global reveal toggle for when you have given up on dignity.
- **Minimal permissions.** The extension requests no host permissions and no
  broad permissions. The only manifest entry tying it to DevTools is
  `devtools_page`. It has nothing to do with your tabs, and is not being modest
  about it.

## Two ways to run it, one core

The model, parsers, and UI live in [`packages/core`](packages/core). Two targets
wrap it and add a mount point and little else.

- **Standalone offline page** ([`apps/standalone`](apps/standalone)). The whole
  viewer built into a single self-contained HTML file (roughly 216 KB) via
  `vite-plugin-singlefile`. Open it with `file://`. There is no server to
  misconfigure and no install to regret. This is the most auditable artifact, so
  it is the one to read if you trust nothing, which is the correct amount.
- **DevTools panel** ([`apps/extension`](apps/extension)). A Manifest V3
  extension that registers a "Sift" panel in DevTools. Same viewer, fewer
  clicks. No live capture in v1; see the non-goals before you ask.

## Formats it reads

Every format normalizes to one canonical `Flow` model, so the UI, search, and
export never learn which parser they are talking to.

- **HAR (`.har`).** JSON, the hub format. Handles base64 bodies, form params,
  redirect chains, and the vendor `_`-prefixed fields everyone sneaks in.
- **Fiddler SAZ (`.saz`).** A ZIP, unzipped in memory with `fflate`. Raw HTTP
  messages are de-chunked and decompressed by a shared helper. Password
  protected archives are detected and refused with an actual reason, rather than
  a stack trace and a shrug.
- **Charles (`.xml` and `.trace`).** Parsed defensively, because the Charles XML
  schema varies by version and the published DTD is more of a suggestion. Fields
  are read as either attribute or element, and headers are collected by shape
  rather than by a fixed path.

Bodies are decompressed for `gzip` and `deflate`. Brotli (`br`) they are not:
`fflate` does not decode it, so Brotli bodies are shown as raw bytes with a
badge that says exactly that. An honest badge beats a hung tab.

## The inspector

A two pane inspector that stays usable on captures with thousands of flows.

- A virtualized flow list. Columns for method, status (colour coded by class),
  host, path, response type, size, and duration. Arrow keys, or `j` and `k` if
  your hands refuse to leave home row, move the selection.
- A detail pane with tabs: Headers, Query, Cookies, Request body, Response body,
  and Timing. Bodies are pretty printed and syntax highlighted for JSON, XML,
  HTML, CSS, and JS. The highlighter emits escaped tokens, never raw HTML,
  because capture content is hostile by default and so are we.
- Free text search across URL, headers, and body, plus quick filters by method,
  status class, host, and MIME type.
- Large bodies are guarded. Anything over 512 KB waits behind a "render anyway"
  button instead of locking the tab to prove a point.

## The one file it will write

**Export sanitized HAR.** It rebuilds a valid HAR with every sensitive value
replaced by `[REDACTED]`, so you can share a capture without sharing your
credentials with it. This is the only output Sift produces, and only as a
download you clicked. Nothing is written automatically, ever.

## Gotchas, stated plainly

A documented flaw is worth more than a polished lie.

- **Hide the tab and the capture clears.** Memory hygiene runs on page unload
  and on `visibilitychange` to hidden. Switching to another tab wipes the loaded
  flows. That is the privacy stance taken to its logical, mildly inconvenient
  conclusion. Reload re-drops nothing, because nothing was kept.
- **Brotli bodies are not decoded.** See above. The badge is the feature.
- **SAZ scheme is inferred, not divined.** HTTPS is guessed from an absolute
  request line, a `Host` on port 443, an `x-egressport` of 443, or the session
  `BitFlags` HTTPS hint, then falls back to `http`. Fiddler does not always make
  this obvious, and neither, in fairness, do we.
- **The non-HAR fixtures are constructed, not exported.** Real Fiddler and
  Charles exports were not available when this was built, so those fixtures are
  byte-faithful to the documented formats (a real ZIP, real raw HTTP, the
  observed XML shape) rather than literal tool output. Swapping in genuine
  exports needs no code change. The HAR fixture is hand-written valid HAR.

## Not in scope, on purpose

- No live capture in v1. v2 will plug into the same `Flow` model via
  `chrome.devtools.network.onRequestFinished` and `getHAR()`, since DevTools
  entries are already HAR shaped. The architecture does not block it. It is just
  not here yet.
- No proxy, interception, MITM, traffic modification, or replay. It is a viewer.
  It views.
- No pcap or pcapng. TCP reassembly and TLS without keys are a different
  product, and a worse weekend.
- No `.chls` or `.tcpsf`. Those are Java serialization, in a browser, which is a
  no. Export HAR from Charles instead. Sift will tell you as much if you drop
  one.

## Dependencies, pinned exactly

The runtime surface is deliberately small, because every dependency is a future
incident with a nicer name.

| Package | Version | Why it earns its place |
| --- | --- | --- |
| `react` / `react-dom` | `18.3.1` | The inspector UI. |
| `fflate` | `0.8.2` | ZIP for SAZ, and gzip/deflate for bodies. Zero dependencies, chosen over `jszip` for exactly that reason. |
| `fast-xml-parser` | `4.5.0` | Charles XML and the SAZ `_m.xml`. No `eval`, so it survives a strict CSP. |

Build and test tooling: `typescript` `5.6.3`, `vite` `5.4.10`,
`@vitejs/plugin-react` `4.3.3`, `vite-plugin-singlefile` `2.0.3`,
`@crxjs/vite-plugin` `2.6.1`, `vitest` `2.1.4`. Managed with `pnpm@9.12.3`.

## Running it

```sh
pnpm install
pnpm test                 # 44 tests across the parsers, redaction, and search
pnpm dev:standalone       # the offline page, with HMR
pnpm dev:extension        # the DevTools panel, load apps/extension/dist unpacked
pnpm build                # build every package and app
pnpm verify               # build, test, then prove zero egress on the bundles
```

## Licence and credits

MIT, per the workspace `package.json`. `fflate` and `fast-xml-parser` are MIT
and belong to their respective authors, who did the hard parts. React and Vite
need no introduction and would not read this anyway.
