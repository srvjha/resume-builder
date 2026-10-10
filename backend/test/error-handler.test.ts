import type { Request, Response } from "express";
import { describe, expect, it } from "vitest";
import { errorHandler } from "../src/middleware/error-handler.js";

function run(err: unknown) {
  const calls: { status?: number; body?: unknown } = {};
  const req = { log: { error() {} } } as unknown as Request;
  const res = {
    status(code: number) {
      calls.status = code;
      return this;
    },
    json(body: unknown) {
      calls.body = body;
      return this;
    },
  } as unknown as Response;
  errorHandler(err, req, res, () => {});
  return calls;
}

describe("errorHandler", () => {
  it("answers a Postgres unique violation with 409 CONFLICT", () => {
    const result = run(Object.assign(new Error("duplicate key"), { code: "23505" }));
    expect(result.status).toBe(409);
    expect(result.body).toEqual({
      error: { code: "CONFLICT", message: "That already exists. Try a different name, or refresh and try again." },
    });
  });

  it("finds a unique violation wrapped in a cause", () => {
    const result = run(new Error("Failed query", { cause: { code: "23505" } }));
    expect(result.status).toBe(409);
  });

  it("still answers other errors with 500", () => {
    const result = run(new Error("boom"));
    expect(result.status).toBe(500);
  });
});
