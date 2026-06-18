import { describe, expect, it } from "vitest";
import { harParser } from "../src/parsers/har.js";
import { sazParser } from "../src/parsers/saz.js";
import { loadFixture } from "./helpers.js";

/**
 * The same logical session exported as HAR and as SAZ must normalize to
 * equivalent `Flow` values (modulo source and source-specific meta). This is
 * the proof that the canonical model is genuinely format-agnostic.
 */
describe("cross-parser normalization", () => {
  it("HAR and SAZ produce an equivalent first flow", async () => {
    const [harFlow] = await harParser.parse(loadFixture("har/sample.har"));
    const [sazFlow] = await sazParser.parse(loadFixture("saz/sample.saz"));

    expect(sazFlow!.request.method).toBe(harFlow!.request.method);
    expect(sazFlow!.request.url).toBe(harFlow!.request.url);
    expect(sazFlow!.response.status).toBe(harFlow!.response.status);
    expect(sazFlow!.response.content.text).toBe(harFlow!.response.content.text);

    const headerVal = (flow: typeof harFlow, name: string) =>
      flow!.request.headers.find((h) => h.name.toLowerCase() === name)?.value;
    expect(headerVal(sazFlow, "authorization")).toBe(headerVal(harFlow, "authorization"));

    // Both surface the response session cookie identically.
    expect(sazFlow!.response.cookies[0]?.value).toBe(harFlow!.response.cookies[0]?.value);
  });
});
