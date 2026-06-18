// Generates a set of example captures, one per supported format, covering the
// cases worth seeing in the viewer: masked secrets, gzip, chunked+gzip, a
// Brotli body (shown as "not decoded"), a binary body, a redirect, and a
// spread of status codes.
//
// Run: node examples/generate.mjs
import { createRequire } from "node:module";
import zlib from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const outDir = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(outDir, "..", "packages", "core", "package.json"));
const { gzipSync, zipSync } = require("fflate");

const enc = new TextEncoder();
const b64 = (u8) => Buffer.from(u8).toString("base64");

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
function chunked(bytes, size) {
  const parts = [];
  for (let i = 0; i < bytes.length; i += size) {
    const slice = bytes.subarray(i, i + size);
    parts.push(enc.encode(slice.length.toString(16) + "\r\n"), slice, enc.encode("\r\n"));
  }
  parts.push(enc.encode("0\r\n\r\n"));
  return concat(...parts);
}

// A tiny valid 1x1 PNG (red pixel), for a binary response body.
const RED_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/* ----------------------------- HAR ----------------------------- */

const usersJson = JSON.stringify(
  { users: [{ id: 1, name: "Ada Lovelace", role: "admin" }, { id: 2, name: "Alan Turing", role: "user" }], page: 1, total: 2 },
);
const indexHtml =
  "<!doctype html><html><head><title>Example</title></head><body><h1>Hello</h1><p>It works.</p></body></html>";
const appCss = "body { margin: 0; font-family: system-ui; }\n.btn { color: #2563eb; padding: 8px 12px; }";
const appJs = "export function greet(name) {\n  return `Hello, ${name}`;\n}\nconst x = 42;";

function harEntry(opts) {
  return {
    startedDateTime: opts.time,
    time: opts.dur ?? 50,
    request: {
      method: opts.method,
      url: opts.url,
      httpVersion: "HTTP/1.1",
      headers: opts.reqHeaders ?? [{ name: "Host", value: new URL(opts.url).host }],
      queryString: [...new URL(opts.url).searchParams].map(([name, value]) => ({ name, value })),
      cookies: opts.reqCookies ?? [],
      headersSize: -1,
      bodySize: opts.postData ? JSON.stringify(opts.postData).length : 0,
      ...(opts.postData ? { postData: opts.postData } : {}),
    },
    response: {
      status: opts.status,
      statusText: opts.statusText ?? "",
      httpVersion: "HTTP/1.1",
      headers: opts.resHeaders ?? [],
      cookies: opts.resCookies ?? [],
      content: opts.content ?? { size: 0, mimeType: "" },
      redirectURL: opts.redirectURL ?? "",
      headersSize: -1,
      bodySize: opts.content?.size ?? 0,
    },
    serverIPAddress: opts.ip ?? "93.184.216.34",
    timings: opts.timings ?? { send: 1, wait: opts.dur ? opts.dur - 10 : 40, receive: 9 },
  };
}

