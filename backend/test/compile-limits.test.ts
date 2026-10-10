import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";

// A fake tectonic: counts runs in a file and fails on markers in the source, so no TeX install is needed.
const fake = await vi.hoisted(async () => {
  const { mkdtempSync, writeFileSync, chmodSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const dir = mkdtempSync(join(tmpdir(), "rb-fake-tectonic-"));
  const bin = join(dir, "tectonic");
  const count = join(dir, "runs");
  writeFileSync(
    bin,
    `#!/bin/sh
echo x >> "${count}"
if grep -q BIGLOG main.tex; then head -c 2000000 /dev/zero | tr '\\0' 'x'; echo; echo "error: main.tex:3: Boom"; exit 1; fi
if grep -q BIGPDF main.tex; then head -c 11000000 /dev/zero > main.pdf; exit 0; fi
echo "error: main.tex:3: Boom"
exit 1
`,
  );
  chmodSync(bin, 0o755);
  return { bin, count };
});

vi.mock("../src/config/env.js", async (importOriginal) => ({
  env: {
    ...(await importOriginal<typeof import("../src/config/env.js")>()).env,
    COMPILER_URL: undefined,
    TECTONIC_BIN: fake.bin,
    TECTONIC_ONLY_CACHED: false,
    COMPILE_TIMEOUT_MS: 20_000,
    COMPILE_CONCURRENCY: 2,
  },
}));
vi.mock("../src/lib/storage.js", () => ({ storage: { get: async () => undefined, put: async () => {} } }));

const { compileTex, oneAtATime } = await import("../src/lib/latex/compile.js");
const runs = () =>
  readFile(fake.count, "utf8").then(
    (s) => s.split("\n").length - 1,
    () => 0,
  );
const doc = (text: string) => `\\documentclass{article}\\begin{document}${text}\\end{document}`;

describe("compile failures", () => {
  it("returns a repeat of a failing source from memory without running the compiler again", async () => {
    const before = await runs();
    const first = await compileTex(doc("BOOM"));
    const second = await compileTex(doc("BOOM"));
    expect(first.ok).toBe(false);
    expect(second).toEqual(first);
    expect((await runs()) - before).toBe(1);
  });
});

describe("compile output size", () => {
  it("drops log output past the cap, so the error line printed after it is not reported", async () => {
    const result = await compileTex(doc("BIGLOG"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.message).toBe("LaTeX compilation failed");
  });

  it("rejects a PDF over 10 MB with a clear error", async () => {
    const result = await compileTex(doc("BIGPDF"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.message).toBe("The PDF is larger than 10 MB");
  });
});

describe("one compile at a time per user", () => {
  it("makes a user's second compile wait for the first, without holding up other users", async () => {
    const order: string[] = [];
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    const first = oneAtATime("user-1", async () => {
      order.push("first start");
      await held;
      order.push("first end");
    });
    const second = oneAtATime("user-1", async () => void order.push("second"));
    await oneAtATime("user-2", async () => void order.push("other user"));
    release();
    await Promise.all([first, second]);
    expect(order).toEqual(["first start", "other user", "first end", "second"]);
  });
});
