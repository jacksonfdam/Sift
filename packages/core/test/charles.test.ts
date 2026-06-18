import { describe, expect, it } from "vitest";
import { charlesParser } from "../src/parsers/charles.js";
import { loadFixture } from "./helpers.js";

describe("Charles parser", () => {
  describe("XML", () => {
    const input = loadFixture("charles/sample.xml");

    it("sniffs by extension and '<' magic", () => {
      expect(charlesParser.canParse(input)).toBe(true);
      expect(charlesParser.canParse({ name: "x", bytes: new TextEncoder().encode("  <x/>") })).toBe(
        true,
      );
    });

    it("maps transactions to flows", async () => {
      const flows = await charlesParser.parse(input);
      expect(flows).toHaveLength(2);
    });

    it("builds an absolute URL from scheme/host/path/query", async () => {
      const [flow] = await charlesParser.parse(input);
      expect(flow!.request.method).toBe("GET");
      expect(flow!.request.url).toBe(
        "https://api.example.com/v1/users?token=eyJabc.def.ghi&page=1",
      );
      expect(flow!.response.status).toBe(200);
    });

    it("collects request and response headers defensively", async () => {
      const [flow] = await charlesParser.parse(input);
      expect(flow!.request.headers).toContainEqual({
        name: "Authorization",
        value: "Bearer sk-live-0123456789abcdef",
      });
      expect(flow!.response.headers).toContainEqual({
        name: "Content-Type",
        value: "application/json; charset=utf-8",
      });
    });

    it("extracts a text response body", async () => {
      const [flow] = await charlesParser.parse(input);
      expect(flow!.response.content.text).toBe('{"users":[{"id":1,"name":"Ada"}]}');
    });
  });

  describe(".trace", () => {
    const input = loadFixture("charles/sample.trace");

    it("sniffs by .trace extension", () => {
      expect(charlesParser.canParse(input)).toBe(true);
    });

    it("parses delimited request/response blocks", async () => {
      const flows = await charlesParser.parse(input);
      expect(flows).toHaveLength(2);
      expect(flows[0]!.request.url).toBe("http://api.example.com/v1/users?page=1");
      expect(flows[0]!.response.status).toBe(200);
      expect(flows[1]!.request.method).toBe("POST");
      expect(flows[1]!.response.status).toBe(201);
    });
  });
});
