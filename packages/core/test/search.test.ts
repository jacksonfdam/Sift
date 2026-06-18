import { describe, expect, it } from "vitest";
import { harParser } from "../src/parsers/har.js";
import {
  computeFacets,
  emptyCriteria,
  filterFlows,
  flowHost,
  responseMime,
} from "../src/ui/search.js";
import { loadFixture } from "./helpers.js";

async function flows() {
  return harParser.parse(loadFixture("har/sample.har"));
}

describe("search & filter", () => {
  it("computes facets across the flow set", async () => {
    const facets = computeFacets(await flows());
    expect(facets.methods).toContain("GET");
    expect(facets.methods).toContain("POST");
    expect(facets.hosts).toContain("api.example.com");
    expect(facets.hosts).toContain("example.com");
  });

  it("free-text matches URL, headers, and body", async () => {
    const f = await flows();
    expect(filterFlows(f, { ...emptyCriteria(), query: "api.example.com" })).toHaveLength(1);
    expect(filterFlows(f, { ...emptyCriteria(), query: "Ada" })).toHaveLength(1);
    expect(filterFlows(f, { ...emptyCriteria(), query: "nomatch-xyz" })).toHaveLength(0);
  });

  it("filters by method and status class", async () => {
    const f = await flows();
    expect(filterFlows(f, { ...emptyCriteria(), methods: new Set(["POST"]) })).toHaveLength(1);
    expect(
      filterFlows(f, { ...emptyCriteria(), statusClasses: new Set(["3xx"] as const) }),
    ).toHaveLength(1);
  });

  it("filters by host and mime", async () => {
    const f = await flows();
    expect(filterFlows(f, { ...emptyCriteria(), hosts: new Set(["api.example.com"]) })).toHaveLength(1);
    expect(
      filterFlows(f, { ...emptyCriteria(), mimeTypes: new Set(["image/png"]) }),
    ).toHaveLength(1);
  });

  it("derives host and response mime", async () => {
    const [flow] = await flows();
    expect(flowHost(flow!)).toBe("api.example.com");
    expect(responseMime(flow!)).toBe("application/json");
  });
});
