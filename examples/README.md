# Example captures

Sample files to drop into the viewer. One per supported format, built to show
off the features rather than to look pretty. Regenerate them with:

```sh
node examples/generate.mjs
```

| File | Format | What it shows |
| --- | --- | --- |
| `example.har` | HAR | 10 flows: JSON, HTML, CSS, JS, a form POST, a 303 redirect, a binary PNG, and a 404 and 500 for colour. Masked Authorization, X-API-Key, Cookie, Set-Cookie, and a token query param. |
| `example.saz` | Fiddler SAZ | 3 sessions: a gzip JSON body, a chunked-then-gzip body, and a Brotli body that the viewer shows as bytes plus a "Brotli body, not decoded" badge. |
| `example.xml` | Charles XML | 3 transactions: a 200 with a JSON body and masked secrets, a 301 redirect, and a 500. |
| `example.trace` | Charles trace | 3 blocks: a GET, a 303 redirect, and a 204 DELETE. |

Every secret in these files is fake. The `sk-live-...` token is nine made-up
hex digits and a hope. Do not file a security report.

A couple of things to try once they are loaded:

- The Authorization and Cookie values start masked. Click one to reveal it, or
  use "Reveal all" if you have committed to it.
- "Export sanitized HAR" turns the loaded capture into a shareable `.har` with
  every secret replaced by `[REDACTED]`. Run it on `example.har` and diff the
  result if you do not believe it.
- Open `example.saz`, select the third session, and look at the Response body
  tab to see the Brotli badge earn its keep.
