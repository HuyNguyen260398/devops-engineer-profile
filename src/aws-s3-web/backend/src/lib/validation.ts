import type { PostInput } from "./types";

export const MAX_BODY_BYTES = 350_000;

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

type Result = { ok: true; value: PostInput } | { ok: false; error: string };

export function validatePostInput(input: unknown): Result {
  if (typeof input !== "object" || input === null) return { ok: false, error: "body must be an object" };
  const b = input as Record<string, unknown>;
  if (typeof b.title !== "string" || b.title.trim() === "") return { ok: false, error: "title required" };
  if (b.status !== "draft" && b.status !== "published") return { ok: false, error: "invalid status" };
  if (typeof b.body !== "object" || b.body === null) return { ok: false, error: "body document required" };
  if (Buffer.byteLength(JSON.stringify(b.body)) > MAX_BODY_BYTES) return { ok: false, error: "body too large" };
  const slug = typeof b.slug === "string" && b.slug.trim() ? slugify(b.slug) : slugify(b.title);
  return {
    ok: true,
    value: {
      title: b.title.trim(),
      slug,
      excerpt: typeof b.excerpt === "string" ? b.excerpt : "",
      tags: Array.isArray(b.tags) ? (b.tags.filter((t) => typeof t === "string") as string[]) : [],
      coverImage: typeof b.coverImage === "string" ? b.coverImage : null,
      status: b.status,
      body: b.body,
    },
  };
}
