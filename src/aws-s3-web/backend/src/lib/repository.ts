import { randomUUID } from "node:crypto";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  DeleteCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { PostInput, PostMeta, PostRecord } from "./types";

interface Deps {
  doc: DynamoDBDocumentClient;
  s3: S3Client;
  table: string;
  bucket: string;
}

const META = (m: Record<string, unknown>): PostMeta => ({
  id: m.id as string,
  slug: m.slug as string,
  title: m.title as string,
  excerpt: (m.excerpt as string) ?? "",
  tags: (m.tags as string[]) ?? [],
  coverImage: (m.coverImage as string) ?? null,
  status: m.status as PostMeta["status"],
  publishedAt: (m.publishedAt as string) ?? null,
  updatedAt: m.updatedAt as string,
});

export class Repository {
  constructor(private d: Deps) {}

  private bodyKey(id: string) {
    return `bodies/${id}.json`;
  }

  async listPublished(): Promise<PostMeta[]> {
    const r = await this.d.doc.send(
      new QueryCommand({
        TableName: this.d.table,
        IndexName: "gsi1",
        KeyConditionExpression: "GSI1PK = :p",
        FilterExpression: "#s = :pub",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":p": "POST", ":pub": "published" },
        ScanIndexForward: false,
      }),
    );
    return (r.Items ?? []).map(META);
  }

  async listAll(): Promise<PostMeta[]> {
    const r = await this.d.doc.send(
      new QueryCommand({
        TableName: this.d.table,
        IndexName: "gsi1",
        KeyConditionExpression: "GSI1PK = :p",
        ExpressionAttributeValues: { ":p": "POST" },
        ScanIndexForward: false,
      }),
    );
    return (r.Items ?? []).map(META);
  }

  async getBySlug(slug: string, includeDraft: boolean): Promise<PostRecord | null> {
    const q = await this.d.doc.send(
      new QueryCommand({
        TableName: this.d.table,
        IndexName: "gsi2",
        KeyConditionExpression: "GSI2PK = :s",
        ExpressionAttributeValues: { ":s": `SLUG#${slug}` },
      }),
    );
    const item = q.Items?.[0];
    if (!item) return null;
    if (item.status !== "published" && !includeDraft) return null;
    const body = await this.readBody(item.id as string);
    return { ...META(item), body };
  }

  private async readBody(id: string): Promise<unknown> {
    const obj = await this.d.s3.send(
      new GetObjectCommand({ Bucket: this.d.bucket, Key: this.bodyKey(id) }),
    );
    const text = await obj.Body!.transformToString();
    return JSON.parse(text);
  }

  private async writeItem(
    id: string,
    input: PostInput,
    publishedAt: string | null,
    updatedAt: string,
  ) {
    await this.d.s3.send(
      new PutObjectCommand({
        Bucket: this.d.bucket,
        Key: this.bodyKey(id),
        Body: JSON.stringify(input.body),
        ContentType: "application/json",
      }),
    );
    await this.d.doc.send(
      new PutCommand({
        TableName: this.d.table,
        Item: {
          PK: `POST#${id}`,
          SK: "META",
          GSI1PK: "POST",
          GSI1SK: publishedAt ?? updatedAt,
          GSI2PK: `SLUG#${input.slug}`,
          id,
          slug: input.slug,
          title: input.title,
          excerpt: input.excerpt,
          tags: input.tags,
          coverImage: input.coverImage,
          status: input.status,
          publishedAt,
          updatedAt,
          bodyKey: this.bodyKey(id),
        },
      }),
    );
  }

  async create(input: PostInput): Promise<PostMeta> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const publishedAt = input.status === "published" ? now : null;
    await this.writeItem(id, input, publishedAt, now);
    return {
      id,
      slug: input.slug,
      title: input.title,
      excerpt: input.excerpt,
      tags: input.tags,
      coverImage: input.coverImage,
      status: input.status,
      publishedAt,
      updatedAt: now,
    };
  }

  async update(id: string, input: PostInput): Promise<PostMeta | null> {
    const existing = await this.d.doc.send(
      new GetCommand({ TableName: this.d.table, Key: { PK: `POST#${id}`, SK: "META" } }),
    );
    if (!existing.Item) return null;
    const now = new Date().toISOString();
    const publishedAt =
      input.status === "published" ? ((existing.Item.publishedAt as string) ?? now) : null;
    await this.writeItem(id, input, publishedAt, now);
    return {
      id,
      slug: input.slug,
      title: input.title,
      excerpt: input.excerpt,
      tags: input.tags,
      coverImage: input.coverImage,
      status: input.status,
      publishedAt,
      updatedAt: now,
    };
  }

  async remove(id: string): Promise<boolean> {
    await this.d.doc.send(
      new DeleteCommand({ TableName: this.d.table, Key: { PK: `POST#${id}`, SK: "META" } }),
    );
    await this.d.s3.send(
      new DeleteObjectCommand({ Bucket: this.d.bucket, Key: this.bodyKey(id) }),
    );
    return true;
  }

  async presignUpload(contentType: string): Promise<{ url: string; key: string }> {
    const ext = contentType.split("/")[1] ?? "bin";
    const key = `media/${randomUUID()}.${ext}`;
    const url = await getSignedUrl(
      this.d.s3,
      new PutObjectCommand({ Bucket: this.d.bucket, Key: key, ContentType: contentType }),
      { expiresIn: 300 },
    );
    return { url, key };
  }
}
