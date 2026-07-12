# Local backend harness (no AWS, no Docker)

Runs the **real Lambda handler** (`../src/handler.ts`) behind a small HTTP server,
backed by an in-memory Map repository instead of DynamoDB + S3. Use it to exercise
the full CRUD / auth / validation flow before deploying to AWS.

```bash
cd src/aws-s3-web/backend
pnpm install
pnpm local:dev            # → http://localhost:3001  (override with PORT=…)
```

## Auth

There is no Cognito locally. Send the dev token to act as the admin:

```
-H 'Authorization: Bearer local-dev'
```

Requests without it are treated as anonymous — they can read published posts but
get `401` on writes, exactly like the deployed API.

## Examples

```bash
# public: list published, read one
curl http://localhost:3001/posts
curl http://localhost:3001/posts/<slug>

# admin: create (derives slug from title), then it appears in the public list
curl -X POST http://localhost:3001/posts \
  -H 'Authorization: Bearer local-dev' -H 'content-type: application/json' \
  -d '{"title":"Hello DevOps","excerpt":"first","tags":["aws"],"coverImage":null,"status":"published","body":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"First post."}]}]}}'

# admin: list including drafts
curl http://localhost:3001/posts -H 'Authorization: Bearer local-dev'

# image round-trip: presign → PUT bytes → read back via /media/*
curl -X POST http://localhost:3001/uploads -H 'Authorization: Bearer local-dev' \
  -H 'content-type: application/json' -d '{"contentType":"image/png"}'
#   → { "url": "http://localhost:3001/_upload/media/<uuid>.png", "key": "media/<uuid>.png" }
```

## Fidelity

- **Tested:** routing, the Cognito-authorizer gate (via the dev token), input
  validation, slug derivation, draft-vs-published filtering, and the presign →
  upload → read image flow.
- **Not tested (needs AWS or LocalStack):** real DynamoDB query/GSI behavior, S3
  object semantics, the VPC/endpoint networking, and real Cognito JWT validation.

Data lives only in memory — restarting the server clears everything.
