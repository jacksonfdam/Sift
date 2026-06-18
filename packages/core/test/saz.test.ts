import { describe, expect, it } from "vitest";
import { zipSync } from "fflate";
import { sazParser } from "../src/parsers/saz.js";
import { loadFixture } from "./helpers.js";

describe("SAZ parser", () => {
  const input = loadFixture("saz/sample.saz");

  it("sniffs by extension and ZIP magic", () => {
    expect(sazParser.canParse(input)).toBe(true);
    expect(
      sazParser.canParse({ name: "x.bin", bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04]) }),
    ).toBe(true);
    expect(sazParser.canParse({ name: "x.bin", bytes: new Uint8Array([0x00]) })).toBe(false);
  });

  it("orders sessions by numeric id", async () => {
    const flows = await sazParser.parse(input);
    expect(flows).toHaveLength(2);
    expect(flows[0]!.meta?.sazSessionId).toBe("1");
    expect(flows[1]!.meta?.sazSessionId).toBe("2");
  });

  it("reconstructs an HTTPS URL from request line + Host + flags", async () => {
    const [flow] = await sazParser.parse(input);
    expect(flow!.request.method).toBe("GET");
    expect(flow!.request.url).toBe(
      "https://api.example.com/v1/users?token=eyJabc.def.ghi&page=1",
    );
    expect(flow!.request.queryString).toEqual([
      { name: "token", value: "eyJabc.def.ghi" },
      { name: "page", value: "1" },
    ]);
  });

  it("decompresses a gzip response body to text", async () => {
    const [flow] = await sazParser.parse(input);
    expect(flow!.response.status).toBe(200);
    expect(flow!.response.content.encoding).toBe("gzip");
    expect(flow!.response.content.text).toBe('{"users":[{"id":1,"name":"Ada"}]}');
  });

  it("parses Set-Cookie into response cookies", async () => {
    const [flow] = await sazParser.parse(input);
    const cookie = flow!.response.cookies[0];
    expect(cookie?.name).toBe("session");
    expect(cookie?.value).toBe("newvalue789");
    expect(cookie?.["path"]).toBe("/");
    expect(cookie?.["httponly"]).toBe("true");
  });

  it("de-chunks then decompresses a chunked+gzip body", async () => {
    const flows = await sazParser.parse(input);
    const second = flows[1]!;
    expect(second.request.url).toBe("http://example.com/stream");
    expect(second.response.content.text).toBe(
      "hello chunked world — this body is gzipped and chunked",
    );
  });

  it("extracts best-effort timing from _m.xml", async () => {
    const [flow] = await sazParser.parse(input);
    expect(flow!.timings?.["total"]).toBe(123);
  });

  it("detects encrypted archives and fails clearly", async () => {
    // Build a ZIP, then flip the encryption bit on its first local header.
    const zip = zipSync({ "raw/1_c.txt": new TextEncoder().encode("GET / HTTP/1.1\r\n\r\n") });
    for (let i = 0; i + 8 < zip.length; i++) {
      if (zip[i] === 0x50 && zip[i + 1] === 0x4b && zip[i + 2] === 0x03 && zip[i + 3] === 0x04) {
        zip[i + 6] = zip[i + 6]! | 0x1;
        break;
      }
    }
    await expect(sazParser.parse({ name: "enc.saz", bytes: zip })).rejects.toMatchObject({
      code: "encrypted",
    });
  });
});
