import { describe, it, expect } from "vitest";
import { json, error } from "../src/lib/response";

describe("response helpers", () => {
  it("json serializes body and sets status", () => {
    const r = json(201, { id: "1" });
    expect(r.statusCode).toBe(201);
    expect(JSON.parse(r.body)).toEqual({ id: "1" });
    expect(r.headers?.["content-type"]).toBe("application/json");
  });
  it("error wraps a message", () => {
    const r = error(400, "bad");
    expect(r.statusCode).toBe(400);
    expect(JSON.parse(r.body)).toEqual({ error: "bad" });
  });
});
