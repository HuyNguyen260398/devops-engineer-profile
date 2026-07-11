import { randomUUID } from "node:crypto";
import type { PostInput, PostMeta, PostRecord } from "../src/lib/types";

interface Stored extends PostMeta {
  body: unknown;
}

/**
 * A Map-backed stand-in for the DynamoDB + S3 Repository, used only by the local
 * dev server. It implements the same public methods the Lambda handler calls, so
 * the real routing/validation/auth logic runs unchanged against in-memory data.
 * Uploaded image bytes are also kept in memory so the presign -> PUT -> GET
 * round-trip works locally.
 */
export class InMemoryRepository {
  private posts = new Map<string, Stored>();
  private blobs = new Map<string, { contentType: string; data: Buffer }>();

  private toMeta(s: Stored): PostMeta {
    const { body: _body, ...meta } = s;
    void _body;
    return meta;
  }

  async listPublished(): Promise<PostMeta[]> {
    return [...this.posts.values()]
      .filter((p) => p.status === "published")
      .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
      .map((p) => this.toMeta(p));
  }

  async listAll(): Promise<PostMeta[]> {
    return [...this.posts.values()]
      .sort((a, b) => (b.publishedAt ?? b.updatedAt).localeCompare(a.publishedAt ?? a.updatedAt))
      .map((p) => this.toMeta(p));
  }

  async getBySlug(slug: string, includeDraft: boolean): Promise<PostRecord | null> {
    const p = [...this.posts.values()].find((x) => x.slug === slug);
    if (!p) return null;
    if (p.status !== "published" && !includeDraft) return null;
    return { ...this.toMeta(p), body: p.body };
  }

  async create(input: PostInput): Promise<PostMeta> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const publishedAt = input.status === "published" ? now : null;
    const rec: Stored = {
      id,
      slug: input.slug,
      title: input.title,
      excerpt: input.excerpt,
      tags: input.tags,
      coverImage: input.coverImage,
      status: input.status,
      publishedAt,
      updatedAt: now,
      body: input.body,
    };
    this.posts.set(id, rec);
    return this.toMeta(rec);
  }

  async update(id: string, input: PostInput): Promise<PostMeta | null> {
    const existing = this.posts.get(id);
    if (!existing) return null;
    const now = new Date().toISOString();
    const publishedAt = input.status === "published" ? (existing.publishedAt ?? now) : null;
    const rec: Stored = {
      ...existing,
      slug: input.slug,
      title: input.title,
      excerpt: input.excerpt,
      tags: input.tags,
      coverImage: input.coverImage,
      status: input.status,
      publishedAt,
      updatedAt: now,
      body: input.body,
    };
    this.posts.set(id, rec);
    return this.toMeta(rec);
  }

  async remove(id: string): Promise<boolean> {
    this.posts.delete(id);
    return true;
  }

  async presignUpload(contentType: string): Promise<{ url: string; key: string }> {
    const ext = contentType.split("/")[1] ?? "bin";
    const key = `media/${randomUUID()}.${ext}`;
    const port = process.env.PORT ?? "3001";
    return { url: `http://localhost:${port}/_upload/${key}`, key };
  }

  // Dev-only blob store for the local image round-trip.
  putBlob(key: string, contentType: string, data: Buffer): void {
    this.blobs.set(key, { contentType, data });
  }

  getBlob(key: string): { contentType: string; data: Buffer } | undefined {
    return this.blobs.get(key);
  }
}
