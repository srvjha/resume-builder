import { describe, expect, it } from "vitest";
import { assertDeletablePrefix } from "../src/lib/storage.js";

describe("assertDeletablePrefix", () => {
  it.each(["", "  ", "/", "//"])("refuses %j", (prefix) => {
    expect(() => assertDeletablePrefix(prefix)).toThrow("Refusing to delete with an empty storage prefix");
  });

  it("allows a real prefix", () => {
    expect(() => assertDeletablePrefix("users/abc/")).not.toThrow();
  });
});
