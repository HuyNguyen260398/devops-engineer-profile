"""
ETL Loader Lambda
-----------------
Invoked asynchronously by the orchestrator after Bedrock content extraction.

Flow:
  1. Validate data contract (schema_version — REC-016)
  2. Derive deterministic article_id from source path (REC-001 — idempotent upserts)
  3. Write clean Markdown to S3 clean bucket at {year}/{month}/{filename}
  4. Write metadata JSON sidecar at metadata/{year}/{month}/{article_id}.json (for Athena/Glue)
  5. Write DynamoDB item (PutItem — idempotent due to deterministic PK)
"""

import hashlib
import json
import logging
import os
import re
from datetime import datetime, timezone

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3_client = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")

SCHEMA_VERSION = "1.0"


def handler(event: dict, context) -> dict:
    correlation_id = event.get("correlation_id", context.aws_request_id)

    def log(msg: str, **kwargs):
        logger.info(json.dumps({"correlation_id": correlation_id, "msg": msg, **kwargs}))

    # ── 1. Validate data contract (REC-016) ───────────────────────────────────
    schema_version = event.get("schema_version")
    if schema_version != SCHEMA_VERSION:
        raise ValueError(
            f"Unsupported schema_version: {schema_version!r}. "
            f"Expected '{SCHEMA_VERSION}'. Check orchestrator deployment."
        )

    source_bucket: str = event["source_bucket"]
    source_key: str = event["source_key"]
    clean_content: str = event["clean_content"]

    log("Loader started", source_bucket=source_bucket, source_key=source_key)

    # ── 2. Deterministic article_id from source path (REC-001) ────────────────
    # sha256(source_bucket/source_key) — same source always produces same ID.
    # PutItem with the same PK is a safe upsert, preventing duplicates on retry.
    article_id = hashlib.sha256(
        f"{source_bucket}/{source_key}".encode()
    ).hexdigest()[:16]

    now = datetime.now(timezone.utc)
    year = now.strftime("%Y")
    month = now.strftime("%m")
    filename = os.path.basename(source_key)
    clean_bucket = os.environ["CLEAN_BUCKET_NAME"]

    # ── 3. Write clean Markdown ───────────────────────────────────────────────
    clean_key = f"{year}/{month}/{filename}"
    s3_client.put_object(
        Bucket=clean_bucket,
        Key=clean_key,
        Body=clean_content.encode("utf-8"),
        ContentType="text/markdown; charset=utf-8",
    )
    log("Wrote clean Markdown", clean_key=clean_key)

    # ── 4. Write metadata sidecar JSON for Athena/Glue (REC-004) ─────────────
    title = _extract_title(clean_content)
    word_count = len(clean_content.split())
    source_url = _derive_source_url(source_key)
    created_at = now.isoformat()

    metadata = {
        "article_id": article_id,
        "title": title,
        "word_count": word_count,
        "s3_key": clean_key,
        "source_url": source_url,
        "created_at": created_at,
        "status": "PUBLISHED",
        "extraction_model": event.get("extraction_model", ""),
    }

    metadata_key = f"metadata/{year}/{month}/{article_id}.json"
    s3_client.put_object(
        Bucket=clean_bucket,
        Key=metadata_key,
        Body=json.dumps(metadata, ensure_ascii=False).encode("utf-8"),
        ContentType="application/json; charset=utf-8",
    )
    log("Wrote metadata sidecar", metadata_key=metadata_key)

    # ── 5. Write DynamoDB item (idempotent PutItem) ───────────────────────────
    table = dynamodb.Table(os.environ["DYNAMODB_TABLE_NAME"])
    table.put_item(
        Item={
            "article_id": article_id,
            "title": title,
            "word_count": word_count,
            "s3_key": clean_key,
            "source_url": source_url,
            "created_at": created_at,
            "status": "PUBLISHED",
        }
    )
    log("Wrote DynamoDB item", article_id=article_id, title=title, word_count=word_count)

    return {
        "status": "ok",
        "article_id": article_id,
        "clean_key": clean_key,
        "correlation_id": correlation_id,
    }


def _extract_title(content: str) -> str:
    """Extract the first H1 heading from Markdown. Falls back to 'Untitled'."""
    match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
    return match.group(1).strip() if match else "Untitled"


def _derive_source_url(source_key: str) -> str:
    """
    Derive a human-readable source URL from the filename convention:
      {sanitized-domain}_{timestamp}.md  →  sanitized-domain (underscores → dots)
    Example: example_com_20240401T120000.md → example.com
    """
    filename = os.path.basename(source_key)
    name_without_ext = os.path.splitext(filename)[0]
    # Convention: last part after final underscore is a timestamp
    parts = name_without_ext.rsplit("_", 1)
    domain_part = parts[0] if len(parts) == 2 else name_without_ext
    return domain_part.replace("_", ".")
