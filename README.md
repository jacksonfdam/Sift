# Sift

A privacy-first HTTP capture **viewer**. Drag a captured session file
(HAR, Fiddler SAZ, or Charles XML/`.trace`) onto the panel; Sift parses it
**entirely in memory** and renders a navigable request/response inspector.

This is a **read-only viewer** — there is no proxy, no interception, and no
traffic modification. Nothing is ever written to disk or persisted.

## Privacy guarantees

These are correctness requirements, verifiable by inspection:

- **In-memory only.** Captures are parsed `File` → `ArrayBuffer` → `Flow[]` →
  rendered → discarded. Sift never touches `chrome.storage`, `localStorage`,
  `sessionStorage`, `IndexedDB`, the Cache API, or the filesystem. No state
  survives a page reload, by design.
- **Zero network egress.** Sift makes no outbound requests of any kind.
  Everything is bundled locally — no CDNs, no remote fonts, no telemetry, no
  analytics.
- **MV3 strict CSP.** No remote code (`script-src 'self'; object-src 'self'`,
  no `unsafe-eval`). The service worker is ephemeral and never holds session
  state; state lives only in the open panel/page document.
- **Minimal permissions.** The extension requests **no** host permissions and
  no broad permissions. The only manifest entry tying it to DevTools is
  `devtools_page`.
- **Secrets masked by default.** Authorization headers, cookies, `Set-Cookie`,
  API keys, and token-shaped values are masked until you click to reveal them.

## Build targets

1. **DevTools panel** (`apps/extension`) — an MV3 extension that registers a
   panel hosting the drag-drop viewer.
2. **Standalone offline page** (`apps/standalone`) — the same core built as a
   single self-contained HTML file that opens with `file://`, runs fully
   offline, and has zero browser permissions. The most auditable artifact.

Both consume `packages/core` (the `Flow` model, parsers, and React UI).

## Repository layout

```
packages/core      Flow model + parser registry + React inspector UI
apps/extension      MV3 DevTools-panel target (CRXJS)
apps/standalone     Single-file offline target (vite-plugin-singlefile)
```

## Dependencies (pinned, justified)

Every runtime dependency is pinned exactly and justified here. The surface is
kept deliberately tiny.

| Dependency | Why |
| --- | --- |
| `react` / `react-dom` | UI runtime for the inspector. |
| `fflate` | ZIP extraction (SAZ) + gzip/deflate body decompression. Zero-dependency, CSP-safe. Chosen over `jszip` to avoid its dependency tree. |
| `fast-xml-parser` | Charles XML and SAZ `_m.xml` parsing. No `eval`, CSP-safe. |

Build tooling: `vite`, `@crxjs/vite-plugin` (MV3 manifest + HMR),
`vite-plugin-singlefile` (inline everything for the standalone page),
`@vitejs/plugin-react`, `vitest` (tests), `typescript` (strict).

## Supported & unsupported

**Supported:** HAR (v1.1/v1.2), Fiddler SAZ, Charles `.xml` and `.trace`.

**Limitation:** `br` (Brotli) `Content-Encoding` cannot be decoded with
`fflate`. Brotli bodies are shown as raw bytes with a "Brotli body — not
decoded" badge rather than failing.

## Non-goals (v1)

- **No live capture.** Deferred to v2; it will plug into the same `Flow` model
  via `chrome.devtools.network.onRequestFinished` / `getHAR()`, so the core
  needs no change. The architecture does not block it.
- **No proxy / interception / MITM / traffic modification / replay.** Read-only.
- **No pcap/pcapng.** L2–L4 parsing, TCP reassembly, and TLS are a separate
  product.
- **No `.chls` / `.tcpsf`** (Java serialization, infeasible in JS). Dropping
  one shows: "export HAR from that tool instead."
- **No persistence of any kind.**

## Development

```sh
pnpm install
pnpm test                 # run core parser tests against real fixtures
pnpm dev:standalone       # iterate on the standalone offline page
pnpm dev:extension        # iterate on the MV3 DevTools panel
pnpm build                # build every package/app
```