const har = {
  log: {
    version: "1.2",
    creator: { name: "Sift example", version: "0.1.0" },
    entries: [
      harEntry({
        time: "2026-01-02T10:00:00.000Z", dur: 124, method: "GET",
        url: "https://api.example.com/v1/users?token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.s3cr3t&page=1",
        reqHeaders: [
          { name: "Host", value: "api.example.com" },
          { name: "Authorization", value: "Bearer sk-live-9f8c0b2a4d6e8f10" },
          { name: "X-API-Key", value: "ak_live_abcdef0123456789" },
          { name: "Accept", value: "application/json" },
        ],
        reqCookies: [{ name: "session", value: "s%3Aabc123.def456ghi789" }],
        status: 200, statusText: "OK",
        resHeaders: [
          { name: "Content-Type", value: "application/json; charset=utf-8" },
          { name: "Set-Cookie", value: "session=rotated-7a8b9c; Path=/; HttpOnly; Secure" },
        ],
        resCookies: [{ name: "session", value: "rotated-7a8b9c", path: "/", httpOnly: "true", secure: "true" }],
        content: { size: usersJson.length, mimeType: "application/json; charset=utf-8", text: usersJson },
      }),
      harEntry({
        time: "2026-01-02T10:00:01.000Z", dur: 30, method: "GET",
        url: "https://example.com/", status: 200, statusText: "OK",
        resHeaders: [{ name: "Content-Type", value: "text/html; charset=utf-8" }],
        content: { size: indexHtml.length, mimeType: "text/html; charset=utf-8", text: indexHtml },
      }),
      harEntry({
        time: "2026-01-02T10:00:01.200Z", dur: 20, method: "GET",
        url: "https://example.com/assets/app.css", status: 200, statusText: "OK",
        resHeaders: [{ name: "Content-Type", value: "text/css" }],
        content: { size: appCss.length, mimeType: "text/css", text: appCss },
      }),
      harEntry({
        time: "2026-01-02T10:00:01.400Z", dur: 22, method: "GET",
        url: "https://example.com/assets/app.js", status: 200, statusText: "OK",
        resHeaders: [{ name: "Content-Type", value: "application/javascript" }],
        content: { size: appJs.length, mimeType: "application/javascript", text: appJs },
      }),
      harEntry({
        time: "2026-01-02T10:00:02.000Z", dur: 60, method: "POST",
        url: "https://api.example.com/v1/posts",
        reqHeaders: [
          { name: "Host", value: "api.example.com" },
          { name: "Authorization", value: "Bearer sk-live-9f8c0b2a4d6e8f10" },
          { name: "Content-Type", value: "application/json" },
        ],
        postData: { mimeType: "application/json", text: JSON.stringify({ title: "Hello", body: "First post", draft: false }) },
        status: 201, statusText: "Created",
        resHeaders: [{ name: "Content-Type", value: "application/json" }, { name: "Location", value: "/v1/posts/42" }],
        content: { size: 20, mimeType: "application/json", text: JSON.stringify({ id: 42 }) },
      }),
      harEntry({
        time: "2026-01-02T10:00:02.200Z", dur: 80, method: "POST",
        url: "https://example.com/login",
        reqHeaders: [{ name: "Host", value: "example.com" }, { name: "Content-Type", value: "application/x-www-form-urlencoded" }],
        postData: {
          mimeType: "application/x-www-form-urlencoded",
          params: [{ name: "username", value: "ada" }, { name: "password", value: "hunter2" }],
        },
        status: 303, statusText: "See Other",
        resHeaders: [{ name: "Location", value: "https://example.com/dashboard" }],
        redirectURL: "https://example.com/dashboard",
        content: { size: 0, mimeType: "" },
      }),
      harEntry({
        time: "2026-01-02T10:00:02.400Z", dur: 18, method: "GET",
        url: "https://example.com/dashboard", status: 200, statusText: "OK",
        resHeaders: [{ name: "Content-Type", value: "text/html" }],
        content: { size: 60, mimeType: "text/html", text: "<!doctype html><title>Dashboard</title><h1>Welcome back</h1>" },
      }),
      harEntry({
        time: "2026-01-02T10:00:03.000Z", dur: 15, method: "GET",
        url: "https://cdn.example.com/pixel.png", status: 200, statusText: "OK",
        resHeaders: [{ name: "Content-Type", value: "image/png" }],
        content: { size: RED_PNG.length, mimeType: "image/png", encoding: "base64", text: b64(RED_PNG) },
      }),
      harEntry({
        time: "2026-01-02T10:00:03.500Z", dur: 12, method: "GET",
        url: "https://api.example.com/v1/missing", status: 404, statusText: "Not Found",
        reqHeaders: [{ name: "Host", value: "api.example.com" }],
        resHeaders: [{ name: "Content-Type", value: "application/json" }],
        content: { size: 27, mimeType: "application/json", text: JSON.stringify({ error: "not found" }) },
      }),
      harEntry({
        time: "2026-01-02T10:00:04.000Z", dur: 200, method: "GET",
        url: "https://api.example.com/v1/boom", status: 500, statusText: "Internal Server Error",
        reqHeaders: [{ name: "Host", value: "api.example.com" }],
        resHeaders: [{ name: "Content-Type", value: "text/html" }],
        content: { size: 40, mimeType: "text/html", text: "<h1>500</h1><p>Something went wrong.</p>" },
      }),
    ],
  },
};
writeFileSync(join(outDir, "example.har"), JSON.stringify(har, null, 2));

/* ----------------------------- SAZ ----------------------------- */
// Exercises the raw-HTTP paths: gzip, chunked+gzip, Brotli (not decoded).

function sazClient(lines) {
  return crlf([...lines, "", ""]);
}
const sessions = {};

// 1: HTTPS, gzip JSON, masked Authorization + Set-Cookie.
sessions["raw/1_c.txt"] = sazClient([
  "GET /v1/users?token=eyJhbGciOiJIUzI1NiJ9.payload.sig HTTP/1.1",
  "Host: api.example.com",
  "Authorization: Bearer sk-live-9f8c0b2a4d6e8f10",
  "Accept: application/json",
]);
sessions["raw/1_s.txt"] = concat(
  crlf([
    "HTTP/1.1 200 OK",
    "Content-Type: application/json; charset=utf-8",
    "Content-Encoding: gzip",
    "Set-Cookie: session=rotated-7a8b9c; Path=/; HttpOnly",
    "", "",
  ]),
  gzipSync(enc.encode(usersJson)),
);
sessions["raw/1_m.xml"] = enc.encode(
  `<?xml version="1.0" encoding="UTF-8"?>
<Session SID="1" BitFlags="1">
  <SessionTimers ClientConnected="2026-01-02T10:00:00.0000000+00:00" ClientDoneResponse="2026-01-02T10:00:00.1240000+00:00"/>
  <SessionFlags><SessionFlag N="x-egressport" V="443"/></SessionFlags>
</Session>
`,
);

