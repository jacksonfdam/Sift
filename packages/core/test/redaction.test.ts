import { describe, expect, it } from "vitest";
import { harParser } from "../src/parsers/har.js";
import {
  isSensitiveHeader,
  isSensitiveQueryParam,
  REDACTED_PLACEHOLDER,
} from "../src/redaction/policy.js";
import { buildSanitizedHar } from "../src/export/sanitized-har.js";
import { loadFixture } from "./helpers.js";

describe("redaction policy", () => {
  it("flags sensitive headers", () => {
    expect(isSensitiveHeader("Authorization")).toBe(true);
    expect(isSensitiveHeader("set-cookie")).toBe(true);
    expect(isSensitiveHeader("X-API-Key")).toBe(true);
    expect(isSensitiveHeader("Accept")).toBe(false);
  });

  it("flags token-shaped and named query params", () => {
    expect(isSensitiveQueryParam("token", "x")).toBe(true);
    expect(isSensitiveQueryParam("page", "1")).toBe(false);
    expect(isSensitiveQueryParam("q", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc")).toBe(true);
  });
});

describe("sanitized HAR export", () => {
  it("replaces every sensitive value with the placeholder", async () => {
    const flows = await harParser.parse(loadFixture("har/sample.har"));
    const har = buildSanitizedHar(flows) as {
      log: { entries: any[] };
    };
    const serialized = JSON.stringify(har);

    // Secrets must be gone.
    expect(serialized).not.toContain("sk-live-0123456789abcdef");
    expect(serialized).not.toContain("newvalue789");
    expect(serialized).not.toContain("abc123def456");

    // Placeholder is present in their place.
    const first = har.log.entries[0];
    const auth = first.request.headers.find((h: any) => h.name === "Authorization");
    expect(auth.value).toBe(REDACTED_PLACEHOLDER);
    expect(first.response.cookies[0].value).toBe(REDACTED_PLACEHOLDER);

    // Non-sensitive data is preserved.
    expect(first.request.method).toBe("GET");
    expect(first.response.status).toBe(200);
  });

  it("emits a structurally valid HAR log", async () => {
    const flows = await harParser.parse(loadFixture("har/sample.har"));
    const har = buildSanitizedHar(flows) as { log: { version: string; entries: any[] } };
    expect(har.log.version).toBe("1.2");
    expect(har.log.entries).toHaveLength(3);
  });
});
