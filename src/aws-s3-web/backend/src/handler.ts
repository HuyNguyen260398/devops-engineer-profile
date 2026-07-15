import type {
  APIGatewayProxyHandler,
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { Repository } from "./lib/repository";
import { validatePostInput } from "./lib/validation";
import { json, error } from "./lib/response";

function isAuthed(event: APIGatewayProxyEvent): boolean {
  return Boolean((event.requestContext as unknown as { authorizer?: { claims?: unknown } })?.authorizer?.claims);
}

export function createHandler(repo: Repository) {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const { httpMethod, resource } = event;
    try {
      if (httpMethod === "GET" && resource === "/posts") {
        return json(200, isAuthed(event) ? await repo.listAll() : await repo.listPublished());
      }
      if (httpMethod === "GET" && resource === "/posts/{key}") {
        const post = await repo.getBySlug(event.pathParameters!.key!, isAuthed(event));
        return post ? json(200, post) : error(404, "not found");
      }

      if (!isAuthed(event)) return error(401, "unauthorized");

      if (httpMethod === "GET" && resource === "/drafts") {
        return json(200, await repo.listDrafts());
      }
      if (httpMethod === "POST" && resource === "/posts") {
        const v = validatePostInput(JSON.parse(event.body ?? "{}"));
        if (!v.ok) return error(400, v.error);
        return json(201, await repo.create(v.value));
      }
      if (httpMethod === "PUT" && resource === "/posts/{key}") {
        const v = validatePostInput(JSON.parse(event.body ?? "{}"));
        if (!v.ok) return error(400, v.error);
        const updated = await repo.update(event.pathParameters!.key!, v.value);
        return updated ? json(200, updated) : error(404, "not found");
      }
      if (httpMethod === "DELETE" && resource === "/posts/{key}") {
        await repo.remove(event.pathParameters!.key!);
        return json(204, {});
      }
      if (httpMethod === "POST" && resource === "/uploads") {
        const { contentType } = JSON.parse(event.body ?? "{}");
        if (!/^image\/(png|jpeg|gif|webp)$/.test(contentType ?? "")) {
          return error(400, "invalid content type");
        }
        return json(200, await repo.presignUpload(contentType));
      }
      return error(404, "not found");
    } catch (e) {
      console.error(e);
      return error(500, "internal error");
    }
  };
}

const repo = new Repository({
  doc: DynamoDBDocumentClient.from(new DynamoDBClient({})),
  s3: new S3Client({}),
  table: process.env.TABLE_NAME!,
  bucket: process.env.MEDIA_BUCKET!,
});

export const handler: APIGatewayProxyHandler = (event) => createHandler(repo)(event);
