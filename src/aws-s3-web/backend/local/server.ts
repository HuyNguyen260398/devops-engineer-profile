import { createServer, type IncomingMessage } from "node:http";
import type { APIGatewayProxyEvent } from "aws-lambda";

import { createHandler } from "../src/handler";
import type { Repository } from "../src/lib/repository";
import { InMemoryRepository } from "./in-memory-repository";

const PORT = Number(process.env.PORT ?? 3001);
const DEV_TOKEN = "local-dev";

const repo = new InMemoryRepository();
// The in-memory repo implements the same public methods the handler calls; the
// cast is only needed because Repository has private fields (dev-only script).
const handler = createHandler(repo as unknown as Repository);

function readRaw(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// Maps an incoming request onto the API Gateway proxy event shape the handler
// expects. Returns null for paths the API does not define.
function buildEvent(
  method: string,
  path: string,
  body: string,
  authed: boolean,
): APIGatewayProxyEvent | null {
  let resource: string | null = null;
  let pathParameters: Record<string, string> | null = null;

  if (path === "/posts") {
    resource = "/posts";
  } else if (/^\/posts\/[^/]+$/.test(path)) {
    resource = "/posts/{key}";
    pathParameters = { key: decodeURIComponent(path.split("/")[2]) };
  } else if (path === "/uploads") {
    resource = "/uploads";
  }

  if (!resource) return null;

  return {
    httpMethod: method,
    resource,
    path,
    pathParameters,
    body: body || null,
    headers: {},
    requestContext: {
      authorizer: authed ? { claims: { sub: "local-admin", email: "admin@local" } } : null,
    },
  } as unknown as APIGatewayProxyEvent;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    const path = url.pathname;
    const method = req.method ?? "GET";
    const authed = (req.headers.authorization ?? "").toLowerCase() === `bearer ${DEV_TOKEN}`;

    // Root / health: the API itself has no "/" route, so browsers hitting the
    // root previously got {"error":"no route"}. Return a short usage index.
    if (method === "GET" && (path === "/" || path === "/health")) {
      res.writeHead(200, { "content-type": "application/json" }).end(
        JSON.stringify(
          {
            service: "blog backend (in-memory dev harness)",
            authHeader: `Authorization: Bearer ${DEV_TOKEN}`,
            routes: {
              "GET /posts": "list published (add auth header to include drafts)",
              "GET /posts/{slug}": "read one post with body",
              "POST /posts": "create (auth)",
              "PUT /posts/{id}": "update (auth)",
              "DELETE /posts/{id}": "delete (auth)",
              "POST /uploads": "presign an image upload (auth)",
            },
          },
          null,
          2,
        ),
      );
      return;
    }

    // Dev-only image endpoints (these live outside the Lambda in real AWS: they
    // are the presigned S3 PUT target and the CloudFront /media/* read path).
    if (method === "PUT" && path.startsWith("/_upload/")) {
      const key = decodeURIComponent(path.slice("/_upload/".length));
      repo.putBlob(key, req.headers["content-type"] ?? "application/octet-stream", await readRaw(req));
      res.writeHead(200).end("ok");
      return;
    }
    if (method === "GET" && path.startsWith("/media/")) {
      const blob = repo.getBlob(decodeURIComponent(path.slice(1)));
      if (!blob) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { "content-type": blob.contentType }).end(blob.data);
      return;
    }

    const bodyText = method === "GET" || method === "DELETE" ? "" : (await readRaw(req)).toString("utf8");
    const event = buildEvent(method, path, bodyText, authed);
    if (!event) {
      res.writeHead(404, { "content-type": "application/json" }).end(JSON.stringify({ error: "no route" }));
      return;
    }

    const result = await handler(event, {} as never, () => {});
    res.writeHead(result.statusCode, result.headers as Record<string, string>).end(result.body);
  } catch (e) {
    res.writeHead(500, { "content-type": "application/json" }).end(JSON.stringify({ error: String(e) }));
  }
});

server.listen(PORT, () => {
  /* eslint-disable no-console */
  console.log(`\n  blog backend (in-memory) → http://localhost:${PORT}\n`);
  console.log("  Public:");
  console.log(`    curl http://localhost:${PORT}/posts`);
  console.log(`    curl http://localhost:${PORT}/posts/<slug>`);
  console.log("\n  Admin (add:  -H 'Authorization: Bearer local-dev'):");
  console.log(
    `    curl -X POST http://localhost:${PORT}/posts -H 'Authorization: Bearer local-dev' \\\n` +
      `      -H 'content-type: application/json' \\\n` +
      `      -d '{"title":"Hello","excerpt":"hi","tags":["aws"],"coverImage":null,"status":"published","body":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"First post."}]}]}}'`,
  );
  console.log("");
  /* eslint-enable no-console */
});
