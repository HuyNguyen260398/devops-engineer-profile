import { describe, it, expect } from "vitest";
import { slugify, validatePostInput } from "../src/lib/validation";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Hello, DevOps World!")).toBe("hello-devops-world");
  });
});

describe("validatePostInput", () => {
  const base = {
    title: "T",
    slug: "t",
    excerpt: "e",
    tags: [],
    coverImage: null,
    status: "draft",
    body: { type: "doc", content: [] },
  };
  it("accepts a valid input", () => {
    const r = validatePostInput(base);
    expect(r.ok).toBe(true);
  });
  it("rejects missing title", () => {
    const r = validatePostInput({ ...base, title: "" });
    expect(r.ok).toBe(false);
  });
  it("rejects invalid status", () => {
    const r = validatePostInput({ ...base, status: "weird" });
    expect(r.ok).toBe(false);
  });
});
