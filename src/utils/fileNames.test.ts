import { describe, expect, it } from "vitest";
import { sanitizeDisplayFileName } from "./fileNames";

describe("sanitizeDisplayFileName", () => {
  it("strips path segments and control characters", () => {
    expect(sanitizeDisplayFileName("../../../evil\x01name.pdf")).toBe("evil_name.pdf");
  });

  it("uses fallback for empty names", () => {
    const name = sanitizeDisplayFileName("   ", "doc");
    expect(name.startsWith("doc_")).toBe(true);
  });
});
