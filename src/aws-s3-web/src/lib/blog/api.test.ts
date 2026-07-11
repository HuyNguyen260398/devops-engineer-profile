import { describe, it, expect, vi, beforeEach } from "vitest";
import { listPosts, createPost } from "./api";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("api client", () => {
  it("listPosts GETs /api/posts", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, json: async () => [{ slug: "a" }] });
    vi.stubGlobal("fetch", f);
    const posts = await listPosts();
    expect(f).toHaveBeenCalledWith("/api/posts", expect.objectContaining({ method: "GET" }));
    expect(posts[0].slug).toBe("a");
  });

  it("createPost sends bearer token", async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: "1" }) });
    vi.stubGlobal("fetch", f);
    await createPost({ title: "t" } as never, "TOKEN");
    expect(f).toHaveBeenCalledWith(
      "/api/posts",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer TOKEN" }),
      }),
    );
  });
});