// 2: HTTP, chunked + gzip text.
const streamText = "This body was chunked, then gzipped, and Sift puts it back together for you.";
sessions["raw/2_c.txt"] = sazClient(["GET /stream HTTP/1.1", "Host: example.com", "Accept: text/plain"]);
sessions["raw/2_s.txt"] = concat(
  crlf([
    "HTTP/1.1 200 OK",
    "Content-Type: text/plain; charset=utf-8",
    "Transfer-Encoding: chunked",
    "Content-Encoding: gzip",
    "", "",
  ]),
  chunked(gzipSync(enc.encode(streamText)), 16),
);
sessions["raw/2_m.xml"] = enc.encode(`<?xml version="1.0" encoding="UTF-8"?>\n<Session SID="2" BitFlags="0"/>\n`);

// 3: HTTPS, Brotli body, shown as "not decoded".
const brBody = zlibBrotli("This text is Brotli-encoded. fflate cannot decode it, so Sift shows the bytes and a badge.");
sessions["raw/3_c.txt"] = sazClient(["GET /v1/report HTTP/1.1", "Host: api.example.com", "Accept-Encoding: br"]);
sessions["raw/3_s.txt"] = concat(
  crlf(["HTTP/1.1 200 OK", "Content-Type: text/plain", "Content-Encoding: br", "", ""]),
  brBody,
);
sessions["raw/3_m.xml"] = enc.encode(`<?xml version="1.0" encoding="UTF-8"?>\n<Session SID="3" BitFlags="1"/>\n`);

function zlibBrotli(text) {
  return new Uint8Array(zlib.brotliCompressSync(Buffer.from(text)));
}

const saz = zipSync(
  { "_index.htm": enc.encode("<html><body>Fiddler session archive</body></html>"), ...sessions },
  { level: 0 },
);
writeFileSync(join(outDir, "example.saz"), saz);

/* --------------------------- Charles XML --------------------------- */

const charlesXml = `<?xml version="1.0" encoding="UTF-8"?>
<charles-session>
  <transaction>
    <scheme>https</scheme>
    <host>api.example.com</host>
    <actualPort>443</actualPort>
    <path>/v1/users</path>
    <query>page=1</query>
    <protocolVersion>HTTP/1.1</protocolVersion>
    <method>GET</method>
    <status>Complete</status>
    <responseCode>200</responseCode>
    <startTime>2026-01-02T10:00:00.000Z</startTime>
    <request>
      <header><name>Host</name><value>api.example.com</value></header>
      <header><name>Authorization</name><value>Bearer sk-live-9f8c0b2a4d6e8f10</value></header>
      <header><name>Accept</name><value>application/json</value></header>
    </request>
    <response>
      <header><name>Content-Type</name><value>application/json; charset=utf-8</value></header>
      <header><name>Set-Cookie</name><value>session=rotated-7a8b9c; Path=/; HttpOnly</value></header>
      <body><text>${usersJson.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text></body>
    </response>
  </transaction>
  <transaction>
    <scheme>https</scheme>
    <host>example.com</host>
    <actualPort>443</actualPort>
    <path>/old-page</path>
    <method>GET</method>
    <responseCode>301</responseCode>
    <protocolVersion>HTTP/1.1</protocolVersion>
    <request><header><name>Host</name><value>example.com</value></header></request>
    <response><header><name>Location</name><value>https://example.com/new-page</value></header></response>
  </transaction>
  <transaction>
    <scheme>https</scheme>
    <host>api.example.com</host>
    <actualPort>443</actualPort>
    <path>/v1/boom</path>
    <method>GET</method>
    <responseCode>500</responseCode>
    <protocolVersion>HTTP/1.1</protocolVersion>
    <request><header><name>Host</name><value>api.example.com</value></header></request>
    <response>
      <header><name>Content-Type</name><value>text/html</value></header>
      <body><text>&lt;h1&gt;500&lt;/h1&gt;</text></body>
    </response>
  </transaction>
</charles-session>
`;
writeFileSync(join(outDir, "example.xml"), charlesXml);

/* -------------------------- Charles .trace -------------------------- */

const charlesTrace = `========================================
GET /v1/users?page=1 HTTP/1.1
Host: api.example.com
Authorization: Bearer sk-live-9f8c0b2a4d6e8f10
Accept: application/json

HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Set-Cookie: session=rotated-7a8b9c; Path=/

========================================
POST /login HTTP/1.1
Host: example.com
Content-Type: application/x-www-form-urlencoded

HTTP/1.1 303 See Other
Location: https://example.com/dashboard

========================================
DELETE /v1/posts/42 HTTP/1.1
Host: api.example.com
Authorization: Bearer sk-live-9f8c0b2a4d6e8f10

HTTP/1.1 204 No Content

`;
writeFileSync(join(outDir, "example.trace"), charlesTrace);

console.log("wrote examples: example.har, example.saz, example.xml, example.trace");
