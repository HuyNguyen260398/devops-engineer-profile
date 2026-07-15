import { describe, it, expect, vi } from "vitest";
import { createHandler } from "../src/handler";

function evt(method: string, resource: string, opts: Partial<any> = {}) {
  return {
    httpMethod: method,
    resource,
    pathParameters: null,
    body: null,
    requestContext: { authorizer: null },
    ...opts,
  } as any;
}

describe("router", () => {
  it("GET /posts returns published list", async () => {
    const repo = { listPublished: vi.fn().mockResolvedValue([{ slug: "a" }]) } as any;
    const res = await createHandler(repo)(evt("GET", "/posts"));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([{ slug: "a" }]);
  });

  it("GET /drafts without authorizer claims is 401", async () => {
    const repo = { listDrafts: vi.fn() } as any;
    const res = await createHandler(repo)(evt("GET", "/drafts"));
    expect(res.statusCode).toBe(401);
    expect(repo.listDrafts).not.toHaveBeenCalled();
  });

  it("GET /drafts with claims returns draft list", async () => {
    const repo = { listDrafts: vi.fn().mockResolvedValue([{ slug: "d", status: "draft" }]) } as any;
    const res = await createHandler(repo)(
      evt("GET", "/drafts", { requestContext: { authorizer: { claims: { sub: "u1" } } } }),
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual([{ slug: "d", status: "draft" }]);
  });

  it("GET /drafts/{key} without authorizer claims is 401", async () => {
    const repo = { getBySlug: vi.fn() } as any;
    const res = await createHandler(repo)(
      evt("GET", "/drafts/{key}", { pathParameters: { key: "test" } }),
    );
    expect(res.statusCode).toBe(401);
    expect(repo.getBySlug).not.toHaveBeenCalled();
  });

  it("GET /drafts/{key} with claims reads any status by slug", async () => {
    const repo = { getBySlug: vi.fn().mockResolvedValue({ slug: "test", status: "draft" }) } as any;
    const res = await createHandler(repo)(
      evt("GET", "/drafts/{key}", {
        pathParameters: { key: "test" },
        requestContext: { authorizer: { claims: { sub: "u1" } } },
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(repo.getBySlug).toHaveBeenCalledWith("test", true);
  });

  it("POST /posts without authorizer claims is 401", async () => {
    const repo = {} as any;
    const res = await createHandler(repo)(evt("POST", "/posts", { body: "{}" }));
    expect(res.statusCode).toBe(401);
  });

  it("POST /posts with claims and valid body creates", async () => {
    const repo = { create: vi.fn().mockResolvedValue({ id: "1", slug: "new" }) } as any;
    const body = JSON.stringify({
      title: "New",
      slug: "new",
      excerpt: "",
      tags: [],
      coverImage: null,
      status: "published",
      body: { type: "doc", content: [] },
    });
    const res = await createHandler(repo)(
      evt("POST", "/posts", { body, requestContext: { authorizer: { claims: { sub: "u1" } } } }),
    );
    expect(res.statusCode).toBe(201);
  });

  it("GET /posts/{key} treats key as slug", async () => {
    const repo = { getBySlug: vi.fn().mockResolvedValue({ slug: "a", title: "A" }) } as any;
    const res = await createHandler(repo)(
      evt("GET", "/posts/{key}", { pathParameters: { key: "a" } }),
    );
    expect(res.statusCode).toBe(200);
    expect(repo.getBySlug).toHaveBeenCalledWith("a", false);
  });

  it("DELETE /posts/{key} treats key as id and requires auth", async () => {
    const repo = { remove: vi.fn().mockResolvedValue(true) } as any;
    const res = await createHandler(repo)(
      evt("DELETE", "/posts/{key}", {
        pathParameters: { key: "id-1" },
        requestContext: { authorizer: { claims: { sub: "u1" } } },
      }),
    );
    expect(res.statusCode).toBe(204);
    expect(repo.remove).toHaveBeenCalledWith("id-1");
  });
});
