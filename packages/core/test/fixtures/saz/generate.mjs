// Reproducible generator for the SAZ test fixture.
//
// Real Fiddler exports aren't available in this environment, so this builds a
// byte-faithful SAZ: a real ZIP (via fflate) containing the documented raw/
// layout, with a gzip body and a chunked+gzip body to exercise decode paths.
//
// Run: node packages/core/test/fixtures/saz/generate.mjs
import { gzipSync, zipSync } from "fflate";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const enc = new TextEncoder();

function crlf(lines) {
  return enc.encode(lines.join("\r\n"));
}

function concat(...parts) {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function chunked(bytes, chunkSize) {
  const parts = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    parts.push(enc.encode(slice.length.toString(16) + "\r\n"));
    parts.push(slice);
    parts.push(enc.encode("\r\n"));
  }
  parts.push(enc.encode("0\r\n\r\n"));
  return concat(...parts);
}

// --- Session 1: HTTPS, gzip JSON body ---
const s1Json = '{"users":[{"id":1,"name":"Ada"}]}';
const s1Client = crlf([
  "GET /v1/users?token=eyJabc.def.ghi&page=1 HTTP/1.1",
  "Host: api.example.com",
  "Authorization: Bearer sk-live-0123456789abcdef",
  "Accept: application/json",
  "",
  "",
]);
const s1Head = crlf([
  "HTTP/1.1 200 OK",
  "Content-Type: application/json; charset=utf-8",
  "Content-Encoding: gzip",
  "Set-Cookie: session=newvalue789; Path=/; HttpOnly",
  "",
  "",
]);
const s1Server = concat(s1Head, gzipSync(enc.encode(s1Json)));
const s1Meta = enc.encode(
  `<?xml version="1.0" encoding="UTF-8"?>
<Session SID="1" BitFlags="1">
  <SessionTimers ClientConnected="2026-01-02T10:00:00.0000000+00:00" ClientDoneResponse="2026-01-02T10:00:00.1230000+00:00"/>
  <SessionFlags>
    <SessionFlag N="x-egressport" V="443"/>
  </SessionFlags>
</Session>
`,
);

// --- Session 2: HTTP, chunked + gzip text body ---
const s2Text = "hello chunked world — this body is gzipped and chunked";
const s2Client = crlf([
  "GET /stream HTTP/1.1",
  "Host: example.com",
  "Accept: text/plain",
  "",
  "",
]);
const s2Head = crlf([
  "HTTP/1.1 200 OK",
  "Content-Type: text/plain; charset=utf-8",
  "Transfer-Encoding: chunked",
  "Content-Encoding: gzip",
  "",
  "",
]);
const s2Server = concat(s2Head, chunked(gzipSync(enc.encode(s2Text)), 8));
const s2Meta = enc.encode(
  `<?xml version="1.0" encoding="UTF-8"?>
<Session SID="2" BitFlags="0"/>
`,
);

const zip = zipSync(
  {
    "_index.htm": enc.encode("<html><body>Fiddler session archive</body></html>"),
    "raw/1_c.txt": s1Client,
    "raw/1_s.txt": s1Server,
    "raw/1_m.xml": s1Meta,
    "raw/2_c.txt": s2Client,
    "raw/2_s.txt": s2Server,
    "raw/2_m.xml": s2Meta,
  },
  { level: 0 },
);

const outDir = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(outDir, "sample.saz"), zip);
console.log("wrote sample.saz", zip.length, "bytes");
