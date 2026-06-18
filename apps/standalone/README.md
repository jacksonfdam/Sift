# @sift/standalone

The whole viewer, built into a single self-contained HTML file by
`vite-plugin-singlefile`. It opens with `file://`, runs entirely offline, and
asks for no permissions because there is no one to ask. This is the most
auditable way to ship the thing, which is a polite way of saying it is the one
you can actually check.

```sh
pnpm dev:standalone          # dev server with HMR
pnpm build:standalone        # emits dist/index.html, everything inlined
```

Open `dist/index.html`, or double-click it, and drop a capture. That is the
install procedure. There isn't more.

## Why it is auditable

- Everything, JS and CSS, is inlined into one file. There are no external
  requests at runtime because there is nothing external to request.
- A strict CSP sits in the page `<meta>`: `default-src 'none'` and
  `connect-src 'none'`, so the browser blocks network access on principle even
  if some future bug develops ambitions.
- `modulePreload` is turned off in the build. A single file has nothing to
  preload, and disabling it removes Vite's polyfill `fetch` call, so the bundle
  contains zero egress symbols. The verify script confirms this rather than
  taking our word for it.

One concession: inline `<script>` and `<style>` need `'unsafe-inline'` in the
standalone CSP, because there is no server to hand out separate files. The MV3
extension build uses the stricter `'self'`-only policy, since it can.
