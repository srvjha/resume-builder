import { describe, expect, it } from "vitest";
import { inWorker } from "../src/lib/in-worker.js";

// A data: URL module stands in for pdf.js: one export that answers, one that never returns.
const module = `data:text/javascript,${encodeURIComponent(
  "export const size = (a) => a.length; export const spin = () => { for (;;); };",
)}`;

describe("inWorker", () => {
  it("returns what the export returns", async () => {
    expect(await inWorker(module, "size", new Uint8Array(3))).toBe(3);
  });

  it("stops an export that runs too long", async () => {
    await expect(inWorker(module, "spin", new Uint8Array(1), 200)).rejects.toThrow("took over 200ms");
  });
});
