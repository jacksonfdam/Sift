# @sift/standalone

The full Sift viewer built as a **single self-contained HTML file**. It opens
directly with `file://`, runs entirely offline, and requests zero browser
permissions — making it the most auditable way to ship the tool.

```sh
pnpm dev:standalone          # dev server with HMR
pnpm build:standalone        # emits dist/index.html (everything inlined)
```

Open `dist/index.html` in any browser (or double-click it) and drop a capture.

## Why it's auditable

- Everything (JS + CSS) is inlined by `vite-plugin-singlefile` into one file —
  no external requests are possible at runtime.
- A strict CSP (`connect-src 'none'`, `default-src 'none'`) is declared in the
  page `<meta>`, so the browser blocks any accidental network access.
- The page touches no storage APIs (enforced by the core's egress guard test).

Inline `<script>`/`<style>` require `'unsafe-inline'` in the standalone CSP
(there is no server to serve separate files). The MV3 extension build uses the
stricter `'self'`-only policy instead.
