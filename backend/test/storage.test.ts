import { describe, expect, it } from "vitest";
import { assertDeletablePrefix, staleKeys } from "../src/lib/storage.js";

describe("staleKeys", () => {
  it("keeps only objects modified before the cutoff", () => {
    const cutoff = new Date("2026-01-10T00:00:00Z");
    const objects = [
      { key: "compiled/old.pdf", modifiedAt: new Date("2026-01-09T23:59:59Z") },
      { key: "compiled/new.pdf", modifiedAt: new Date("2026-01-10T00:00:01Z") },
    ];
    expect(staleKeys(objects, cutoff)).toEqual(["compiled/old.pdf"]);
  });
});

describe("assertDeletablePrefix", () => {
  it.each(["", "  ", "/", "//"])("refuses %j", (prefix) => {
    expect(() => assertDeletablePrefix(prefix)).toThrow("Refusing to delete with an empty storage prefix");
  });

  it("allows a real prefix", () => {
    expect(() => assertDeletablePrefix("users/abc/")).not.toThrow();
  });
});
