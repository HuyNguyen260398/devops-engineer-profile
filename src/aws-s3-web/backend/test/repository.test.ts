import { describe, it, expect, beforeEach } from "vitest";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { Repository } from "../src/lib/repository";

const ddb = mockClient(DynamoDBDocumentClient);
const s3 = mockClient(S3Client);

function repo() {
  return new Repository({
    doc: ddb as unknown as DynamoDBDocumentClient,
    s3: s3 as unknown as S3Client,
    table: "t",
    bucket: "b",
  });
}

beforeEach(() => {
  ddb.reset();
  s3.reset();
});

describe("Repository.listPublished", () => {
  it("queries gsi1 and maps items", async () => {
    ddb.on(QueryCommand).resolves({
      Items: [
        {
          id: "1",
          slug: "a",
          title: "A",
          status: "published",
          publishedAt: "2026-01-01",
          updatedAt: "2026-01-01",
          excerpt: "",
          tags: [],
          coverImage: null,
        },
      ],
    });
    const posts = await repo().listPublished();
    expect(posts).toHaveLength(1);
    expect(posts[0].slug).toBe("a");
  });
});

describe("Repository.create", () => {
  it("writes body to s3 and metadata to dynamo", async () => {
    ddb.on(PutCommand).resolves({});
    const meta = await repo().create({
      title: "New",
      slug: "new",
      excerpt: "",
      tags: [],
      coverImage: null,
      status: "published",
      body: { type: "doc", content: [] },
    });
    expect(meta.id).toBeTruthy();
    expect(meta.slug).toBe("new");
    expect(s3.calls().length).toBeGreaterThan(0);
  });
});
