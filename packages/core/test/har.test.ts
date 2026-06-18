import { describe, expect, it } from "vitest";
import { harParser } from "../src/parsers/har.js";
import { bytesToText } from "../src/util/bytes.js";
import { loadFixture } from "./helpers.js";

describe("HAR parser", () => {
  const input = loadFixture("har/sample.har");

  it("sniffs by extension and JSON magic", () => {
    expect(harParser.canParse(input)).toBe(true);
    expect(harParser.canParse({ name: "x.json", bytes: input.bytes })).toBe(true);
    expect(harParser.canParse({ name: "x.bin", bytes: new Uint8Array([0x50]) })).toBe(false);
  });

  it("maps log.entries to the expected flow count", async () => {
    const flows = await harParser.parse(input);
    expect(flows).toHaveLength(3);
  });

  it("spot-checks the first flow", async () => {
    const [flow] = await harParser.parse(input);
    expect(flow!.request.method).toBe("GET");
    expect(flow!.request.url).toBe(
      "https://api.example.com/v1/users?token=eyJabc.def.ghi&page=1",
    );
    expect(flow!.response.status).toBe(200);
    expect(flow!.startedDateTime).toBe("2026-01-02T10:00:00.000Z");
    expect(flow!.serverIPAddress).toBe("93.184.216.34");
    expect(flow!.timings).toMatchObject({ wait: 100, receive: 22.2 });

    const auth = flow!.request.headers.find((h) => h.name === "Authorization");
    expect(auth?.value).toBe("Bearer sk-live-0123456789abcdef");

    expect(flow!.response.content.mimeType).toBe("application/json; charset=utf-8");
    expect(flow!.response.content.text).toContain('"name":"Ada"');
  });

  it("captures a redirect chain", async () => {
    const flows = await harParser.parse(input);
    expect(flows[1]!.response.status).toBe(302);
    expect(flows[1]!.response.redirectURL).toBe("https://example.com/new-path");
  });

  it("decodes base64 binary response bodies to bytes (no text for binary)", async () => {
    const flows = await harParser.parse(input);
    const png = flows[2]!.response.content;
    expect(png.mimeType).toBe("image/png");
    expect(png.bytes).toBeInstanceOf(Uint8Array);
    // PNG magic bytes
    expect(Array.from(png.bytes!.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(png.text).toBeUndefined();
  });

  it("reconstructs form post bodies from params", async () => {
    const flows = await harParser.parse(input);
    const post = flows[2]!.request.postData;
    expect(post?.mimeType).toBe("application/x-www-form-urlencoded");
    expect(post?.text).toBe("title=hello&visible=true");
  });

  it("throws a typed error on non-HAR JSON", async () => {
    await expect(
      harParser.parse({ name: "x.har", bytes: new TextEncoder().encode("{}") }),
    ).rejects.toMatchObject({ name: "ParserError", code: "malformed" });
  });

  it("never echoes capture content in errors", async () => {
    try {
      await harParser.parse({ name: "x.har", bytes: new TextEncoder().encode("nope") });
    } catch (e) {
      expect(bytesToText).toBeTypeOf("function");
      expect(String((e as Error).message)).not.toContain("nope");
    }
  });
});
